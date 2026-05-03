const logger = require("../utils/logger");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const pool = require("../config/db");
const path = require("path");
const fs = require("fs");

class PaymentController {
  static async handleStripeWebhook(req, res) {
    const sig = req.headers["stripe-signature"];
    
    // --- KHỐI CHẨN ĐOÁN HỆ THỐNG (DIAGNOSTICS) ---
    // Kiểm tra sự tồn tại của file .env nếu biến môi trường bị trống
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      const envPath = path.resolve(process.cwd(), ".env");
      console.log("\n[CẢNH BÁO HỆ THỐNG] Biến môi trường đang bị trống!");
      console.log(`- Vị trí Terminal đang đứng (CWD): ${process.cwd()}`);
      console.log(`- Hệ thống đang tìm file .env tại: ${envPath}`);
      console.log(`- File có tồn tại vật lý không?: ${fs.existsSync(envPath) ? "CÓ" : "KHÔNG"}`);
    }

    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    // --- TRẠM KIỂM SOÁT TÌM ROOT CAUSE (DEBUG LOGS) ---
    console.log("\n=== KIỂM TRA LỖI WEBHOOK BỊ 400 ===");
    console.log("1. Dữ liệu req.body:", Buffer.isBuffer(req.body) ? "Chuẩn (Buffer)" : `LỖI KIẾN TRÚC (${typeof req.body}) - Express đã parse mất dữ liệu thô!`);
    console.log("2. Mã Secret Node.js đang lưu RAM:", endpointSecret || "RỖNG (NULL)");
    console.log("3. Tình trạng so khớp mã:", endpointSecret === "whsec_c693c0a4c785b2478bd63b0b00444c5128a9a72b5bbe387109537aa5fd2a1e98" ? "TRÙNG KHỚP" : "LỆCH MÃ (Vui lòng kiểm tra lại .env và Restart Server)");
    console.log("====================================\n");

    let event;

    // 1. Xác thực chữ ký Stripe
    try {
      if (!endpointSecret) {
        throw new Error("Chưa cấu hình STRIPE_WEBHOOK_SECRET trong .env hoặc server chưa nạp biến môi trường.");
      }
      
      // Sử dụng constructEvent để xác thực tính toàn vẹn dữ liệu
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      logger.error(`[Webhook Error] Xác thực thất bại: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // 2. Xử lý sự kiện khi thanh toán hoàn tất
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      // Trích xuất metadata auction_id được gửi từ Frontend/Checkout session
      const auctionId = session.metadata?.auction_id;
      if (!auctionId) {
        logger.warn("[Webhook] Nhận session thành công nhưng thiếu metadata auction_id");
        return res.status(200).json({ received: true });
      }

      const finalAmount = session.amount_total / 100;
      logger.info(`[Webhook Nhận] Thanh toán $${finalAmount} thành công cho phiên đấu giá ${auctionId}`);

      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        // Kiểm tra trạng thái hiện tại và sử dụng FOR UPDATE để tránh Race Condition
        const [rows] = await connection.execute(
          "SELECT status FROM Auctions WHERE id = ? FOR UPDATE",
          [auctionId]
        );

        if (!rows.length) {
          logger.error(`[Webhook Error] Không tìm thấy phiên đấu giá ID: ${auctionId}`);
          await connection.rollback();
          return res.status(200).json({ received: true, warning: "Auction not found" });
        }

        // Nếu phiên đã hoàn thành trước đó (do webhook gửi trùng hoặc xử lý nhanh)
        if (rows[0].status === "Completed") {
          logger.info(`[Webhook Skip] Phiên ${auctionId} đã được xử lý trước đó. Bỏ qua.`);
          await connection.rollback();
          return res.status(200).json({ received: true, skipped: true });
        }

        // Cập nhật trạng thái và lưu Stripe Session ID để đối soát sau này
        await connection.execute(
          "UPDATE Auctions SET status = 'Completed', stripe_session_id = ? WHERE id = ?",
          [session.id, auctionId]
        );

        await connection.commit();
        logger.success(`[DB Sync] Đã chốt đơn thành công phiên ${auctionId} | Stripe ID: ${session.id}`);
      } catch (dbError) {
        if (connection) await connection.rollback();
        logger.error(`[Webhook Lỗi DB]: ${dbError.message}`);
        return res.status(500).json({ error: "Database error during processing" });
      } finally {
        if (connection) connection.release();
      }
    }

    // Luôn trả về 200 để xác nhận với Stripe rằng server đã nhận được dữ liệu
    res.status(200).json({ received: true });
  }
}

module.exports = PaymentController;
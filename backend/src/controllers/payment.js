const logger = require("../utils/logger");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const pool = require("../config/db");

class PaymentController {
  static async handleStripeWebhook(req, res) {
    const sig = req.headers["stripe-signature"];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    // 1. Xác thực tính toàn vẹn của dữ liệu từ Stripe
    try {
      if (!endpointSecret) {
        throw new Error("STRIPE_WEBHOOK_SECRET chưa được cấu hình trong biến môi trường.");
      }
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      logger.error(`[Webhook Error] Xác thực thất bại: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // 2. Xử lý khi checkout hoàn tất
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const type = session.metadata?.type;
      const auctionId = session.metadata?.auction_id;

      if (!auctionId) {
        logger.warn("[Webhook] Nhận session thành công nhưng thiếu metadata auction_id");
        return res.status(200).json({ received: true });
      }

      // ----------------------------------------------------
      // XỬ LÝ THANH TOÁN ĐẶT CỌC (DEPOSIT)
      // ----------------------------------------------------
      if (type === "deposit") {
        try {
          // Lưu payment_intent để Worker xử lý refund sau này
          await pool.execute(
            `UPDATE auction_deposits 
             SET status = 'SUCCEEDED', provider_payment_id = ?, paid_at = NOW() 
             WHERE stripe_session_id = ?`,
            [session.payment_intent, session.id]
          );
          logger.success(`[Webhook] User đã đặt cọc thành công cho phiên ${auctionId}`);
        } catch (e) {
          logger.error(`[Webhook Deposit Lỗi DB]: ${e.message}`);
        }
        return res.status(200).json({ received: true });
      }

      // ----------------------------------------------------
      // XỬ LÝ THANH TOÁN CUỐI CÙNG (WIN_PAYMENT)
      // ----------------------------------------------------
      if (type === "win_payment" || !type) {
        const connection = await pool.getConnection();
        try {
          await connection.beginTransaction();

          // Kiểm tra trạng thái và khóa bản ghi để cập nhật (Pessimistic Locking)
          const [rows] = await connection.execute(
            "SELECT status FROM Auctions WHERE id = ? FOR UPDATE",
            [auctionId]
          );

          if (!rows.length) {
            logger.error(`[Webhook Error] Không tìm thấy phiên đấu giá ID: ${auctionId}`);
            await connection.rollback();
            return res.status(200).json({ received: true });
          }

          if (rows[0].status === "Completed") {
            logger.info(`[Webhook Skip] Phiên ${auctionId} đã được xử lý rồi. Bỏ qua.`);
            await connection.rollback();
            return res.status(200).json({ received: true });
          }

          // Cập nhật trạng thái và lưu Stripe Session ID để đối soát
          await connection.execute(
            "UPDATE Auctions SET status = 'Completed', stripe_session_id = ? WHERE id = ?",
            [session.id, auctionId]
          );

          await connection.commit();
          logger.success(`[DB Sync] Đã chốt đơn thành công phiên ${auctionId} | Stripe Session: ${session.id}`);
        } catch (dbError) {
          if (connection) await connection.rollback();
          logger.error(`[Webhook Lỗi DB]: ${dbError.message}`);
          return res.status(500).json({ error: "Lỗi xử lý cơ sở dữ liệu" });
        } finally {
          if (connection) connection.release();
        }
      }
    }

    // Luôn trả về 200 để Stripe không gửi lại webhook
    res.status(200).json({ received: true });
  }
}

module.exports = PaymentController;
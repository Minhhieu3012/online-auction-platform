const logger = require("../utils/logger");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const pool = require("../config/db");

class PaymentController {
  static async handleStripeWebhook(req, res) {
    const sig = req.headers["stripe-signature"];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event;

    // 1. Xác thực bảo mật với Stripe
    try {
      if (!endpointSecret) throw new Error("Thiếu STRIPE_WEBHOOK_SECRET");
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

      // Lấy loại giao dịch từ metadata do Frontend cấu hình lúc gọi Stripe
      const paymentType = session.metadata?.payment_type; // 'deposit' hoặc 'settlement'
      const auctionId = session.metadata?.auction_id;
      const userId = session.metadata?.user_id;

      if (!auctionId || !userId) {
        logger.warn("[Webhook] Thiếu metadata auction_id hoặc user_id. Bỏ qua.");
        return res.status(200).json({ received: true });
      }

      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        if (paymentType === "deposit") {
          // Nghiệp vụ 1: User thanh toán TIỀN CỌC ĐẤU GIÁ
          await connection.execute(
            `UPDATE auction_deposits 
                 SET status = 'SUCCEEDED', stripe_session_id = ?, paid_at = NOW() 
                 WHERE auction_id = ? AND user_id = ? AND status = 'PENDING'`,
            [session.id, auctionId, userId],
          );

          // Lưu lịch sử Giao dịch
          await connection.execute(
            `INSERT INTO Transactions (user_id, auction_id, amount, type, status, provider_session_id) 
                 VALUES (?, ?, ?, 'AUCTION_DEPOSIT', 'SUCCESS', ?)`,
            [userId, auctionId, session.amount_total / 100, session.id],
          );
          logger.success(`[Payment] User #${userId} nạp Cọc thành công cho Lô #${auctionId}`);
        } else if (paymentType === "settlement") {
          // Nghiệp vụ 2: Winner THANH TOÁN TIỀN THẮNG CUỘC
          await connection.execute(
            `UPDATE auction_settlements 
                 SET status = 'PAID', stripe_session_id = ?, paid_at = NOW() 
                 WHERE auction_id = ? AND winner_id = ?`,
            [session.id, auctionId, userId],
          );

          // Cập nhật trạng thái Lô hàng thành Hoàn Tất
          await connection.execute(`UPDATE Auctions SET status = 'Completed' WHERE id = ?`, [auctionId]);

          // Lưu lịch sử Giao dịch
          await connection.execute(
            `INSERT INTO Transactions (user_id, auction_id, amount, type, status, provider_session_id) 
                 VALUES (?, ?, ?, 'WIN_FULL_PAYMENT', 'SUCCESS', ?)`,
            [userId, auctionId, session.amount_total / 100, session.id],
          );
          logger.success(`[Payment] Winner #${userId} đã thanh toán chốt đơn Lô #${auctionId}`);
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

    // Phải trả về 200 để Stripe không gọi lại liên tục
    res.status(200).json({ received: true });
  }
}

module.exports = PaymentController;

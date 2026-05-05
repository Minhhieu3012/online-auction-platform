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

      // Hợp nhất Metadata để tránh lỗi khai báo trùng lặp (Redeclaration)
      const auctionId = session.metadata?.auction_id;
      const userId = session.metadata?.user_id;
      const paymentType = session.metadata?.payment_type || session.metadata?.type;

      if (!auctionId || !userId) {
        logger.warn("[Webhook] Thiếu metadata auction_id hoặc user_id. Bỏ qua.");
        return res.status(200).json({ received: true });
      }

      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        // ----------------------------------------------------
        // NGHIỆP VỤ 1: THANH TOÁN TIỀN CỌC (DEPOSIT)
        // ----------------------------------------------------
        if (paymentType === "deposit") {
          await connection.execute(
            `UPDATE auction_deposits 
             SET status = 'SUCCEEDED', stripe_session_id = ?, paid_at = NOW() 
             WHERE auction_id = ? AND user_id = ? AND status = 'PENDING'`,
            [session.id, auctionId, userId],
          );

          await connection.execute(
            `INSERT INTO Transactions (user_id, auction_id, amount, type, status, provider_session_id) 
             VALUES (?, ?, ?, 'AUCTION_DEPOSIT', 'SUCCESS', ?)`,
            [userId, auctionId, session.amount_total / 100, session.id],
          );
          logger.success(`[Payment] User #${userId} nạp Cọc thành công cho Lô #${auctionId}`);
        }

        // ----------------------------------------------------
        // NGHIỆP VỤ 2: THANH TOÁN CHỐT ĐƠN (SETTLEMENT / WIN_PAYMENT)
        // ----------------------------------------------------
        else if (paymentType === "settlement" || paymentType === "win_payment" || !paymentType) {
          // Khóa bản ghi (Pessimistic Locking)
          const [rows] = await connection.execute("SELECT status FROM Auctions WHERE id = ? FOR UPDATE", [auctionId]);

          if (!rows.length) {
            throw new Error(`Không tìm thấy phiên đấu giá ID: ${auctionId}`);
          }

          if (rows[0].status === "Completed") {
            logger.info(`[Webhook Skip] Phiên ${auctionId} đã được xử lý. Bỏ qua.`);
            await connection.rollback();
            connection.release(); // Giải phóng connection ngay lập tức
            return res.status(200).json({ received: true });
          }

          // Update bảng Settlements nếu có
          if (paymentType === "settlement") {
            await connection.execute(
              `UPDATE auction_settlements 
               SET status = 'PAID', stripe_session_id = ?, paid_at = NOW() 
               WHERE auction_id = ? AND winner_id = ?`,
              [session.id, auctionId, userId],
            );
          }

          // Chốt trạng thái Auction và lưu Transaction
          await connection.execute("UPDATE Auctions SET status = 'Completed', stripe_session_id = ? WHERE id = ?", [
            session.id,
            auctionId,
          ]);

          await connection.execute(
            `INSERT INTO Transactions (user_id, auction_id, amount, type, status, provider_session_id) 
             VALUES (?, ?, ?, 'WIN_FULL_PAYMENT', 'SUCCESS', ?)`,
            [userId, auctionId, session.amount_total / 100, session.id],
          );

          logger.success(`[DB Sync] Đã chốt đơn thành công phiên ${auctionId} | Stripe Session: ${session.id}`);
        }

        // Cam kết lưu toàn bộ dữ liệu vào MySQL
        await connection.commit();
        return res.status(200).json({ received: true });
      } catch (dbError) {
        // Rollback lập tức nếu có bất kỳ lỗi truy vấn nào
        await connection.rollback();
        logger.error(`[Webhook Lỗi DB]: ${dbError.message}`);
        return res.status(500).json({ error: "Lỗi xử lý cơ sở dữ liệu" });
      } finally {
        // LUÔN LUÔN trả connection về lại Pool dù thành công hay thất bại
        connection.release();
      }
    }

    // Response mặc định cho các sự kiện Stripe khác
    res.status(200).json({ received: true });
  }
}

module.exports = PaymentController;

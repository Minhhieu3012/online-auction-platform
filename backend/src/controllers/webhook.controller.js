const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const pool = require('../config/db');
const logger = require('../utils/logger');

class WebhookController {
  /**
   * API: POST /api/webhook
   * Lưu ý: Route này trong Express phải được cấu hình dùng express.raw({type: 'application/json'}) 
   * trước khi đi qua express.json()
   */
  static async handleStripeWebhook(req, res) {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      // Xác thực chữ ký để đảm bảo request thực sự đến từ Stripe
      event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      logger.error(`[Stripe Webhook Error] Lỗi chữ ký: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Xử lý sự kiện thanh toán thành công
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const stripeSessionId = session.id;

      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        // 1. Chuyển trạng thái Phiên đấu giá sang Completed
        const [aucUpdate] = await connection.execute(
          `UPDATE Auctions 
           SET status = 'Completed' 
           WHERE stripe_session_id = ? AND status = 'Payment Pending'`,
          [stripeSessionId]
        );

        if (aucUpdate.affectedRows > 0) {
          // 2. Chuyển trạng thái Giao dịch sang SUCCESS
          await connection.execute(
            `UPDATE Transactions 
             SET status = 'SUCCESS' 
             WHERE provider_transaction_id = ?`,
            [stripeSessionId]
          );
          
          logger.success(`[Payment Success] Giao dịch ${stripeSessionId} hoàn tất. Đã chốt phiên đấu giá!`);
        } else {
          logger.warn(`[Payment Warning] Nhận được webhook cho session ${stripeSessionId} nhưng không tìm thấy phiên chờ thanh toán hợp lệ.`);
        }

        await connection.commit();
      } catch (dbError) {
        await connection.rollback();
        logger.error("[DB Webhook Error]:", dbError.message);
      } finally {
        connection.release();
      }
    }

    // Luôn trả về 200 OK cho Stripe để họ không gửi lại webhook
    res.json({ received: true });
  }
}

module.exports = WebhookController;
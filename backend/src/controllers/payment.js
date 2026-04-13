const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const pool = require("../config/db");

class PaymentController {
  static async handleStripeWebhook(req, res) {
    const sig = req.headers["stripe-signature"];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    // 1. Xác thực chữ ký Stripe
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error(`[Webhook Error] Sai chữ ký: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // 2. Xử lý khi thanh toán thành công
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const auctionId = session.metadata?.auction_id;
      if (!auctionId) {
        console.error("[Webhook Error] Thiếu auction_id trong metadata");
        return res.status(200).json({ received: true, warning: "Missing auction_id" });
      }

      const finalAmount = session.amount_total / 100;
      console.log(`[Webhook Nhận] Thanh toán $${finalAmount} cho phiên ${auctionId}`);

      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        const [rows] = await connection.execute("SELECT status FROM Auctions WHERE id = ? FOR UPDATE", [auctionId]);

        if (!rows.length) {
          console.error(`[Webhook Error] Không tìm thấy phiên ${auctionId}`);
          await connection.rollback();
          return res.status(200).json({ received: true, warning: "Auction not found" });
        }

        if (rows[0].status === "Completed") {
          console.log(`[Webhook Skip] Phiên ${auctionId} đã được xử lý rồi, bỏ qua.`);
          await connection.rollback();
          return res.status(200).json({ received: true, skipped: true });
        }

        await connection.execute("UPDATE Auctions SET status = 'Completed', stripe_session_id = ? WHERE id = ?", [
          session.id,
          auctionId,
        ]);

        await connection.commit();
        console.log(`[DB Sync] Đã chốt đơn thành công phiên ${auctionId} | Stripe Session: ${session.id}`);
      } catch (dbError) {
        await connection.rollback();
        console.error(`[Webhook Lỗi DB]: ${dbError.message}`);
        return res.status(500).json({ error: "Database error, will retry" });
      } finally {
        connection.release();
      }
    }

    res.status(200).json({ received: true });
  }
}

module.exports = PaymentController;

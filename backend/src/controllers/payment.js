const logger = require("../utils/logger");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const pool = require("../config/db");
const NotificationService = require("../services/notificationService");

function getSessionAmount(session) {
  return Number(session.amount_total || 0) / 100;
}

function getPaymentType(session) {
  return String(session.metadata?.payment_type || session.metadata?.type || "win_payment")
    .trim()
    .toLowerCase();
}

async function insertTransaction(connection, payload) {
  await connection.execute(
    `
      INSERT INTO Transactions (
        user_id,
        auction_id,
        deposit_id,
        settlement_id,
        amount,
        type,
        status,
        payment_provider,
        provider_transaction_id,
        provider_session_id,
        metadata
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      payload.userId,
      payload.auctionId || null,
      payload.depositId || null,
      payload.settlementId || null,
      payload.amount,
      payload.type,
      payload.status || "SUCCESS",
      payload.paymentProvider || "STRIPE",
      payload.providerTransactionId || null,
      payload.providerSessionId || null,
      payload.metadata ? JSON.stringify(payload.metadata) : null,
    ],
  );
}

class PaymentController {
  static async handleStripeWebhook(req, res) {
    const signature = req.headers["stripe-signature"];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
      if (!endpointSecret) {
        throw new Error("STRIPE_WEBHOOK_SECRET chưa được cấu hình.");
      }

      event = stripe.webhooks.constructEvent(req.body, signature, endpointSecret);
    } catch (error) {
      logger.error(`[Webhook Error] Xác thực Stripe thất bại: ${error.message}`);
      return res.status(400).send(`Webhook Error: ${error.message}`);
    }

    if (event.type !== "checkout.session.completed") {
      return res.status(200).json({ received: true });
    }

    const session = event.data.object;
    const paymentType = getPaymentType(session);
    const auctionId = Number(session.metadata?.auction_id);
    const userId = Number(session.metadata?.user_id);
    const amount = getSessionAmount(session);

    if (!Number.isInteger(auctionId) || auctionId <= 0 || !Number.isInteger(userId) || userId <= 0) {
      logger.warn("[Webhook] Thiếu hoặc sai metadata auction_id/user_id. Bỏ qua.");
      return res.status(200).json({ received: true });
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      if (paymentType === "deposit") {
        const [depositRows] = await connection.execute(
          `
            SELECT id, status
            FROM auction_deposits
            WHERE auction_id = ? AND user_id = ?
            FOR UPDATE
          `,
          [auctionId, userId],
        );

        if (depositRows.length === 0) {
          await connection.execute(
            `
              INSERT INTO auction_deposits (
                auction_id,
                user_id,
                amount,
                status,
                payment_provider,
                stripe_session_id,
                paid_at
              )
              VALUES (?, ?, ?, 'SUCCEEDED', 'STRIPE', ?, NOW())
            `,
            [auctionId, userId, amount, session.id],
          );
        } else if (depositRows[0].status !== "SUCCEEDED") {
          await connection.execute(
            `
              UPDATE auction_deposits
              SET
                amount = ?,
                status = 'SUCCEEDED',
                stripe_session_id = ?,
                paid_at = NOW(),
                updated_at = NOW()
              WHERE id = ?
            `,
            [amount, session.id, depositRows[0].id],
          );
        }

        const [latestDepositRows] = await connection.execute(
          `
            SELECT id
            FROM auction_deposits
            WHERE auction_id = ? AND user_id = ?
            LIMIT 1
          `,
          [auctionId, userId],
        );

        await insertTransaction(connection, {
          userId,
          auctionId,
          depositId: latestDepositRows[0]?.id || null,
          amount,
          type: "AUCTION_DEPOSIT",
          providerSessionId: session.id,
          metadata: {
            stripe_session_id: session.id,
            source: "stripe_webhook",
          },
        });

        try {
          await NotificationService.notifyDepositSucceeded(connection, {
            userId,
            auctionId,
          });
        } catch (notificationError) {
          logger.warn(`[Payment] Không thể tạo thông báo đặt cọc: ${notificationError.message}`);
        }

        await connection.commit();

        logger.success(`[Payment] User #${userId} đặt cọc thành công cho phiên #${auctionId}`);
        return res.status(200).json({ received: true });
      }

      if (paymentType === "settlement" || paymentType === "win_payment") {
        const [settlementRows] = await connection.execute(
          `
            SELECT id, status
            FROM auction_settlements
            WHERE auction_id = ? AND winner_id = ?
            FOR UPDATE
          `,
          [auctionId, userId],
        );

        const settlementId = settlementRows[0]?.id || null;

        if (settlementId) {
          await connection.execute(
            `
              UPDATE auction_settlements
              SET
                status = 'PAID',
                stripe_session_id = ?,
                paid_at = NOW(),
                updated_at = NOW()
              WHERE id = ?
            `,
            [session.id, settlementId],
          );
        }

        await connection.execute(
          `
            UPDATE Auctions
            SET
              status = 'Completed',
              stripe_session_id = ?,
              updated_at = NOW()
            WHERE id = ?
          `,
          [session.id, auctionId],
        );

        await insertTransaction(connection, {
          userId,
          auctionId,
          settlementId,
          amount,
          type: "WIN_FULL_PAYMENT",
          providerSessionId: session.id,
          metadata: {
            stripe_session_id: session.id,
            source: "stripe_webhook",
          },
        });

        try {
          await NotificationService.notifyPaymentSuccess(connection, {
            userId,
            winnerId: userId,
            auctionId,
          });
        } catch (notificationError) {
          logger.warn(`[Payment] Không thể tạo thông báo thanh toán: ${notificationError.message}`);
        }

        await connection.commit();

        logger.success(`[Payment] Winner #${userId} thanh toán thành công phiên #${auctionId}`);
        return res.status(200).json({ received: true });
      }

      await connection.rollback();
      logger.warn(`[Webhook] Loại thanh toán chưa hỗ trợ: ${paymentType}`);
      return res.status(200).json({ received: true });
    } catch (error) {
      await connection.rollback();
      logger.error(`[Webhook DB Error]: ${error.message}`);
      return res.status(500).json({ error: "Lỗi xử lý cơ sở dữ liệu." });
    } finally {
      connection.release();
    }
  }
}

module.exports = PaymentController;
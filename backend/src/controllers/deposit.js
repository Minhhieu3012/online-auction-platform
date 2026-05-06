const pool = require("../config/db");
const { sendSuccess, sendError } = require("../utils/response");
const logger = require("../utils/logger");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const PAID_DEPOSIT_STATUSES = new Set(["SUCCEEDED", "APPLIED_TO_WIN_PAYMENT"]);

function getClientUrl() {
  return String(process.env.CLIENT_URL || "http://127.0.0.1:5500/frontend/pages").replace(/\/$/, "");
}

/**
 * CLIENT_URL hiện tại của team đang trỏ vào /frontend/pages.
 * Stripe thanh toán phần còn lại thành công cần đưa user về trang index:
 * /frontend/index.html?payment=success&auction_id=...
 */
function getFrontendRootUrl() {
  const clientUrl = getClientUrl();

  if (clientUrl.endsWith("/pages")) {
    return clientUrl.slice(0, -"/pages".length);
  }

  return clientUrl.replace(/\/pages\/?$/, "");
}

function normalizeDepositStatus(status) {
  return String(status || "NONE")
    .trim()
    .toUpperCase();
}

function isPaidDepositStatus(status) {
  return PAID_DEPOSIT_STATUSES.has(normalizeDepositStatus(status));
}

function isStripeSessionPaid(session) {
  return (
    session &&
    (session.payment_status === "paid" ||
      session.status === "complete" ||
      session.status === "completed")
  );
}

function getStripePaymentIntentId(session) {
  if (!session) return null;

  if (typeof session.payment_intent === "string") {
    return session.payment_intent;
  }

  if (session.payment_intent && typeof session.payment_intent === "object") {
    return session.payment_intent.id || null;
  }

  return null;
}

function getStripeSessionAmount(session, fallbackAmount = 0) {
  const amountTotal = Number(session?.amount_total || 0);

  if (amountTotal > 0) {
    return amountTotal / 100;
  }

  return Number(fallbackAmount || 0);
}

/**
 * Cứu luồng Stripe khi webhook bị trễ hoặc chưa chạy:
 * - placeDeposit tạo auction_deposits.status = PENDING
 * - Stripe thanh toán xong redirect user về auction-detail
 * - frontend gọi GET /deposit-status
 * - nếu thấy PENDING, backend kiểm tra trực tiếp Stripe checkout session
 * - nếu Stripe đã paid, cập nhật DB sang SUCCEEDED ngay
 */
async function reconcilePendingDepositWithStripe(connection, deposit) {
  if (!deposit) {
    return null;
  }

  const currentStatus = normalizeDepositStatus(deposit.status);

  if (currentStatus !== "PENDING") {
    return {
      ...deposit,
      status: currentStatus,
    };
  }

  if (!deposit.stripe_session_id) {
    return {
      ...deposit,
      status: currentStatus,
    };
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(deposit.stripe_session_id);

    if (!isStripeSessionPaid(session)) {
      return {
        ...deposit,
        status: currentStatus,
      };
    }

    const paidAmount = getStripeSessionAmount(session, deposit.amount);
    const paymentIntentId = getStripePaymentIntentId(session);

    await connection.execute(
      `
        UPDATE auction_deposits
        SET
          amount = ?,
          status = 'SUCCEEDED',
          payment_provider = 'STRIPE',
          provider_payment_id = COALESCE(?, provider_payment_id),
          stripe_session_id = ?,
          paid_at = COALESCE(paid_at, NOW()),
          updated_at = NOW()
        WHERE id = ?
      `,
      [paidAmount, paymentIntentId, session.id, deposit.id],
    );

    logger.success(
      `[Deposit] Lazy confirm Stripe deposit #${deposit.id} auction #${deposit.auction_id} user #${deposit.user_id}`,
    );

    return {
      ...deposit,
      amount: paidAmount,
      status: "SUCCEEDED",
      payment_provider: "STRIPE",
      provider_payment_id: paymentIntentId || deposit.provider_payment_id,
      stripe_session_id: session.id,
      paid_at: deposit.paid_at || new Date(),
    };
  } catch (error) {
    logger.warn(`[Deposit] Không thể xác minh Stripe session ${deposit.stripe_session_id}: ${error.message}`);

    return {
      ...deposit,
      status: currentStatus,
    };
  }
}

class DepositController {
  static async getDepositStatus(req, res) {
    const auctionId = Number(req.params.id);
    const userId = req.user?.id;

    if (!auctionId) {
      return sendError(res, "ERR_INVALID_AUCTION_ID", "ID phiên đấu giá không hợp lệ.", 400);
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [auctionRows] = await connection.execute(
        `
          SELECT
            id,
            status,
            requires_deposit,
            deposit_amount,
            created_by
          FROM Auctions
          WHERE id = ?
          LIMIT 1
        `,
        [auctionId],
      );

      if (auctionRows.length === 0) {
        await connection.rollback();
        return sendError(res, "ERR_AUCTION_NOT_FOUND", "Không tìm thấy.", 404);
      }

      const [depositRows] = await connection.execute(
        `
          SELECT *
          FROM auction_deposits
          WHERE auction_id = ?
            AND user_id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [auctionId, userId],
      );

      let deposit = depositRows[0] || null;
      deposit = await reconcilePendingDepositWithStripe(connection, deposit);

      await connection.commit();

      const depositStatus = normalizeDepositStatus(deposit?.status);
      const hasDeposit = Boolean(deposit && depositStatus !== "NONE");
      const canBid = isPaidDepositStatus(depositStatus);

      return sendSuccess(
        res,
        {
          requires_deposit: Boolean(auctionRows[0].requires_deposit),
          deposit_amount: Number(auctionRows[0].deposit_amount || 0),
          has_deposit: hasDeposit,
          can_bid: canBid,
          is_paid: canBid,
          status: deposit ? depositStatus : "NONE",
          amount: deposit ? Number(deposit.amount || 0) : 0,
          payment_provider: deposit ? deposit.payment_provider || null : null,
          stripe_session_id: deposit ? deposit.stripe_session_id || null : null,
          provider_payment_id: deposit ? deposit.provider_payment_id || null : null,
          paid_at: deposit ? deposit.paid_at || null : null,
          refunded_at: deposit ? deposit.refunded_at || null : null,
          applied_at: deposit ? deposit.applied_at || null : null,
        },
        "Thành công.",
      );
    } catch (error) {
      await connection.rollback();
      logger.error("[Deposit Status Error]:", error.message);
      return sendError(res, "ERR_SERVER", "Lỗi lấy trạng thái cọc.", 500);
    } finally {
      connection.release();
    }
  }

  static async placeDeposit(req, res) {
    const auctionId = Number(req.params.id);
    const userId = req.user?.id;

    if (!auctionId) {
      return sendError(res, "ERR_INVALID_AUCTION_ID", "ID phiên đấu giá không hợp lệ.", 400);
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [auctionRows] = await connection.execute(
        `
          SELECT
            id,
            status,
            requires_deposit,
            deposit_amount,
            created_by
          FROM Auctions
          WHERE id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [auctionId],
      );

      if (auctionRows.length === 0) {
        await connection.rollback();
        return sendError(res, "ERR_AUCTION_NOT_FOUND", "Không tìm thấy phiên đấu giá.", 404);
      }

      const auction = auctionRows[0];

      if (Number(auction.created_by) === Number(userId)) {
        await connection.rollback();
        return sendError(res, "ERR_OWNER_DEPOSIT", "Chủ phiên không cần đặt cọc để tham gia phiên của mình.", 400);
      }

      if (!["Scheduled", "Active", "Closing"].includes(auction.status)) {
        await connection.rollback();
        return sendError(res, "ERR_DEPOSIT_NOT_ALLOWED", "Chỉ có thể đặt cọc cho phiên đang mở.", 400);
      }

      const amount = Number(auction.deposit_amount || 0);

      if (!auction.requires_deposit || amount <= 0) {
        await connection.rollback();
        return sendSuccess(res, { url: null }, "Phiên này không yêu cầu đặt cọc.");
      }

      const [existingRows] = await connection.execute(
        `
          SELECT *
          FROM auction_deposits
          WHERE auction_id = ?
            AND user_id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [auctionId, userId],
      );

      let existingDeposit = existingRows[0] || null;
      existingDeposit = await reconcilePendingDepositWithStripe(connection, existingDeposit);

      if (existingDeposit && isPaidDepositStatus(existingDeposit.status)) {
        await connection.commit();

        return sendSuccess(
          res,
          {
            url: null,
            already_paid: true,
            status: normalizeDepositStatus(existingDeposit.status),
          },
          "Bạn đã đặt cọc thành công trước đó.",
        );
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `Cọc tham gia phiên #${auctionId}`,
              },
              unit_amount: Math.round(amount * 100),
            },
            quantity: 1,
          },
        ],
        success_url: `${getClientUrl()}/auction-detail.html?id=${auctionId}&deposit=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${getClientUrl()}/auction-detail.html?id=${auctionId}&deposit=failed`,
        metadata: {
          type: "deposit",
          payment_type: "deposit",
          auction_id: String(auctionId),
          user_id: String(userId),
        },
      });

      await connection.execute(
        `
          INSERT INTO auction_deposits (
            auction_id,
            user_id,
            amount,
            status,
            payment_provider,
            stripe_session_id
          )
          VALUES (?, ?, ?, 'PENDING', 'STRIPE', ?)
          ON DUPLICATE KEY UPDATE
            amount = VALUES(amount),
            status = 'PENDING',
            payment_provider = 'STRIPE',
            stripe_session_id = VALUES(stripe_session_id),
            updated_at = NOW()
        `,
        [auctionId, userId, amount, session.id],
      );

      await connection.commit();

      return sendSuccess(res, { url: session.url }, "Đã tạo phiên thanh toán đặt cọc.");
    } catch (error) {
      await connection.rollback();
      logger.error("[Place Deposit Error]:", error.message);
      return sendError(res, "ERR_STRIPE", "Không thể tạo phiên thanh toán.", 500);
    } finally {
      connection.release();
    }
  }

  static async payRemaining(req, res) {
    const auctionId = Number(req.params.id);
    const userId = req.user?.id;

    if (!auctionId) {
      return sendError(res, "ERR_INVALID_AUCTION_ID", "ID phiên không hợp lệ.", 400);
    }

    const connection = await pool.getConnection();

    try {
      const [auctionRows] = await connection.execute(
        `
          SELECT
            id,
            current_price,
            final_price,
            status,
            winner_id
          FROM Auctions
          WHERE id = ?
          LIMIT 1
        `,
        [auctionId],
      );

      if (auctionRows.length === 0) {
        return sendError(res, "ERR_NOT_FOUND", "Không tìm thấy phiên.", 404);
      }

      const auction = auctionRows[0];

      if (Number(auction.winner_id) !== Number(userId)) {
        return sendError(res, "ERR_FORBIDDEN", "Bạn không phải người thắng.", 403);
      }

      if (auction.status === "Completed") {
        return sendError(res, "ERR_ALREADY_PAID", "Đã thanh toán đủ.", 400);
      }

      const [depositRows] = await connection.execute(
        `
          SELECT amount
          FROM auction_deposits
          WHERE auction_id = ?
            AND user_id = ?
            AND status IN ('SUCCEEDED', 'APPLIED_TO_WIN_PAYMENT')
          LIMIT 1
        `,
        [auctionId, userId],
      );

      const depositAmount = depositRows.length > 0 ? Number(depositRows[0].amount) : 0;
      const finalPrice = Number(auction.final_price || auction.current_price || 0);
      const remainingAmount = Math.max(0, finalPrice - depositAmount);

      if (remainingAmount <= 0) {
        return sendSuccess(
          res,
          {
            url: `${getFrontendRootUrl()}/index.html?payment=success&auction_id=${auctionId}`,
          },
          "Tiền cọc đã đủ bù giá thắng.",
        );
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `Thanh toán phiên #${auctionId}`,
              },
              unit_amount: Math.round(remainingAmount * 100),
            },
            quantity: 1,
          },
        ],
        success_url: `${getFrontendRootUrl()}/index.html?payment=success&auction_id=${auctionId}`,
        cancel_url: `${getClientUrl()}/auction-detail.html?id=${auctionId}&payment=failed`,
        metadata: {
          type: "win_payment",
          payment_type: "win_payment",
          auction_id: String(auctionId),
          user_id: String(userId),
        },
      });

      return sendSuccess(res, { url: session.url }, "Đã tạo link thanh toán.");
    } catch (error) {
      logger.error("[Pay Remaining Error]:", error.message);
      return sendError(res, "ERR_STRIPE", "Không tạo được link.", 500);
    } finally {
      connection.release();
    }
  }
}

module.exports = DepositController;
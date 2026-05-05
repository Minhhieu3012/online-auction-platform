const pool = require("../config/db");
const { sendSuccess, sendError } = require("../utils/response");
const logger = require("../utils/logger");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

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

class DepositController {
  static async getDepositStatus(req, res) {
    const auctionId = Number(req.params.id);
    const userId = req.user?.id;

    if (!auctionId) return sendError(res, "ERR_INVALID_AUCTION_ID", "ID phiên đấu giá không hợp lệ.", 400);

    try {
      const [auctionRows] = await pool.execute(
        `SELECT id, status, requires_deposit, deposit_amount, created_by FROM Auctions WHERE id = ? LIMIT 1`,
        [auctionId],
      );

      if (auctionRows.length === 0) return sendError(res, "ERR_AUCTION_NOT_FOUND", "Không tìm thấy.", 404);

      const [depositRows] = await pool.execute(
        `SELECT * FROM auction_deposits WHERE auction_id = ? AND user_id = ? LIMIT 1`,
        [auctionId, userId],
      );

      const deposit = depositRows[0];
      const hasDeposit = !!deposit && deposit.status !== "NONE";

      return sendSuccess(
        res,
        {
          requires_deposit: Boolean(auctionRows[0].requires_deposit),
          deposit_amount: Number(auctionRows[0].deposit_amount || 0),
          has_deposit: hasDeposit,
          status: deposit ? deposit.status : "NONE",
          amount: deposit ? Number(deposit.amount) : 0,
          refunded_at: deposit ? deposit.refunded_at : null,
          applied_at: deposit ? deposit.applied_at : null,
        },
        "Thành công.",
      );
    } catch (error) {
      logger.error("[Deposit Status Error]:", error.message);
      return sendError(res, "ERR_SERVER", "Lỗi lấy trạng thái cọc.", 500);
    }
  }

  static async placeDeposit(req, res) {
    const auctionId = Number(req.params.id);
    const userId = req.user?.id;

    if (!auctionId) return sendError(res, "ERR_INVALID_AUCTION_ID", "ID phiên đấu giá không hợp lệ.", 400);

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [auctionRows] = await connection.execute(
        `SELECT id, status, requires_deposit, deposit_amount, created_by FROM Auctions WHERE id = ? LIMIT 1 FOR UPDATE`,
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
        `SELECT * FROM auction_deposits WHERE auction_id = ? AND user_id = ? LIMIT 1 FOR UPDATE`,
        [auctionId, userId],
      );

      if (existingRows.length > 0 && existingRows[0].status === "SUCCEEDED") {
        await connection.rollback();
        return sendSuccess(res, { url: null }, "Bạn đã đặt cọc thành công trước đó.");
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
        success_url: `${getClientUrl()}/auction-detail.html?id=${auctionId}&deposit=success`,
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

    if (!auctionId) return sendError(res, "ERR_INVALID_AUCTION_ID", "ID phiên không hợp lệ.", 400);

    const connection = await pool.getConnection();

    try {
      const [auctionRows] = await connection.execute(
        `SELECT id, current_price, final_price, status, winner_id FROM Auctions WHERE id = ? LIMIT 1`,
        [auctionId],
      );

      if (auctionRows.length === 0) return sendError(res, "ERR_NOT_FOUND", "Không tìm thấy phiên.", 404);

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
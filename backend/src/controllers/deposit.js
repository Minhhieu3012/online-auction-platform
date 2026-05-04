const pool = require("../config/db");
const { sendSuccess, sendError } = require("../utils/response");
const logger = require("../utils/logger");

function formatUTC(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();

  const text = String(value);
  if (text.endsWith("Z")) return text;

  return text.replace(" ", "T") + "Z";
}

function mapDeposit(row) {
  if (!row) return null;

  return {
    id: row.id,
    auctionId: row.auction_id,
    userId: row.user_id,
    amount: Number(row.amount || 0),
    status: row.status,
    paymentProvider: row.payment_provider,
    stripeSessionId: row.stripe_session_id,
    providerPaymentId: row.provider_payment_id,
    paidAt: formatUTC(row.paid_at),
    failedAt: formatUTC(row.failed_at),
    refundedAt: formatUTC(row.refunded_at),
    appliedAt: formatUTC(row.applied_at),
    createdAt: formatUTC(row.created_at),
    updatedAt: formatUTC(row.updated_at),
  };
}

async function getAuction(connection, auctionId) {
  const [rows] = await connection.execute(
    `
      SELECT
        id,
        created_by,
        status,
        requires_deposit,
        deposit_amount,
        end_time
      FROM Auctions
      WHERE id = ?
      LIMIT 1
      FOR UPDATE
    `,
    [auctionId],
  );

  return rows[0] || null;
}

class DepositController {
  static async getDepositStatus(req, res) {
    const auctionId = Number(req.params.id);
    const userId = req.user?.id;

    if (!auctionId) {
      return sendError(res, "ERR_INVALID_AUCTION_ID", "ID phiên đấu giá không hợp lệ.", 400);
    }

    try {
      const [auctionRows] = await pool.execute(
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
        return sendError(res, "ERR_AUCTION_NOT_FOUND", "Không tìm thấy phiên đấu giá.", 404);
      }

      const auction = auctionRows[0];

      const [depositRows] = await pool.execute(
        `
          SELECT *
          FROM auction_deposits
          WHERE auction_id = ? AND user_id = ?
          LIMIT 1
        `,
        [auctionId, userId],
      );

      const deposit = mapDeposit(depositRows[0]);
      const hasSucceededDeposit = deposit?.status === "SUCCEEDED";

      return sendSuccess(
        res,
        {
          requiresDeposit: Boolean(auction.requires_deposit),
          depositAmount: Number(auction.deposit_amount || 0),
          deposit,
          canBid:
            auction.status === "Active" &&
            Number(auction.created_by) !== Number(userId) &&
            (!auction.requires_deposit || hasSucceededDeposit),
        },
        "Lấy trạng thái đặt cọc thành công.",
      );
    } catch (error) {
      logger.error("[Deposit Status Error]:", error);
      return sendError(res, "ERR_DEPOSIT_STATUS", "Không thể lấy trạng thái đặt cọc.", 500);
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

      const auction = await getAuction(connection, auctionId);

      if (!auction) {
        await connection.rollback();
        return sendError(res, "ERR_AUCTION_NOT_FOUND", "Không tìm thấy phiên đấu giá.", 404);
      }

      if (Number(auction.created_by) === Number(userId)) {
        await connection.rollback();
        return sendError(res, "ERR_OWNER_DEPOSIT", "Chủ phiên không cần đặt cọc để tham gia phiên của mình.", 400);
      }

      if (!["Scheduled", "Active", "Closing"].includes(auction.status)) {
        await connection.rollback();
        return sendError(res, "ERR_DEPOSIT_NOT_ALLOWED", "Chỉ có thể đặt cọc cho phiên đã được duyệt.", 400);
      }

      if (!auction.requires_deposit) {
        await connection.rollback();
        return sendSuccess(
          res,
          {
            requiresDeposit: false,
            deposit: null,
          },
          "Phiên này không yêu cầu đặt cọc.",
        );
      }

      const amount = Number(auction.deposit_amount || 0);

      if (!Number.isFinite(amount) || amount <= 0) {
        await connection.rollback();
        return sendError(res, "ERR_INVALID_DEPOSIT_AMOUNT", "Số tiền cọc của phiên không hợp lệ.", 400);
      }

      const [existingRows] = await connection.execute(
        `
          SELECT *
          FROM auction_deposits
          WHERE auction_id = ? AND user_id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [auctionId, userId],
      );

      let depositId;

      if (existingRows.length > 0) {
        const existing = existingRows[0];

        if (existing.status === "SUCCEEDED") {
          await connection.commit();

          return sendSuccess(
            res,
            {
              deposit: mapDeposit(existing),
            },
            "Bạn đã đặt cọc thành công trước đó.",
          );
        }

        await connection.execute(
          `
            UPDATE auction_deposits
            SET
              amount = ?,
              status = 'SUCCEEDED',
              paid_at = NOW(),
              failed_at = NULL,
              refunded_at = NULL,
              applied_at = NULL,
              payment_provider = 'WALLET'
            WHERE id = ?
          `,
          [amount, existing.id],
        );

        depositId = existing.id;
      } else {
        const [depositResult] = await connection.execute(
          `
            INSERT INTO auction_deposits
              (auction_id, user_id, amount, status, payment_provider, paid_at)
            VALUES
              (?, ?, ?, 'SUCCEEDED', 'WALLET', NOW())
          `,
          [auctionId, userId, amount],
        );

        depositId = depositResult.insertId;
      }

      const [transactionResult] = await connection.execute(
        `
          INSERT INTO Transactions
            (
              user_id,
              auction_id,
              deposit_id,
              amount,
              type,
              status,
              payment_provider,
              wallet_delta,
              metadata
            )
          VALUES
            (?, ?, ?, ?, 'AUCTION_DEPOSIT', 'SUCCESS', 'WALLET', 0.00, JSON_OBJECT('source', 'dev_confirmed_deposit'))
        `,
        [userId, auctionId, depositId, amount],
      );

      await connection.execute(
        `
          INSERT INTO Notifications
            (user_id, auction_id, type, title, message, action_url)
          VALUES
            (?, ?, 'DEPOSIT_SUCCEEDED', ?, ?, ?)
        `,
        [
          userId,
          auctionId,
          "Đặt cọc thành công",
          "Bạn đã đủ điều kiện tham gia trả giá trong phiên đấu giá này.",
          `/pages/product-detail.html?id=${auctionId}`,
        ],
      );

      const [depositRows] = await connection.execute(
        `
          SELECT *
          FROM auction_deposits
          WHERE id = ?
          LIMIT 1
        `,
        [depositId],
      );

      await connection.commit();

      return sendSuccess(
        res,
        {
          deposit: mapDeposit(depositRows[0]),
          transactionId: transactionResult.insertId,
        },
        "Đặt cọc thành công. Bạn đã có thể tham gia trả giá.",
      );
    } catch (error) {
      await connection.rollback();
      logger.error("[Place Deposit Error]:", error);
      return sendError(res, "ERR_PLACE_DEPOSIT", "Không thể đặt cọc lúc này.", 500);
    } finally {
      connection.release();
    }
  }
}

module.exports = DepositController;
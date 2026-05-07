const pool = require("../config/db");
const { sendSuccess, sendError } = require("../utils/response");
const logger = require("../utils/logger");

function formatUTC(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const text = String(value);
  return text.endsWith("Z") ? text : text.replace(" ", "T") + "Z";
}

const TYPE_LABEL = {
  AUCTION_DEPOSIT: "Đặt cọc đấu giá",
  DEPOSIT_REFUND: "Hoàn tiền cọc",
  DEPOSIT_APPLIED: "Cọc khấu trừ vào giá thắng",
  WIN_REMAINING_PAYMENT: "Thanh toán phần còn lại",
  WIN_FULL_PAYMENT: "Thanh toán toàn bộ giá thắng",
  WALLET_TOPUP: "Nạp ví",
  WALLET_WITHDRAW: "Rút ví",
  ADMIN_ADJUSTMENT: "Điều chỉnh bởi admin",
};

const STATUS_LABEL = {
  PENDING: "Đang xử lý",
  SUCCESS: "Thành công",
  FAILED: "Thất bại",
  CANCELLED: "Đã hủy",
};

class TransactionController {
  static async getMyTransactions(req, res) {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, "ERR_UNAUTHORIZED", "Bạn cần đăng nhập.", 401);
    }

    const limit = Math.min(Math.max(Number(req.query.limit || 30), 1), 100);
    const offset = Math.max(Number(req.query.offset || 0), 0);

    try {
      const [rows] = await pool.execute(
        `
          SELECT
            t.id,
            t.amount,
            t.type,
            t.status,
            t.payment_provider,
            t.provider_session_id,
            t.wallet_delta,
            t.balance_after,
            t.created_at,
            t.auction_id,
            p.name AS product_name
          FROM Transactions t
          LEFT JOIN Auctions a ON a.id = t.auction_id
          LEFT JOIN Products p ON p.id = a.product_id
          WHERE t.user_id = ?
          ORDER BY t.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `,
        [userId],
      );

      const [countRows] = await pool.execute(`SELECT COUNT(*) AS total FROM Transactions WHERE user_id = ?`, [userId]);

      const transactions = rows.map((row) => ({
        id: row.id,
        amount: Number(row.amount),
        type: row.type,
        typeLabel: TYPE_LABEL[row.type] || row.type,
        status: row.status,
        statusLabel: STATUS_LABEL[row.status] || row.status,
        paymentProvider: row.payment_provider || null,
        walletDelta: Number(row.wallet_delta || 0),
        balanceAfter: row.balance_after !== null ? Number(row.balance_after) : null,
        createdAt: formatUTC(row.created_at),
        auctionId: row.auction_id || null,
        auctionTitle: row.product_name || null,
      }));

      return sendSuccess(
        res,
        {
          transactions,
          total: Number(countRows[0]?.total || 0),
          limit,
          offset,
        },
        "Lấy lịch sử giao dịch thành công.",
      );
    } catch (error) {
      logger.error("[Transactions Error]:", error);
      return sendError(res, "ERR_SERVER", "Không thể tải lịch sử giao dịch.", 500);
    }
  }
}

module.exports = TransactionController;

const pool = require("../config/db");
const { sendSuccess, sendError } = require("../utils/response");
const logger = require("../utils/logger");

function formatUTC(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const text = String(value);
  return text.endsWith("Z") ? text : text.replace(" ", "T") + "Z";
}

class WatchlistController {
  static async getWatchlist(req, res) {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, "ERR_UNAUTHORIZED", "Bạn cần đăng nhập.", 401);
    }

    try {
      const [rows] = await pool.execute(
        `
          SELECT
            w.id          AS watchlist_id,
            w.created_at  AS watched_at,
            a.id          AS auction_id,
            a.status      AS auction_status,
            a.current_price,
            a.final_price,
            a.end_time,
            a.winner_id,
            p.name        AS product_name,
            p.image_url,
            COUNT(b.id)   AS bid_count
          FROM Watchlists w
          INNER JOIN Auctions a ON a.id = w.auction_id
          INNER JOIN Products p ON p.id = a.product_id
          LEFT  JOIN Bids b     ON b.auction_id = a.id
          WHERE w.user_id = ?
          GROUP BY
            w.id, w.created_at,
            a.id, a.status, a.current_price, a.final_price,
            a.end_time, a.winner_id,
            p.name, p.image_url
          ORDER BY w.created_at DESC
          LIMIT 50
        `,
        [userId],
      );

      const auctions = rows.map((row) => ({
        watchlistId: row.watchlist_id,
        auctionId: row.auction_id,
        lot: `Lô #${String(row.auction_id).padStart(3, "0")}`,
        title: row.product_name,
        imageUrl: row.image_url || null,
        currentPrice: Number(row.current_price),
        finalPrice: row.final_price !== null ? Number(row.final_price) : null,
        auctionStatus: row.auction_status,
        endTime: formatUTC(row.end_time),
        watchedAt: formatUTC(row.watched_at),
        bidCount: Number(row.bid_count || 0),
        isEnded: ["Ended", "Payment Pending", "Completed", "Cancelled"].includes(row.auction_status),
      }));

      return sendSuccess(res, { auctions }, "Lấy danh sách theo dõi thành công.");
    } catch (error) {
      logger.error("[Watchlist Get Error]:", error);
      return sendError(res, "ERR_SERVER", "Không thể tải danh sách theo dõi.", 500);
    }
  }

  static async addToWatchlist(req, res) {
    const userId = req.user?.id;
    const auctionId = Number(req.params.id || req.body?.auctionId);

    if (!userId) return sendError(res, "ERR_UNAUTHORIZED", "Bạn cần đăng nhập.", 401);
    if (!auctionId) return sendError(res, "ERR_INVALID_INPUT", "ID phiên không hợp lệ.", 400);

    try {
      await pool.execute(
        `
          INSERT IGNORE INTO Watchlists (user_id, auction_id)
          VALUES (?, ?)
        `,
        [userId, auctionId],
      );

      return sendSuccess(res, { auctionId, watching: true }, "Đã thêm vào danh sách theo dõi.");
    } catch (error) {
      logger.error("[Watchlist Add Error]:", error);
      return sendError(res, "ERR_SERVER", "Không thể thêm vào danh sách theo dõi.", 500);
    }
  }

  static async removeFromWatchlist(req, res) {
    const userId = req.user?.id;
    const auctionId = Number(req.params.id || req.body?.auctionId);

    if (!userId) return sendError(res, "ERR_UNAUTHORIZED", "Bạn cần đăng nhập.", 401);
    if (!auctionId) return sendError(res, "ERR_INVALID_INPUT", "ID phiên không hợp lệ.", 400);

    try {
      await pool.execute(
        `
          DELETE FROM Watchlists
          WHERE user_id = ? AND auction_id = ?
        `,
        [userId, auctionId],
      );

      return sendSuccess(res, { auctionId, watching: false }, "Đã xóa khỏi danh sách theo dõi.");
    } catch (error) {
      logger.error("[Watchlist Remove Error]:", error);
      return sendError(res, "ERR_SERVER", "Không thể xóa khỏi danh sách theo dõi.", 500);
    }
  }
}

module.exports = WatchlistController;

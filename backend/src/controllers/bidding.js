const pool = require("../config/db");
const { sendSuccess, sendError } = require("../utils/response");
const redisClient = require("../config/redis");
const redisKeys = require("../utils/redis-keys");
const NotificationService = require("../services/notificationService");
const AutoBidService = require("../services/autobid");

/**
 * Ép chuỗi MySQL DATETIME thành UTC timestamp tuyệt đối.
 */
function parseDbTimeToUTC(timeStr) {
  if (!timeStr) return 0;
  let str = String(timeStr);
  if (str.includes("GMT") || str.includes("Z")) return new Date(timeStr).getTime();
  str = str.replace(" ", "T") + "Z";
  return new Date(str).getTime();
}

function formatUTC(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const text = String(value);
  return text.endsWith("Z") ? text : text.replace(" ", "T") + "Z";
}

function maskBidder(username, email) {
  const source = username || email || "Bidder";
  if (source.length <= 2) return `${source[0] || "B"}***`;
  return `${source[0]}***${source[source.length - 1]}`.toUpperCase();
}

function normalizeBidPayload({ bid, auctionId, userId, currentPrice, version }) {
  const bidder = maskBidder(bid?.username, bid?.email);
  const amount = Number(bid?.bid_amount || currentPrice || 0);
  const createdAt = formatUTC(bid?.created_at) || new Date().toISOString();

  return {
    auctionId: Number(auctionId),
    auction_id: Number(auctionId),
    bidId: bid?.id ? Number(bid.id) : null,
    bid_id: bid?.id ? Number(bid.id) : null,
    id: bid?.id ? Number(bid.id) : null,
    userId: Number(userId),
    user_id: Number(userId),
    bidder,
    username: bid?.username || null,
    bidAmount: amount,
    bid_amount: amount,
    amount,
    currentPrice: Number(currentPrice || amount),
    current_price: Number(currentPrice || amount),
    version: Number(version || 0),
    createdAt,
    created_at: createdAt,
    time: createdAt,
  };
}

class BiddingController {
  /**
   * API Đặt giá thủ công.
   * Source of truth: MySQL transaction. Commit xong mới broadcast socket.
   */
  static async placeBid(req, res) {
    const auctionId = Number(req.params.id);
    const userId = Number(req.user?.id);
    const bidAmount = Number(req.body?.bidAmount);

    if (!auctionId || !userId || !bidAmount || bidAmount <= 0) {
      return sendError(res, "ERR_INVALID_INPUT", "Số tiền đặt giá không hợp lệ.", 400);
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [auctionRows] = await connection.execute(
        `
          SELECT *
          FROM Auctions
          WHERE id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [auctionId],
      );

      if (auctionRows.length === 0) {
        await connection.rollback();
        return sendError(res, "ERR_NOT_FOUND", "Không tìm thấy phiên đấu giá.", 404);
      }

      const auction = auctionRows[0];

      if (!["Active", "Closing"].includes(auction.status)) {
        await connection.rollback();
        return sendError(res, "ERR_NOT_ACTIVE", "Phiên đấu giá hiện không mở để đặt giá.", 400);
      }

      const endTimeMs = parseDbTimeToUTC(auction.end_time);
      if (endTimeMs <= Date.now()) {
        await connection.rollback();
        return sendError(res, "ERR_AUCTION_ENDED", "Phiên đấu giá đã kết thúc.", 400);
      }

      const minBid = Number(auction.current_price || 0) + Number(auction.step_price || 0);
      if (bidAmount < minBid) {
        await connection.rollback();
        return sendError(res, "ERR_BID_TOO_LOW", `Giá đặt phải tối thiểu là ${minBid}`, 400);
      }

      const [previousBidRows] = await connection.execute(
        `
          SELECT
            b.id,
            b.user_id,
            b.bid_amount,
            b.created_at,
            u.username,
            u.email
          FROM Bids b
          INNER JOIN Users u ON u.id = b.user_id
          WHERE b.auction_id = ?
          ORDER BY b.bid_amount DESC, b.created_at ASC, b.id ASC
          LIMIT 1
        `,
        [auctionId],
      );

      const previousHighestBid = previousBidRows[0] || null;
      const nextVersion = Number(auction.version || 0) + 1;

      const [insertResult] = await connection.execute(
        `
          INSERT INTO Bids (auction_id, user_id, bid_amount)
          VALUES (?, ?, ?)
        `,
        [auctionId, userId, bidAmount],
      );

      await connection.execute(
        `
          UPDATE Auctions
          SET current_price = ?, version = ?, updated_at = NOW()
          WHERE id = ?
        `,
        [bidAmount, nextVersion, auctionId],
      );

      if (
        previousHighestBid &&
        Number(previousHighestBid.user_id) !== Number(userId) &&
        Number(bidAmount) > Number(previousHighestBid.bid_amount || 0)
      ) {
        try {
          await NotificationService.notifyOutbid(connection, {
            userId: previousHighestBid.user_id,
            auctionId,
            previousBidAmount: previousHighestBid.bid_amount,
            newBidAmount: bidAmount,
          });
        } catch (notificationError) {
          console.warn("[Bidding Notification Warning]:", notificationError.message);
        }
      }

      const [createdBidRows] = await connection.execute(
        `
          SELECT
            b.id,
            b.auction_id,
            b.user_id,
            b.bid_amount,
            b.created_at,
            u.username,
            u.email
          FROM Bids b
          INNER JOIN Users u ON u.id = b.user_id
          WHERE b.id = ?
          LIMIT 1
        `,
        [insertResult.insertId],
      );

      const payload = normalizeBidPayload({
        bid: createdBidRows[0],
        auctionId,
        userId,
        currentPrice: bidAmount,
        version: nextVersion,
      });

      await connection.commit();

      const auctionKey = redisKeys.auctionInfo(auctionId);
      await redisClient.hSet(auctionKey, {
        current_price: String(bidAmount),
        highest_bidder: String(userId),
        version: String(nextVersion),
      });

      const io = req.app.get("io");
      if (io) {
        io.to(String(auctionId)).emit("new_bid", payload);
      }

      return sendSuccess(res, payload, "Đặt giá thành công.", 201);
    } catch (error) {
      await connection.rollback();
      console.error("[Place Bid Error]:", error);
      return sendError(res, "ERR_SERVER", "Không thể đặt giá lúc này.", 500);
    } finally {
      connection.release();
    }
  }

  /**
   * API lấy lịch sử đặt giá chung của phiên.
   */
  static async getBidHistory(req, res) {
    const auctionId = Number(req.params.id);
    if (!auctionId) return sendError(res, "ERR_INVALID_AUCTION_ID", "ID không hợp lệ.", 400);

    try {
      const [bids] = await pool.execute(
        `
          SELECT
            b.id,
            b.auction_id,
            b.user_id,
            b.bid_amount,
            b.created_at,
            u.username,
            u.email
          FROM Bids b
          INNER JOIN Users u ON u.id = b.user_id
          WHERE b.auction_id = ?
          ORDER BY b.created_at DESC, b.id DESC
          LIMIT 25
        `,
        [auctionId],
      );

      return sendSuccess(
        res,
        {
          bids: bids.map((bid, index) => ({
            id: Number(bid.id),
            bidId: Number(bid.id),
            bid_id: Number(bid.id),
            auctionId: Number(bid.auction_id),
            auction_id: Number(bid.auction_id),
            userId: Number(bid.user_id),
            user_id: Number(bid.user_id),
            bidder: maskBidder(bid.username, bid.email),
            username: bid.username || null,
            amount: Number(bid.bid_amount),
            bidAmount: Number(bid.bid_amount),
            bid_amount: Number(bid.bid_amount),
            time: formatUTC(bid.created_at),
            createdAt: formatUTC(bid.created_at),
            created_at: formatUTC(bid.created_at),
            highlight: index === 0,
          })),
        },
        "Lấy lịch sử thành công.",
      );
    } catch (error) {
      console.error("[Bid History Error]:", error);
      return sendError(res, "ERR_SERVER", "Lỗi cơ sở dữ liệu.", 500);
    }
  }

  static async setupAutoBid(req, res) {
    const auctionId = Number(req.params.id);
    const userId = Number(req.user?.id);
    const maxAmount = Number(req.body?.maxAmount);

    if (!auctionId || !userId || !maxAmount || maxAmount <= 0) {
      return sendError(res, "ERR_INVALID_INPUT", "Hạn mức tối đa không hợp lệ.", 400);
    }

    try {
      const result = await AutoBidService.setupAutoBid(auctionId, userId, maxAmount);
      return sendSuccess(res, result, result.message, 200);
    } catch (error) {
      console.error("[Auto-Bid Setup Error]:", error);
      if (error.message === "ERR_INSUFFICIENT_BALANCE") {
        return sendError(res, "ERR_BALANCE", "Số dư khả dụng không đủ để đóng băng hạn mức này.", 400);
      }
      if (error.message === "ERR_USER_NOT_FOUND") {
        return sendError(res, "ERR_AUTH", "Không tìm thấy thông tin tài khoản.", 404);
      }
      return sendError(res, "ERR_SERVER", "Lỗi máy chủ khi thiết lập Auto-bid.", 500);
    }
  }
}

module.exports = BiddingController;

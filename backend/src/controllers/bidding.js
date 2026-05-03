const AutoBidService = require("../services/autobid");
const BiddingService = require("../services/bidding");
const pool = require("../config/db");
const { sendSuccess, sendError } = require("../utils/response");

function mapBidError(errorCode) {
  const messages = {
    ERR_NOT_FOUND: "Không tìm thấy phiên đấu giá hoặc cache phiên chưa sẵn sàng.",
    ERR_INVALID_STATE: "Phiên đấu giá hiện không mở để đặt giá.",
    ERR_ALREADY_HIGHEST: "Bạn đang là người đặt giá cao nhất hiện tại.",
    ERR_BID_TOO_LOW: "Số tiền đặt giá thấp hơn mức tối thiểu.",
    ERR_AUCTION_NOT_FOUND: "Không tìm thấy phiên đấu giá.",
    ERR_AUCTION_ENDED: "Phiên đấu giá đã kết thúc.",
  };

  return messages[errorCode] || "Đặt giá thất bại.";
}

class BiddingController {
  /**
   * Đặt giá mới
   */
  static async placeBid(req, res) {
    try {
      const auctionId = parseInt(req.params.id, 10);
      const { bidAmount } = req.body;
      const userId = req.user.id;

      if (Number.isNaN(auctionId)) {
        return sendError(res, "ERR_INVALID_AUCTION", "ID phiên đấu giá không hợp lệ.", 400);
      }

      const numericBidAmount = Number(bidAmount);

      if (!Number.isFinite(numericBidAmount) || numericBidAmount <= 0) {
        return sendError(res, "ERR_INVALID_INPUT", "Số tiền đặt giá không hợp lệ.", 400);
      }

      const result = await BiddingService.placeBid(auctionId, userId, numericBidAmount);

      if (!result.success) {
        return sendError(res, result.errorCode, mapBidError(result.errorCode), 400);
      }

      return sendSuccess(
        res,
        result.data || null,
        result.message || "Đặt giá thành công!"
      );
    } catch (error) {
      console.error("[Place Bid Controller Error]:", error.message);
      return sendError(res, "ERR_SERVER", error.message || "Lỗi máy chủ nội bộ.", 500);
    }
  }

  /**
   * Lấy lịch sử đặt giá của một phiên
   */
  static async getBidHistory(req, res) {
    try {
      const auctionId = parseInt(req.params.id, 10);

      if (Number.isNaN(auctionId)) {
        return sendError(res, "ERR_INVALID_ID", "ID phiên đấu giá không hợp lệ.", 400);
      }

      const [bids] = await pool.execute(
        `
          SELECT
            b.id,
            b.bid_amount,
            b.created_at,
            u.username,
            u.email
          FROM Bids b
          JOIN Users u ON b.user_id = u.id
          WHERE b.auction_id = ?
          ORDER BY b.created_at DESC
          LIMIT 25
        `,
        [auctionId],
      );

      const mappedBids = bids.map((bid, index) => {
        const source = bid.username || bid.email || "Bidder";
        const bidder = source.length <= 2
          ? `${source[0] || "B"}***`
          : `${source[0]}***${source[source.length - 1]}`.toUpperCase();

        return {
          id: bid.id,
          bidder,
          amount: Number(bid.bid_amount || 0),
          time: bid.created_at,
          highlight: index === 0,
        };
      });

      return sendSuccess(res, { bids: mappedBids }, "Lấy lịch sử đặt giá thành công!");
    } catch (error) {
      console.error("[Get Bid History Error]:", error);
      return sendError(res, "ERR_SERVER", "Lỗi máy chủ khi lấy lịch sử.", 500);
    }
  }

  /**
   * Thiết lập Auto-bid / Proxy-bid
   */
  static async setupAutoBid(req, res) {
    try {
      const auctionId = parseInt(req.params.id, 10);
      const { maxAmount } = req.body;
      const userId = req.user.id;

      if (Number.isNaN(auctionId)) {
        return sendError(res, "ERR_INVALID_ID", "ID phiên đấu giá không hợp lệ.", 400);
      }

      const numericMaxAmount = Number(maxAmount);

      if (!Number.isFinite(numericMaxAmount) || numericMaxAmount <= 0) {
        return sendError(res, "ERR_INVALID_INPUT", "Hạn mức tối đa không hợp lệ.", 400);
      }

      const result = await AutoBidService.setupAutoBid(auctionId, userId, numericMaxAmount);

      return sendSuccess(
        res,
        {
          auctionId,
          maxAmount: numericMaxAmount,
        },
        result.message || "Đã thiết lập Auto-bid thành công."
      );
    } catch (error) {
      console.error("[Setup Auto-bid Error]:", error.message);

      if (error.message === "ERR_INSUFFICIENT_BALANCE") {
        return sendError(res, "ERR_BALANCE", "Số dư không đủ để đóng băng Auto-bid.", 400);
      }

      if (error.message === "ERR_USER_NOT_FOUND") {
        return sendError(res, "ERR_USER_NOT_FOUND", "Không tìm thấy người dùng.", 404);
      }

      return sendError(res, "ERR_SERVER", "Lỗi máy chủ khi thiết lập Auto-bid.", 500);
    }
  }
}

module.exports = BiddingController;
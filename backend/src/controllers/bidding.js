const AutoBidService = require("../services/autobid");
const BiddingService = require("../services/bidding");
const pool = require("../config/db");
const { sendSuccess, sendError } = require("../utils/response");

class BiddingController {
  /**
   * Đặt giá mới
   */
  static async placeBid(req, res) {
    try {
      const auctionId = parseInt(req.params.id, 10);
      const { bidAmount } = req.body;
      const userId = req.user.id;

      if (isNaN(auctionId)) {
        return sendError(res, "ERR_INVALID_AUCTION", "ID phiên đấu giá không hợp lệ.", 400);
      }

      if (!bidAmount || isNaN(bidAmount)) {
        return sendError(res, "ERR_INVALID_INPUT", "Số tiền đặt giá không hợp lệ.", 400);
      }

      const result = await BiddingService.placeBid(auctionId, userId, parseFloat(bidAmount));

      if (result.success) {
        return sendSuccess(res, null, "Đặt giá thành công!");
      } else {
        return sendError(res, result.errorCode, "Đặt giá thất bại.", 400);
      }
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

      if (isNaN(auctionId)) {
        return sendError(res, "ERR_INVALID_ID", "ID phiên đấu giá không hợp lệ.", 400);
      }

      const [bids] = await pool.execute(
        `SELECT b.bid_amount, b.created_at, u.username 
         FROM Bids b 
         JOIN Users u ON b.user_id = u.id 
         WHERE b.auction_id = ? 
         ORDER BY b.created_at DESC`,
        [auctionId],
      );

      return sendSuccess(res, { bids }, "Lấy lịch sử đặt giá thành công!");
    } catch (error) {
      console.error("[Get Bid History Error]:", error);
      return sendError(res, "ERR_SERVER", "Lỗi máy chủ khi lấy lịch sử.", 500);
    }
  }

  /**
   * Thiết lập Auto-bid
   */
  static async setupAutoBid(req, res) {
    try {
      const auctionId = parseInt(req.params.id, 10);
      const { maxAmount } = req.body;
      const userId = req.user.id;

      if (isNaN(auctionId)) {
        return sendError(res, "ERR_INVALID_ID", "ID phiên đấu giá không hợp lệ.", 400);
      }

      if (!maxAmount || isNaN(maxAmount) || parseFloat(maxAmount) <= 0) {
        return sendError(res, "ERR_INVALID_INPUT", "Hạn mức tối đa không hợp lệ.", 400);
      }

      // Gọi sang Service
      const result = await AutoBidService.setupAutoBid(auctionId, userId, parseFloat(maxAmount));

      // Trả về thông báo động ("Đã thiết lập..." hoặc "Đã cập nhật...") kèm mức giá mới
      return sendSuccess(res, { max_price: maxAmount }, result.message);
    } catch (error) {
      console.error("[Setup Auto-bid Error]:", error.message);

      if (error.message === "ERR_INSUFFICIENT_BALANCE") {
        return sendError(res, "ERR_BALANCE", "Số dư không đủ để đóng băng.", 400);
      }

      return sendError(res, "ERR_SERVER", "Lỗi máy chủ khi thiết lập Auto-bid.", 500);
    }
  }
}

module.exports = BiddingController;

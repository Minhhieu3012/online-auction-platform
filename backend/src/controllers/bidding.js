const BiddingService = require("../services/bidding");
const { sendSuccess, sendError } = require("../utils/response");

class BiddingController {
  static async placeBid(req, res) {
    try {
      const auctionId = parseInt(req.params.id, 10);
      const userId = req.user.id; // ← Lấy từ JWT middleware
      const { bidAmount } = req.body;

      // Validate
      if (isNaN(auctionId)) {
        return sendError(res, "ERR_INVALID_AUCTION", "ID phiên đấu giá không hợp lệ.", 400);
      }
      if (!bidAmount || isNaN(bidAmount) || parseFloat(bidAmount) <= 0) {
        return sendError(res, "ERR_INVALID_AMOUNT", "Số tiền đặt giá không hợp lệ.", 400);
      }

      const result = await BiddingService.placeBid(auctionId, userId, parseFloat(bidAmount));

      if (result.success) {
        return sendSuccess(res, null, result.message);
      } else {
        return sendError(res, result.errorCode, "Đặt giá thất bại.", 400);
      }
    } catch (error) {
      return sendError(res, "ERR_SERVER", error.message, 500);
    }
  }
}

module.exports = BiddingController;

const BiddingService = require("../services/bidding");
const pool = require("../config/db"); // THÊM DÒNG NÀY
const { sendSuccess, sendError } = require("../utils/response");

class BiddingController {
  static async placeBid(req, res) {
    // ... (Giữ nguyên code cũ của bạn)
  }

  // --- THÊM HÀM NÀY VÀO DƯỚI HÀM PLACEBID ---
  static async getBidHistory(req, res) {
    try {
      const auctionId = parseInt(req.params.id, 10);

      if (isNaN(auctionId)) {
        return sendError(res, "ERR_INVALID_ID", "ID phiên đấu giá không hợp lệ.", 400);
      }

      // Lấy lịch sử từ Database, sắp xếp giá từ cao xuống thấp (hoặc theo thời gian mới nhất)
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
}

module.exports = BiddingController;

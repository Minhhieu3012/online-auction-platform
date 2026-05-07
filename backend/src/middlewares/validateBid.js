const pool = require("../config/db");
const { sendError } = require("../utils/response");

function parseDbTimeToUTC(timeStr) {
  if (!timeStr) return 0;
  let str = String(timeStr);
  if (str.includes('GMT') || str.includes('Z')) return new Date(timeStr).getTime();
  str = str.replace(' ', 'T') + 'Z';
  return new Date(str).getTime();
}

const validateBidRequirements = async (req, res, next) => {
  try {
    const auctionId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (userRole === 'admin') return sendError(res, "ERR_ADMIN_FORBIDDEN", "Admin không được phép đặt giá.", 403);

    const [auctions] = await pool.execute("SELECT created_by, current_price, status, requires_deposit, end_time FROM Auctions WHERE id = ?", [auctionId]);
    if (auctions.length === 0) return sendError(res, "ERR_NOT_FOUND", "Phiên đấu giá không tồn tại.", 404);
    
    const auction = auctions[0];

    // CHỐT CHẶN: ÉP TIMEZONE CHUẨN ĐỂ SO SÁNH
    const endTimeMs = parseDbTimeToUTC(auction.end_time);
    if (Date.now() >= endTimeMs || !["Active", "Closing"].includes(auction.status)) {
      return sendError(res, "ERR_AUCTION_ENDED", "Phiên đấu giá đã kết thúc.", 400);
    }

    if (auction.created_by === userId) return sendError(res, "ERR_SELF_BIDDING", "Bạn không thể tự đặt giá.", 403);

    if (auction.requires_deposit) {
      const [deposits] = await pool.execute("SELECT status FROM auction_deposits WHERE auction_id = ? AND user_id = ? AND status IN ('SUCCEEDED', 'APPLIED_TO_WIN_PAYMENT')", [auctionId, userId]);
      if (deposits.length === 0) return sendError(res, "ERR_DEPOSIT_REQUIRED", "Bạn cần đặt cọc trước.", 403);
    }

    next();
  } catch (error) { return sendError(res, "ERR_SERVER", "Lỗi kiểm tra điều kiện.", 500); }
};
module.exports = { validateBidRequirements };
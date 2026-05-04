const pool = require("../config/db");
const { sendError } = require("../utils/response");

const validateBidRequirements = async (req, res, next) => {
  try {
    const auctionId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;

    // 1. CHẶN ADMIN: Admin không được tham gia bidding[cite: 9]
    if (userRole === 'admin') {
      return sendError(res, "ERR_ADMIN_FORBIDDEN", "Tài khoản quản trị không được phép đặt giá.", 403);
    }

    // 2. TRUY VẤN DB: Lấy thông tin phiên và số dư (Cột chính xác từ init.sql)[cite: 13]
    const [auctions] = await pool.execute(
      "SELECT created_by, current_price, status FROM Auctions WHERE id = ?", 
      [auctionId]
    );
    const [users] = await pool.execute(
      "SELECT balance FROM Users WHERE id = ?", 
      [userId]
    );

    if (auctions.length === 0) {
      return sendError(res, "ERR_NOT_FOUND", "Phiên đấu giá không tồn tại.", 404);
    }
    
    const auction = auctions[0];
    const userBalance = Number(users[0].balance);

    // 3. CHẶN SELLER: created_by trong DB chính là Seller[cite: 13]
    if (auction.created_by === userId) {
      return sendError(res, "ERR_SELF_BIDDING", "Bạn không thể đặt giá cho sản phẩm do mình đăng bán.", 403);
    }

    // 4. KIỂM TRA TÀI CHÍNH: balance so với 10% giá hiện tại (Giả định mức ký quỹ)[cite: 13]
    const requiredDeposit = Number(auction.current_price) * 0.1;
    if (userBalance < requiredDeposit) {
      return sendError(
        res, 
        "ERR_INSUFFICIENT_BALANCE", 
        `Số dư không đủ. Bạn cần tối thiểu ${requiredDeposit.toLocaleString()} USD (10% giá hiện tại) để tham gia.`, 
        400
      );
    }

    next();
  } catch (error) {
    console.error("[Validation Error]:", error);
    return sendError(res, "ERR_SERVER", "Lỗi kiểm tra điều kiện đặt giá.", 500);
  }
};

module.exports = { validateBidRequirements };
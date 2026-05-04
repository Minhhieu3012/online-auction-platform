const jwt = require("jsonwebtoken");
const { sendError } = require("../utils/response");
const logger = require("../utils/logger");

// ==========================================
// KIỂM TRA NGAY LÚC KHỞI ĐỘNG SERVER (Kiến trúc Fail Fast)
// ==========================================
const secretKey = process.env.JWT_SECRET;
if (!secretKey) {
  logger.error("FATAL ERROR: JWT_SECRET chưa được cấu hình trong file .env");
  process.exit(1);
}

/**
 * Middleware xác thực Token JWT
 */
const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return sendError(
        res, 
        "ERR_UNAUTHORIZED", 
        "Vui lòng đăng nhập để thực hiện chức năng này.", 
        401
      );
    }

    const token = authHeader.split(" ")[1];

    // Xác thực token bằng secretKey đã kiểm tra
    const decoded = jwt.verify(token, secretKey);

    // Lưu thông tin user (id, role) vào request để các middleware sau sử dụng
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return sendError(res, "ERR_TOKEN_EXPIRED", "Phiên đăng nhập đã hết hạn.", 401);
    }
    return sendError(res, "ERR_INVALID_TOKEN", "Token xác thực không hợp lệ.", 401);
  }
};

/**
 * Middleware kiểm tra quyền hạn (Role-Based Access Control - RBAC)
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    // Đảm bảo user đã qua bước authMiddleware và có role hợp lệ
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return sendError(
        res, 
        "ERR_FORBIDDEN", 
        "Bạn không có quyền thực hiện hành động này.", 
        403
      );
    }
    next();
  };
};

module.exports = { 
  authMiddleware, 
  authorize 
};
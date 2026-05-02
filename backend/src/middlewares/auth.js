const jwt = require("jsonwebtoken");
const { sendError } = require("../utils/response");

// KIỂM TRA NGAY LÚC KHỞI ĐỘNG SERVER (Bên ngoài hàm)
const secretKey = process.env.JWT_SECRET;
if (!secretKey) {
  console.error("FATAL ERROR: JWT_SECRET chưa được cấu hình trong file .env");
  process.exit(1);
}

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return sendError(res, "ERR_UNAUTHORIZED", "Vui lòng đăng nhập để thực hiện chức năng này.", 401);
    }

    const token = authHeader.split(" ")[1];

    // Bây giờ dùng thẳng secretKey đã được kiểm tra ở trên
    const decoded = jwt.verify(token, secretKey);

    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return sendError(res, "ERR_TOKEN_EXPIRED", "Phiên đăng nhập đã hết hạn.", 401);
    }
    return sendError(res, "ERR_INVALID_TOKEN", "Token xác thực không hợp lệ.", 401);
  }
};

module.exports = authMiddleware;

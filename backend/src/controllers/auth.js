const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const { sendSuccess, sendError } = require("../utils/response");

class AuthController {
  // --- ĐĂNG KÝ ---
  static async register(req, res) {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return sendError(res, "ERR_MISSING_DATA", "Vui lòng nhập đủ username, email và password.", 400);
    }

    try {
      // 1. Kiểm tra xem email hoặc username đã tồn tại chưa (Dùng thẳng pool.execute)
      const [existingUsers] = await pool.execute("SELECT id FROM Users WHERE email = ? OR username = ?", [
        email,
        username,
      ]);

      if (existingUsers.length > 0) {
        return sendError(res, "ERR_USER_EXISTS", "Email hoặc Username đã được sử dụng.", 409);
      }

      // 2. Băm (Hash) mật khẩu
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // 3. Lưu vào Database (Dùng thẳng pool.execute)
      const [result] = await pool.execute(
        "INSERT INTO Users (username, email, password, balance) VALUES (?, ?, ?, 0)",
        [username, email, hashedPassword],
      );

      return sendSuccess(res, { userId: result.insertId }, "Đăng ký tài khoản thành công!", 201);
    } catch (error) {
      console.error("[Auth Register Error]:", error);
      return sendError(res, "ERR_SERVER", "Lỗi máy chủ khi đăng ký.", 500);
    }
  }

  // --- ĐĂNG NHẬP ---
  static async login(req, res) {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendError(res, "ERR_MISSING_DATA", "Vui lòng nhập email và password.", 400);
    }

    try {
      // 1. Tìm user theo email
      const [users] = await pool.execute("SELECT * FROM Users WHERE email = ?", [email]);
      const user = users[0];

      if (!user) {
        return sendError(res, "ERR_AUTH_FAILED", "Email hoặc mật khẩu không chính xác.", 401);
      }

      // 2. So sánh mật khẩu
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return sendError(res, "ERR_AUTH_FAILED", "Email hoặc mật khẩu không chính xác.", 401);
      }

      // 3. Tạo chữ ký số (JWT)
      const payload = {
        id: user.id,
        username: user.username,
      };

      const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || "7d",
      });

      // 4. Trả về Token
      return sendSuccess(
        res,
        {
          token,
          user: { id: user.id, username: user.username, email: user.email, balance: user.balance },
        },
        "Đăng nhập thành công!",
      );
    } catch (error) {
      console.error("[Auth Login Error]:", error);
      return sendError(res, "ERR_SERVER", "Lỗi máy chủ khi đăng nhập.", 500);
    }
  }
}

module.exports = AuthController;

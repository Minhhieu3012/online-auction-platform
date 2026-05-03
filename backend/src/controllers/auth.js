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
      const [existingUsers] = await pool.execute("SELECT id FROM Users WHERE email = ? OR username = ?", [
        email,
        username,
      ]);

      if (existingUsers.length > 0) {
        return sendError(res, "ERR_USER_EXISTS", "Email hoặc Username đã được sử dụng.", 409);
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

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
      const [users] = await pool.execute("SELECT * FROM Users WHERE email = ?", [email]);
      const user = users[0];

      if (!user) {
        return sendError(res, "ERR_AUTH_FAILED", "Email hoặc mật khẩu không chính xác.", 401);
      }

      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        return sendError(res, "ERR_AUTH_FAILED", "Email hoặc mật khẩu không chính xác.", 401);
      }

      const payload = {
        id: user.id,
        username: user.username,
      };

      const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || "7d",
      });

      return sendSuccess(
        res,
        {
          token,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            balance: user.balance,
          },
        },
        "Đăng nhập thành công!",
      );
    } catch (error) {
      console.error("[Auth Login Error]:", error);
      return sendError(res, "ERR_SERVER", "Lỗi máy chủ khi đăng nhập.", 500);
    }
  }

  // --- QUÊN MẬT KHẨU ---
  static async forgotPassword(req, res) {
    const { email } = req.body;

    if (!email) {
      return sendError(res, "ERR_MISSING_DATA", "Vui lòng nhập email.", 400);
    }

    try {
      const [users] = await pool.execute("SELECT id, username, email FROM Users WHERE email = ?", [email]);
      const user = users[0];

      if (!user) {
        return sendError(res, "ERR_USER_NOT_FOUND", "Không tìm thấy tài khoản với email này.", 404);
      }

      const resetToken = jwt.sign(
        {
          id: user.id,
          email: user.email,
          purpose: "password_reset",
        },
        process.env.JWT_SECRET,
        {
          expiresIn: "15m",
        },
      );

      return sendSuccess(
        res,
        {
          resetToken,
          expiresIn: "15m",
          email: user.email,
        },
        "Reset token đã được tạo. Trong bản production, token này sẽ được gửi qua email.",
      );
    } catch (error) {
      console.error("[Auth Forgot Password Error]:", error);
      return sendError(res, "ERR_SERVER", "Lỗi máy chủ khi xử lý quên mật khẩu.", 500);
    }
  }

  // --- ĐẶT LẠI MẬT KHẨU ---
  static async resetPassword(req, res) {
    const { token, password } = req.body;

    if (!token || !password) {
      return sendError(res, "ERR_MISSING_DATA", "Vui lòng cung cấp token và mật khẩu mới.", 400);
    }

    if (password.length < 8) {
      return sendError(res, "ERR_WEAK_PASSWORD", "Mật khẩu mới phải có ít nhất 8 ký tự.", 400);
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (decoded.purpose !== "password_reset") {
        return sendError(res, "ERR_INVALID_RESET_TOKEN", "Reset token không hợp lệ.", 401);
      }

      const [users] = await pool.execute("SELECT id FROM Users WHERE id = ? AND email = ?", [
        decoded.id,
        decoded.email,
      ]);

      if (users.length === 0) {
        return sendError(res, "ERR_USER_NOT_FOUND", "Tài khoản không tồn tại.", 404);
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      await pool.execute("UPDATE Users SET password = ? WHERE id = ?", [hashedPassword, decoded.id]);

      return sendSuccess(res, null, "Đặt lại mật khẩu thành công.");
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return sendError(res, "ERR_RESET_TOKEN_EXPIRED", "Reset token đã hết hạn.", 401);
      }

      if (error.name === "JsonWebTokenError") {
        return sendError(res, "ERR_INVALID_RESET_TOKEN", "Reset token không hợp lệ.", 401);
      }

      console.error("[Auth Reset Password Error]:", error);
      return sendError(res, "ERR_SERVER", "Lỗi máy chủ khi đặt lại mật khẩu.", 500);
    }
  }
}

module.exports = AuthController;
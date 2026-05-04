const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const pool = require("../config/db");
const { sendSuccess, sendError } = require("../utils/response");
const logger = require("../utils/logger");

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const BCRYPT_SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 10);

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is missing in environment variables.");
  }

  return secret;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeUsername(username) {
  return String(username || "").trim();
}

function buildPublicUser(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role || "user",
    accountStatus: row.account_status || "active",
    balance: Number(row.balance || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role || "user",
      accountStatus: user.accountStatus || "active",
    },
    getJwtSecret(),
    {
      expiresIn: JWT_EXPIRES_IN,
    },
  );
}

function isStrongEnoughPassword(password) {
  return typeof password === "string" && password.length >= 8;
}

class AuthController {
  static async register(req, res) {
    const username = normalizeUsername(req.body?.username);
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!username || !email || !password) {
      return sendError(res, "ERR_MISSING_DATA", "Vui lòng nhập đủ tên đăng nhập, email và mật khẩu.", 400);
    }

    if (!isStrongEnoughPassword(password)) {
      return sendError(res, "ERR_WEAK_PASSWORD", "Mật khẩu phải có ít nhất 8 ký tự.", 400);
    }

    try {
      const [existingUsers] = await pool.execute(
        `
          SELECT id, username, email
          FROM Users
          WHERE username = ? OR email = ?
          LIMIT 1
        `,
        [username, email],
      );

      if (existingUsers.length > 0) {
        const duplicatedField = existingUsers[0].email === email ? "email" : "tên đăng nhập";
        return sendError(res, "ERR_USER_EXISTS", `${duplicatedField} đã tồn tại trong hệ thống.`, 409);
      }

      const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

      const [result] = await pool.execute(
        `
          INSERT INTO Users
            (username, email, password, role, account_status, balance)
          VALUES
            (?, ?, ?, 'user', 'active', 0.00)
        `,
        [username, email, passwordHash],
      );

      const user = {
        id: result.insertId,
        username,
        email,
        role: "user",
        accountStatus: "active",
        balance: 0,
      };

      const token = signToken(user);

      return sendSuccess(
        res,
        {
          token,
          user,
        },
        "Tạo tài khoản thành công.",
        201,
      );
    } catch (error) {
      logger.error("[Auth Register Error]:", error);
      return sendError(res, "ERR_REGISTER_FAILED", "Không thể tạo tài khoản lúc này.", 500);
    }
  }

  static async login(req, res) {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return sendError(res, "ERR_MISSING_DATA", "Vui lòng nhập email và mật khẩu.", 400);
    }

    try {
      const [rows] = await pool.execute(
        `
          SELECT
            id,
            username,
            email,
            password,
            role,
            account_status,
            balance,
            created_at,
            updated_at
          FROM Users
          WHERE email = ?
          LIMIT 1
        `,
        [email],
      );

      if (rows.length === 0) {
        return sendError(res, "ERR_INVALID_CREDENTIALS", "Email hoặc mật khẩu không chính xác.", 401);
      }

      const userRow = rows[0];

      if (userRow.account_status === "locked") {
        return sendError(
          res,
          "ERR_ACCOUNT_LOCKED",
          "Tài khoản của bạn đang bị khóa. Vui lòng liên hệ quản trị viên.",
          403,
        );
      }

      const isPasswordValid = await bcrypt.compare(password, userRow.password);

      if (!isPasswordValid) {
        return sendError(res, "ERR_INVALID_CREDENTIALS", "Email hoặc mật khẩu không chính xác.", 401);
      }

      const user = buildPublicUser(userRow);
      const token = signToken(user);

      return sendSuccess(
        res,
        {
          token,
          user,
        },
        "Đăng nhập thành công.",
      );
    } catch (error) {
      logger.error("[Auth Login Error]:", error);
      return sendError(res, "ERR_LOGIN_FAILED", "Không thể đăng nhập lúc này.", 500);
    }
  }

  static async me(req, res) {
    if (!req.user?.id) {
      return sendError(res, "ERR_UNAUTHORIZED", "Phiên đăng nhập không hợp lệ.", 401);
    }

    try {
      const [rows] = await pool.execute(
        `
          SELECT
            id,
            username,
            email,
            role,
            account_status,
            balance,
            created_at,
            updated_at
          FROM Users
          WHERE id = ?
          LIMIT 1
        `,
        [req.user.id],
      );

      if (rows.length === 0) {
        return sendError(res, "ERR_USER_NOT_FOUND", "Không tìm thấy tài khoản.", 404);
      }

      const user = buildPublicUser(rows[0]);

      return sendSuccess(
        res,
        {
          user,
        },
        "Lấy thông tin tài khoản thành công.",
      );
    } catch (error) {
      logger.error("[Auth Me Error]:", error);
      return sendError(res, "ERR_ME_FAILED", "Không thể lấy thông tin tài khoản.", 500);
    }
  }
}

module.exports = AuthController;
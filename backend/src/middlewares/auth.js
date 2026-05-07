const jwt = require("jsonwebtoken");

const pool = require("../config/db");
const { sendError } = require("../utils/response");

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is missing in environment variables.");
  }

  return secret;
}

function extractBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || "";

  if (!header || typeof header !== "string") {
    return null;
  }

  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

async function findUserById(userId) {
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
    [userId],
  );

  return rows[0] || null;
}

async function hydrateUserFromRequest(req) {
  const token = extractBearerToken(req);

  if (!token) {
    return null;
  }

  const decoded = jwt.verify(token, getJwtSecret());

  if (!decoded?.id) {
    return null;
  }

  const user = await findUserById(decoded.id);

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role || "user",
    accountStatus: user.account_status || "active",
    balance: Number(user.balance || 0),
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

async function authMiddleware(req, res, next) {
  try {
    const user = await hydrateUserFromRequest(req);

    if (!user) {
      return sendError(res, "ERR_UNAUTHORIZED", "Vui lòng đăng nhập để tiếp tục.", 401);
    }

    if (user.accountStatus === "locked") {
      return sendError(res, "ERR_ACCOUNT_LOCKED", "Tài khoản của bạn đang bị khóa.", 403);
    }

    req.user = user;
    return next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return sendError(res, "ERR_TOKEN_EXPIRED", "Phiên đăng nhập đã hết hạn.", 401);
    }

    return sendError(res, "ERR_INVALID_TOKEN", "Token không hợp lệ.", 401);
  }
}

async function optionalAuth(req, res, next) {
  try {
    const user = await hydrateUserFromRequest(req);

    if (user && user.accountStatus !== "locked") {
      req.user = user;
    }

    return next();
  } catch {
    req.user = null;
    return next();
  }
}

function authorize(...roles) {
  const allowedRoles = roles.flat().filter(Boolean);

  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, "ERR_UNAUTHORIZED", "Vui lòng đăng nhập để tiếp tục.", 401);
    }

    if (allowedRoles.length === 0) {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      return sendError(res, "ERR_FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.", 403);
    }

    return next();
  };
}

module.exports = {
  authMiddleware,
  optionalAuth,
  authorize,
};
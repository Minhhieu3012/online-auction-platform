const express = require("express");

const pool = require("../config/db");
const authModule = require("../middlewares/auth");

const authMiddleware = authModule.authMiddleware || authModule;

const router = express.Router();

function sendSuccess(res, data = {}, message = "Thành công.") {
  return res.status(200).json({
    success: true,
    message,
    data,
  });
}

function sendError(res, errorCode, message, status = 500) {
  return res.status(status).json({
    success: false,
    error_code: errorCode,
    message,
  });
}

function normalizeLimit(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 6;
  }

  return Math.min(Math.max(Math.floor(parsed), 1), 20);
}

function looksLikeMojibake(value) {
  return /Ã.|Â.|Ä.|Å.|Æ.|áº|á»|â€|â€™|â€œ|â€/.test(String(value ?? ""));
}

function decodeMojibake(value) {
  const text = String(value ?? "");

  if (!text || !looksLikeMojibake(text)) {
    return text;
  }

  try {
    const bytes = Uint8Array.from(Array.from(text, (char) => char.charCodeAt(0) & 0xff));
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return text;
  }
}

function normalizeNotificationRow(row) {
  const notificationId = Number(row.id);
  const userId = Number(row.user_id);
  const auctionId = row.auction_id === null || row.auction_id === undefined ? null : Number(row.auction_id);
  const isRead = Boolean(row.is_read);
  const actionUrl = row.action_url || "";

  return {
    id: notificationId,
    notificationId,
    notification_id: notificationId,

    userId,
    user_id: userId,

    auctionId,
    auction_id: auctionId,

    type: row.type || "SYSTEM",
    title: decodeMojibake(row.title || "Thông báo"),
    message: decodeMojibake(row.message || "Bạn có một cập nhật mới."),

    isRead,
    is_read: isRead,

    actionUrl,
    action_url: actionUrl,

    createdAt: row.created_at,
    created_at: row.created_at,

    readAt: row.read_at,
    read_at: row.read_at,
  };
}

/**
 * GET /api/notifications?limit=6
 * Lấy danh sách thông báo của user đang đăng nhập.
 */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    const limit = normalizeLimit(req.query.limit);

    if (!userId) {
      return sendError(res, "ERR_UNAUTHORIZED", "Vui lòng đăng nhập để xem thông báo.", 401);
    }

    const [notificationRows] = await pool.execute(
      `
        SELECT
          id,
          user_id,
          auction_id,
          type,
          title,
          message,
          is_read,
          action_url,
          created_at,
          read_at
        FROM Notifications
        WHERE user_id = ?
        ORDER BY is_read ASC, created_at DESC, id DESC
        LIMIT ${limit}
      `,
      [userId],
    );

    const [countRows] = await pool.execute(
      `
        SELECT COUNT(*) AS unread_count
        FROM Notifications
        WHERE user_id = ?
          AND is_read = 0
      `,
      [userId],
    );

    const unreadCount = Number(countRows[0]?.unread_count || 0);

    return sendSuccess(
      res,
      {
        notifications: notificationRows.map(normalizeNotificationRow),
        unreadCount,
        unread_count: unreadCount,
      },
      "Lấy danh sách thông báo thành công.",
    );
  } catch (error) {
    console.error("[Notifications] List Error:", error);
    return sendError(res, "ERR_NOTIFICATIONS_LIST", "Không thể tải thông báo.", 500);
  }
});

/**
 * PATCH /api/notifications/read-all
 * Đánh dấu tất cả thông báo của user hiện tại là đã đọc.
 */
router.patch("/read-all", authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, "ERR_UNAUTHORIZED", "Vui lòng đăng nhập để cập nhật thông báo.", 401);
    }

    const [result] = await pool.execute(
      `
        UPDATE Notifications
        SET
          is_read = 1,
          read_at = COALESCE(read_at, NOW())
        WHERE user_id = ?
          AND is_read = 0
      `,
      [userId],
    );

    const updatedCount = result.affectedRows || 0;

    return sendSuccess(
      res,
      {
        updatedCount,
        updated_count: updatedCount,
        affectedRows: updatedCount,
        affected_rows: updatedCount,
      },
      "Đã đánh dấu tất cả thông báo là đã đọc.",
    );
  } catch (error) {
    console.error("[Notifications] Read All Error:", error);
    return sendError(res, "ERR_NOTIFICATIONS_READ_ALL", "Không thể đánh dấu tất cả thông báo.", 500);
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Đánh dấu 1 thông báo cụ thể là đã đọc.
 */
router.patch("/:id/read", authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    const notificationId = Number(req.params.id);

    if (!userId) {
      return sendError(res, "ERR_UNAUTHORIZED", "Vui lòng đăng nhập để cập nhật thông báo.", 401);
    }

    if (!Number.isInteger(notificationId) || notificationId <= 0) {
      return sendError(res, "ERR_INVALID_NOTIFICATION_ID", "ID thông báo không hợp lệ.", 400);
    }

    const [result] = await pool.execute(
      `
        UPDATE Notifications
        SET
          is_read = 1,
          read_at = COALESCE(read_at, NOW())
        WHERE id = ?
          AND user_id = ?
      `,
      [notificationId, userId],
    );

    if (!result.affectedRows) {
      return sendError(res, "ERR_NOTIFICATION_NOT_FOUND", "Không tìm thấy thông báo.", 404);
    }

    return sendSuccess(
      res,
      {
        id: notificationId,
        notificationId,
        notification_id: notificationId,
        affectedRows: result.affectedRows || 0,
        affected_rows: result.affectedRows || 0,
      },
      "Đã đánh dấu thông báo là đã đọc.",
    );
  } catch (error) {
    console.error("[Notifications] Read One Error:", error);
    return sendError(res, "ERR_NOTIFICATION_READ", "Không thể cập nhật thông báo.", 500);
  }
});

module.exports = router;
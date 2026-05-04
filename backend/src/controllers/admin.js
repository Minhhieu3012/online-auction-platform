const pool = require("../config/db");
const { sendSuccess, sendError } = require("../utils/response");
const logger = require("../utils/logger");

function toMysqlDatetime(date) {
  if (!date) return null;
  return new Date(date).toISOString().slice(0, 19).replace("T", " ");
}

function formatUTC(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();

  const text = String(value);
  if (text.endsWith("Z")) return text;
  return text.replace(" ", "T") + "Z";
}

function escapeLike(value) {
  return `%${String(value || "").trim()}%`;
}

function normalizeStatus(value) {
  const map = {
    pending: "Pending",
    rejected: "Rejected",
    scheduled: "Scheduled",
    active: "Active",
    closing: "Closing",
    ended: "Ended",
    cancelled: "Cancelled",
    completed: "Completed",
    payment_pending: "Payment Pending",
    "payment-pending": "Payment Pending",
    "payment pending": "Payment Pending",
  };

  return map[String(value || "").trim().toLowerCase()] || null;
}

function getSortClause(sort) {
  if (sort === "highest-bid") return "a.current_price DESC";
  if (sort === "newest") return "a.created_at DESC";
  if (sort === "most-bids") return "bid_count DESC";
  if (sort === "pending-first") return "FIELD(a.status, 'Pending', 'Active', 'Scheduled', 'Closing', 'Payment Pending', 'Ended', 'Completed', 'Rejected', 'Cancelled'), a.created_at DESC";
  return "a.created_at DESC";
}

function parseJson(value, fallback = []) {
  if (!value) return fallback;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function mapAuction(row) {
  return {
    id: row.id,
    lot: `Lô #${String(row.id).padStart(3, "0")}`,
    productId: row.product_id,
    title: row.product_name,
    description: row.description || "",
    category: row.category || "collectibles",
    imageUrl: row.image_url || null,

    createdBy: row.created_by,
    sellerUsername: row.seller_username || "",
    sellerEmail: row.seller_email || "",

    status: row.status,
    currentPrice: Number(row.current_price || 0),
    stepPrice: Number(row.step_price || 0),

    requiresDeposit: Boolean(row.requires_deposit),
    depositAmount: Number(row.deposit_amount || 0),

    startTime: formatUTC(row.start_time),
    endTime: formatUTC(row.end_time),

    winnerId: row.winner_id,
    winnerUsername: row.winner_username || null,
    finalPrice: row.final_price === null ? null : Number(row.final_price),

    approvedBy: row.approved_by,
    approvedAt: formatUTC(row.approved_at),

    rejectedBy: row.rejected_by,
    rejectedAt: formatUTC(row.rejected_at),
    rejectionReason: row.rejection_reason || "",

    cancelledBy: row.cancelled_by,
    cancelledAt: formatUTC(row.cancelled_at),
    cancellationReason: row.cancellation_reason || "",

    bidCount: Number(row.bid_count || 0),
    depositCount: Number(row.deposit_count || 0),
    createdAt: formatUTC(row.created_at),
    updatedAt: formatUTC(row.updated_at),
  };
}

function mapUser(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    accountStatus: row.account_status,
    balance: Number(row.balance || 0),
    createdAt: formatUTC(row.created_at),
    auctionCount: Number(row.auction_count || 0),
    bidCount: Number(row.bid_count || 0),
    fraudAlertCount: Number(row.fraud_alert_count || 0),
  };
}

function mapFraudAlert(row) {
  return {
    id: row.id,
    auctionId: row.auction_id,
    auctionTitle: row.auction_title || "",
    userId: row.user_id,
    username: row.username || "",
    email: row.email || "",
    riskScore: Number(row.risk_score || 0),
    reasons: parseJson(row.reasons, []),
    status: row.status,
    reviewedBy: row.reviewed_by,
    reviewedAt: formatUTC(row.reviewed_at),
    adminNote: row.admin_note || "",
    createdAt: formatUTC(row.created_at),
    updatedAt: formatUTC(row.updated_at),
  };
}

function mapSettlement(row) {
  return {
    id: row.id,
    auctionId: row.auction_id,
    auctionTitle: row.auction_title || "",
    winnerId: row.winner_id,
    winnerUsername: row.winner_username || "",
    finalPrice: Number(row.final_price || 0),
    depositAppliedAmount: Number(row.deposit_applied_amount || 0),
    remainingAmount: Number(row.remaining_amount || 0),
    status: row.status,
    dueAt: formatUTC(row.due_at),
    paidAt: formatUTC(row.paid_at),
    createdAt: formatUTC(row.created_at),
  };
}

async function writeAdminLog(connection, req, payload) {
  const adminId = req.user?.id || null;

  await connection.execute(
    `
      INSERT INTO Admin_Action_Logs
        (admin_id, target_type, target_id, action, old_value, new_value, note, ip_address, user_agent)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      adminId,
      payload.targetType,
      payload.targetId || null,
      payload.action,
      payload.oldValue ? JSON.stringify(payload.oldValue) : null,
      payload.newValue ? JSON.stringify(payload.newValue) : null,
      payload.note || null,
      req.ip || null,
      req.headers["user-agent"] || null,
    ],
  );
}

async function createNotification(connection, { userId, auctionId = null, type = "SYSTEM", title, message, actionUrl = null }) {
  if (!userId || !title || !message) return;

  await connection.execute(
    `
      INSERT INTO Notifications
        (user_id, auction_id, type, title, message, action_url)
      VALUES
        (?, ?, ?, ?, ?, ?)
    `,
    [userId, auctionId, type, title, message, actionUrl],
  );
}

async function getAuctionForUpdate(connection, auctionId) {
  const [rows] = await connection.execute(
    `
      SELECT
        a.*,
        p.name AS product_name,
        p.description,
        p.category,
        p.image_url,
        u.username AS seller_username,
        u.email AS seller_email
      FROM Auctions a
      INNER JOIN Products p ON p.id = a.product_id
      INNER JOIN Users u ON u.id = a.created_by
      WHERE a.id = ?
      LIMIT 1
      FOR UPDATE
    `,
    [auctionId],
  );

  return rows[0] || null;
}

async function getAuctionRows({ status, category, q, sort, limit, offset }) {
  const where = [];
  const params = [];

  const normalizedStatus = normalizeStatus(status);
  if (normalizedStatus) {
    where.push("a.status = ?");
    params.push(normalizedStatus);
  }

  if (category && category !== "all") {
    where.push("LOWER(COALESCE(p.category, '')) = LOWER(?)");
    params.push(category);
  }

  if (q && q.trim()) {
    where.push("(p.name LIKE ? OR p.description LIKE ? OR u.username LIKE ? OR u.email LIKE ? OR CAST(a.id AS CHAR) LIKE ?)");
    const keyword = escapeLike(q);
    params.push(keyword, keyword, keyword, keyword, keyword);
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 200);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const sortSql = getSortClause(sort);

  const [rows] = await pool.execute(
    `
      SELECT
        a.*,
        p.name AS product_name,
        p.description,
        p.category,
        p.image_url,
        seller.username AS seller_username,
        seller.email AS seller_email,
        winner.username AS winner_username,
        COUNT(DISTINCT b.id) AS bid_count,
        COUNT(DISTINCT d.id) AS deposit_count
      FROM Auctions a
      INNER JOIN Products p ON p.id = a.product_id
      INNER JOIN Users seller ON seller.id = a.created_by
      LEFT JOIN Users winner ON winner.id = a.winner_id
      LEFT JOIN Bids b ON b.auction_id = a.id
      LEFT JOIN auction_deposits d ON d.auction_id = a.id AND d.status = 'SUCCEEDED'
      ${whereSql}
      GROUP BY a.id
      ORDER BY ${sortSql}
      LIMIT ${safeLimit}
      OFFSET ${safeOffset}
    `,
    params,
  );

  return rows.map(mapAuction);
}

class AdminController {
  static async dashboard(req, res) {
    try {
      const [[auctionStats]] = await pool.execute(
        `
          SELECT
            COUNT(*) AS total_auctions,
            SUM(status = 'Pending') AS pending_auctions,
            SUM(status = 'Rejected') AS rejected_auctions,
            SUM(status = 'Active') AS active_auctions,
            SUM(status = 'Scheduled') AS scheduled_auctions,
            SUM(status = 'Closing') AS closing_auctions,
            SUM(status = 'Ended') AS ended_auctions,
            SUM(status = 'Payment Pending') AS payment_pending_auctions,
            SUM(status = 'Completed') AS completed_auctions,
            COALESCE(SUM(current_price), 0) AS total_volume
          FROM Auctions
        `,
      );

      const [[userStats]] = await pool.execute(
        `
          SELECT
            COUNT(*) AS total_users,
            SUM(role = 'admin') AS total_admins,
            SUM(account_status = 'locked') AS locked_users
          FROM Users
        `,
      );

      const [[moneyStats]] = await pool.execute(
        `
          SELECT
            COALESCE(SUM(CASE WHEN status = 'SUCCEEDED' THEN amount ELSE 0 END), 0) AS successful_deposits,
            COALESCE(SUM(CASE WHEN status = 'REFUNDED' THEN amount ELSE 0 END), 0) AS refunded_deposits
          FROM auction_deposits
        `,
      );

      const [[fraudStats]] = await pool.execute(
        `
          SELECT
            COUNT(*) AS total_fraud_alerts,
            SUM(status = 'OPEN') AS open_fraud_alerts,
            SUM(risk_score >= 0.60) AS high_risk_alerts
          FROM Fraud_Alerts
        `,
      );

      const topAuctions = await getAuctionRows({
        sort: "highest-bid",
        limit: 5,
        offset: 0,
      });

      return sendSuccess(
        res,
        {
          stats: {
            ...auctionStats,
            ...userStats,
            ...moneyStats,
            ...fraudStats,
          },
          topAuctions,
        },
        "Lấy tổng quan quản trị thành công.",
      );
    } catch (error) {
      logger.error("[Admin Dashboard Error]:", error);
      return sendError(res, "ERR_ADMIN_DASHBOARD", "Không thể tải dữ liệu tổng quan admin.", 500);
    }
  }

  static async listAuctions(req, res) {
    try {
      const auctions = await getAuctionRows(req.query);

      return sendSuccess(
        res,
        {
          auctions,
          meta: {
            count: auctions.length,
          },
        },
        "Lấy danh sách phiên đấu giá cho admin thành công.",
      );
    } catch (error) {
      logger.error("[Admin List Auctions Error]:", error);
      return sendError(res, "ERR_ADMIN_AUCTIONS", "Không thể tải danh sách phiên đấu giá.", 500);
    }
  }

  static async approveAuction(req, res) {
    const auctionId = Number(req.params.id);
    const { startTime, endTime } = req.body || {};

    if (!auctionId) {
      return sendError(res, "ERR_INVALID_AUCTION_ID", "ID phiên đấu giá không hợp lệ.", 400);
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const auction = await getAuctionForUpdate(connection, auctionId);
      if (!auction) {
        await connection.rollback();
        return sendError(res, "ERR_AUCTION_NOT_FOUND", "Không tìm thấy phiên đấu giá.", 404);
      }

      if (!["Pending", "Rejected", "Scheduled"].includes(auction.status)) {
        await connection.rollback();
        return sendError(res, "ERR_INVALID_STATUS", "Chỉ có thể duyệt phiên đang chờ hoặc đã bị từ chối.", 400);
      }

      const now = new Date();
      const parsedStartTime = startTime ? new Date(startTime) : now;
      const parsedEndTime = endTime ? new Date(endTime) : new Date(auction.end_time);
      const nextStatus = parsedStartTime.getTime() > Date.now() ? "Scheduled" : "Active";

      if (Number.isNaN(parsedEndTime.getTime()) || parsedEndTime.getTime() <= Date.now()) {
        await connection.rollback();
        return sendError(res, "ERR_INVALID_END_TIME", "Thời gian kết thúc phải nằm trong tương lai.", 400);
      }

      await connection.execute(
        `
          UPDATE Auctions
          SET
            status = ?,
            start_time = ?,
            end_time = ?,
            approved_by = ?,
            approved_at = NOW(),
            rejected_by = NULL,
            rejected_at = NULL,
            rejection_reason = NULL,
            version = version + 1
          WHERE id = ?
        `,
        [
          nextStatus,
          toMysqlDatetime(parsedStartTime),
          toMysqlDatetime(parsedEndTime),
          req.user.id,
          auctionId,
        ],
      );

      await createNotification(connection, {
        userId: auction.created_by,
        auctionId,
        type: "AUCTION_APPROVED",
        title: "Phiên đấu giá đã được duyệt",
        message: `Phiên "${auction.product_name}" đã được admin thông qua.`,
        actionUrl: `/pages/product-detail.html?id=${auctionId}`,
      });

      await writeAdminLog(connection, req, {
        targetType: "auction",
        targetId: auctionId,
        action: "APPROVE_AUCTION",
        oldValue: { status: auction.status },
        newValue: { status: nextStatus },
        note: "Admin duyệt phiên đấu giá.",
      });

      await connection.commit();

      return sendSuccess(
        res,
        {
          auctionId,
          status: nextStatus,
        },
        "Đã duyệt phiên đấu giá.",
      );
    } catch (error) {
      await connection.rollback();
      logger.error("[Admin Approve Auction Error]:", error);
      return sendError(res, "ERR_APPROVE_AUCTION", "Không thể duyệt phiên đấu giá.", 500);
    } finally {
      connection.release();
    }
  }

  static async rejectAuction(req, res) {
    const auctionId = Number(req.params.id);
    const reason = String(req.body?.reason || "").trim();

    if (!auctionId) {
      return sendError(res, "ERR_INVALID_AUCTION_ID", "ID phiên đấu giá không hợp lệ.", 400);
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const auction = await getAuctionForUpdate(connection, auctionId);
      if (!auction) {
        await connection.rollback();
        return sendError(res, "ERR_AUCTION_NOT_FOUND", "Không tìm thấy phiên đấu giá.", 404);
      }

      if (!["Pending", "Scheduled"].includes(auction.status)) {
        await connection.rollback();
        return sendError(res, "ERR_INVALID_STATUS", "Chỉ có thể từ chối phiên đang chờ duyệt hoặc đã lên lịch.", 400);
      }

      await connection.execute(
        `
          UPDATE Auctions
          SET
            status = 'Rejected',
            rejected_by = ?,
            rejected_at = NOW(),
            rejection_reason = ?,
            version = version + 1
          WHERE id = ?
        `,
        [req.user.id, reason || "Không đạt yêu cầu duyệt.", auctionId],
      );

      await createNotification(connection, {
        userId: auction.created_by,
        auctionId,
        type: "AUCTION_REJECTED",
        title: "Phiên đấu giá bị từ chối",
        message: reason || `Phiên "${auction.product_name}" chưa được thông qua.`,
        actionUrl: `/pages/account.html#selling`,
      });

      await writeAdminLog(connection, req, {
        targetType: "auction",
        targetId: auctionId,
        action: "REJECT_AUCTION",
        oldValue: { status: auction.status },
        newValue: { status: "Rejected", reason },
        note: reason || "Admin từ chối phiên đấu giá.",
      });

      await connection.commit();

      return sendSuccess(
        res,
        {
          auctionId,
          status: "Rejected",
        },
        "Đã từ chối phiên đấu giá.",
      );
    } catch (error) {
      await connection.rollback();
      logger.error("[Admin Reject Auction Error]:", error);
      return sendError(res, "ERR_REJECT_AUCTION", "Không thể từ chối phiên đấu giá.", 500);
    } finally {
      connection.release();
    }
  }

  static async cancelAuction(req, res) {
    const auctionId = Number(req.params.id);
    const reason = String(req.body?.reason || "").trim();

    if (!auctionId) {
      return sendError(res, "ERR_INVALID_AUCTION_ID", "ID phiên đấu giá không hợp lệ.", 400);
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const auction = await getAuctionForUpdate(connection, auctionId);
      if (!auction) {
        await connection.rollback();
        return sendError(res, "ERR_AUCTION_NOT_FOUND", "Không tìm thấy phiên đấu giá.", 404);
      }

      if (["Completed", "Cancelled"].includes(auction.status)) {
        await connection.rollback();
        return sendError(res, "ERR_INVALID_STATUS", "Không thể hủy phiên đã hoàn tất hoặc đã hủy.", 400);
      }

      await connection.execute(
        `
          UPDATE Auctions
          SET
            status = 'Cancelled',
            cancelled_by = ?,
            cancelled_at = NOW(),
            cancellation_reason = ?,
            version = version + 1
          WHERE id = ?
        `,
        [req.user.id, reason || "Admin hủy phiên đấu giá.", auctionId],
      );

      await createNotification(connection, {
        userId: auction.created_by,
        auctionId,
        type: "AUCTION_ENDED",
        title: "Phiên đấu giá đã bị hủy",
        message: reason || `Phiên "${auction.product_name}" đã bị admin hủy.`,
        actionUrl: `/pages/account.html#selling`,
      });

      await writeAdminLog(connection, req, {
        targetType: "auction",
        targetId: auctionId,
        action: "CANCEL_AUCTION",
        oldValue: { status: auction.status },
        newValue: { status: "Cancelled", reason },
        note: reason || "Admin hủy phiên đấu giá.",
      });

      await connection.commit();

      return sendSuccess(
        res,
        {
          auctionId,
          status: "Cancelled",
        },
        "Đã hủy phiên đấu giá.",
      );
    } catch (error) {
      await connection.rollback();
      logger.error("[Admin Cancel Auction Error]:", error);
      return sendError(res, "ERR_CANCEL_AUCTION", "Không thể hủy phiên đấu giá.", 500);
    } finally {
      connection.release();
    }
  }

  static async listUsers(req, res) {
    const { q, role, status, limit = 100, offset = 0 } = req.query;

    try {
      const where = [];
      const params = [];

      if (q && q.trim()) {
        where.push("(u.username LIKE ? OR u.email LIKE ? OR CAST(u.id AS CHAR) LIKE ?)");
        const keyword = escapeLike(q);
        params.push(keyword, keyword, keyword);
      }

      if (role && ["user", "admin"].includes(role)) {
        where.push("u.role = ?");
        params.push(role);
      }

      if (status && ["active", "locked"].includes(status)) {
        where.push("u.account_status = ?");
        params.push(status);
      }

      const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 200);
      const safeOffset = Math.max(Number(offset) || 0, 0);
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

      const [rows] = await pool.execute(
        `
          SELECT
            u.id,
            u.username,
            u.email,
            u.role,
            u.account_status,
            u.balance,
            u.created_at,
            COUNT(DISTINCT a.id) AS auction_count,
            COUNT(DISTINCT b.id) AS bid_count,
            COUNT(DISTINCT f.id) AS fraud_alert_count
          FROM Users u
          LEFT JOIN Auctions a ON a.created_by = u.id
          LEFT JOIN Bids b ON b.user_id = u.id
          LEFT JOIN Fraud_Alerts f ON f.user_id = u.id
          ${whereSql}
          GROUP BY u.id
          ORDER BY u.created_at DESC
          LIMIT ${safeLimit}
          OFFSET ${safeOffset}
        `,
        params,
      );

      return sendSuccess(
        res,
        {
          users: rows.map(mapUser),
        },
        "Lấy danh sách người dùng thành công.",
      );
    } catch (error) {
      logger.error("[Admin List Users Error]:", error);
      return sendError(res, "ERR_ADMIN_USERS", "Không thể tải danh sách người dùng.", 500);
    }
  }

  static async lockUser(req, res) {
    return AdminController.updateUserStatus(req, res, "locked");
  }

  static async unlockUser(req, res) {
    return AdminController.updateUserStatus(req, res, "active");
  }

  static async updateUserStatus(req, res, status) {
    const userId = Number(req.params.id);

    if (!userId) {
      return sendError(res, "ERR_INVALID_USER_ID", "ID người dùng không hợp lệ.", 400);
    }

    if (userId === Number(req.user.id)) {
      return sendError(res, "ERR_SELF_LOCK", "Admin không thể tự khóa chính mình.", 400);
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [rows] = await connection.execute("SELECT id, username, email, role, account_status FROM Users WHERE id = ? FOR UPDATE", [userId]);

      if (rows.length === 0) {
        await connection.rollback();
        return sendError(res, "ERR_USER_NOT_FOUND", "Không tìm thấy người dùng.", 404);
      }

      const user = rows[0];

      await connection.execute("UPDATE Users SET account_status = ? WHERE id = ?", [status, userId]);

      await writeAdminLog(connection, req, {
        targetType: "user",
        targetId: userId,
        action: status === "locked" ? "LOCK_USER" : "UNLOCK_USER",
        oldValue: { account_status: user.account_status },
        newValue: { account_status: status },
        note: req.body?.note || null,
      });

      await connection.commit();

      return sendSuccess(
        res,
        {
          userId,
          status,
        },
        status === "locked" ? "Đã khóa tài khoản người dùng." : "Đã mở khóa tài khoản người dùng.",
      );
    } catch (error) {
      await connection.rollback();
      logger.error("[Admin User Status Error]:", error);
      return sendError(res, "ERR_USER_STATUS", "Không thể cập nhật trạng thái người dùng.", 500);
    } finally {
      connection.release();
    }
  }

  static async listFraudAlerts(req, res) {
    const { status, limit = 100, offset = 0 } = req.query;

    try {
      const where = [];
      const params = [];

      if (status && ["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"].includes(status)) {
        where.push("f.status = ?");
        params.push(status);
      }

      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 200);
      const safeOffset = Math.max(Number(offset) || 0, 0);

      const [rows] = await pool.execute(
        `
          SELECT
            f.*,
            u.username,
            u.email,
            p.name AS auction_title
          FROM Fraud_Alerts f
          INNER JOIN Users u ON u.id = f.user_id
          INNER JOIN Auctions a ON a.id = f.auction_id
          INNER JOIN Products p ON p.id = a.product_id
          ${whereSql}
          ORDER BY f.risk_score DESC, f.created_at DESC
          LIMIT ${safeLimit}
          OFFSET ${safeOffset}
        `,
        params,
      );

      return sendSuccess(
        res,
        {
          alerts: rows.map(mapFraudAlert),
        },
        "Lấy danh sách cảnh báo gian lận thành công.",
      );
    } catch (error) {
      logger.error("[Admin Fraud Alerts Error]:", error);
      return sendError(res, "ERR_FRAUD_ALERTS", "Không thể tải cảnh báo gian lận.", 500);
    }
  }

  static async updateFraudAlert(req, res) {
    const alertId = Number(req.params.id);
    const status = String(req.body?.status || "").trim().toUpperCase();
    const note = String(req.body?.note || "").trim();

    if (!alertId) {
      return sendError(res, "ERR_INVALID_ALERT_ID", "ID cảnh báo không hợp lệ.", 400);
    }

    if (!["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"].includes(status)) {
      return sendError(res, "ERR_INVALID_ALERT_STATUS", "Trạng thái cảnh báo không hợp lệ.", 400);
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [rows] = await connection.execute("SELECT * FROM Fraud_Alerts WHERE id = ? FOR UPDATE", [alertId]);

      if (rows.length === 0) {
        await connection.rollback();
        return sendError(res, "ERR_ALERT_NOT_FOUND", "Không tìm thấy cảnh báo.", 404);
      }

      const alert = rows[0];

      await connection.execute(
        `
          UPDATE Fraud_Alerts
          SET
            status = ?,
            reviewed_by = ?,
            reviewed_at = NOW(),
            admin_note = ?
          WHERE id = ?
        `,
        [status, req.user.id, note || null, alertId],
      );

      await writeAdminLog(connection, req, {
        targetType: "fraud_alert",
        targetId: alertId,
        action: "UPDATE_FRAUD_ALERT",
        oldValue: { status: alert.status },
        newValue: { status, note },
        note,
      });

      await connection.commit();

      return sendSuccess(
        res,
        {
          alertId,
          status,
        },
        "Cập nhật cảnh báo gian lận thành công.",
      );
    } catch (error) {
      await connection.rollback();
      logger.error("[Admin Update Fraud Alert Error]:", error);
      return sendError(res, "ERR_UPDATE_FRAUD_ALERT", "Không thể cập nhật cảnh báo.", 500);
    } finally {
      connection.release();
    }
  }

  static async listSettlements(req, res) {
    try {
      const [rows] = await pool.execute(
        `
          SELECT
            s.*,
            p.name AS auction_title,
            u.username AS winner_username
          FROM auction_settlements s
          INNER JOIN Auctions a ON a.id = s.auction_id
          INNER JOIN Products p ON p.id = a.product_id
          INNER JOIN Users u ON u.id = s.winner_id
          ORDER BY s.created_at DESC
          LIMIT 100
        `,
      );

      return sendSuccess(
        res,
        {
          settlements: rows.map(mapSettlement),
        },
        "Lấy danh sách đối soát thành công.",
      );
    } catch (error) {
      logger.error("[Admin Settlements Error]:", error);
      return sendError(res, "ERR_SETTLEMENTS", "Không thể tải dữ liệu đối soát.", 500);
    }
  }

  static async listActionLogs(req, res) {
    try {
      const [rows] = await pool.execute(
        `
          SELECT
            l.*,
            u.username AS admin_username,
            u.email AS admin_email
          FROM Admin_Action_Logs l
          LEFT JOIN Users u ON u.id = l.admin_id
          ORDER BY l.created_at DESC
          LIMIT 100
        `,
      );

      return sendSuccess(
        res,
        {
          logs: rows.map((row) => ({
            id: row.id,
            adminId: row.admin_id,
            adminUsername: row.admin_username || "System",
            adminEmail: row.admin_email || "",
            targetType: row.target_type,
            targetId: row.target_id,
            action: row.action,
            oldValue: parseJson(row.old_value, null),
            newValue: parseJson(row.new_value, null),
            note: row.note || "",
            ipAddress: row.ip_address || "",
            createdAt: formatUTC(row.created_at),
          })),
        },
        "Lấy nhật ký quản trị thành công.",
      );
    } catch (error) {
      logger.error("[Admin Action Logs Error]:", error);
      return sendError(res, "ERR_ADMIN_LOGS", "Không thể tải nhật ký quản trị.", 500);
    }
  }
}

module.exports = AdminController;
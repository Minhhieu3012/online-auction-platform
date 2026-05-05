const pool = require("../config/db");
const redisClient = require("../config/redis");
const redisKeys = require("../utils/redis-keys");
const { scheduleAuctionClose } = require("../config/queue");
const { sendSuccess, sendError } = require("../utils/response");
const logger = require("../utils/logger");

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const DEFAULT_APPROVED_DURATION_MINUTES = 24 * 60;
const PUBLIC_STATUSES = ["Scheduled", "Active", "Closing", "Ended", "Payment Pending", "Completed"];

function isAdmin(req) {
  return String(req.user?.role || "").toLowerCase() === "admin";
}

function normalizeStatusForSql(status) {
  const statusMap = {
    pending: "Pending",
    rejected: "Rejected",
    scheduled: "Scheduled",
    active: "Active",
    closing: "Closing",
    ended: "Ended",
    payment_pending: "Payment Pending",
    "payment-pending": "Payment Pending",
    completed: "Completed",
    cancelled: "Cancelled",
  };

  return statusMap[String(status || "").trim().toLowerCase().replace(/\s+/g, "_")] || null;
}

function normalizeSort(sort) {
  const allowedSorts = ["pending-first", "ending-soon", "highest-bid", "newest", "most-bids"];
  return allowedSorts.includes(sort) ? sort : "ending-soon";
}

function getSortClause(sort) {
  if (sort === "pending-first") {
    return `
      CASE a.status
        WHEN 'Pending' THEN 0
        WHEN 'Scheduled' THEN 1
        WHEN 'Active' THEN 2
        WHEN 'Closing' THEN 3
        WHEN 'Ended' THEN 4
        WHEN 'Payment Pending' THEN 5
        WHEN 'Completed' THEN 6
        WHEN 'Rejected' THEN 7
        WHEN 'Cancelled' THEN 8
        ELSE 9
      END ASC,
      a.created_at DESC
    `;
  }

  if (sort === "highest-bid") return "a.current_price DESC";
  if (sort === "newest") return "a.created_at DESC";
  if (sort === "most-bids") return "bid_count DESC";

  return "a.end_time ASC";
}

function maskBidder(username, email) {
  const source = username || email || "Bidder";
  if (source.length <= 2) return `${source[0] || "B"}***`;
  return `${source[0]}***${source[source.length - 1]}`.toUpperCase();
}

// BẢN VÁ: Hàm ép chuỗi MySQL DATETIME thành UTC Timestamp tuyệt đối
function parseDbTimeToUTC(timeStr) {
  if (!timeStr) return 0;
  let str = String(timeStr);
  if (str.includes('GMT') || str.includes('Z')) return new Date(timeStr).getTime();
  str = str.replace(' ', 'T') + 'Z';
  return new Date(str).getTime();
}

function formatUTC(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();

  const text = String(value);
  return text.endsWith("Z") ? text : `${text.replace(" ", "T")}Z`;
}

function toMysqlDatetime(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function parsePositiveNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function resolveApprovedEndTime(currentEndTime, requestedEndTime) {
  const now = Date.now();

  if (requestedEndTime) {
    const parsed = new Date(requestedEndTime).getTime();
    if (!Number.isNaN(parsed) && parsed > now) return new Date(parsed);
  }

  const parsedCurrent = new Date(currentEndTime).getTime();
  if (!Number.isNaN(parsedCurrent) && parsedCurrent > now) return new Date(parsedCurrent);

  return new Date(now + DEFAULT_APPROVED_DURATION_MINUTES * 60000);
}

function getClientUrl() {
  return String(process.env.CLIENT_URL || "http://127.0.0.1:5500/frontend/pages").replace(/\/$/, "");
}

function mapAuctionRow(row) {
  return {
    id: row.id,
    lot: `Lô #${String(row.id).padStart(3, "0")}`,
    productId: row.product_id,
    title: row.product_name,
    name: row.product_name,
    productName: row.product_name,
    description: row.description || "",
    category: row.category || "collectibles",
    imageUrl: row.image_url || null,
    image_url: row.image_url || null,
    status: row.status,
    currentPrice: Number(row.current_price || 0),
    current_price: Number(row.current_price || 0),
    stepPrice: Number(row.step_price || 0),
    step_price: Number(row.step_price || 0),
    depositAmount: Number(row.deposit_amount || 0),
    deposit_amount: Number(row.deposit_amount || 0),
    requiresDeposit: Boolean(row.requires_deposit),
    requires_deposit: Boolean(row.requires_deposit),
    startTime: formatUTC(row.start_time),
    start_time: formatUTC(row.start_time),
    endTime: formatUTC(row.end_time),
    end_time: formatUTC(row.end_time),
    createdAt: formatUTC(row.created_at),
    created_at: formatUTC(row.created_at),
    updatedAt: formatUTC(row.updated_at),
    bidCount: Number(row.bid_count || 0),
    bid_count: Number(row.bid_count || 0),
    depositCount: Number(row.deposit_count || 0),
    createdBy: row.created_by,
    created_by: row.created_by,
    sellerUsername: row.seller_username || null,
    sellerEmail: row.seller_email || null,
    winnerId: row.winner_id || null,
    winner_id: row.winner_id || null,
    finalPrice: row.final_price === null || row.final_price === undefined ? null : Number(row.final_price),
    version: Number(row.version || 0)
  };
}

function getAuctionSelectSql(whereSql = "") {
  return `
    SELECT
      a.id,
      a.product_id,
      a.created_by,
      a.status,
      a.current_price,
      a.step_price,
      a.requires_deposit,
      a.deposit_amount,
      a.start_time,
      a.end_time,
      a.winner_id,
      a.final_price,
      a.created_at,
      a.updated_at,
      a.version,
      p.name AS product_name,
      p.description,
      p.category,
      p.image_url,
      u.username AS seller_username,
      u.email AS seller_email,
      COUNT(DISTINCT b.id) AS bid_count,
      COUNT(DISTINCT d.id) AS deposit_count
    FROM Auctions a
    INNER JOIN Products p ON p.id = a.product_id
    INNER JOIN Users u ON u.id = a.created_by
    LEFT JOIN Bids b ON b.auction_id = a.id
    LEFT JOIN auction_deposits d
      ON d.auction_id = a.id
      AND d.status = 'SUCCEEDED'
    ${whereSql}
    GROUP BY
      a.id,
      a.product_id,
      a.created_by,
      a.status,
      a.current_price,
      a.step_price,
      a.requires_deposit,
      a.deposit_amount,
      a.start_time,
      a.end_time,
      a.winner_id,
      a.final_price,
      a.created_at,
      a.updated_at,
      p.name,
      p.description,
      p.category,
      p.image_url,
      u.username,
      u.email
  `;
}

async function trySyncAuctionToRedis(auction) {
  try {
    const auctionId = auction.id;
    // BẢN VÁ: Đảm bảo Redis và BullMQ nhận được thời gian UTC chuẩn xác
    const endTimeMs = parseDbTimeToUTC(auction.end_time || auction.endTime);

    if (!endTimeMs) {
      return;
    }

    await redisClient.hSet(redisKeys.auctionInfo(auctionId), {
      current_price: String(auction.current_price || auction.currentPrice || 0),
      step_price: String(auction.step_price || auction.stepPrice || 0),
      status: auction.status || "Active",
      version: String(auction.version || 0),
      highest_bidder: "",
      end_time: new Date(endTimeMs).toISOString(),
      extension_count: "0",
    });

    await scheduleAuctionClose(auctionId, new Date(endTimeMs));
  } catch (error) {
    logger.error(`[Auction Redis Sync Warning]: ${error.message}`);
  }
}

async function tryInsertNotification(connection, payload) {
  try {
    await connection.execute(
      `
        INSERT INTO Notifications (user_id, auction_id, type, title, message, action_url)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        payload.userId,
        payload.auctionId || null,
        payload.type || "SYSTEM",
        payload.title,
        payload.message,
        payload.actionUrl || null,
      ],
    );
  } catch (error) {
    logger.error(`[Notification Warning]: ${error.message}`);
  }
}

async function tryInsertAdminLog(connection, payload) {
  try {
    await connection.execute(
      `
        INSERT INTO Admin_Action_Logs (admin_id, target_type, target_id, action, note)
        VALUES (?, ?, ?, ?, ?)
      `,
      [
        payload.adminId || null,
        payload.targetType || "auction",
        payload.targetId || null,
        payload.action,
        payload.note || null,
      ],
    );
  } catch (error) {
    logger.error(`[Admin Log Warning]: ${error.message}`);
  }
}

class AuctionController {
  static async listAuctions(req, res) {
    const {
      status,
      category,
      q,
      sort = "ending-soon",
      limit = 100,
      offset = 0,
      createdBy,
      scope,
    } = req.query;

    const adminMode = scope === "admin" || isAdmin(req);

    if (scope === "admin" && !isAdmin(req)) {
      return sendError(res, "ERR_FORBIDDEN", "Chỉ admin được xem toàn bộ phiên đấu giá.", 403);
    }

    try {
      const where = [];
      const params = [];

      const normalizedStatus = normalizeStatusForSql(status);

      if (normalizedStatus) {
        where.push("a.status = ?");
        params.push(normalizedStatus);
      } else if (!adminMode) {
        where.push(`a.status IN (${PUBLIC_STATUSES.map(() => "?").join(", ")})`);
        params.push(...PUBLIC_STATUSES);
      }

      if (category && category !== "all") {
        where.push("LOWER(COALESCE(p.category, 'collectibles')) = LOWER(?)");
        params.push(category);
      }

      if (createdBy) {
        where.push("a.created_by = ?");
        params.push(Number(createdBy));
      }

      if (q && String(q).trim()) {
        where.push(
          `
            (
              p.name LIKE ?
              OR p.description LIKE ?
              OR p.category LIKE ?
              OR u.username LIKE ?
              OR u.email LIKE ?
              OR CAST(a.id AS CHAR) LIKE ?
            )
          `,
        );

        const keyword = `%${String(q).trim()}%`;
        params.push(keyword, keyword, keyword, keyword, keyword, keyword);
      }

      const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 200);
      const safeOffset = Math.max(Number(offset) || 0, 0);
      const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

      const [rows] = await pool.execute(
        `${getAuctionSelectSql(whereSql)} ORDER BY ${getSortClause(normalizeSort(sort))} LIMIT ${safeLimit} OFFSET ${safeOffset}`,
        params,
      );

      return sendSuccess(res, { auctions: rows.map(mapAuctionRow) }, "Lấy danh sách phiên đấu giá thành công.");
    } catch (error) {
      logger.error("[Auction List Error]:", error);
      return sendError(res, "ERR_SERVER", "Không thể tải danh sách phiên đấu giá.", 500);
    }
  }

  static async listMyAuctions(req, res) {
    const userId = req.user?.id;

    try {
      const [rows] = await pool.execute(
        `${getAuctionSelectSql("WHERE a.created_by = ?")} ORDER BY a.created_at DESC`,
        [userId],
      );

      return sendSuccess(res, { auctions: rows.map(mapAuctionRow) }, "Lấy danh sách phiên của bạn thành công.");
    } catch (error) {
      logger.error("[Auction Mine Error]:", error);
      return sendError(res, "ERR_SERVER", "Không thể tải phiên của bạn.", 500);
    }
  }

  static async getAuctionById(req, res) {
    const auctionId = Number(req.params.id);

    try {
      const [rows] = await pool.execute(`${getAuctionSelectSql("WHERE a.id = ?")} LIMIT 1`, [auctionId]);

      if (rows.length === 0) {
        return sendError(res, "ERR_NOT_FOUND", "Không tìm thấy phiên đấu giá.", 404);
      }

      const [bids] = await pool.execute(
        `
          SELECT
            b.id,
            b.bid_amount,
            b.created_at,
            u.username,
            u.email
          FROM Bids b
          INNER JOIN Users u ON u.id = b.user_id
          WHERE b.auction_id = ?
          ORDER BY b.created_at DESC
          LIMIT 25
        `,
        [auctionId],
      );

      const auction = mapAuctionRow(rows[0]);

      auction.bidHistory = bids.map((bid, index) => ({
        id: bid.id,
        bidder: maskBidder(bid.username, bid.email),
        amount: Number(bid.bid_amount || 0),
        time: formatUTC(bid.created_at),
        highlight: index === 0,
      }));

      // BẢN VÁ: Gửi kèm server_time để Frontend bù trừ lệch múi giờ
      return sendSuccess(res, { 
        auction,
        server_time: new Date().toISOString()
      }, "Lấy chi tiết phiên đấu giá thành công.");
    } catch (error) {
      logger.error("[Auction Detail Error]:", error);
      return sendError(res, "ERR_SERVER", "Không thể tải chi tiết phiên đấu giá.", 500);
    }
  }

  static async createAuction(req, res) {
    const userId = req.user?.id;

    const productName = String(req.body?.productName || req.body?.title || req.body?.name || "").trim();
    const description = String(req.body?.description || "").trim();
    const category = String(req.body?.category || "Collectibles").trim();
    const imageUrl = req.body?.imageUrl || req.body?.image_url || null;

    const startingPrice = parsePositiveNumber(
      req.body?.startingPrice || req.body?.currentPrice || req.body?.startingBid,
      0,
    );

    const stepPrice = parsePositiveNumber(req.body?.stepPrice || req.body?.bidIncrement || req.body?.increment, 0);

    const requestedDurationMinutes = parsePositiveNumber(req.body?.durationMinutes, 0);
    const durationHours = parsePositiveNumber(req.body?.durationHours || req.body?.duration, 48);
    const durationMinutes = requestedDurationMinutes || durationHours * 60;

    const requestedStatus = normalizeStatusForSql(req.body?.status);
    const initialStatus = isAdmin(req) && requestedStatus ? requestedStatus : "Pending";

    const depositAmount = parsePositiveNumber(req.body?.depositAmount, Math.round(startingPrice * 0.1 * 100) / 100);
    const requiresDeposit = req.body?.requiresDeposit === false || req.body?.requires_deposit === false ? 0 : 1;

    if (!userId) {
      return sendError(res, "ERR_UNAUTHORIZED", "Bạn cần đăng nhập để tạo phiên đấu giá.", 401);
    }

    if (!productName || !description || !startingPrice || !stepPrice) {
      return sendError(
        res,
        "ERR_INVALID_INPUT",
        "Vui lòng nhập đủ tên tài sản, mô tả, giá khởi điểm và bước giá.",
        400,
      );
    }

    const startTime = req.body?.startTime ? new Date(req.body.startTime) : new Date();
    const endTime = req.body?.endTime ? new Date(req.body.endTime) : new Date(Date.now() + durationMinutes * 60000);

    if (Number.isNaN(endTime.getTime()) || endTime.getTime() <= Date.now()) {
      return sendError(res, "ERR_INVALID_TIME", "Thời gian kết thúc phiên đấu giá không hợp lệ.", 400);
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [productResult] = await connection.execute(
        `
          INSERT INTO Products (name, description, category, image_url)
          VALUES (?, ?, ?, ?)
        `,
        [productName, description, category, imageUrl],
      );

      const [auctionResult] = await connection.execute(
        `
          INSERT INTO Auctions (
            product_id,
            created_by,
            status,
            current_price,
            step_price,
            requires_deposit,
            deposit_amount,
            start_time,
            end_time
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          productResult.insertId,
          userId,
          initialStatus,
          startingPrice,
          stepPrice,
          requiresDeposit,
          depositAmount,
          toMysqlDatetime(startTime),
          toMysqlDatetime(endTime),
        ],
      );

      await connection.commit();

      const auctionId = auctionResult.insertId;

      if (initialStatus === "Active" || initialStatus === "Scheduled") {
        await trySyncAuctionToRedis({
          id: auctionId,
          current_price: startingPrice,
          step_price: stepPrice,
          status: initialStatus,
          end_time: endTime,
          version: 0,
        });
      }

      return sendSuccess(
        res,
        {
          auctionId,
          status: initialStatus,
        },
        initialStatus === "Pending"
          ? "Đã gửi phiên đấu giá, chờ admin duyệt."
          : "Đã tạo phiên đấu giá thành công.",
        201,
      );
    } catch (error) {
      await connection.rollback();
      logger.error("[Auction Create Error]:", error);
      return sendError(res, "ERR_SERVER", "Không thể tạo phiên đấu giá.", 500);
    } finally {
      connection.release();
    }
  }

  static async updateAuctionStatus(req, res) {
    const auctionId = Number(req.params.id);
    const requestedStatus = normalizeStatusForSql(req.body?.status);
    const adminId = req.user?.id;

    if (!requestedStatus) {
      return sendError(res, "ERR_INVALID_STATUS", "Trạng thái phiên đấu giá không hợp lệ.", 400);
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [rows] = await connection.execute(
        `
          SELECT
            a.*,
            p.name AS product_name
          FROM Auctions a
          INNER JOIN Products p ON p.id = a.product_id
          WHERE a.id = ?
          FOR UPDATE
        `,
        [auctionId],
      );

      if (rows.length === 0) {
        await connection.rollback();
        return sendError(res, "ERR_NOT_FOUND", "Không tìm thấy phiên đấu giá.", 404);
      }

      const auction = rows[0];
      let finalEndTime = new Date(auction.end_time);

      if (requestedStatus === "Active" || requestedStatus === "Scheduled") {
        finalEndTime = resolveApprovedEndTime(auction.end_time, req.body?.endTime);

        await connection.execute(
          `
            UPDATE Auctions
            SET
              status = ?,
              end_time = ?,
              approved_by = COALESCE(approved_by, ?),
              approved_at = COALESCE(approved_at, NOW()),
              version = version + 1,
              updated_at = NOW()
            WHERE id = ?
          `,
          [requestedStatus, toMysqlDatetime(finalEndTime), adminId || null, auctionId],
        );
      } else if (requestedStatus === "Rejected") {
        await connection.execute(
          `
            UPDATE Auctions
            SET
              status = 'Rejected',
              rejected_by = ?,
              rejected_at = NOW(),
              rejection_reason = ?,
              version = version + 1,
              updated_at = NOW()
            WHERE id = ?
          `,
          [adminId || null, req.body?.reason || "Admin từ chối phiên đấu giá.", auctionId],
        );
      } else {
        await connection.execute(
          `
            UPDATE Auctions
            SET
              status = ?,
              version = version + 1,
              updated_at = NOW()
            WHERE id = ?
          `,
          [requestedStatus, auctionId],
        );
      }

      await tryInsertAdminLog(connection, {
        adminId,
        targetType: "auction",
        targetId: auctionId,
        action: `UPDATE_STATUS_${requestedStatus}`,
        note: req.body?.reason || null,
      });

      if (requestedStatus === "Active" || requestedStatus === "Scheduled") {
        await tryInsertNotification(connection, {
          userId: auction.created_by,
          auctionId,
          type: "AUCTION_APPROVED",
          title: "Phiên đấu giá đã được thông qua",
          message: `Phiên "${auction.product_name}" đã được admin duyệt.`,
          actionUrl: `/pages/product-detail.html?id=${auctionId}`,
        });
      }

      if (requestedStatus === "Rejected") {
        await tryInsertNotification(connection, {
          userId: auction.created_by,
          auctionId,
          type: "AUCTION_REJECTED",
          title: "Phiên đấu giá chưa được thông qua",
          message: `Phiên "${auction.product_name}" chưa được duyệt.`,
          actionUrl: "/pages/account.html#selling",
        });
      }

      await connection.commit();

      if (requestedStatus === "Active" || requestedStatus === "Scheduled") {
        await trySyncAuctionToRedis({
          ...auction,
          status: requestedStatus,
          end_time: finalEndTime,
          version: Number(auction.version || 0) + 1,
        });
      }

      return sendSuccess(
        res,
        {
          auctionId,
          status: requestedStatus,
        },
        "Cập nhật trạng thái phiên đấu giá thành công.",
      );
    } catch (error) {
      await connection.rollback();
      logger.error("[Auction Status Error]:", error);
      return sendError(res, "ERR_SERVER", "Không thể cập nhật trạng thái phiên đấu giá.", 500);
    } finally {
      connection.release();
    }
  }

  static async approveAuction(req, res) {
    req.body.status = req.body?.status || "Active";
    return AuctionController.updateAuctionStatus(req, res);
  }

  static async rejectAuction(req, res) {
    req.body.status = "Rejected";
    return AuctionController.updateAuctionStatus(req, res);
  }
}

module.exports = AuctionController;
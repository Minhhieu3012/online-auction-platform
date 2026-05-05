// backend/src/controllers/auction.js
const pool = require("../config/db");
const redisClient = require("../config/redis");
const redisKeys = require("../utils/redis-keys");
const { scheduleAuctionClose } = require("../config/queue");
const { sendSuccess, sendError } = require("../utils/response");
const logger = require("../utils/logger");

// Khởi tạo Stripe
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const DEFAULT_APPROVED_DURATION_MINUTES = 24 * 60;

// ==========================================
// CÁC HÀM BỔ TRỢ (HELPERS)
// ==========================================

function normalizeStatusForSql(status) {
  const statusMap = {
    active: "Active",
    scheduled: "Scheduled",
    closing: "Closing",
    ended: "Ended",
    completed: "Completed",
    payment_pending: "Payment Pending",
  };
  return (
    statusMap[
      String(status || "")
        .trim()
        .toLowerCase()
    ] || null
  );
}

function normalizeSort(sort) {
  const allowedSorts = ["ending-soon", "highest-bid", "newest", "most-bids"];
  return allowedSorts.includes(sort) ? sort : "ending-soon";
}

function getSortClause(sort) {
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

function formatUTC(dateString) {
  if (!dateString) return null;
  if (dateString instanceof Date) return dateString.toISOString();
  const str = String(dateString);
  return str.endsWith("Z") ? str : str.replace(" ", "T") + "Z";
}

function toMysqlDatetime(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function mapAuctionRow(row) {
  return {
    id: row.id,
    lot: `Lot ${String(row.id).padStart(3, "0")}`,
    productId: row.product_id,
    title: row.product_name,
    description: row.description || "",
    category: row.category || "collectibles",
    imageUrl: row.image_url || null,
    status: row.status,
    currentPrice: Number(row.current_price || 0),
    stepPrice: Number(row.step_price || 0),
    depositAmount: Number(row.deposit_amount || 0),
    requiresDeposit: Boolean(row.requires_deposit),
    endTime: formatUTC(row.end_time),
    createdAt: formatUTC(row.created_at),
    bidCount: Number(row.bid_count || 0),
    createdBy: row.created_by,
    sellerUsername: row.seller_username || null,
    winnerId: row.winner_id || null,
  };
}

function getAuctionSelectSql(whereSql = "") {
  return `
    SELECT
      a.id, a.product_id, a.created_by, a.status, a.current_price, a.step_price,
      a.deposit_amount, a.requires_deposit, a.winner_id, a.end_time, a.created_at,
      p.name AS product_name, p.description, p.category, p.image_url,
      u.username AS seller_username, COUNT(b.id) AS bid_count
    FROM Auctions a
    INNER JOIN Products p ON p.id = a.product_id
    INNER JOIN Users u ON u.id = a.created_by
    LEFT JOIN Bids b ON b.auction_id = a.id
    ${whereSql}
    GROUP BY
      a.id, a.product_id, a.created_by, a.status, a.current_price, a.step_price,
      a.deposit_amount, a.requires_deposit, a.winner_id, a.end_time, a.created_at,
      p.name, p.description, p.category, p.image_url, u.username
  `;
}

async function syncApprovedAuctionToRedis(auction) {
  const auctionId = auction.id;
  const auctionKey = redisKeys.auctionInfo(auctionId);
  const endTimeMs = new Date(auction.end_time).getTime();

  await redisClient.hSet(auctionKey, {
    current_price: String(auction.current_price || 0),
    step_price: String(auction.step_price || 0),
    status: "Active",
    version: String(auction.version || 0),
    highest_bidder: "",
    end_time: String(endTimeMs),
    extension_count: "0",
  });

  await scheduleAuctionClose(auctionId, new Date(endTimeMs));
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

// ==========================================
// AUCTION CONTROLLER
// ==========================================

class AuctionController {
  static async listAuctions(req, res) {
    const { status, category, q, sort = "ending-soon", limit = 100, offset = 0, createdBy, scope } = req.query;

    const adminMode = scope === "admin";

    if (adminMode && !isAdmin(req)) {
      return sendError(res, "ERR_FORBIDDEN", "Chỉ admin được xem toàn bộ phiên đấu giá.", 403);
    }

    try {
      const sqlParams = [];
      const whereClauses = [];
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

      if (q && q.trim()) {
        whereClauses.push("(p.name LIKE ? OR p.description LIKE ? OR CAST(a.id AS CHAR) LIKE ?)");
        const keyword = `%${q.trim()}%`;
        sqlParams.push(keyword, keyword, keyword);
      }
      const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 200);
      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
      const [rows] = await pool.execute(
        `${getAuctionSelectSql(whereSql)} ORDER BY ${getSortClause(normalizeSort(sort))} LIMIT ${safeLimit} OFFSET ${Number(offset) || 0}`,
        sqlParams,
      );
      return sendSuccess(res, { auctions: rows.map(mapAuctionRow) }, "Thành công.");
    } catch (e) {
      logger.error(e);
      return sendError(res, "ERR_SERVER", "Lỗi server.", 500);
    }
  }

  static async listMyAuctions(req, res) {
    const userId = req.user?.id;
    try {
      const [rows] = await pool.execute(`${getAuctionSelectSql("WHERE a.created_by = ?")} ORDER BY a.created_at DESC`, [
        userId,
      ]);
      return sendSuccess(res, { auctions: rows.map(mapAuctionRow) }, "Thành công.");
    } catch (e) {
      logger.error(e);
      return sendError(res, "ERR_SERVER", "Lỗi server.", 500);
    }
  }

  static async getAuctionById(req, res) {
    const auctionId = Number(req.params.id);
    try {
      const [rows] = await pool.execute(`${getAuctionSelectSql("WHERE a.id = ?")} LIMIT 1`, [auctionId]);
      if (rows.length === 0) return sendError(res, "ERR_NOT_FOUND", "Không tìm thấy.", 404);
      const [bids] = await pool.execute(
        `SELECT b.id, b.bid_amount, b.created_at, u.username, u.email FROM Bids b INNER JOIN Users u ON u.id = b.user_id WHERE b.auction_id = ? ORDER BY b.created_at DESC LIMIT 10`,
        [auctionId],
      );
      const auction = mapAuctionRow(rows[0]);
      auction.bidHistory = bids.map((b, i) => ({
        id: b.id,
        bidder: maskBidder(b.username, b.email),
        amount: Number(b.bid_amount),
        time: formatUTC(b.created_at),
        highlight: i === 0,
      }));
      return sendSuccess(res, { auction }, "Thành công.");
    } catch (e) {
      logger.error(e);
      return sendError(res, "ERR_SERVER", "Lỗi server.", 500);
    }
  }

  static async createAuction(req, res) {
    const { productName, description, category, imageUrl, startingPrice, stepPrice, durationMinutes } = req.body;
    const userId = req.user?.id;
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [p] = await connection.execute(
        "INSERT INTO Products (name, description, category, image_url) VALUES (?, ?, ?, ?)",
        [productName, description, category, imageUrl],
      );
      const endTime = new Date(Date.now() + durationMinutes * 60000);
      const deposit = Number(startingPrice) * 0.1;
      const [a] = await connection.execute(
        `INSERT INTO Auctions (product_id, created_by, status, current_price, step_price, requires_deposit, deposit_amount, end_time) VALUES (?, ?, 'Scheduled', ?, ?, 1, ?, ?)`,
        [p.insertId, userId, startingPrice, stepPrice, deposit, toMysqlDatetime(endTime)],
      );
      await connection.commit();
      return sendSuccess(res, { auctionId: a.insertId }, "Đã tạo phiên, chờ duyệt.", 201);
    } catch (e) {
      await connection.rollback();
      logger.error(e);
      return sendError(res, "ERR_SERVER", "Lỗi server.", 500);
    } finally {
      connection.release();
    }
  }

  // --- HÀM QUAN TRỌNG ĐANG BỊ THIẾU ---
  static async updateAuctionStatus(req, res) {
    const auctionId = Number(req.params.id);
    const requestedStatus = normalizeStatusForSql(req.body?.status);
    if (!requestedStatus) return sendError(res, "ERR_INVALID", "Trạng thái lỗi.", 400);

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute(
        `SELECT a.*, p.name AS product_name FROM Auctions a INNER JOIN Products p ON p.id = a.product_id WHERE a.id = ? FOR UPDATE`,
        [auctionId],
      );
      if (rows.length === 0) {
        await connection.rollback();
        return sendError(res, "ERR_NOT_FOUND", "Không tìm thấy.", 404);
      }

      const auction = rows[0];
      let finalEndTime = new Date(auction.end_time);

      if (requestedStatus === "Active") {
        finalEndTime = resolveApprovedEndTime(auction.end_time, req.body?.endTime);
        await connection.execute(`UPDATE Auctions SET status = ?, end_time = ?, version = version + 1 WHERE id = ?`, [
          requestedStatus,
          toMysqlDatetime(finalEndTime),
          auctionId,
        ]);
      } else {
        await connection.execute(`UPDATE Auctions SET status = ?, version = version + 1 WHERE id = ?`, [
          requestedStatus,
          auctionId,
        ]);
      }
      await connection.commit();

      if (requestedStatus === "Active") {
        await syncApprovedAuctionToRedis({ ...auction, status: requestedStatus, end_time: finalEndTime });
      }
      return sendSuccess(res, { status: requestedStatus }, "Duyệt thành công.");
    } catch (e) {
      await connection.rollback();
      logger.error(e);
      return sendError(res, "ERR_SERVER", "Lỗi server.", 500);
    } finally {
      connection.release();
    }
  }

  static async getDepositStatus(req, res) {
    const userId = req.user.id;
    const auctionId = Number(req.params.id);
    try {
      const [rows] = await pool.execute(
        `SELECT status, amount FROM auction_deposits WHERE auction_id = ? AND user_id = ?`,
        [auctionId, userId],
      );
      return sendSuccess(res, rows[0] || { status: "NONE", amount: 0 });
    } catch (e) {
      return sendError(res, "ERR_SERVER", "Lỗi.", 500);
    }
  }

  static async createDeposit(req, res) {
    const userId = req.user.id;
    const auctionId = Number(req.params.id);
    try {
      const [aucs] = await pool.execute("SELECT status, requires_deposit, deposit_amount FROM Auctions WHERE id = ?", [
        auctionId,
      ]);
      if (aucs.length === 0) return sendError(res, "ERR_NOT_FOUND", "Không thấy.", 404);
      const auc = aucs[0];
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: { name: `Cọc phiên #${auctionId}` },
              unit_amount: Math.round(auc.deposit_amount * 100),
            },
            quantity: 1,
          },
        ],
        success_url: `${process.env.CLIENT_URL}/auction-detail.html?id=${auctionId}&deposit=success`,
        cancel_url: `${process.env.CLIENT_URL}/auction-detail.html?id=${auctionId}&deposit=failed`,
        metadata: { type: "deposit", auction_id: auctionId.toString(), user_id: userId.toString() },
      });
      await pool.execute(
        "INSERT INTO auction_deposits (auction_id, user_id, amount, status, stripe_session_id) VALUES (?, ?, ?, 'PENDING', ?) ON DUPLICATE KEY UPDATE stripe_session_id = VALUES(stripe_session_id)",
        [auctionId, userId, auc.deposit_amount, session.id],
      );
      return sendSuccess(res, { url: session.url });
    } catch (e) {
      logger.error(e);
      return sendError(res, "ERR_SERVER", "Lỗi Stripe.", 500);
    }
  }

  // ==========================================
  // CÁC HÀM CỦA ADMIN (Tích hợp Redis + BullMQ)
  // ==========================================

  static async approveAuction(req, res) {
    const auctionId = Number(req.params.id);
    const adminId = req.user.id;

    try {
      const [rows] = await pool.execute('SELECT * FROM Auctions WHERE id = ? AND status = "Pending"', [auctionId]);
      if (rows.length === 0) return sendError(res, "ERR_NOT_FOUND", "Không tìm thấy lô hợp lệ để duyệt.", 404);

      const auction = rows[0];

      // 1. Cập nhật trạng thái SQL
      await pool.execute(
        'UPDATE Auctions SET status = "Scheduled", approved_by = ?, approved_at = NOW() WHERE id = ?',
        [adminId, auctionId],
      );

      // 2. Đồng bộ lên Redis Cache cho Realtime
      await redisClient.hSet(redisKeys.auctionInfo(auctionId), {
        current_price: String(auction.current_price),
        step_price: String(auction.step_price),
        status: "Scheduled",
        version: "0",
        highest_bidder: "",
        end_time: String(new Date(auction.end_time).getTime()),
        extension_count: "0",
      });

      // 3. Đưa vào hàng đợi BullMQ để tự động kết thúc phiên
      await scheduleAuctionClose(auctionId, new Date(auction.end_time));

      // 4. Bắn thông báo cho người bán
      await pool.execute(
        `INSERT INTO Notifications (user_id, auction_id, type, title, message, action_url)
         VALUES (?, ?, 'AUCTION_APPROVED', 'Lô hàng đã được duyệt', 'Phiên đấu giá của bạn đã được admin phê duyệt và lên lịch!', '/pages/product-detail.html?id=${auctionId}')`,
        [auction.created_by, auctionId],
      );

      logger.success(`[Admin Action] Đã duyệt lô ${auctionId}. Đẩy thành công lên Sàn và Redis.`);
      return sendSuccess(res, null, "Phê duyệt thành công! Phiên đã lên sàn.");
    } catch (error) {
      logger.error(error);
      return sendError(res, "ERR_SERVER", "Lỗi khi phê duyệt.", 500);
    }
  }

  static async rejectAuction(req, res) {
    const auctionId = Number(req.params.id);
    const adminId = req.user.id;
    try {
      // Lấy id người tạo để gửi thông báo
      const [rows] = await pool.execute('SELECT created_by FROM Auctions WHERE id = ? AND status = "Pending"', [
        auctionId,
      ]);
      if (rows.length === 0) return sendError(res, "ERR_NOT_FOUND", "Không tìm thấy lô hợp lệ.", 404);

      await pool.execute('UPDATE Auctions SET status = "Rejected", rejected_by = ?, rejected_at = NOW() WHERE id = ?', [
        adminId,
        auctionId,
      ]);

      // Bắn thông báo cho người bán
      await pool.execute(
        `INSERT INTO Notifications (user_id, auction_id, type, title, message)
         VALUES (?, ?, 'AUCTION_REJECTED', 'Lô hàng bị từ chối', 'Phiên đấu giá của bạn không vượt qua được bước kiểm duyệt.')`,
        [rows[0].created_by, auctionId],
      );

      return sendSuccess(res, null, "Đã từ chối lô hàng này.");
    } catch (error) {
      return sendError(res, "ERR_SERVER", "Lỗi server.", 500);
    }
  }
}

module.exports = AuctionController;

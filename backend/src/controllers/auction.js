const pool = require("../config/db");
const redisClient = require("../config/redis");
const redisKeys = require("../utils/redis-keys");
const { scheduleAuctionClose } = require("../config/queue");
const { sendSuccess, sendError } = require("../utils/response");
const logger = require("../utils/logger");

function normalizeStatusForSql(status) {
  const statusMap = {
    active: "Active",
    scheduled: "Scheduled",
    closing: "Closing",
    ended: "Ended",
    payment_pending: "Payment Pending",
    completed: "Completed",
  };

  return statusMap[String(status || "").toLowerCase()] || null;
}

function normalizeCreateStatus(status) {
  const normalized = normalizeStatusForSql(status);

  if (normalized === "Scheduled") {
    return "Scheduled";
  }

  if (normalized === "Active") {
    return "Active";
  }

  return "Active";
}

function normalizeSort(sort) {
  const allowedSorts = ["ending-soon", "highest-bid", "newest", "most-bids"];

  return allowedSorts.includes(sort) ? sort : "ending-soon";
}

function getSortClause(sort) {
  if (sort === "highest-bid") {
    return "a.current_price DESC";
  }

  if (sort === "newest") {
    return "a.created_at DESC";
  }

  if (sort === "most-bids") {
    return "bid_count DESC";
  }

  return "a.end_time ASC";
}

function maskBidder(username, email) {
  const source = username || email || "Bidder";

  if (source.length <= 2) {
    return `${source[0] || "B"}***`;
  }

  return `${source[0]}***${source[source.length - 1]}`.toUpperCase();
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
    endTime: row.end_time,
    createdAt: row.created_at,
    bidCount: Number(row.bid_count || 0),
    createdBy: row.created_by,
    sellerUsername: row.seller_username || null,
  };
}

class AuctionController {
  // ==========================================
  // API FRONTEND: LẤY DANH SÁCH & CHI TIẾT
  // ==========================================
  static async listAuctions(req, res) {
    const {
      status,
      category,
      q,
      sort = "ending-soon",
      limit = 100,
      offset = 0,
    } = req.query;

    try {
      const sqlParams = [];
      const whereClauses = [];

      const normalizedStatus = normalizeStatusForSql(status);

      if (normalizedStatus) {
        whereClauses.push("a.status = ?");
        sqlParams.push(normalizedStatus);
      }

      if (category && category !== "all") {
        whereClauses.push("LOWER(COALESCE(p.category, 'collectibles')) = LOWER(?)");
        sqlParams.push(category);
      }

      if (q && q.trim()) {
        whereClauses.push("(p.name LIKE ? OR p.description LIKE ? OR CAST(a.id AS CHAR) LIKE ?)");
        const keyword = `%${q.trim()}%`;
        sqlParams.push(keyword, keyword, keyword);
      }

      const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 200);
      const safeOffset = Math.max(Number(offset) || 0, 0);
      const sortClause = getSortClause(normalizeSort(sort));
      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

      const [rows] = await pool.execute(
        `
          SELECT
            a.id,
            a.product_id,
            a.created_by,
            a.status,
            a.current_price,
            a.step_price,
            a.end_time,
            a.created_at,
            p.name AS product_name,
            p.description,
            p.category,
            p.image_url,
            u.username AS seller_username,
            COUNT(b.id) AS bid_count
          FROM Auctions a
          INNER JOIN Products p ON p.id = a.product_id
          INNER JOIN Users u ON u.id = a.created_by
          LEFT JOIN Bids b ON b.auction_id = a.id
          ${whereSql}
          GROUP BY
            a.id,
            a.product_id,
            a.created_by,
            a.status,
            a.current_price,
            a.step_price,
            a.end_time,
            a.created_at,
            p.name,
            p.description,
            p.category,
            p.image_url,
            u.username
          ORDER BY ${sortClause}
          LIMIT ${safeLimit}
          OFFSET ${safeOffset}
        `,
        sqlParams,
      );

      return sendSuccess(
        res,
        {
          auctions: rows.map(mapAuctionRow),
          meta: {
            count: rows.length,
            limit: safeLimit,
            offset: safeOffset,
            sort: normalizeSort(sort),
          },
        },
        "Lấy danh sách phiên đấu giá thành công.",
      );
    } catch (error) {
      logger.error("[Auction List Error]:", error);
      return sendError(res, "ERR_SERVER", "Lỗi máy chủ khi lấy danh sách đấu giá.", 500);
    }
  }

  static async getAuctionById(req, res) {
    const auctionId = Number(req.params.id);

    if (!auctionId) {
      return sendError(res, "ERR_INVALID_ID", "Auction ID không hợp lệ.", 400);
    }

    try {
      const [auctionRows] = await pool.execute(
        `
          SELECT
            a.id,
            a.product_id,
            a.created_by,
            a.status,
            a.current_price,
            a.step_price,
            a.end_time,
            a.created_at,
            p.name AS product_name,
            p.description,
            p.category,
            p.image_url,
            u.username AS seller_username,
            COUNT(b.id) AS bid_count
          FROM Auctions a
          INNER JOIN Products p ON p.id = a.product_id
          INNER JOIN Users u ON u.id = a.created_by
          LEFT JOIN Bids b ON b.auction_id = a.id
          WHERE a.id = ?
          GROUP BY
            a.id,
            a.product_id,
            a.created_by,
            a.status,
            a.current_price,
            a.step_price,
            a.end_time,
            a.created_at,
            p.name,
            p.description,
            p.category,
            p.image_url,
            u.username
          LIMIT 1
        `,
        [auctionId],
      );

      if (auctionRows.length === 0) {
        return sendError(res, "ERR_AUCTION_NOT_FOUND", "Không tìm thấy phiên đấu giá.", 404);
      }

      const [bidRows] = await pool.execute(
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
          LIMIT 10
        `,
        [auctionId],
      );

      const auction = mapAuctionRow(auctionRows[0]);

      return sendSuccess(
        res,
        {
          auction: {
            ...auction,
            bidHistory: bidRows.map((bid, index) => ({
              id: bid.id,
              bidder: maskBidder(bid.username, bid.email),
              amount: Number(bid.bid_amount || 0),
              time: bid.created_at,
              highlight: index === 0,
            })),
          },
        },
        "Lấy chi tiết phiên đấu giá thành công.",
      );
    } catch (error) {
      logger.error("[Auction Detail Error]:", error);
      return sendError(res, "ERR_SERVER", "Lỗi máy chủ khi lấy chi tiết đấu giá.", 500);
    }
  }

  // ==========================================
  // API BACKEND: TẠO MỚI (ĐÃ MERGE FRONTEND FIELDS)
  // ==========================================
  /**
   * Tạo phiên đấu giá: Kết hợp logic Transaction MySQL và nạp dữ liệu vào Redis/BullMQ
   */
  static async createAuction(req, res) {
    // 1. Trích xuất dữ liệu từ Request Body (Đã gộp thêm category, imageUrl, status của Frontend)
    const { 
      productName, 
      description, 
      category, 
      imageUrl, 
      startingPrice, 
      stepPrice, 
      durationMinutes, 
      status 
    } = req.body;
    
    const userId = req.user.id; // Lấy từ JWT Auth Middleware

    // Kiểm tra dữ liệu đầu vào cơ bản
    if (!productName || !startingPrice || !stepPrice || !durationMinutes) {
      return sendError(res, "ERR_MISSING_DATA", "Vui lòng nhập đủ thông tin sản phẩm và giá.", 400);
    }

    const numericStartingPrice = Number(startingPrice);
    const numericStepPrice = Number(stepPrice);
    const numericDurationMinutes = Number(durationMinutes);

    if (
      !Number.isFinite(numericStartingPrice) ||
      numericStartingPrice <= 0 ||
      !Number.isFinite(numericStepPrice) ||
      numericStepPrice <= 0 ||
      !Number.isFinite(numericDurationMinutes) ||
      numericDurationMinutes <= 0
    ) {
      return sendError(res, "ERR_INVALID_PRICE", "Giá hoặc thời lượng đấu giá không hợp lệ.", 400);
    }

    const auctionStatus = normalizeCreateStatus(status);
    const connection = await pool.getConnection();

    let auctionId;
    let productId;
    let endTime;

    // ==========================================
    // KHỐI 1: GIAO DỊCH MYSQL (BẢO ĐẢM DỮ LIỆU GỐC)
    // ==========================================
    try {
      await connection.beginTransaction();

      // Bước A: Tạo Sản phẩm trước để lấy product_id (Gộp thêm category và image_url)
      const [prodResult] = await connection.execute(
        "INSERT INTO Products (name, description, category, image_url) VALUES (?, ?, ?, ?)",
        [
          productName,
          description || "",
          category || "Collectibles",
          imageUrl || null,
        ],
      );
      productId = prodResult.insertId;

      // Bước B: Tính toán mốc thời gian kết thúc (datetime)
      endTime = new Date(Date.now() + numericDurationMinutes * 60000);
      const mysqlEndTime = endTime.toISOString().slice(0, 19).replace("T", " ");

      // Bước C: Tạo Phiên đấu giá trong bảng Auctions
      const [aucResult] = await connection.execute(
        `
          INSERT INTO Auctions
            (product_id, created_by, status, current_price, step_price, end_time, version)
          VALUES
            (?, ?, ?, ?, ?, ?, 0)
        `,
        [
          productId,
          userId,
          auctionStatus,
          numericStartingPrice,
          numericStepPrice,
          mysqlEndTime,
        ],
      );
      auctionId = aucResult.insertId;

      // Xác nhận lưu dữ liệu thành công vào MySQL
      await connection.commit();
      logger.info(`[DB Success] Đã chốt lưu phiên đấu giá ${auctionId} vào MySQL.`);

    } catch (error) {
      // Nếu có bất kỳ lỗi nào, hủy bỏ toàn bộ dữ liệu đã chèn để tránh rác DB
      if (connection) await connection.rollback();
      logger.error(`[MySQL Transaction Error]: ${error.message || error}`);
      return sendError(res, "ERR_SERVER", "Lỗi hệ thống khi lưu phiên đấu giá.", 500);
    } finally {
      // Giải phóng kết nối ngay lập tức để tối ưu tài nguyên hệ thống
      connection.release();
    }

    // ==========================================
    // KHỐI 2: TÁC VỤ NỀN (REDIS CACHE & BULLMQ QUEUE)
    // ==========================================
    try {
      // Bước D: Nạp dữ liệu vào Redis để phục vụ việc Bid tốc độ cao (Real-time)
      const auctionKey = redisKeys.auctionInfo(auctionId);
      
      await redisClient.hSet(auctionKey, {
        current_price: String(numericStartingPrice),
        step_price: String(numericStepPrice),
        status: auctionStatus,
        version: "0",
        highest_bidder: "",
        end_time: String(endTime.getTime()),
        extension_count: "0",
      });

      // Bước E: Hẹn giờ đóng phiên bằng BullMQ
      await scheduleAuctionClose(auctionId, endTime);
      logger.success(`[System Sync] Phiên ${auctionId} đã sẵn sàng trên Redis và BullMQ.`);
    } catch (error) {
      // Không crash API vì DB đã an toàn, chỉ log lỗi để Retry sau
      logger.error(`[Background Task Error] Phiên ${auctionId} lỗi đồng bộ Cache/Queue: ${error.message || error}`);
    }

    // ==========================================
    // TRẢ VỀ KẾT QUẢ THÀNH CÔNG
    // ==========================================
    return sendSuccess(
      res,
      {
        auctionId,
        productId,
        endTime,
        status: auctionStatus,
      },
      "Tạo phiên đấu giá và khởi động bộ đếm giờ thành công!",
      201
    );
  }
}

module.exports = AuctionController;
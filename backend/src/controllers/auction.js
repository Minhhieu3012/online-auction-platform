const pool = require("../config/db");
const redisClient = require("../config/redis");
const redisKeys = require("../utils/redis-keys");
const { scheduleAuctionClose } = require("../config/queue");
const { sendSuccess, sendError } = require("../utils/response");
const logger = require("../utils/logger");

const DEFAULT_APPROVED_DURATION_MINUTES = 24 * 60;

function normalizeStatusForSql(status) {
  const statusMap = {
    active: "Active",
    scheduled: "Scheduled",
    closing: "Closing",
    ended: "Ended",
    completed: "Completed",
    payment_pending: "Payment Pending",
    "payment-pending": "Payment Pending",
    "payment pending": "Payment Pending",
  };

  return statusMap[String(status || "").trim().toLowerCase()] || null;
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

  if (dateString instanceof Date) {
    return dateString.toISOString();
  }

  const str = String(dateString);
  if (str.endsWith("Z")) return str;

  return str.replace(" ", "T") + "Z";
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
    endTime: formatUTC(row.end_time),
    createdAt: formatUTC(row.created_at),
    bidCount: Number(row.bid_count || 0),
    createdBy: row.created_by,
    sellerUsername: row.seller_username || null,
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
  `;
}

async function syncApprovedAuctionToRedis(auction) {
  const auctionId = auction.id;
  const auctionKey = redisKeys.auctionInfo(auctionId);
  const endTimeMs = new Date(auction.end_time || auction.endTime).getTime();

  await redisClient.hSet(auctionKey, {
    current_price: String(auction.current_price || auction.currentPrice || 0),
    step_price: String(auction.step_price || auction.stepPrice || 0),
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
    const parsedRequested = new Date(requestedEndTime).getTime();

    if (!Number.isNaN(parsedRequested) && parsedRequested > now) {
      return new Date(parsedRequested);
    }
  }

  const parsedCurrent = new Date(currentEndTime).getTime();

  if (!Number.isNaN(parsedCurrent) && parsedCurrent > now) {
    return new Date(parsedCurrent);
  }

  return new Date(now + DEFAULT_APPROVED_DURATION_MINUTES * 60000);
}

class AuctionController {
  static async listAuctions(req, res) {
    const { status, category, q, sort = "ending-soon", limit = 100, offset = 0, createdBy } = req.query;

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

      if (createdBy) {
        whereClauses.push("a.created_by = ?");
        sqlParams.push(Number(createdBy));
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
          ${getAuctionSelectSql(whereSql)}
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

  static async listMyAuctions(req, res) {
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, "ERR_UNAUTHORIZED", "Vui lòng đăng nhập để xem phiên của bạn.", 401);
    }

    try {
      const [rows] = await pool.execute(
        `
          ${getAuctionSelectSql("WHERE a.created_by = ?")}
          ORDER BY a.created_at DESC
        `,
        [userId],
      );

      return sendSuccess(
        res,
        {
          auctions: rows.map(mapAuctionRow),
        },
        "Lấy danh sách phiên đấu giá của bạn thành công.",
      );
    } catch (error) {
      logger.error("[My Auction List Error]:", error);
      return sendError(res, "ERR_SERVER", "Lỗi máy chủ khi lấy danh sách phiên của bạn.", 500);
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
          ${getAuctionSelectSql("WHERE a.id = ?")}
          LIMIT 1
        `,
        [auctionId],
      );

      if (auctionRows.length === 0) {
        return sendError(res, "ERR_AUCTION_NOT_FOUND", "Không tìm thấy phiên đấu giá.", 404);
      }

      const [bidRows] = await pool.execute(
        `
          SELECT b.id, b.bid_amount, b.created_at, u.username, u.email
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
              time: formatUTC(bid.created_at),
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

  static async createAuction(req, res) {
    const { productName, description, category, imageUrl, startingPrice, stepPrice, durationMinutes } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, "ERR_UNAUTHORIZED", "Vui lòng đăng nhập để tạo phiên đấu giá.", 401);
    }

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

    const auctionStatus = "Scheduled";
    const connection = await pool.getConnection();

    let auctionId;
    let productId;
    let endTime;

    try {
      await connection.beginTransaction();

      const [prodResult] = await connection.execute(
        "INSERT INTO Products (name, description, category, image_url) VALUES (?, ?, ?, ?)",
        [productName, description || "", category || "Collectibles", imageUrl || null],
      );

      productId = prodResult.insertId;
      endTime = new Date(Date.now() + numericDurationMinutes * 60000);

      const [aucResult] = await connection.execute(
        `
          INSERT INTO Auctions
            (product_id, created_by, status, current_price, step_price, end_time, version)
          VALUES
            (?, ?, ?, ?, ?, ?, 0)
        `,
        [productId, userId, auctionStatus, numericStartingPrice, numericStepPrice, toMysqlDatetime(endTime)],
      );

      auctionId = aucResult.insertId;

      await connection.commit();

      logger.info(`[DB Success] User ${userId} đã tạo phiên ${auctionId} chờ admin duyệt.`);
    } catch (error) {
      await connection.rollback();
      logger.error(`[MySQL Transaction Error]: ${error.message || error}`);
      return sendError(res, "ERR_SERVER", "Lỗi hệ thống khi lưu phiên đấu giá.", 500);
    } finally {
      connection.release();
    }

    return sendSuccess(
      res,
      {
        auctionId,
        productId,
        endTime,
        status: auctionStatus,
      },
      "Đã gửi phiên đấu giá. Phiên đang chờ admin duyệt trước khi mở công khai.",
      201,
    );
  }

  static async updateAuctionStatus(req, res) {
    const auctionId = Number(req.params.id);
    const requestedStatus = normalizeStatusForSql(req.body?.status);
    const requestedEndTime = req.body?.endTime || null;

    if (!auctionId) {
      return sendError(res, "ERR_INVALID_ID", "Auction ID không hợp lệ.", 400);
    }

    if (!requestedStatus) {
      return sendError(res, "ERR_INVALID_STATUS", "Trạng thái phiên đấu giá không hợp lệ.", 400);
    }

    const allowedManualStatuses = ["Scheduled", "Active", "Ended", "Completed"];

    if (!allowedManualStatuses.includes(requestedStatus)) {
      return sendError(
        res,
        "ERR_STATUS_NOT_ALLOWED",
        "Chỉ cho phép chuyển thủ công sang Scheduled, Active, Ended hoặc Completed.",
        400,
      );
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [rows] = await connection.execute(
        `
          SELECT
            a.id,
            a.status,
            a.current_price,
            a.step_price,
            a.end_time,
            a.version,
            a.product_id,
            a.created_by,
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
        return sendError(res, "ERR_AUCTION_NOT_FOUND", "Không tìm thấy phiên đấu giá.", 404);
      }

      const auction = rows[0];
      let finalEndTime = new Date(auction.end_time);

      if (requestedStatus === "Active") {
        finalEndTime = resolveApprovedEndTime(auction.end_time, requestedEndTime);

        await connection.execute(
          `
            UPDATE Auctions
            SET status = ?, end_time = ?, version = version + 1
            WHERE id = ?
          `,
          [requestedStatus, toMysqlDatetime(finalEndTime), auctionId],
        );
      } else {
        await connection.execute(
          `
            UPDATE Auctions
            SET status = ?, version = version + 1
            WHERE id = ?
          `,
          [requestedStatus, auctionId],
        );
      }

      await connection.commit();

      const nextAuction = {
        ...auction,
        status: requestedStatus,
        end_time: finalEndTime,
      };

      try {
        const auctionKey = redisKeys.auctionInfo(auctionId);

        if (requestedStatus === "Active") {
          await syncApprovedAuctionToRedis(nextAuction);
        } else {
          await redisClient.hSet(auctionKey, {
            status: requestedStatus,
          });
        }
      } catch (cacheError) {
        logger.error(`[Auction Status Cache Error] ${cacheError.message || cacheError}`);
      }

      return sendSuccess(
        res,
        {
          auctionId,
          status: requestedStatus,
          endTime: formatUTC(finalEndTime),
        },
        requestedStatus === "Active"
          ? "Admin đã duyệt phiên đấu giá. Phiên đã được mở công khai."
          : "Cập nhật trạng thái phiên đấu giá thành công.",
      );
    } catch (error) {
      await connection.rollback();
      logger.error("[Auction Status Error]:", error);
      return sendError(res, "ERR_SERVER", "Lỗi máy chủ khi cập nhật trạng thái phiên đấu giá.", 500);
    } finally {
      connection.release();
    }
  }
}

module.exports = AuctionController;
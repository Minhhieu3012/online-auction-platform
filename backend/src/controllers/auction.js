const redisKeys = require("../utils/redis-keys");
const pool = require("../config/db");
const redisClient = require("../config/redis");
const { scheduleAuctionClose } = require("../config/queue");
const { sendSuccess, sendError } = require("../utils/response");

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
      console.error("[Auction List Error]:", error);
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
      console.error("[Auction Detail Error]:", error);
      return sendError(res, "ERR_SERVER", "Lỗi máy chủ khi lấy chi tiết đấu giá.", 500);
    }
  }

  static async createAuction(req, res) {
    const {
      productName,
      description,
      category,
      imageUrl,
      startingPrice,
      stepPrice,
      durationMinutes,
    } = req.body;

    const userId = req.user.id;

    if (!productName || !startingPrice || !stepPrice || !durationMinutes) {
      return sendError(res, "ERR_MISSING_DATA", "Vui lòng nhập đủ thông tin.", 400);
    }

    const connection = await pool.getConnection();
    let auctionId;
    let productId;
    let endTime;

    try {
      await connection.beginTransaction();

      const [prodResult] = await connection.execute(
        "INSERT INTO Products (name, description, category, image_url) VALUES (?, ?, ?, ?)",
        [
          productName,
          description || "",
          category || "collectibles",
          imageUrl || null,
        ],
      );

      productId = prodResult.insertId;

      endTime = new Date(Date.now() + durationMinutes * 60000);
      const mysqlEndTime = endTime.toISOString().slice(0, 19).replace("T", " ");

      const [aucResult] = await connection.execute(
        `INSERT INTO Auctions (product_id, created_by, status, current_price, step_price, end_time, version)
         VALUES (?, ?, 'Active', ?, ?, ?, 0)`,
        [productId, userId, startingPrice, stepPrice, mysqlEndTime],
      );

      auctionId = aucResult.insertId;

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      console.error("[DB Error]:", error);
      return sendError(res, "ERR_SERVER", "Lỗi hệ thống khi lưu phiên đấu giá.", 500);
    } finally {
      connection.release();
    }

    try {
      const auctionKey = redisKeys.auctionInfo(auctionId);

      await redisClient.hSet(auctionKey, {
        current_price: startingPrice.toString(),
        step_price: stepPrice.toString(),
        status: "Active",
        version: "0",
        highest_bidder: "",
        end_time: endTime.getTime().toString(),
        extension_count: "0",
      });

      await scheduleAuctionClose(auctionId, endTime);
    } catch (error) {
      console.error(`[Background Error] Phiên ${auctionId} rớt Cache/Queue:`, error);
    }

    return sendSuccess(
      res,
      {
        auctionId,
        productId,
        endTime,
      },
      "Tạo phiên đấu giá thành công!",
      201,
    );
  }
}

module.exports = AuctionController;
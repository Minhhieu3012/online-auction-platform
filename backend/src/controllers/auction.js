// backend/src/controllers/auction.js

const pool = require("../config/db");
const { sendSuccess, sendError } = require("../utils/response");
const logger = require("../utils/logger");

const PUBLIC_STATUSES = ["Scheduled", "Active", "Closing", "Ended", "Payment Pending", "Completed"];

// Khởi tạo Stripe từ mã cũ
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const DEFAULT_APPROVED_DURATION_MINUTES = 24 * 60;

// ==========================================
// CÁC HÀM BỔ TRỢ (HELPERS)
// ==========================================

function normalizeStatusForSql(status) {
  const statusMap = {
    pending: "Pending",
    rejected: "Rejected",
    scheduled: "Scheduled",
    active: "Active",
    closing: "Closing",
    ended: "Ended",
    completed: "Completed",
    cancelled: "Cancelled",
    payment_pending: "Payment Pending",
    "payment-pending": "Payment Pending",
    "payment pending": "Payment Pending",
  };

  return statusMap[String(status || "").trim().toLowerCase()] || null;
}

function normalizeSort(sort) {
  const allowed = ["ending-soon", "highest-bid", "newest", "most-bids", "pending-first"];
  return allowed.includes(sort) ? sort : "ending-soon";
}

function getSortClause(sort) {
  if (sort === "highest-bid") return "a.current_price DESC";
  if (sort === "newest") return "a.created_at DESC";
  if (sort === "most-bids") return "bid_count DESC";
  if (sort === "pending-first") {
    return "FIELD(a.status, 'Pending', 'Active', 'Scheduled', 'Closing', 'Payment Pending', 'Ended', 'Completed', 'Rejected', 'Cancelled'), a.created_at DESC";
  }

  return "a.end_time ASC";
}

function isAdmin(req) {
  return req.user?.role === "admin";
}

function toMysqlDatetime(date) {
  return new Date(date).toISOString().slice(0, 19).replace("T", " ");
}

function formatUTC(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();

  const text = String(value);
  if (text.endsWith("Z")) return text;

  return text.replace(" ", "T") + "Z";
}

function maskBidder(username, email) {
  const source = username || email || "Bidder";
  if (source.length <= 2) return `${source[0] || "B"}***`;
  return `${source[0]}***${source[source.length - 1]}`.toUpperCase();
}

function mapAuctionRow(row) {
  return {
    id: row.id,
    lot: `Lô #${String(row.id).padStart(3, "0")}`,
    productId: row.product_id,
    title: row.product_name,
    description: row.description || "",
    category: row.category || "collectibles",
    imageUrl: row.image_url || null,

    createdBy: row.created_by,
    sellerUsername: row.seller_username || null,
    sellerEmail: row.seller_email || null,

    status: row.status,
    currentPrice: Number(row.current_price || 0),
    stepPrice: Number(row.step_price || 0),

    requiresDeposit: Boolean(row.requires_deposit),
    depositAmount: Number(row.deposit_amount || 0),

    startTime: formatUTC(row.start_time),
    endTime: formatUTC(row.end_time),

    winnerId: row.winner_id || null,
    finalPrice: row.final_price === null ? null : Number(row.final_price),
    paymentDueAt: formatUTC(row.payment_due_at),

    approvedBy: row.approved_by,
    approvedAt: formatUTC(row.approved_at),

    rejectedBy: row.rejected_by,
    rejectedAt: formatUTC(row.rejected_at),
    rejectionReason: row.rejection_reason || "",

    bidCount: Number(row.bid_count || 0),
    depositCount: Number(row.deposit_count || 0),

    createdAt: formatUTC(row.created_at),
    updatedAt: formatUTC(row.updated_at),
  };
}

function getAuctionSelectSql(whereSql = "") {
  return `
    SELECT
      a.*,
      p.name AS product_name,
      p.description,
      p.category,
      p.image_url,
      seller.username AS seller_username,
      seller.email AS seller_email,
      COUNT(DISTINCT b.id) AS bid_count,
      COUNT(DISTINCT d.id) AS deposit_count
    FROM Auctions a
    INNER JOIN Products p ON p.id = a.product_id
    INNER JOIN Users seller ON seller.id = a.created_by
    LEFT JOIN Bids b ON b.auction_id = a.id
    LEFT JOIN auction_deposits d ON d.auction_id = a.id AND d.status = 'SUCCEEDED'
    ${whereSql}
    GROUP BY a.id
  `;
}

function calculateDefaultDeposit(startingPrice, explicitDepositAmount) {
  const requested = Number(explicitDepositAmount || 0);

  if (Number.isFinite(requested) && requested > 0) {
    return requested;
  }

  const base = Number(startingPrice || 0);

  if (!Number.isFinite(base) || base <= 0) {
    return 0;
  }

  return Math.max(50, Math.round(base * 0.1));
}

async function getUserDepositStatus(auctionId, userId) {
  if (!userId) {
    return null;
  }

  const [rows] = await pool.execute(
    `
      SELECT id, status, amount, paid_at, refunded_at, applied_at
      FROM auction_deposits
      WHERE auction_id = ? AND user_id = ?
      LIMIT 1
    `,
    [auctionId, userId],
  );

  return rows[0] || null;
}
// ==========================================
// AUCTION CONTROLLER
// ==========================================

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

    const adminMode = scope === "admin";

    if (adminMode && !isAdmin(req)) {
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

      if (q && q.trim()) {
        where.push("(p.name LIKE ? OR p.description LIKE ? OR seller.username LIKE ? OR CAST(a.id AS CHAR) LIKE ?)");
        const keyword = `%${q.trim()}%`;
        params.push(keyword, keyword, keyword, keyword);
      }

      const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 200);
      const safeOffset = Math.max(Number(offset) || 0, 0);
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const sortSql = getSortClause(normalizeSort(sort));

      const [rows] = await pool.execute(
        `
          ${getAuctionSelectSql(whereSql)}
          ORDER BY ${sortSql}
          LIMIT ${safeLimit}
          OFFSET ${safeOffset}
        `,
        params,
      );

      return sendSuccess(
        res,
        {
          auctions: rows.map(mapAuctionRow),
          meta: {
            count: rows.length,
            limit: safeLimit,
            offset: safeOffset,
            scope: adminMode ? "admin" : "public",
          },
        },
        "Lấy danh sách phiên đấu giá thành công.",
      );
    } catch (error) {
      logger.error("[Auction List Error]:", error);
      return sendError(res, "ERR_AUCTION_LIST", "Không thể lấy danh sách phiên đấu giá.", 500);
    }
  }

  static async listMyAuctions(req, res) {
    if (!req.user?.id) {
      return sendError(res, "ERR_UNAUTHORIZED", "Vui lòng đăng nhập để xem phiên của bạn.", 401);
    }

    try {
      const [rows] = await pool.execute(
        `
          ${getAuctionSelectSql("WHERE a.created_by = ?")}
          ORDER BY a.created_at DESC
        `,
        [req.user.id],
      );

      return sendSuccess(
        res,
        {
          auctions: rows.map(mapAuctionRow),
        },
        "Lấy danh sách phiên bạn tạo thành công.",
      );
    } catch (error) {
      logger.error("[My Auctions Error]:", error);
      return sendError(res, "ERR_MY_AUCTIONS", "Không thể lấy danh sách phiên của bạn.", 500);
    }
  }

  static async getAuctionById(req, res) {
    const auctionId = Number(req.params.id);

    if (!auctionId) {
      return sendError(res, "ERR_INVALID_AUCTION_ID", "ID phiên đấu giá không hợp lệ.", 400);
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

      const auction = mapAuctionRow(auctionRows[0]);
      const isOwner = req.user?.id && Number(req.user.id) === Number(auction.createdBy);
      const canViewPrivate = isOwner || isAdmin(req);

      if (["Pending", "Rejected", "Cancelled"].includes(auction.status) && !canViewPrivate) {
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
          LIMIT 20
        `,
        [auctionId],
      );

      const deposit = await getUserDepositStatus(auctionId, req.user?.id);

      const canBid =
        auction.status === "Active" &&
        Number(auction.createdBy) !== Number(req.user?.id || 0) &&
        (!auction.requiresDeposit || deposit?.status === "SUCCEEDED");

      return sendSuccess(
        res,
        {
          auction: {
            ...auction,
            userDeposit: deposit
              ? {
                  id: deposit.id,
                  status: deposit.status,
                  amount: Number(deposit.amount || 0),
                  paidAt: formatUTC(deposit.paid_at),
                  refundedAt: formatUTC(deposit.refunded_at),
                  appliedAt: formatUTC(deposit.applied_at),
                }
              : null,
            canBid,
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
      return sendError(res, "ERR_AUCTION_DETAIL", "Không thể lấy chi tiết phiên đấu giá.", 500);
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
      requiresDeposit = true,
      depositAmount,
    } = req.body || {};

    if (!req.user?.id) {
      return sendError(res, "ERR_UNAUTHORIZED", "Vui lòng đăng nhập để tạo phiên đấu giá.", 401);
    }

    if (!productName || !startingPrice || !stepPrice || !durationMinutes) {
      return sendError(res, "ERR_MISSING_DATA", "Vui lòng nhập đủ thông tin sản phẩm, giá và thời lượng.", 400);
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
      return sendError(res, "ERR_INVALID_AUCTION_VALUE", "Giá hoặc thời lượng đấu giá không hợp lệ.", 400);
    }

    const safeRequiresDeposit = Boolean(requiresDeposit);
    const safeDepositAmount = safeRequiresDeposit ? calculateDefaultDeposit(numericStartingPrice, depositAmount) : 0;
    const endTime = new Date(Date.now() + numericDurationMinutes * 60000);

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [productResult] = await connection.execute(
        `
          INSERT INTO Products
            (name, description, category, image_url)
          VALUES
            (?, ?, ?, ?)
        `,
        [productName, description || "", category || "collectibles", imageUrl || null],
      );

      const productId = productResult.insertId;

      const [auctionResult] = await connection.execute(
        `
          INSERT INTO Auctions
            (
              product_id,
              created_by,
              status,
              current_price,
              step_price,
              requires_deposit,
              deposit_amount,
              start_time,
              end_time,
              version
            )
          VALUES
            (?, ?, 'Pending', ?, ?, ?, ?, NULL, ?, 0)
        `,
        [
          productId,
          req.user.id,
          numericStartingPrice,
          numericStepPrice,
          safeRequiresDeposit,
          safeDepositAmount,
          toMysqlDatetime(endTime),
        ],
      );

      const auctionId = auctionResult.insertId;

      await connection.execute(
        `
          INSERT INTO Notifications
            (user_id, auction_id, type, title, message, action_url)
          VALUES
            (?, ?, 'SYSTEM', ?, ?, ?)
        `,
        [
          req.user.id,
          auctionId,
          "Đã gửi phiên đấu giá",
          "Phiên đấu giá của bạn đã được gửi và đang chờ admin duyệt.",
          `/pages/account.html#selling`,
        ],
      );

      await connection.commit();

      return sendSuccess(
        res,
        {
          auctionId,
          productId,
          status: "Pending",
          requiresDeposit: safeRequiresDeposit,
          depositAmount: safeDepositAmount,
          endTime: formatUTC(endTime),
        },
        "Đã gửi phiên đấu giá. Phiên đang chờ admin duyệt.",
        201,
      );
    } catch (error) {
      await connection.rollback();
      logger.error("[Auction Create Error]:", error);
      return sendError(res, "ERR_CREATE_AUCTION", "Không thể tạo phiên đấu giá.", 500);
    } finally {
      connection.release();
    }
  }

  static async getDepositStatus(req, res) {
    const auctionId = Number(req.params.id);
    const userId = req.user.id;

    if (!auctionId) return sendError(res, "ERR_INVALID_ID", "Auction ID không hợp lệ.", 400);

    try {
      const [rows] = await pool.execute(
        `SELECT status, amount FROM auction_deposits WHERE auction_id = ? AND user_id = ? LIMIT 1`,
        [auctionId, userId]
      );

      const deposit = rows.length > 0 ? rows[0] : { status: "NONE", amount: 0 };
      return sendSuccess(res, deposit, "Lấy trạng thái đặt cọc thành công.");
    } catch (error) {
      logger.error("[Get Deposit Status Error]:", error);
      return sendError(res, "ERR_SERVER", "Lỗi máy chủ khi kiểm tra đặt cọc.", 500);
    }
  }

  static async createDeposit(req, res) {
    const auctionId = Number(req.params.id);
    const userId = req.user.id;

    if (!auctionId) return sendError(res, "ERR_INVALID_ID", "Auction ID không hợp lệ.", 400);

    try {
      const [auctions] = await pool.execute(
        "SELECT status, requires_deposit, deposit_amount FROM Auctions WHERE id = ?",
        [auctionId]
      );
      
      if (auctions.length === 0) return sendError(res, "ERR_NOT_FOUND", "Phiên đấu giá không tồn tại.", 404);
      
      const auction = auctions[0];
      if (auction.status !== "Active" && auction.status !== "Scheduled") {
        return sendError(res, "ERR_INVALID_STATE", "Không thể đặt cọc vì phiên đấu giá chưa mở hoặc đã kết thúc.", 400);
      }
      if (!auction.requires_deposit) {
        return sendError(res, "ERR_NO_DEPOSIT", "Phiên đấu giá này không yêu cầu đặt cọc.", 400);
      }

      const [deps] = await pool.execute(
        "SELECT id, status FROM auction_deposits WHERE auction_id = ? AND user_id = ?",
        [auctionId, userId]
      );

      if (deps.length > 0 && deps[0].status === 'SUCCEEDED') {
        return sendError(res, "ERR_ALREADY_DEPOSITED", "Bạn đã đặt cọc thành công cho phiên này rồi.", 400);
      }

      const depositAmountCent = Math.round(Number(auction.deposit_amount) * 100);
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `Đặt Cọc Tham Gia Đấu Giá #${auctionId}`,
                description: "Sẽ được hoàn lại nếu bạn không trúng thầu.",
              },
              unit_amount: depositAmountCent,
            },
            quantity: 1,
          },
        ],
        success_url: `${process.env.CLIENT_URL || "http://localhost:5173"}/auction-detail.html?id=${auctionId}&deposit=success`,
        cancel_url: `${process.env.CLIENT_URL || "http://localhost:5173"}/auction-detail.html?id=${auctionId}&deposit=failed`,
        metadata: {
          type: "deposit",
          auction_id: auctionId.toString(),
          user_id: userId.toString(),
        },
      });

      if (deps.length > 0) {
        await pool.execute(
          "UPDATE auction_deposits SET stripe_session_id = ?, status = 'PENDING', amount = ? WHERE id = ?",
          [session.id, auction.deposit_amount, deps[0].id]
        );
      } else {
        await pool.execute(
          "INSERT INTO auction_deposits (auction_id, user_id, amount, status, stripe_session_id) VALUES (?, ?, ?, 'PENDING', ?)",
          [auctionId, userId, auction.deposit_amount, session.id]
        );
      }

      return sendSuccess(res, { url: session.url }, "Tạo yêu cầu thanh toán đặt cọc thành công.");
    } catch (error) {
      logger.error("[Create Deposit Error]:", error);
      return sendError(res, "ERR_SERVER", "Lỗi tạo yêu cầu thanh toán.", 500);
    }
  }
}

module.exports = AuctionController;
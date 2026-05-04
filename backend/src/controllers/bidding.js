const pool = require("../config/db");
const { sendSuccess, sendError } = require("../utils/response");

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

function getIo(req) {
  return req.app?.get?.("io") || req.app?.locals?.io || req.io || global.io || null;
}

function emitBidEvent(req, auctionId, payload) {
  const io = getIo(req);

  if (!io) {
    return;
  }

  io.to(String(auctionId)).emit("new_bid", payload);
  io.emit("new_bid", payload);
}

async function getHighestBidder(connection, auctionId) {
  const [rows] = await connection.execute(
    `
      SELECT user_id, bid_amount
      FROM Bids
      WHERE auction_id = ?
      ORDER BY bid_amount DESC, created_at ASC
      LIMIT 1
    `,
    [auctionId],
  );

  return rows[0] || null;
}

class BiddingController {
  static async placeBid(req, res) {
    const auctionId = Number(req.params.id);
    const userId = Number(req.user?.id);
    const bidAmount = Number(req.body?.bidAmount);

    if (!auctionId) {
      return sendError(res, "ERR_INVALID_AUCTION_ID", "ID phiên đấu giá không hợp lệ.", 400);
    }

    if (!Number.isFinite(bidAmount) || bidAmount <= 0) {
      return sendError(res, "ERR_INVALID_BID", "Số tiền đặt giá không hợp lệ.", 400);
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [auctionRows] = await connection.execute(
        `
          SELECT
            a.id,
            a.created_by,
            a.status,
            a.current_price,
            a.step_price,
            a.requires_deposit,
            a.deposit_amount,
            a.end_time,
            a.version,
            p.name AS product_name
          FROM Auctions a
          INNER JOIN Products p ON p.id = a.product_id
          WHERE a.id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [auctionId],
      );

      if (auctionRows.length === 0) {
        await connection.rollback();
        return sendError(res, "ERR_AUCTION_NOT_FOUND", "Không tìm thấy phiên đấu giá.", 404);
      }

      const auction = auctionRows[0];

      if (auction.status !== "Active") {
        await connection.rollback();
        return sendError(res, "ERR_AUCTION_NOT_ACTIVE", "Phiên đấu giá hiện không mở để đặt giá.", 400);
      }

      const endTime = new Date(auction.end_time).getTime();

      if (Number.isNaN(endTime) || endTime <= Date.now()) {
        await connection.rollback();
        return sendError(res, "ERR_AUCTION_ENDED", "Phiên đấu giá đã kết thúc.", 400);
      }

      if (Number(auction.created_by) === userId) {
        await connection.rollback();
        return sendError(res, "ERR_OWNER_CANNOT_BID", "Bạn không thể tự đấu giá phiên do mình tạo.", 400);
      }

      if (auction.requires_deposit) {
        const [depositRows] = await connection.execute(
          `
            SELECT id, status, amount
            FROM auction_deposits
            WHERE auction_id = ? AND user_id = ?
            LIMIT 1
            FOR UPDATE
          `,
          [auctionId, userId],
        );

        if (depositRows.length === 0 || depositRows[0].status !== "SUCCEEDED") {
          await connection.rollback();
          return sendError(
            res,
            "ERR_DEPOSIT_REQUIRED",
            "Bạn cần đặt cọc thành công trước khi tham gia trả giá.",
            402,
            {
              depositAmount: Number(auction.deposit_amount || 0),
            },
          );
        }
      }

      const currentPrice = Number(auction.current_price || 0);
      const stepPrice = Number(auction.step_price || 0);
      const minimumBid = currentPrice + stepPrice;

      if (bidAmount < minimumBid) {
        await connection.rollback();
        return sendError(
          res,
          "ERR_BID_TOO_LOW",
          `Giá đặt phải lớn hơn hoặc bằng ${minimumBid}.`,
          400,
          {
            currentPrice,
            stepPrice,
            minimumBid,
          },
        );
      }

      const previousHighest = await getHighestBidder(connection, auctionId);

      const [bidResult] = await connection.execute(
        `
          INSERT INTO Bids
            (auction_id, user_id, bid_amount)
          VALUES
            (?, ?, ?)
        `,
        [auctionId, userId, bidAmount],
      );

      await connection.execute(
        `
          UPDATE Auctions
          SET current_price = ?, version = version + 1
          WHERE id = ?
        `,
        [bidAmount, auctionId],
      );

      if (previousHighest?.user_id && Number(previousHighest.user_id) !== userId) {
        await connection.execute(
          `
            INSERT INTO Notifications
              (user_id, auction_id, type, title, message, action_url)
            VALUES
              (?, ?, 'BID_OUTBID', ?, ?, ?)
          `,
          [
            previousHighest.user_id,
            auctionId,
            "Bạn đã bị vượt giá",
            `Một thành viên khác vừa đặt giá cao hơn bạn trong phiên "${auction.product_name}".`,
            `/pages/product-detail.html?id=${auctionId}`,
          ],
        );
      }

      await connection.execute(
        `
          INSERT INTO Notifications
            (user_id, auction_id, type, title, message, action_url)
          VALUES
            (?, ?, 'BID_LEADING', ?, ?, ?)
        `,
        [
          userId,
          auctionId,
          "Bạn đang dẫn đầu",
          `Lượt giá của bạn đang dẫn đầu trong phiên "${auction.product_name}".`,
          `/pages/product-detail.html?id=${auctionId}`,
        ],
      );

      await connection.commit();

      const payload = {
        auctionId,
        bidId: bidResult.insertId,
        userId,
        bidder: req.user.username,
        bidAmount,
        amount: bidAmount,
        currentPrice: bidAmount,
        createdAt: new Date().toISOString(),
      };

      emitBidEvent(req, auctionId, payload);

      return sendSuccess(
        res,
        payload,
        "Đặt giá thành công.",
        201,
      );
    } catch (error) {
      await connection.rollback();
      console.error("[Place Bid Error]:", error);
      return sendError(res, "ERR_PLACE_BID", "Không thể đặt giá lúc này.", 500);
    } finally {
      connection.release();
    }
  }

  static async getBidHistory(req, res) {
    const auctionId = Number(req.params.id);

    if (!auctionId) {
      return sendError(res, "ERR_INVALID_AUCTION_ID", "ID phiên đấu giá không hợp lệ.", 400);
    }

    try {
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

      return sendSuccess(
        res,
        {
          bids: bids.map((bid, index) => ({
            id: bid.id,
            bidder: maskBidder(bid.username, bid.email),
            amount: Number(bid.bid_amount || 0),
            time: formatUTC(bid.created_at),
            highlight: index === 0,
          })),
        },
        "Lấy lịch sử đặt giá thành công.",
      );
    } catch (error) {
      console.error("[Bid History Error]:", error);
      return sendError(res, "ERR_BID_HISTORY", "Không thể lấy lịch sử đặt giá.", 500);
    }
  }

  static async setupAutoBid(req, res) {
    return sendError(
      res,
      "ERR_AUTOBID_NOT_READY",
      "Auto-bid sẽ được nối lại sau khi luồng đặt cọc và bid thủ công ổn định.",
      501,
    );
  }
}

module.exports = BiddingController;
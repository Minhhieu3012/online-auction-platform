const logger = require("../utils/logger");
const { kafka } = require("../config/kafka");
const pool = require("../config/db");

const consumer = kafka.consumer({ groupId: "bidding-group" });

function formatUTC(value) {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  const text = String(value);
  return text.endsWith("Z") ? text : text.replace(" ", "T") + "Z";
}

function maskBidder(username, email) {
  const source = username || email || "Bidder";
  if (source.length <= 2) return `${source[0] || "B"}***`;
  return `${source[0]}***${source[source.length - 1]}`.toUpperCase();
}

function emitToAuctionRoom(io, event, auctionId, payload) {
  if (!io || !auctionId) return;
  io.to(String(auctionId)).emit(event, payload);
}

function buildBidPayload({ bid, auctionId, userId, bidAmount, version, newEndTime }) {
  const amount = Number(bid?.bid_amount || bidAmount || 0);
  const createdAt = formatUTC(bid?.created_at);

  return {
    auctionId: Number(auctionId),
    auction_id: Number(auctionId),
    bidId: bid?.id ? Number(bid.id) : null,
    bid_id: bid?.id ? Number(bid.id) : null,
    id: bid?.id ? Number(bid.id) : null,
    userId: Number(userId),
    user_id: Number(userId),
    bidder: maskBidder(bid?.username, bid?.email),
    username: bid?.username || null,
    bidAmount: amount,
    bid_amount: amount,
    amount,
    currentPrice: amount,
    current_price: amount,
    version: Number(version || 0),
    newEndTime: newEndTime || null,
    endTime: newEndTime || null,
    createdAt,
    created_at: createdAt,
    time: createdAt,
  };
}

async function persistBidEvent(payload, io) {
  const auctionId = Number(payload.auction_id || payload.auctionId);
  const userId = Number(payload.user_id || payload.userId);
  const bidAmount = Number(payload.price || payload.bidAmount || payload.bid_amount || payload.amount);
  const incomingVersion = Number(payload.version || 0);
  const newEndTime = payload.newEndTime || payload.new_end_time || null;

  if (!auctionId || !userId || !bidAmount) {
    logger.warn("[Kafka Consumer] Bỏ qua bid event thiếu auctionId/userId/bidAmount.");
    return;
  }

  const connection = await pool.getConnection();
  let realtimePayload = null;

  try {
    await connection.beginTransaction();

    const [auctionRows] = await connection.execute(
      `
        SELECT id, current_price, version, status
        FROM Auctions
        WHERE id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [auctionId],
    );

    if (auctionRows.length === 0) {
      await connection.rollback();
      logger.warn(`[Kafka Consumer] Không tìm thấy phiên ${auctionId}.`);
      return;
    }

    const auction = auctionRows[0];
    const currentVersion = Number(auction.version || 0);
    const nextVersion = incomingVersion > currentVersion ? incomingVersion : currentVersion + 1;

    if (incomingVersion > 0 && currentVersion >= incomingVersion) {
      await connection.rollback();
      logger.info(
        `[Kafka Consumer] Bỏ qua bid $${bidAmount} cho phiên ${auctionId} vì DB đã ở version ${currentVersion}.`,
      );
      return;
    }

    const [insertResult] = await connection.execute(
      `
        INSERT INTO Bids (auction_id, user_id, bid_amount)
        VALUES (?, ?, ?)
      `,
      [auctionId, userId, bidAmount],
    );

    let sql = `
      UPDATE Auctions
      SET current_price = ?, version = ?, updated_at = NOW()
    `;
    const params = [bidAmount, nextVersion];

    if (newEndTime) {
      const mysqlDatetime = new Date(newEndTime).toISOString().slice(0, 19).replace("T", " ");
      sql += `, end_time = ?`;
      params.push(mysqlDatetime);
    }

    sql += ` WHERE id = ?`;
    params.push(auctionId);

    await connection.execute(sql, params);

    const [bidRows] = await connection.execute(
      `
        SELECT
          b.id,
          b.auction_id,
          b.user_id,
          b.bid_amount,
          b.created_at,
          u.username,
          u.email
        FROM Bids b
        INNER JOIN Users u ON u.id = b.user_id
        WHERE b.id = ?
        LIMIT 1
      `,
      [insertResult.insertId],
    );

    realtimePayload = buildBidPayload({
      bid: bidRows[0],
      auctionId,
      userId,
      bidAmount,
      version: nextVersion,
      newEndTime,
    });

    await connection.commit();
    logger.info(`[Kafka Consumer] Đã đồng bộ bid $${bidAmount} cho phiên ${auctionId} xuống DB.`);
  } catch (error) {
    await connection.rollback();
    logger.error(`[Kafka Consumer DB Error] Lỗi đồng bộ bid $${bidAmount}:`, error.message);
  } finally {
    connection.release();
  }

  if (realtimePayload) {
    emitToAuctionRoom(io, "new_bid", auctionId, realtimePayload);
  }
}

const startKafkaConsumer = async (io = null) => {
  try {
    await consumer.connect();
    logger.success("[Kafka Consumer] Đã khởi động và sẵn sàng nhận việc!");

    await consumer.subscribe({
      topics: ["auction-bids", "fraud_alerts", "auction_extensions", "winner-notifications"],
      fromBeginning: false,
    });

    await consumer.run({
      eachMessage: async ({ topic, message }) => {
        try {
          const payload = JSON.parse(message.value.toString());

          if (topic === "fraud_alerts") {
            logger.warn(`[AI WARNING] Cảnh báo tài khoản ${payload.user_id} - Điểm rủi ro: ${payload.lss_score}`);
            if (io) io.emit("fraud_detected", payload);
            return;
          }

          if (topic === "auction_extensions") {
            const auctionId = payload.auction_id || payload.auctionId;
            logger.info(`[AI SYSTEM] Gia hạn phiên ${auctionId} thêm ${payload.extend_by || 30}s`);
            emitToAuctionRoom(io, "auction_extended", auctionId, payload);
            return;
          }

          if (topic === "winner-notifications") {
            const auctionId = payload.auctionId || payload.auction_id;
            logger.info(`[Socket.io] Gửi kết quả phiên ${auctionId} tới auction room.`);
            emitToAuctionRoom(io, "auction_winner", auctionId, payload);
            emitToAuctionRoom(io, "auction_finalized", auctionId, payload);
            return;
          }

          if (topic === "auction-bids") {
            await persistBidEvent(payload, io);
          }
        } catch (parseError) {
          logger.error("[Kafka Message Parse Error]:", parseError.message);
        }
      },
    });
  } catch (error) {
    logger.error("[Kafka Consumer Error]:", error.message);
  }
};

const stopKafkaConsumer = async () => {
  try {
    await consumer.disconnect();
    logger.info("[Kafka Consumer] Đã ngắt kết nối an toàn.");
  } catch (error) {
    logger.error("[Kafka Consumer Disconnect Error]:", error.message);
  }
};

module.exports = { startKafkaConsumer, stopKafkaConsumer };
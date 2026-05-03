const redisKeys = require("../utils/redis-keys");
const AutoBidService = require("./autobid");
const redisClient = require("../config/redis");
const pool = require("../config/db");
const { checkAntiSniping } = require("../constants/business");
const { producer } = require("../config/kafka");
const logger = require("../utils/logger");

const placeBidLuaScript = `
    local auction_key = KEYS[1]
    local user_id = ARGV[1]
    local bid_amount = tonumber(ARGV[2])

    local current_price = tonumber(redis.call('HGET', auction_key, 'current_price'))
    local step_price = tonumber(redis.call('HGET', auction_key, 'step_price'))
    local status = redis.call('HGET', auction_key, 'status')
    local current_version = tonumber(redis.call('HGET', auction_key, 'version')) or 0
    local highest_bidder = redis.call('HGET', auction_key, 'highest_bidder')

    if not current_price then return 'ERR_NOT_FOUND' end
    if status ~= 'Active' and status ~= 'Closing' then return 'ERR_INVALID_STATE' end
    if highest_bidder == user_id then return 'ERR_ALREADY_HIGHEST' end

    local min_required = current_price + step_price
    if bid_amount < min_required then return 'ERR_BID_TOO_LOW' end

    redis.call('HSET', auction_key,
        'current_price', bid_amount,
        'highest_bidder', user_id,
        'version', current_version + 1
    )

    return current_version
`;

function toMysqlDateTime(dateOrMs) {
  return new Date(dateOrMs).toISOString().slice(0, 19).replace("T", " ");
}

class BiddingService {
  static async hydrateAuctionCacheIfMissing(auctionId) {
    const auctionKey = redisKeys.auctionInfo(auctionId);
    const exists = await redisClient.exists(auctionKey);

    if (exists) {
      return true;
    }

    const [rows] = await pool.execute(
      `
        SELECT
          id,
          status,
          current_price,
          step_price,
          end_time,
          version
        FROM Auctions
        WHERE id = ?
        LIMIT 1
      `,
      [auctionId],
    );

    if (rows.length === 0) {
      return false;
    }

    const auction = rows[0];
    const endTimeMs = new Date(auction.end_time).getTime();

    await redisClient.hSet(auctionKey, {
      current_price: String(auction.current_price),
      step_price: String(auction.step_price),
      status: String(auction.status),
      version: String(auction.version || 0),
      highest_bidder: "",
      end_time: String(endTimeMs),
      extension_count: "0",
    });

    return true;
  }

  static async sendBidEventToKafka({
    auctionId,
    userId,
    bidAmount,
    version,
    newEndTime,
  }) {
    await producer.send({
      topic: "auction-bids",
      messages: [
        {
          key: String(auctionId),
          value: JSON.stringify({
            auctionId,
            userId,
            bidAmount,
            version,
            newEndTime,
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    });
  }

  static async fallbackPersistBidToDB({
    auctionId,
    userId,
    bidAmount,
    version,
    newEndTime,
  }) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      await connection.execute(
        `
          INSERT INTO Bids (auction_id, user_id, bid_amount)
          VALUES (?, ?, ?)
        `,
        [auctionId, userId, bidAmount],
      );

      if (newEndTime) {
        await connection.execute(
          `
            UPDATE Auctions
            SET current_price = ?, version = ?, end_time = ?
            WHERE id = ?
          `,
          [bidAmount, version, toMysqlDateTime(newEndTime), auctionId],
        );
      } else {
        await connection.execute(
          `
            UPDATE Auctions
            SET current_price = ?, version = ?
            WHERE id = ?
          `,
          [bidAmount, version, auctionId],
        );
      }

      await connection.commit();

      logger.info(`[DB Fallback] Đã lưu bid $${bidAmount} cho phiên ${auctionId}`);
    } catch (error) {
      await connection.rollback();
      logger.error("[DB Fallback Error]:", error.message);
      throw error;
    } finally {
      connection.release();
    }
  }

  static async placeBid(auctionId, userId, bidAmount) {
    const auctionKey = redisKeys.auctionInfo(auctionId);

    try {
      const hydrated = await BiddingService.hydrateAuctionCacheIfMissing(auctionId);

      if (!hydrated) {
        return {
          success: false,
          errorCode: "ERR_AUCTION_NOT_FOUND",
        };
      }

      const result = await redisClient.eval(placeBidLuaScript, {
        keys: [auctionKey],
        arguments: [String(userId), String(bidAmount)],
      });

      if (typeof result !== "number") {
        return {
          success: false,
          errorCode: result,
        };
      }

      const currentVersion = result;
      const nextVersion = currentVersion + 1;

      logger.success(`[Bid Success] User ${userId} đặt $${bidAmount} cho phiên ${auctionId}`);

      const auctionInfo = await redisClient.hGetAll(auctionKey);

      AutoBidService.triggerAutoBids(auctionId, bidAmount, userId).catch((err) => {
        console.error("[Auto-bid Trigger Error]:", err.message);
      });

      let newEndTimeForDB = null;
      let currentEndTime = auctionInfo.end_time;

      try {
        const extensionCount = parseInt(auctionInfo.extension_count, 10) || 0;
        const rawEndTime = auctionInfo.end_time;
        const endTime = /^\d+$/.test(rawEndTime) ? parseInt(rawEndTime, 10) : Date.parse(rawEndTime);

        const antiSnipe = checkAntiSniping(endTime, extensionCount);

        if (antiSnipe.shouldExtend) {
          const newEndString = new Date(antiSnipe.newEndTime).toISOString();

          await redisClient.hSet(
            auctionKey,
            "end_time",
            String(antiSnipe.newEndTime),
            "extension_count",
            String(extensionCount + 1),
          );

          newEndTimeForDB = antiSnipe.newEndTime;
          currentEndTime = String(antiSnipe.newEndTime);

          logger.info(`[Anti-Snipe] Phiên ${auctionId} gia hạn đến: ${newEndString} (Lần ${extensionCount + 1})`);
        }
      } catch (err) {
        logger.error("[Anti-Snipe Error]:", err.message);
      }

      try {
        await BiddingService.sendBidEventToKafka({
          auctionId,
          userId,
          bidAmount,
          version: nextVersion,
          newEndTime: newEndTimeForDB,
        });

        logger.info(`[Kafka] Đã đẩy sự kiện Bid ($${bidAmount}) vào topic 'auction-bids'`);
      } catch (kafkaError) {
        logger.error("[Kafka Error]:", kafkaError.message);

        await BiddingService.fallbackPersistBidToDB({
          auctionId,
          userId,
          bidAmount,
          version: nextVersion,
          newEndTime: newEndTimeForDB,
        });
      }

      return {
        success: true,
        message: "Đặt giá thành công!",
        data: {
          auctionId,
          bidAmount,
          currentPrice: bidAmount,
          version: nextVersion,
          endTime: currentEndTime,
          minNextBid: bidAmount + Number(auctionInfo.step_price || 0),
        },
      };
    } catch (error) {
      logger.error("[Bidding Error]:", error);
      throw new Error("Hệ thống đang quá tải, vui lòng thử lại sau");
    }
  }
}

module.exports = BiddingService;
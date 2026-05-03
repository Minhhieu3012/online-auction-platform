const redisKeys = require("../utils/redis-keys");
const AutoBidService = require("./autobid");
const redisClient = require("../config/redis");
const pool = require("../config/db"); // Kết nối MySQL để tự phục hồi cache
const { checkAntiSniping } = require("../constants/business");
const { producer } = require("../config/kafka");
const logger = require("../utils/logger");

/**
 * Lua Script: Xử lý đặt giá nguyên tử trên Redis để đảm bảo hiệu năng và tính nhất quán
 */
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
  /**
   * Tự động phục hồi Cache từ MySQL nếu Redis bị mất dữ liệu
   */
  static async hydrateAuctionCacheIfMissing(auctionId) {
    const auctionKey = redisKeys.auctionInfo(auctionId);
    const exists = await redisClient.exists(auctionKey);

    if (exists) {
      return true;
    }

    logger.warn(`[Cache Miss] Phiên ${auctionId} không có trên Redis. Đang nạp từ MySQL...`);

    // Gộp query của nhánh dev: Lấy thêm current_highest_bidder
    const [rows] = await pool.execute(
      `
        SELECT a.*, 
          (SELECT user_id FROM Bids WHERE auction_id = a.id ORDER BY bid_amount DESC LIMIT 1) as current_highest_bidder 
        FROM Auctions a 
        WHERE a.id = ? AND a.status = 'Active'
        LIMIT 1
      `,
      [auctionId],
    );

    if (rows.length === 0) {
      return false;
    }

    const auc = rows[0];
    const endTimeMs = new Date(auc.end_time).getTime();
    const highestBidderToRestore = auc.current_highest_bidder ? String(auc.current_highest_bidder) : "";

    await redisClient.hSet(auctionKey, {
      current_price: String(auc.current_price),
      step_price: String(auc.step_price),
      status: String(auc.status),
      version: String(auc.version || 0),
      highest_bidder: highestBidderToRestore,
      end_time: String(endTimeMs),
      extension_count: "0",
    });

    logger.success(`[Cache Warm-up] Đã nạp thành công phiên ${auctionId} (Highest Bidder: ${highestBidderToRestore || 'Trống'}) lên Redis.`);
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
            auction_id: String(auctionId),
            user_id: String(userId),
            price: Number(bidAmount),
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

  /**
   * Đặt giá đấu giá chính
   */
  static async placeBid(auctionId, userId, bidAmount) {
    const auctionKey = redisKeys.auctionInfo(auctionId);

    try {
      // 1. Phục hồi Cache nếu cần
      const hydrated = await BiddingService.hydrateAuctionCacheIfMissing(auctionId);

      if (!hydrated) {
        return {
          success: false,
          errorCode: "ERR_AUCTION_NOT_FOUND",
        };
      }

      // 2. Chạy Lua Script Đặt giá trên Redis
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

      // Kích hoạt Auto Bid
      AutoBidService.triggerAutoBids(auctionId, bidAmount, userId).catch((err) => {
        logger.error("[Auto-bid Trigger Error]:", err.message);
      });

      let newEndTimeForDB = null;
      let currentEndTime = auctionInfo.end_time;

      // Xử lý Anti Sniping
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

      // 3. Đẩy vào Kafka để đồng bộ MySQL
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

        // Fallback lưu thẳng DB nếu Kafka sập
        await BiddingService.fallbackPersistBidToDB({
          auctionId,
          userId,
          bidAmount,
          version: nextVersion,
          newEndTime: newEndTimeForDB,
        });
      }

      // Trả về data chi tiết cho nhánh Frontend
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
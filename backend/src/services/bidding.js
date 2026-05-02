const redisKeys = require("../utils/redis-keys");
const AutoBidService = require("./autobid");
const redisClient = require("../config/redis");
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

class BiddingService {
  static async placeBid(auctionId, userId, bidAmount) {
    const auctionKey = redisKeys.auctionInfo(auctionId);

    try {
      const result = await redisClient.eval(placeBidLuaScript, {
        keys: [auctionKey],
        arguments: [userId.toString(), bidAmount.toString()],
      });

      if (typeof result === "number") {
        const currentVersion = result;
        logger.success(`[Bid Success] User ${userId} đặt $${bidAmount} cho phiên ${auctionId}`);

        // Đọc auctionInfo một lần duy nhất
        const auctionInfo = await redisClient.hGetAll(auctionKey);

        // Trigger Auto-bid cho các user khác
        AutoBidService.triggerAutoBids(auctionId, bidAmount, userId).catch((err) => {
          console.error("[Auto-bid Trigger Error]:", err.message);
        });

        // Kiểm tra Anti-sniping
        let newEndTimeForDB = null;
        try {
          const extensionCount = parseInt(auctionInfo.extension_count) || 0;

          const rawEndTime = auctionInfo.end_time;
          const endTime = /^\d+$/.test(rawEndTime) ? parseInt(rawEndTime, 10) : Date.parse(rawEndTime);

          const antiSnipe = checkAntiSniping(endTime, extensionCount);
          if (antiSnipe.shouldExtend) {
            const newEndString = new Date(antiSnipe.newEndTime).toISOString();

            await redisClient.hSet(
              auctionKey,
              "end_time",
              newEndString,
              "extension_count",
              (extensionCount + 1).toString(),
            );
            newEndTimeForDB = antiSnipe.newEndTime;
            logger.info(`[Anti-Snipe] Phiên ${auctionId} gia hạn đến: ${newEndString} (Lần ${extensionCount + 1})`);
          }
        } catch (err) {
          logger.error("[Anti-Snipe Error]:", err.message);
        }

        // Bắn Kafka — Consumer sẽ lo việc ghi DB
        try {
          await producer.send({
            topic: "auction-bids",
            messages: [
              {
                key: auctionId.toString(),
                value: JSON.stringify({
                  auction_id: auctionId.toString(), // Khớp với Pydantic schema
                  user_id: userId.toString(),       // Khớp với Pydantic schema
                  price: Number(bidAmount),         // Đổi bidAmount thành price
                  version: currentVersion + 1,
                  newEndTime: newEndTimeForDB,
                  timestamp: new Date().toISOString(),
                }),
              },
            ],
          });
          logger.info(`[Kafka] Đã đẩy sự kiện Bid ($${bidAmount}) vào topic 'auction-bids'`);
        } catch (kafkaError) {
          logger.error("[Kafka Error]:", kafkaError.message);
          // TODO: Fallback — ghi thẳng vào DB nếu Kafka chết
        }

        return { success: true, message: "Đặt giá thành công" };
      } else {
        return { success: false, errorCode: result };
      }
    } catch (error) {
      logger.error("[Bidding Error]:", error);
      throw new Error("Hệ thống đang quá tải, vui lòng thử lại sau");
    }
  }
}

module.exports = BiddingService;
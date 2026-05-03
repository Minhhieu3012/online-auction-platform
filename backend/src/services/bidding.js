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

class BiddingService {
  /**
   * Đặt giá đấu giá
   */
  static async placeBid(auctionId, userId, bidAmount) {
    const auctionKey = redisKeys.auctionInfo(auctionId);

    try {
      // --- BƯỚC 1: KIỂM TRA & TỰ PHỤC HỒI CACHE (TRIỆT ĐỂ) ---
      let exists = await redisClient.exists(auctionKey);
      
      if (!exists) {
        logger.warn(`[Cache Miss] Phiên ${auctionId} không có trên Redis. Đang nạp từ MySQL...`);
        
        // FIX KIẾN TRÚC: Lấy thêm user_id của người đang trả giá cao nhất từ bảng Bids
        const [rows] = await pool.execute(
          `SELECT a.*, 
            (SELECT user_id FROM Bids WHERE auction_id = a.id ORDER BY bid_amount DESC LIMIT 1) as current_highest_bidder 
           FROM Auctions a WHERE a.id = ? AND a.status = 'Active'`,
          [auctionId]
        );

        if (rows.length === 0) {
          return { success: false, errorCode: 'ERR_NOT_FOUND' };
        }

        const auc = rows[0];
        const highestBidderToRestore = auc.current_highest_bidder ? auc.current_highest_bidder.toString() : "";

        // Nạp lại vào Redis với đầy đủ trạng thái lịch sử
        await redisClient.hSet(auctionKey, {
          current_price: auc.current_price.toString(),
          step_price: auc.step_price.toString(),
          status: auc.status,
          version: auc.version.toString(),
          highest_bidder: highestBidderToRestore, 
          end_time: new Date(auc.end_time).getTime().toString(),
          extension_count: "0"
        });
        logger.success(`[Cache Warm-up] Đã nạp thành công phiên ${auctionId} (Highest Bidder: ${highestBidderToRestore || 'Trống'}) lên Redis.`);
      }

      // --- BƯỚC 2: CHẠY LUA SCRIPT ĐẶT GIÁ TRÊN REDIS ---
      const result = await redisClient.eval(placeBidLuaScript, {
        keys: [auctionKey],
        arguments: [userId.toString(), bidAmount.toString()],
      });

      if (typeof result === "number") {
        const currentVersion = result;
        logger.success(`[Bid Success] User ${userId} đặt $${bidAmount} cho phiên ${auctionId}`);

        // Đọc thông tin phiên sau khi đặt giá thành công
        const auctionInfo = await redisClient.hGetAll(auctionKey);

        // Kích hoạt Auto-bid cho các người dùng khác
        AutoBidService.triggerAutoBids(auctionId, bidAmount, userId).catch((err) => {
          logger.error("[Auto-bid Trigger Error]:", err.message);
        });

        // Kiểm tra cơ chế Anti-sniping (Gia hạn giờ chót)
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
              (extensionCount + 1).toString()
            );
            newEndTimeForDB = antiSnipe.newEndTime;
            logger.info(`[Anti-Snipe] Gia hạn phiên ${auctionId} đến: ${newEndString}`);
          }
        } catch (err) {
          logger.error("[Anti-Snipe Error]:", err.message);
        }

        // --- BƯỚC 3: BẮN KAFKA ĐỂ ĐỒNG BỘ XUỐNG MYSQL ---
        try {
          await producer.send({
            topic: "auction-bids",
            messages: [
              {
                key: auctionId.toString(),
                value: JSON.stringify({
                  auction_id: auctionId.toString(),
                  user_id: userId.toString(),
                  price: Number(bidAmount),
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
          // Fallback: Ghi thẳng DB nếu Kafka lỗi
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
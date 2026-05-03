const { Worker } = require("bullmq");
const ioredis = require("ioredis");
const pool = require("../config/db");
const logger = require("../utils/logger");

const connection = new ioredis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: null,
});

const auctionWorker = new Worker(
  "auction-management",
  async (job) => {
    if (job.name === "close-auction") {
      const { auctionId } = job.data;
      logger.info(`[Worker] Đang tiến hành đóng phiên đấu giá: ${auctionId}`);

      const db = await pool.getConnection();
      try {
        await db.beginTransaction();

        // 1. Kiểm tra trạng thái hiện tại (Đảm bảo phiên vẫn đang Active)
        const [auctionInfo] = await db.execute(
          "SELECT status FROM Auctions WHERE id = ? FOR UPDATE",
          [auctionId]
        );

        if (!auctionInfo.length || auctionInfo[0].status !== "Active") {
          logger.warn(`[Worker Skip] Phiên ${auctionId} không ở trạng thái Active. Bỏ qua.`);
          await db.rollback();
          return;
        }

        // 2. Tìm người đặt giá cao nhất (Winner)
        const [bids] = await db.execute(
          "SELECT user_id, bid_amount FROM Bids WHERE auction_id = ? ORDER BY bid_amount DESC LIMIT 1",
          [auctionId]
        );

        if (bids.length === 0) {
          // Trường hợp không có ai đặt giá
          await db.execute(
            "UPDATE Auctions SET status = 'Expired' WHERE id = ?",
            [auctionId]
          );
          logger.warn(`[Worker] Phiên ${auctionId} kết thúc mà không có người đặt giá.`);
        } else {
          const winner = bids[0];
          
          // 3. Cập nhật trạng thái thành 'Pending Payment' và gán người thắng
          await db.execute(
            "UPDATE Auctions SET status = 'Pending Payment', winner_id = ?, final_price = ? WHERE id = ?",
            [winner.user_id, winner.bid_amount, auctionId]
          );

          logger.success(`[Worker] Chốt đơn thành công phiên ${auctionId}. Người thắng: User ${winner.user_id} ($${winner.bid_amount})`);
          
          // TODO: Tại đây bạn có thể bắn một sự kiện Kafka để hệ thống Email gửi link thanh toán cho người thắng
        }

        await db.commit();
      } catch (error) {
        if (db) await db.rollback();
        logger.error(`[Worker Error] Thất bại khi đóng phiên ${auctionId}: ${error.message}`);
        throw error; // Quăng lỗi để BullMQ thực hiện cơ chế retry nếu cần
      } finally {
        if (db) db.release();
      }
    }
  },
  { connection }
);

auctionWorker.on("failed", (job, err) => {
  logger.error(`[Worker Critical] Job ${job.id} thất bại sau nhiều lần thử: ${err.message}`);
});

module.exports = auctionWorker;
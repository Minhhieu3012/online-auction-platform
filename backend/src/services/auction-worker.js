const { Worker } = require("bullmq");
const { connection } = require("../config/queue");
const pool = require("../config/db");
const redisClient = require("../config/redis");

const auctionWorker = new Worker(
  "auction-lifecycle",
  async (job) => {
    // Chỉ xử lý công việc có tên là 'close-auction'
    if (job.name === "close-auction") {
      const { auctionId } = job.data;
      console.log(`[BullMQ] Tới giờ! Đang đóng phiên đấu giá ${auctionId}...`);

      const dbConnection = await pool.getConnection();
      try {
        // 1. Chốt MySQL (Chỉ đóng nếu nó đang Active hoặc Closing)
        const [result] = await dbConnection.execute(
          "UPDATE Auctions SET status = 'Ended' WHERE id = ? AND status IN ('Active', 'Closing')",
          [auctionId],
        );

        if (result.affectedRows > 0) {
          // 2. Chốt Redis (Chặn đứng mọi Lua Script Bidding)
          await redisClient.hSet(`auction:${auctionId}:info`, "status", "Ended");

          console.log(`[BullMQ] Đã khóa phiên ${auctionId}. Bidding chính thức khép lại.`);

          // TODO (Giai đoạn 3): Gọi AutoBidService.releaseAutoBid() ở đây để hoàn tiền
        }
      } catch (error) {
        console.error(`[BullMQ] Lỗi Database khi đóng phiên ${auctionId}:`, error.message);
        throw error;
      } finally {
        dbConnection.release();
      }
    }
  },
  { connection },
);

auctionWorker.on("failed", (job, err) => {
  console.error(`[BullMQ] Job ${job.name} thất bại:`, err.message);
});

module.exports = auctionWorker;

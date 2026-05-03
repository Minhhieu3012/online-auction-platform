const { Queue } = require("bullmq");
const ioredis = require("ioredis");

// Kết nối tới Redis - Nơi lưu trữ các Delayed Jobs
const connection = new ioredis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: null, // Bắt buộc đối với BullMQ
});

const auctionQueue = new Queue("auction-management", { connection });

/**
 * Hàm hẹn giờ kết thúc cho một phiên đấu giá
 * @param {number} auctionId - ID phiên đấu giá trong DB
 * @param {number} delayMs - Khoảng thời gian từ lúc này đến lúc kết thúc (miligiây)
 */
const scheduleAuctionEnd = async (auctionId, delayMs) => {
  try {
    await auctionQueue.add(
      "close-auction",
      { auctionId },
      { 
        delay: delayMs, 
        jobId: `auction-${auctionId}`,
        removeOnComplete: true // Tự xóa log sau khi xong để nhẹ Redis
      }
    );
    console.log(`[Queue] Đã đặt lịch kết thúc cho phiên ${auctionId} sau ${delayMs / 1000} giây.`);
  } catch (error) {
    console.error(`[Queue Error] Không thể đặt lịch cho phiên ${auctionId}:`, error);
  }
};

module.exports = { auctionQueue, scheduleAuctionEnd };
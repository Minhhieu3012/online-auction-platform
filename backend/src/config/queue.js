const logger = require("../utils/logger");
const { Queue } = require("bullmq");
require("dotenv").config();

// Sử dụng connection options để BullMQ tự tạo các kết nối Redis độc lập.
// Tránh lỗi Deadlock khi Queue và Worker dùng chung 1 kết nối.
const connectionOptions = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || 6379, 10),
  maxRetriesPerRequest: null,
};

const auctionQueue = new Queue("auction-lifecycle", { connection: connectionOptions });

const scheduleAuctionClose = async (auctionId, endTime) => {
  const targetTime = new Date(endTime).getTime();
  const finalDelay = Math.max(0, targetTime - Date.now());

  await auctionQueue.add(
    "close-auction",
    { auctionId },
    {
      delay: finalDelay,
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      jobId: `close-auction-${auctionId}`, // Thêm jobId để chống lưu trùng
    },
  );

  logger.info(`[BullMQ] Đã hẹn giờ đóng phiên ${auctionId} sau ${finalDelay}ms`);
};

logger.info("[BullMQ] Đã khởi tạo Hàng đợi Quản lý Đấu giá");

module.exports = { auctionQueue, connection: connectionOptions, scheduleAuctionClose };

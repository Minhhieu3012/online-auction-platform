const logger = require("../utils/logger");
const { Queue } = require("bullmq");
const IORedis = require("ioredis");
require("dotenv").config();

const connection = new IORedis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT, 10),
  maxRetriesPerRequest: null,
});

const auctionQueue = new Queue("auction-lifecycle", { connection });

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
    },
  );

  logger.info(`[BullMQ] Đã hẹn giờ đóng phiên ${auctionId} sau ${finalDelay}ms`);
};

logger.info("[BullMQ] Đã khởi tạo Hàng đợi Quản lý Đấu giá");

module.exports = { auctionQueue, connection, scheduleAuctionClose };

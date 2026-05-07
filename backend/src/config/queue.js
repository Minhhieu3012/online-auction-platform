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

function normalizeAuctionId(auctionId) {
  const id = Number(auctionId);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

async function removeExistingCloseJob(jobId) {
  const existingJob = await auctionQueue.getJob(jobId);

  if (!existingJob) {
    return true;
  }

  const state = await existingJob.getState();

  if (state === "active") {
    logger.info(`[BullMQ] Job ${jobId} đang active, không xóa để tránh xử lý trùng.`);
    return false;
  }

  try {
    await existingJob.remove();
    logger.info(`[BullMQ] Đã xóa job cũ ${jobId} ở trạng thái ${state}.`);
    return true;
  } catch (error) {
    logger.warn(`[BullMQ] Không thể xóa job cũ ${jobId}: ${error.message}`);
    return false;
  }
}

const scheduleAuctionClose = async (auctionId, endTime) => {
  const safeAuctionId = normalizeAuctionId(auctionId);

  if (!safeAuctionId) {
    logger.warn(`[BullMQ] Không thể hẹn giờ đóng phiên vì auctionId không hợp lệ: ${auctionId}`);
    return null;
  }

  const targetTime = new Date(endTime).getTime();

  if (Number.isNaN(targetTime)) {
    logger.warn(`[BullMQ] Không thể hẹn giờ đóng phiên ${safeAuctionId} vì endTime không hợp lệ: ${endTime}`);
    return null;
  }

  const finalDelay = Math.max(0, targetTime - Date.now());
  const jobId = `close-auction-${safeAuctionId}`;

  const canAddJob = await removeExistingCloseJob(jobId);

  if (!canAddJob) {
    logger.info(`[BullMQ] Bỏ qua hẹn lại job ${jobId} vì job đang được xử lý.`);
    return null;
  }

  const job = await auctionQueue.add(
    "close-auction",
    { auctionId: safeAuctionId },
    {
      delay: finalDelay,
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      jobId,
      removeOnComplete: true,
      removeOnFail: true,
    },
  );

  logger.info(`[BullMQ] Đã hẹn giờ đóng phiên ${safeAuctionId} sau ${finalDelay}ms`);

  return job;
};

logger.info("[BullMQ] Đã khởi tạo Hàng đợi Quản lý Đấu giá");

module.exports = { auctionQueue, connection: connectionOptions, scheduleAuctionClose };
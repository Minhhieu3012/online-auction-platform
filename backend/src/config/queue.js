const { Queue } = require("bullmq");
const IORedis = require("ioredis");
require("dotenv").config();

// Khởi tạo kết nối Redis cho BullMQ với Port đã được parse chuẩn
const connection = new IORedis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT, 10), // Ép kiểu an toàn cơ số 10
  maxRetriesPerRequest: null,
});

// Tạo Hàng đợi
const auctionQueue = new Queue("auction-lifecycle", { connection });

/**
 * Ném công việc đóng phiên vào Hàng đợi
 * @param {number} auctionId - ID phiên đấu giá
 * @param {number|Date} endTime - Thời điểm kết thúc (timestamp hoặc Date object)
 */
const scheduleAuctionClose = async (auctionId, endTime) => {
  // Nếu truyền vào Date object, chuyển nó thành timestamp
  const targetTime = new Date(endTime).getTime();
  const delay = targetTime - Date.now();

  // Nếu thời gian đã trôi qua, delay = 0 (thực thi ngay)
  const finalDelay = Math.max(0, delay);

  await auctionQueue.add(
    "close-auction",
    { auctionId },
    {
      delay: finalDelay,
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 }, // Khoảng cách thử lại tăng dần
    },
  );

  console.log(`[BullMQ] Đã hẹn giờ đóng phiên ${auctionId} sau ${finalDelay}ms`);
};

console.log("[BullMQ] Đã khởi tạo Hàng đợi Quản lý Đấu giá");

module.exports = {
  auctionQueue,
  connection,
  scheduleAuctionClose,
};

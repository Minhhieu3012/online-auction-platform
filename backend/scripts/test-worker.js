require("dotenv").config();
const { scheduleAuctionClose } = require("../src/config/queue");
const logger = require("../src/utils/logger");

async function trigger() {
  logger.info("Đang dán bảng thông báo hẹn giờ cho Worker...");

  const endTime = new Date(Date.now() + 5000);

  await scheduleAuctionClose(1, endTime);

  logger.info("Đã đặt lịch xong! Hãy qua màn hình Terminal của Server để xem Worker thức dậy nhé.");

  setTimeout(() => process.exit(), 10000);
}

trigger();

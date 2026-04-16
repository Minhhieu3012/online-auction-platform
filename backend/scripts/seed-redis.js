require("dotenv").config();
const redisClient = require("../src/config/redis");
const logger = require("../src/utils/logger");

async function seed() {
  const auctionId = 1;
  const auctionKey = `auction:${auctionId}:info`;

  await redisClient.hSet(auctionKey, {
    current_price: "1000",
    step_price: "100",
    status: "Active",
    version: "0",
    highest_bidder: "",
    end_time: (Date.now() + 10000000).toString(),
    extension_count: "0",
  });

  console.log("Đã nạp dữ liệu phiên đấu giá vào Redis thành công!");
  process.exit();
}

seed();

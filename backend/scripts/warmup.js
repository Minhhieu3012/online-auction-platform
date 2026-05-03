const pool = require("../config/db");
const redisClient = require("../config/redis");
const redisKeys = require("../utils/redis-keys");

async function warmUp() {
  console.log("🚀 Đang đồng bộ MySQL -> Redis...");
  try {
    const [auctions] = await pool.execute("SELECT * FROM Auctions WHERE status = 'Active'");
    
    for (const auc of auctions) {
      const key = redisKeys.auctionInfo(auc.id);
      await redisClient.hSet(key, {
        current_price: auc.current_price.toString(),
        step_price: auc.step_price.toString(),
        status: auc.status,
        version: auc.version.toString(),
        end_time: new Date(auc.end_time).getTime().toString(),
        extension_count: "0"
      });
    }
    console.log(`✅ Đã nạp ${auctions.length} phiên vào Redis.`);
    process.exit();
  } catch (err) {
    console.error("❌ Lỗi warmup:", err);
    process.exit(1);
  }
}
warmUp();
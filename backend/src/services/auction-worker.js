const { Worker } = require("bullmq");
const { connection } = require("../config/queue");
const redisClient = require("../config/redis");
const pool = require("../config/db");

const auctionWorker = new Worker(
  "auction-lifecycle",
  async (job) => {
    const { auctionId } = job.data;
    console.log(`\n[Worker] Bắt đầu xử lý đóng phiên đấu giá ID: ${auctionId}...`);

    const auctionKey = `auction:${auctionId}:info`;
    const dbConnection = await pool.getConnection();

    try {
      // 1. Lấy dữ liệu chốt sổ từ Redis
      const auctionData = await redisClient.hGetAll(auctionKey);
      if (!auctionData || Object.keys(auctionData).length === 0) {
        console.log(`[Worker] Bỏ qua: Phiên ${auctionId} không tồn tại trong Redis.`);
        return;
      }
      if (auctionData.status === "Ended") {
        console.log(`[Worker] Bỏ qua: Phiên ${auctionId} đã được đóng từ trước.`);
        return;
      }

      const highestBidder = auctionData.highest_bidder;
      const finalPrice = parseFloat(auctionData.current_price);

      // 2. Transaction MySQL trước
      await dbConnection.beginTransaction();

      const [updateResult] = await dbConnection.execute(
        `UPDATE Auctions 
         SET status = 'Ended', current_price = ?, version = version + 1
         WHERE id = ? AND status IN ('Active', 'Closing')`,
        [finalPrice, auctionId],
      );

      if (updateResult.affectedRows === 0) {
        throw new Error("ERR_AUCTION_ALREADY_ENDED");
      }

      // 3. Tạo Transaction cho người thắng
      if (highestBidder && highestBidder !== "") {
        await dbConnection.execute(
          `INSERT INTO Transactions (user_id, auction_id, amount, type, status)
           VALUES (?, ?, ?, 'WIN_PAYMENT', 'PENDING')`,
          [highestBidder, auctionId, finalPrice],
        );
        console.log(`[Worker] NGƯỜI CHIẾN THẮNG: User ID ${highestBidder} với mức giá $${finalPrice}!`);
      } else {
        console.log(`[Worker] Phiên đấu giá kết thúc không có ai trả giá.`);
      }

      await dbConnection.commit();

      // 4. Chỉ khóa Redis sau khi MySQL thành công
      await redisClient.hSet(auctionKey, "status", "Ended");

      // TODO: Gọi AutoBidService.releaseAutoBid() cho tất cả user thua

      console.log(`[Worker] Đóng phiên ${auctionId} thành công!`);
    } catch (error) {
      await dbConnection.rollback();
      console.error(`[Worker Error] Lỗi khi đóng phiên ${auctionId}:`, error);
      throw error;
    } finally {
      dbConnection.release();
    }
  },
  { connection },
);

auctionWorker.on("completed", (job) => {
  console.log(`[BullMQ] Nhiệm vụ ${job.id} đã hoàn tất.`);
});

auctionWorker.on("failed", (job, err) => {
  console.log(`[BullMQ] Nhiệm vụ ${job.id} thất bại:`, err.message);
});

module.exports = auctionWorker;

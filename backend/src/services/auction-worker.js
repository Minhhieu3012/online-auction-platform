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
      // 1. Đọc dữ liệu nguyên bản từ Redis trước tiên
      const auctionData = await redisClient.hGetAll(auctionKey);

      if (!auctionData || Object.keys(auctionData).length === 0) {
        console.log(`[Worker] Bỏ qua: Phiên ${auctionId} không tồn tại trong Redis.`);
        return;
      }

      // 2. Kiểm tra an toàn (Bảo vệ tính toàn vẹn của logic)
      if (auctionData.status === "Ended" || auctionData.status === "Payment Pending") {
        console.log(`[Worker] Bỏ qua: Phiên ${auctionId} đã được xử lý từ trước.`);
        return;
      }

      // 3. Khóa Redis sang trạng thái 'Closing' (Từ chối mọi lượt Bid mới từ giờ)
      await redisClient.hSet(auctionKey, "status", "Closing");

      const highestBidder = auctionData.highest_bidder;
      const finalPrice = parseFloat(auctionData.current_price);

      // 4. LOGIC STATE MACHINE: Xác định trạng thái cuối
      let finalStatus = "Ended";
      if (highestBidder && highestBidder !== "") {
        finalStatus = "Payment Pending";
      }

      // 5. Bắt đầu Transaction MySQL
      await dbConnection.beginTransaction();

      const [updateResult] = await dbConnection.execute(
        `UPDATE Auctions 
         SET status = ?, current_price = ?, version = version + 1
         WHERE id = ? AND status IN ('Active', 'Closing')`,
        [finalStatus, finalPrice, auctionId],
      );

      if (updateResult.affectedRows === 0) {
        throw new Error("ERR_AUCTION_ALREADY_ENDED");
      }

      // 6. Tạo Transaction chờ thanh toán nếu có người thắng
      if (finalStatus === "Payment Pending") {
        await dbConnection.execute(
          `INSERT INTO Transactions (user_id, auction_id, amount, type, status)
           VALUES (?, ?, ?, 'WIN_PAYMENT', 'PENDING')`,
          [highestBidder, auctionId, finalPrice],
        );
        console.log(
          `[Worker] NGƯỜI CHIẾN THẮNG: User ID ${highestBidder} với mức giá $${finalPrice}! State -> Payment Pending.`,
        );
      } else {
        console.log(`[Worker] Phiên đấu giá kết thúc không có ai trả giá. State -> Ended.`);
      }

      await dbConnection.commit();

      // 7. Đồng bộ trạng thái cuối cùng lên Redis để Frontend cập nhật UI
      await redisClient.hSet(auctionKey, "status", finalStatus);

      // TODO: Gọi AutoBidService.releaseAutoBid() cho tất cả user thua (Dành cho tính năng AI/Auto-bid sau này)

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

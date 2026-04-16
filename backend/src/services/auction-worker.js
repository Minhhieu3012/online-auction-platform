const redisKeys = require("../utils/redis-keys");
const { Worker, Queue } = require("bullmq");
const { connection } = require("../config/queue");
const redisClient = require("../config/redis");
const pool = require("../config/db");

// Hàng đợi để Worker tự đặt báo thức
const auctionQueue = new Queue("auction-lifecycle", { connection });

// Thời gian khóa (30 giây)
const LOCK_TTL = 30000;

// ==========================================
// HÀM TIỆN ÍCH (Khóa & Cập nhật nguyên tử)
// ==========================================

async function acquireLock(redis, lockKey) {
  return await redis.set(lockKey, "1", {
    NX: true,
    PX: LOCK_TTL,
  });
}

async function safeSetClosing(redis, auctionKey) {
  // Script Lua đảm bảo chỉ khóa trạng thái khi đang là Active
  const lua = `
    if redis.call("HGET", KEYS[1], "status") == "Active" then
      redis.call("HSET", KEYS[1], "status", "Closing")
      return 1
    end
    return 0
  `;
  return await redis.eval(lua, {
    keys: [auctionKey],
  });
}

// ==========================================
// LOGIC WORKER ĐÓNG PHIÊN ĐẤU GIÁ
// ==========================================

const auctionWorker = new Worker(
  "auction-lifecycle",
  async (job) => {
    const { auctionId } = job.data;
    const auctionKey = redisKeys.auctionInfo(auctionId);
    const lockKey = redisKeys.auctionLock(auctionId);

    console.log(`\n[Worker] Bắt đầu tiến trình đóng phiên đấu giá ID: ${auctionId}...`);

    // 1. Chốt khóa phân tán (Distributed Lock)
    // Ngăn chặn BullMQ chạy trùng lặp Job gây Deadlock
    const lock = await acquireLock(redisClient, lockKey);
    if (!lock) {
      console.log(`[Worker] Bỏ qua: Phiên ${auctionId} đang được một tiến trình khác xử lý.`);
      return;
    }

    const dbConnection = await pool.getConnection();

    try {
      // 2. Lấy dữ liệu từ Redis
      let auctionData = await redisClient.hGetAll(auctionKey);

      // [Dự phòng an toàn]: Nếu Redis rỗng/chết, lấy dữ liệu từ MySQL
      if (!auctionData || Object.keys(auctionData).length === 0) {
        console.log(`[Worker] Redis rỗng, dùng dữ liệu dự phòng từ MySQL cho phiên ${auctionId}`);

        const [rows] = await dbConnection.execute(
          `SELECT a.id, a.status, a.current_price, a.end_time, 
            (SELECT user_id FROM Bids WHERE auction_id = a.id ORDER BY bid_amount DESC LIMIT 1) as highest_bidder
           FROM Auctions a WHERE a.id = ?`,
          [auctionId],
        );

        if (!rows.length) return; // Phiên không tồn tại

        auctionData = {
          status: rows[0].status,
          current_price: rows[0].current_price,
          end_time: rows[0].end_time,
          highest_bidder: rows[0].highest_bidder, // Fix: Bổ sung người thắng cuộc
        };
      }

      // 3. Kiểm tra gia hạn giờ chót (Smart Worker)
      const nowMs = Date.now();
      const latestEndTimeMs = Date.parse(auctionData.end_time);

      if (latestEndTimeMs > nowMs) {
        const delay = latestEndTimeMs - nowMs;
        console.log(`[Worker Ngủ Tiếp] Phiên ${auctionId} đã được gia hạn. Hẹn giờ quay lại sau ${delay}ms`);

        // Đẩy 1 Job mới vào Queue với độ trễ tương ứng
        await auctionQueue.add(
          "close-auction",
          { auctionId },
          {
            delay,
            jobId: `close-auction-${auctionId}`, // Chống trùng lặp Job ID
            removeOnComplete: true,
            removeOnFail: true,
          },
        );
        return; // Thoát hàm để ngủ
      }

      // 4. Khóa trạng thái Redis nguyên tử (Từ chối Bid mới)
      const canClose = await safeSetClosing(redisClient, auctionKey);
      if (!canClose) {
        console.log(`[Worker] Bỏ qua: Phiên ${auctionId} đã kết thúc hoặc đang chốt đơn.`);
        return;
      }

      const highestBidder = auctionData.highest_bidder;
      const finalPrice = parseFloat(auctionData.current_price);

      // Xác định trạng thái cuối
      let finalStatus = "Ended";
      if (highestBidder && highestBidder !== "") {
        finalStatus = "Payment Pending";
      }

      // 5. Bắt đầu Transaction ghi nhận MySQL
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

      // 6. Ghi nhận giao dịch (Idempotent - Chống tạo trùng)
      if (finalStatus === "Payment Pending") {
        await dbConnection.execute(
          `INSERT INTO Transactions (user_id, auction_id, amount, type, status)
           VALUES (?, ?, ?, 'WIN_PAYMENT', 'PENDING')
           ON DUPLICATE KEY UPDATE amount = VALUES(amount)`,
          [highestBidder, auctionId, finalPrice],
        );

        console.log(`[Worker] NGƯỜI CHIẾN THẮNG: User ID ${highestBidder} với mức giá $${finalPrice}!`);
      } else {
        console.log(`[Worker] Phiên đấu giá kết thúc không có ai trả giá.`);
      }

      await dbConnection.commit();

      // 7. Đồng bộ trạng thái cuối cùng lên Redis và dọn dẹp
      await redisClient.hSet(auctionKey, "status", finalStatus);
      await redisClient.expire(auctionKey, 3600); // Tự xóa data Redis sau 1 tiếng để nhẹ RAM

      console.log(`[Worker] Chốt đơn phiên ${auctionId} hoàn tất!`);
    } catch (err) {
      await dbConnection.rollback();
      console.error(`[Worker Error] Lỗi khi xử lý phiên ${auctionId}:`, err);
      throw err;
    } finally {
      dbConnection.release();
      await redisClient.del(lockKey); // Giải phóng Lock cho phiên tiếp theo
    }
  },
  { connection },
);

// Bắt sự kiện Log cho BullMQ
auctionWorker.on("completed", (job) => {
  console.log(`[BullMQ] Nhiệm vụ ${job.id} đã hoàn tất.`);
});

auctionWorker.on("failed", (job, err) => {
  console.log(`[BullMQ] Nhiệm vụ ${job.id} thất bại:`, err.message);
});

module.exports = auctionWorker;

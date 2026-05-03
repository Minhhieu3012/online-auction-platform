const logger = require("../utils/logger");
const { kafka } = require("../config/kafka");
const pool = require("../config/db");

const consumer = kafka.consumer({ groupId: "bidding-group" });

// Nhận thêm tham số 'io' từ file chạy server (app.js hoặc server.js) để gọi Socket
const startKafkaConsumer = async (io = null) => {
  try {
    await consumer.connect();
    logger.success("[Kafka Consumer] Đã khởi động và sẵn sàng nhận việc!");

    // Subscribe cùng lúc 3 topics (1 của Node.js, 2 của AI)
    await consumer.subscribe({ 
      topics: ["auction-bids", "fraud_alerts", "auction_extensions"], 
      fromBeginning: false 
    });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const payload = JSON.parse(message.value.toString());

          // ==========================================
          // 1. LẮNG NGHE LỆNH KHÓA TÀI KHOẢN TỪ AI
          // ==========================================
          if (topic === "fraud_alerts") {
            logger.warn(`[AI WARNING] Khóa tài khoản ${payload.user_id} - Điểm: ${payload.lss_score}`);
            // TODO: Bổ sung logic khóa user trong DB ở đây nếu cần
            if (io) {
              io.emit('fraud_detected', payload); // Bắn Socket lên cho Frontend
            }
            return;
          }

          // ==========================================
          // 2. LẮNG NGHE LỆNH GIA HẠN THỜI GIAN TỪ AI
          // ==========================================
          if (topic === "auction_extensions") {
            logger.info(`[AI SYSTEM] Gia hạn phiên ${payload.auction_id} thêm ${payload.extend_by || 30}s`);
            if (io) {
              io.emit('auction_extended', payload); // Bắn Socket lên cho Frontend
            }
            return;
          }

          // ==========================================
          // 3. ĐỒNG BỘ BID VÀO DATABASE (CŨ)
          // ==========================================
          if (topic === "auction-bids") {
            // Lấy data theo chuẩn mới khớp với Pydantic (auction_id, user_id, price)
            const auctionId = payload.auction_id || payload.auctionId;
            const userId = payload.user_id || payload.userId;
            const bidAmount = payload.price || payload.bidAmount;
            const version = payload.version;
            const newEndTime = payload.newEndTime;

            const connection = await pool.getConnection();
            try {
              await connection.beginTransaction();

              // 1. Ghi lịch sử Bid
              await connection.execute("INSERT INTO Bids (auction_id, user_id, bid_amount) VALUES (?, ?, ?)", [
                auctionId,
                userId,
                bidAmount,
              ]);

              // 2. UPDATE với Optimistic Locking
              let sql = `UPDATE Auctions SET current_price = ?, version = ?`;
              let params = [bidAmount, version];

              if (newEndTime) {
                const mysqlDatetime = new Date(newEndTime).toISOString().slice(0, 19).replace("T", " ");
                sql += `, end_time = ?`;
                params.push(mysqlDatetime);
              }

              // Chỉ update nếu version trong DB nhỏ hơn version mới
              sql += ` WHERE id = ? AND version < ?`;
              params.push(auctionId, version);

              const [updateResult] = await connection.execute(sql, params);

              if (updateResult.affectedRows === 0) {
                logger.info(`[Kafka Consumer] Bỏ qua Bid $${bidAmount} (Version ${version}) vì DB đã có giá mới hơn.`);
              } else {
                logger.info(`[Kafka Consumer] Đã đồng bộ Bid $${bidAmount} (Version ${version}) xuống DB.`);
              }

              await connection.commit();
            } catch (error) {
              await connection.rollback();
              logger.error(`[Kafka Consumer DB Error] Lỗi đồng bộ Bid $${bidAmount}:`, error.message);
            } finally {
              connection.release();
            }
          }
        } catch (parseError) {
          logger.error("[Kafka Message Parse Error]:", parseError.message);
        }
      },
    });
  } catch (error) {
    logger.error("[Kafka Consumer Error]:", error.message);
  }
};

const stopKafkaConsumer = async () => {
  try {
    await consumer.disconnect();
    logger.info("[Kafka Consumer] Đã ngắt kết nối an toàn.");
  } catch (error) {
    logger.error("[Kafka Consumer Disconnect Error]:", error.message);
  }
};

module.exports = { startKafkaConsumer, stopKafkaConsumer };
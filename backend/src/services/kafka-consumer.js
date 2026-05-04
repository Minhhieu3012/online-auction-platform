const logger = require("../utils/logger");
const { kafka } = require("../config/kafka");
const pool = require("../config/db");

const consumer = kafka.consumer({ groupId: "bidding-group" });

// Nhận tham số 'io' từ file chạy server (server.js) để gọi Socket.io
const startKafkaConsumer = async (io = null) => {
  try {
    await consumer.connect();
    logger.success("[Kafka Consumer] Đã khởi động và sẵn sàng nhận việc!");

    // Subscribe 4 topics: 1 của Node.js (bids), 1 của Worker (winner) và 2 của AI (fraud, extension)
    await consumer.subscribe({
      topics: [
        "auction-bids",
        "fraud_alerts",
        "auction_extensions",
        "winner-notifications", // Thêm Topic của Priority 2
      ],
      fromBeginning: false,
    });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const payload = JSON.parse(message.value.toString());

          // ==========================================
          // 1. LẮNG NGHE CẢNH BÁO GIAN LẬN TỪ AI
          // ==========================================
          if (topic === "fraud_alerts") {
            logger.warn(`[AI WARNING] Cảnh báo tài khoản ${payload.user_id} - Điểm rủi ro: ${payload.lss_score}`);
            if (io) {
              io.emit("fraud_detected", payload);
            }
            return;
          }

          // ==========================================
          // 2. LẮNG NGHE LỆNH GIA HẠN THỜI GIAN TỪ AI
          // ==========================================
          if (topic === "auction_extensions") {
            logger.info(`[AI SYSTEM] Gia hạn phiên ${payload.auction_id} thêm ${payload.extend_by || 30}s`);
            if (io) {
              io.emit("auction_extended", payload);
            }
            return;
          }

          // ==========================================
          // 3. THÔNG BÁO NGƯỜI CHIẾN THẮNG & LINK THANH TOÁN
          // ==========================================
          if (topic === "winner-notifications") {
            logger.info(
              `[Socket.io] Chuẩn bị gửi Link thanh toán cho User ${payload.userId} (Phiên ${payload.auctionId})`,
            );
            if (io) {
              // Bắn event kèm paymentUrl để Frontend hiển thị nút thanh toán
              io.emit("auction_winner", payload);
            }
            return;
          }

          // ==========================================
          // 4. XỬ LÝ ĐẶT GIÁ & ĐỒNG BỘ XUỐNG DATABASE
          // ==========================================
          if (topic === "auction-bids") {
            // Chuẩn hóa dữ liệu tương thích cả Backend và AI (Pydantic)
            const auctionId = payload.auction_id || payload.auctionId;
            const userId = payload.user_id || payload.userId;
            const bidAmount = payload.price || payload.bidAmount;
            const version = payload.version;
            const newEndTime = payload.newEndTime;

            // 👉 PHÁT SÓNG REAL-TIME CHO FRONTEND (PRIORITY 3)
            // Phát sóng ngay lập tức để UI cập nhật không độ trễ, việc ghi DB sẽ chạy âm thầm ngay sau đó
            if (io) {
              io.emit("new_bid", {
                auctionId: auctionId,
                bidAmount: bidAmount,
                bidder: userId, // Tạm dùng userId, Frontend có thể call API lấy tên sau nếu cần
                newEndTime: newEndTime,
              });
            }

            const connection = await pool.getConnection();
            try {
              await connection.beginTransaction();

              // 4.1 Ghi lịch sử Bid vào bảng Bids
              await connection.execute("INSERT INTO Bids (auction_id, user_id, bid_amount) VALUES (?, ?, ?)", [
                auctionId,
                userId,
                bidAmount,
              ]);

              // 4.2 Cập nhật bảng Auctions với Optimistic Locking
              let sql = `UPDATE Auctions SET current_price = ?, version = ?`;
              let params = [bidAmount, version];

              if (newEndTime) {
                // Format lại datetime chuẩn MySQL (YYYY-MM-DD HH:MM:SS)
                const mysqlDatetime = new Date(newEndTime).toISOString().slice(0, 19).replace("T", " ");
                sql += `, end_time = ?`;
                params.push(mysqlDatetime);
              }

              // Ràng buộc bảo vệ: Chỉ update nếu version trong DB nhỏ hơn version truyền vào
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

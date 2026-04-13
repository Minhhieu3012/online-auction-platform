const { kafka } = require("../config/kafka");
const pool = require("../config/db");

const consumer = kafka.consumer({ groupId: "bidding-group" });

const startKafkaConsumer = async () => {
  try {
    await consumer.connect();
    console.log("[Kafka Consumer] Đã khởi động và sẵn sàng nhận việc!");

    await consumer.subscribe({ topic: "auction-bids", fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ message }) => {
        const payload = JSON.parse(message.value.toString());
        const { auctionId, userId, bidAmount, version, newEndTime } = payload;

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
            console.log(`[Kafka Consumer] Bỏ qua Bid $${bidAmount} (Version ${version}) vì DB đã có giá mới hơn.`);
          } else {
            console.log(`[Kafka Consumer] Đã đồng bộ Bid $${bidAmount} (Version ${version}) xuống DB.`);
          }

          await connection.commit();
        } catch (error) {
          await connection.rollback();
          console.error(`[Kafka Consumer Error] Lỗi đồng bộ Bid $${bidAmount}:`, error.message);
        } finally {
          connection.release();
        }
      },
    });
  } catch (error) {
    console.error("[Kafka Consumer Error]:", error.message);
  }
};

const stopKafkaConsumer = async () => {
  try {
    await consumer.disconnect();
    console.log("[Kafka Consumer] Đã ngắt kết nối an toàn.");
  } catch (error) {
    console.error("[Kafka Consumer Disconnect Error]:", error.message);
  }
};

module.exports = { startKafkaConsumer, stopKafkaConsumer };

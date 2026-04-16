require("dotenv").config();
require("./config/db");
require("./config/redis");
require("./config/queue");
require("./services/auction-worker");

const { connectProducer, disconnectProducer } = require("./config/kafka");
const { startKafkaConsumer, stopKafkaConsumer } = require("./services/kafka-consumer");
const logger = require("./utils/logger");

const app = require("./app");

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, async () => {
  logger.info(`[Core Engine] Server is running on http://localhost:${PORT}`);
  logger.info(`[Health Check] http://localhost:${PORT}/api/health`);

  await connectProducer();

  await startKafkaConsumer();
});

// ==========================================
// GRACEFUL SHUTDOWN (Tắt hệ thống an toàn)
// ==========================================
const shutdown = async () => {
  logger.info("\n[Core Engine] Đang nhận lệnh tắt hệ thống, tiến hành đóng các kết nối...");

  await stopKafkaConsumer();

  // Ngắt kết nối Kafka Producer
  await disconnectProducer();

  // Cầu chì an toàn: Ép tắt sau 3 giây nếu có kết nối bị kẹt
  setTimeout(() => {
    logger.info("[Core Engine] Đã ép tắt hệ thống do quá thời gian chờ đóng kết nối.");
    process.exit(0);
  }, 3000);

  // Từ chối các request HTTP mới
  server.close(() => {
    logger.info("[Core Engine] Đã đóng HTTP Server. Tắt tiến trình an toàn.");
    process.exit(0);
  });
};

// Bắt tín hiệu khi bạn bấm Ctrl+C
process.on("SIGINT", shutdown);
// Bắt tín hiệu khi Docker/PM2 muốn tắt container
process.on("SIGTERM", shutdown);

// ==========================================
// ERROR HANDLING (Xử lý lỗi hệ thống)
// ==========================================
process.on("uncaughtException", (err) => {
  console.error("[FATAL] Uncaught Exception:", err.message);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] Unhandled Rejection:", reason);
  process.exit(1);
});

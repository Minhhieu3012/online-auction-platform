// 1. Cấu hình biến môi trường ngay lập tức (Ưu tiên hàng đầu)
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
require("dotenv").config();

// 2. Import các cấu hình nền tảng
require("./config/db");
require("./config/redis");
require("./config/queue");

// SỬA LỖI Ở ĐÂY: Trỏ đúng vào file Worker xịn (Chứa logic Stripe Webhook)
require("./workers/auctionWorker");

// 4. Import các dịch vụ truyền tải và thông báo
const { connectProducer, disconnectProducer } = require("./config/kafka");
const { startKafkaConsumer, stopKafkaConsumer } = require("./services/kafka-consumer");
const logger = require("./utils/logger");

const app = require("./app");
const http = require("http");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 3000;

// 5. Tạo HTTP server từ Express app để gắn Socket.io
const server = http.createServer(app);

// 6. Khởi tạo Socket.io server
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  logger.info(`[Socket.io] Có client kết nối thành công: ${socket.id}`);
  socket.on("disconnect", () => {
    logger.info(`[Socket.io] Client ngắt kết nối: ${socket.id}`);
  });
});

// 7. Khởi động hệ thống
server.listen(PORT, async () => {
  logger.info(`[Core Engine] Server is running on http://localhost:${PORT}`);
  logger.info(`[Health Check] http://localhost:${PORT}/api/health`);

  try {
    await connectProducer();
    await startKafkaConsumer(io); // Gắn Socket vào Kafka Consumer
    logger.success("[Core Engine] Toàn bộ hệ thống (Kafka, BullMQ, Socket.io) đã sẵn sàng!");
  } catch (error) {
    logger.error(`[Core Engine] Lỗi khi khởi động dịch vụ: ${error.message}`);
  }
});

// ==========================================
// GRACEFUL SHUTDOWN (Tắt hệ thống an toàn)
// ==========================================
const shutdown = async () => {
  logger.info("\n[Core Engine] Đang nhận lệnh tắt hệ thống, tiến hành đóng các kết nối...");
  try {
    await stopKafkaConsumer();
    await disconnectProducer();

    setTimeout(() => {
      logger.info("[Core Engine] Đã ép tắt hệ thống do quá thời gian chờ đóng kết nối.");
      process.exit(0);
    }, 3000);

    server.close(() => {
      logger.info("[Core Engine] Đã đóng HTTP Server. Tắt tiến trình an toàn.");
      process.exit(0);
    });
  } catch (error) {
    logger.error(`[Core Engine] Lỗi khi đang tắt hệ thống: ${error.message}`);
    process.exit(1);
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

process.on("uncaughtException", (err) => {
  console.error("[FATAL] Uncaught Exception:", err.message);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] Unhandled Rejection:", reason);
  process.exit(1);
});

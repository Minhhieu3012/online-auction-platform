// 1. Cấu hình biến môi trường ngay lập tức (Ưu tiên hàng đầu)
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
require("dotenv").config();

// 2. Import các cấu hình nền tảng
require("./config/db");
require("./config/redis");
require("./config/queue");

// 3. Kích hoạt Worker của BullMQ để bắt đầu lắng nghe các sự kiện hết giờ đấu giá
// File này sẽ chạy ngầm để xử lý chốt đơn khi đến giờ
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
    origin: "*", // Cho phép Frontend kết nối từ mọi cổng
    methods: ["GET", "POST"]
  }
});

// Lắng nghe các sự kiện kết nối từ Frontend (Real-time updates)
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
    // Kết nối Kafka để sẵn sàng bắn tin nhắn (Event-driven)
    await connectProducer();

    // Truyền 'io' vào Consumer để có thể phát sóng (emit) dữ liệu xuống Web qua Socket.io
    await startKafkaConsumer(io);
    
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
    
    // Cầu chì an toàn: Ép tắt sau 3 giây nếu có kết nối bị kẹt
    setTimeout(() => {
      logger.info("[Core Engine] Đã ép tắt hệ thống do quá thời gian chờ đóng kết nối.");
      process.exit(0);
    }, 3000);

    // Từ chối các request HTTP mới và ngắt Socket.io
    server.close(() => {
      logger.info("[Core Engine] Đã đóng HTTP Server. Tắt tiến trình an toàn.");
      process.exit(0);
    });
  } catch (error) {
    logger.error(`[Core Engine] Lỗi khi đang tắt hệ thống: ${error.message}`);
    process.exit(1);
  }
};

// Bắt tín hiệu khi bạn bấm Ctrl+C hoặc từ Docker/PM2
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// ==========================================
// ERROR HANDLING (Xử lý lỗi hệ thống chưa được bắt)
// ==========================================
process.on("uncaughtException", (err) => {
  console.error("[FATAL] Uncaught Exception:", err.message);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] Unhandled Rejection:", reason);
  process.exit(1);
});
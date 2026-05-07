// 1. Cấu hình biến môi trường ngay lập tức
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
require("dotenv").config();

// 2. Import các cấu hình nền tảng
require("./config/db");
require("./config/redis");
require("./config/queue");
require("./workers/auctionWorker");

const { connectProducer, disconnectProducer } = require("./config/kafka");
const { startKafkaConsumer, stopKafkaConsumer } = require("./services/kafka-consumer");
const logger = require("./utils/logger");

const app = require("./app");
const http = require("http");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      callback(null, true);
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Cho controller có thể broadcast sau khi DB commit.
app.set("io", io);

function normalizeAuctionRoom(auctionId) {
  const id = Number(auctionId);
  if (!Number.isInteger(id) || id <= 0) return null;
  return String(id);
}

io.on("connection", (socket) => {
  logger.info(`[Socket.io] Có client kết nối thành công: ${socket.id}`);

  const initialRoom = normalizeAuctionRoom(socket.handshake.query?.auctionId);
  if (initialRoom) {
    socket.join(initialRoom);
    logger.info(`[Socket.io] Client ${socket.id} đã vào room auction ${initialRoom}`);
  }

  socket.on("join_auction", (payload = {}) => {
    const room = normalizeAuctionRoom(payload.auctionId || payload.auction_id || payload.room);
    if (!room) return;
    socket.join(room);
    logger.info(`[Socket.io] Client ${socket.id} join auction room ${room}`);
  });

  socket.on("leave_auction", (payload = {}) => {
    const room = normalizeAuctionRoom(payload.auctionId || payload.auction_id || payload.room);
    if (!room) return;
    socket.leave(room);
    logger.info(`[Socket.io] Client ${socket.id} leave auction room ${room}`);
  });

  socket.on("disconnect", () => {
    logger.info(`[Socket.io] Client ngắt kết nối: ${socket.id}`);
  });
});

server.listen(PORT, async () => {
  logger.info(`[Core Engine] Server is running on http://localhost:${PORT}`);
  logger.info(`[Health Check] http://localhost:${PORT}/api/health`);

  try {
    await connectProducer();
    await startKafkaConsumer(io);
    logger.success("[Core Engine] Toàn bộ hệ thống (Kafka, BullMQ, Socket.io) đã sẵn sàng!");
  } catch (error) {
    logger.error(`[Core Engine] Lỗi khi khởi động dịch vụ: ${error.message}`);
  }
});

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

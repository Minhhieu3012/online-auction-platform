const pool = require("../config/db");
const redisClient = require("../config/redis");
const redisKeys = require("../utils/redis-keys");
const { scheduleAuctionClose } = require("../config/queue");
const { sendSuccess, sendError } = require("../utils/response");
const logger = require("../utils/logger");

class AuctionController {
  /**
   * Tạo phiên đấu giá: Kết hợp logic Transaction MySQL và nạp dữ liệu vào Redis/BullMQ
   */
  static async createAuction(req, res) {
    // 1. Trích xuất dữ liệu từ Request Body
    const { productName, description, startingPrice, stepPrice, durationMinutes } = req.body;
    const userId = req.user.id; // Lấy từ JWT Auth Middleware

    // Kiểm tra dữ liệu đầu vào cơ bản
    if (!productName || !startingPrice || !stepPrice || !durationMinutes) {
      return sendError(res, "ERR_MISSING_DATA", "Vui lòng nhập đủ thông tin sản phẩm và giá.", 400);
    }

    const connection = await pool.getConnection();
    let auctionId, productId, endTime;

    // ==========================================
    // KHỐI 1: GIAO DỊCH MYSQL (BẢO ĐẢM DỮ LIỆU GỐC)
    // ==========================================
    try {
      await connection.beginTransaction();

      // Bước A: Tạo Sản phẩm trước để lấy product_id
      const [prodResult] = await connection.execute(
        "INSERT INTO Products (name, description) VALUES (?, ?)",
        [productName, description || ""]
      );
      productId = prodResult.insertId;

      // Bước B: Tính toán mốc thời gian kết thúc (datetime)
      endTime = new Date(Date.now() + durationMinutes * 60000);
      // Định dạng datetime chuẩn MySQL: YYYY-MM-DD HH:MM:SS
      const mysqlEndTime = endTime.toISOString().slice(0, 19).replace("T", " ");

      // Bước C: Tạo Phiên đấu giá trong bảng Auctions
      // Sử dụng chính xác các cột: product_id, created_by, status, current_price, step_price, end_time, version
      const [aucResult] = await connection.execute(
        `INSERT INTO Auctions (product_id, created_by, status, current_price, step_price, end_time, version)
         VALUES (?, ?, 'Active', ?, ?, ?, 0)`,
        [productId, userId, startingPrice, stepPrice, mysqlEndTime]
      );
      auctionId = aucResult.insertId;

      // Xác nhận lưu dữ liệu thành công vào MySQL
      await connection.commit();
      logger.info(`[DB Success] Đã chốt lưu phiên đấu giá ${auctionId} vào MySQL.`);

    } catch (error) {
      // Nếu có bất kỳ lỗi nào, hủy bỏ toàn bộ dữ liệu đã chèn để tránh rác DB
      if (connection) await connection.rollback();
      logger.error(`[MySQL Transaction Error]: ${error.message}`);
      return sendError(res, "ERR_SERVER", "Lỗi hệ thống khi lưu phiên đấu giá.", 500);
    } finally {
      // Giải phóng kết nối ngay lập tức để tối ưu tài nguyên hệ thống
      connection.release();
    }

    // ==========================================
    // KHỐI 2: TÁC VỤ NỀN (REDIS CACHE & BULLMQ QUEUE)
    // ==========================================
    try {
      // Bước D: Nạp dữ liệu vào Redis để phục vụ việc Bid tốc độ cao (Real-time)
      const auctionKey = redisKeys.auctionInfo(auctionId); // Trả về 'auction:ID:info'
      await redisClient.hSet(auctionKey, {
        current_price: startingPrice.toString(),
        step_price: stepPrice.toString(),
        status: "Active",
        version: "0",
        highest_bidder: "",
        end_time: endTime.getTime().toString(),
        extension_count: "0",
      });

      // Bước E: Hẹn giờ đóng phiên bằng BullMQ
      // Hàm scheduleAuctionClose sẽ tự động tính toán delay từ endTime
      await scheduleAuctionClose(auctionId, endTime);

      logger.success(`[System Sync] Phiên ${auctionId} đã sẵn sàng trên Redis và BullMQ.`);
    } catch (error) {
      // Lưu ý: Chúng ta không trả về lỗi cho Client ở đây vì MySQL đã lưu thành công.
      // Thay vào đó, log lỗi để bộ phận kỹ thuật xử lý bù (Retry logic).
      logger.error(`[Background Task Error] Phiên ${auctionId} lỗi đồng bộ: ${error.message}`);
    }

    // ==========================================
    // TRẢ VỀ KẾT QUẢ THÀNH CÔNG
    // ==========================================
    return sendSuccess(
      res,
      {
        auctionId,
        productId,
        endTime,
      },
      "Tạo phiên đấu giá và khởi động bộ đếm giờ thành công!",
      201
    );
  }
}

module.exports = AuctionController;
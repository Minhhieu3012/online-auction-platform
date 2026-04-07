const pool = require("../config/db");
const redisClient = require("../config/redis");
const { scheduleAuctionClose } = require("../config/queue");
const { sendSuccess, sendError } = require("../utils/response");

class AuctionController {
  static async createAuction(req, res) {
    const { productName, description, startingPrice, stepPrice, durationMinutes } = req.body;
    const userId = req.user.id; // Lấy từ JWT

    if (!productName || !startingPrice || !stepPrice || !durationMinutes) {
      return sendError(res, "ERR_MISSING_DATA", "Vui lòng nhập đủ thông tin.", 400);
    }

    const connection = await pool.getConnection();
    let auctionId, productId, endTime;

    // ==========================================
    // BLOCK 1: LƯU TRỮ CHÍNH (MySQL - Phải an toàn 100%)
    // ==========================================
    try {
      await connection.beginTransaction();

      // 1. Tạo Sản phẩm
      const [prodResult] = await connection.execute("INSERT INTO Products (name, description) VALUES (?, ?)", [
        productName,
        description || "",
      ]);
      productId = prodResult.insertId;

      endTime = new Date(Date.now() + durationMinutes * 60000);
      const mysqlEndTime = endTime.toISOString().slice(0, 19).replace("T", " ");

      // 2. Tạo Phiên đấu giá (Đã thêm created_by theo chuẩn của bạn)
      const [aucResult] = await connection.execute(
        `INSERT INTO Auctions (product_id, created_by, status, current_price, step_price, end_time, version)
         VALUES (?, ?, 'Active', ?, ?, ?, 0)`,
        [productId, userId, startingPrice, stepPrice, mysqlEndTime],
      );
      auctionId = aucResult.insertId;

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      console.error("[DB Error]:", error);
      return sendError(res, "ERR_SERVER", "Lỗi hệ thống khi lưu phiên đấu giá.", 500);
    } finally {
      // Giải phóng DB ngay lập tức, không bắt nó chờ Redis/BullMQ
      connection.release();
    }

    // ==========================================
    // BLOCK 2: TÁC VỤ NỀN (Redis & BullMQ - Best Effort)
    // ==========================================
    try {
      const auctionKey = `auction:${auctionId}:info`;
      await redisClient.hSet(auctionKey, {
        current_price: startingPrice.toString(),
        step_price: stepPrice.toString(),
        status: "Active",
        version: "0",
        highest_bidder: "",
        end_time: endTime.getTime().toString(),
        extension_count: "0",
      });

      await scheduleAuctionClose(auctionId, endTime);
    } catch (error) {
      // Chỉ log lỗi để đội Dev biết, KHÔNG crash API vì DB đã an toàn
      console.error(`[Background Error] Phiên ${auctionId} rớt Cache/Queue:`, error);
      // Thực tế: Cần có 1 job phụ quét các phiên thiếu Queue để bù đắp sau.
    }

    // ==========================================
    // TRẢ KẾT QUẢ CHO USER
    // ==========================================
    return sendSuccess(
      res,
      {
        auctionId,
        productId,
        endTime,
      },
      "Tạo phiên đấu giá thành công!",
      201,
    );
  }
}

module.exports = AuctionController;

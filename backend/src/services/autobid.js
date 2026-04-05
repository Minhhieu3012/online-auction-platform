// src/services/autobid.service.js
const pool = require("../config/db");
const redisClient = require("../config/redis");
const { BIDDING } = require("../constants/business.constant");

class AutoBidService {
  static async setupAutoBid(auctionId, userId, maxAmount) {
    const proxyKey = `auction:${auctionId}:proxy`;

    // 1. Kiểm tra tồn tại (Chống trừ tiền 2 lần)
    const existingProxy = await redisClient.hGet(proxyKey, userId.toString());
    if (existingProxy) {
      throw new Error("ERR_AUTOBID_ALREADY_SET");
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [users] = await connection.execute("SELECT balance FROM Users WHERE id = ? FOR UPDATE", [userId]);

      if (users.length === 0) throw new Error("ERR_USER_NOT_FOUND");
      if (parseFloat(users[0].balance) < maxAmount) throw new Error("ERR_INSUFFICIENT_BALANCE");

      await connection.execute("UPDATE Users SET balance = balance - ? WHERE id = ?", [maxAmount, userId]);

      // Lưu vào Redis và thiết lập TTL (24 giờ) tránh rác bộ nhớ
      await redisClient.hSet(proxyKey, userId.toString(), maxAmount.toString());
      await redisClient.expire(proxyKey, 86400);

      await connection.commit();
      console.log(`[Auto-Bid Hold] Đã đóng băng $${maxAmount} của User ${userId} cho phiên ${auctionId}`);

      return { success: true, message: "Thiết lập Auto-bid thành công." };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Hoàn tiền Auto-bid khi phiên kết thúc
   */
  static async releaseAutoBid(auctionId, userId, finalPrice) {
    const connection = await pool.getConnection();
    const proxyKey = `auction:${auctionId}:proxy`;

    try {
      await connection.beginTransaction();

      // Lấy số tiền đã đóng băng
      const heldAmount = await redisClient.hGet(proxyKey, userId.toString());
      if (!heldAmount) {
        throw new Error("ERR_NO_AUTOBID_FOUND");
      }

      // Hoàn trả phần chênh lệch
      const refundAmount = Math.max(0, parseFloat(heldAmount) - finalPrice);

      if (refundAmount > 0) {
        await connection.execute("UPDATE Users SET balance = balance + ? WHERE id = ?", [refundAmount, userId]);
      }

      // Xóa key Redis (Cleanup)
      await redisClient.hDel(proxyKey, userId.toString());

      await connection.commit();
      console.log(`[Auto-Bid Release] Đã hoàn trả $${refundAmount} cho User ${userId}`);

      return { success: true, refundAmount };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = AutoBidService;

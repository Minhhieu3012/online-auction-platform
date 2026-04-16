const redisKeys = require("../utils/redis-keys");
const pool = require("../config/db");
const redisClient = require("../config/redis");

class AutoBidService {
  /**
   * 1. THIẾT LẬP AUTO-BID (Đóng băng tiền + Lưu cấu hình)
   */
  static async setupAutoBid(auctionId, userId, maxAmount) {
    const proxyKey = `auction:${auctionId}:proxy`;

    const existingProxy = await redisClient.hGet(proxyKey, userId.toString());
    const oldAmount = existingProxy ? parseFloat(existingProxy) : 0;
    const amountDifference = maxAmount - oldAmount;

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Lock row User để trừ tiền an toàn
      const [users] = await connection.execute("SELECT balance FROM Users WHERE id = ? FOR UPDATE", [userId]);
      if (users.length === 0) throw new Error("ERR_USER_NOT_FOUND");

      if (amountDifference > 0) {
        // Nâng hạn mức -> Cần đóng băng thêm tiền
        if (parseFloat(users[0].balance) < amountDifference) throw new Error("ERR_INSUFFICIENT_BALANCE");
        await connection.execute("UPDATE Users SET balance = balance - ? WHERE id = ?", [amountDifference, userId]);
      } else if (amountDifference < 0) {
        // Hạ hạn mức -> Trả lại tiền thừa ngay lập tức
        const refundAmount = Math.abs(amountDifference);
        await connection.execute("UPDATE Users SET balance = balance + ? WHERE id = ?", [refundAmount, userId]);
      }

      // Lưu vào MySQL (Cập nhật đè nếu đã tồn tại)
      await connection.execute(
        `INSERT INTO AutoBids (auction_id, user_id, max_price, is_active) VALUES (?, ?, ?, TRUE)
         ON DUPLICATE KEY UPDATE max_price = ?, is_active = TRUE`,
        [auctionId, userId, maxAmount, maxAmount],
      );

      // Lưu vào Redis để Trigger đọc cực nhanh
      await redisClient.hSet(proxyKey, userId.toString(), maxAmount.toString());
      await redisClient.expire(proxyKey, 86400); // 24h TTL

      await connection.commit();

      // Trả về message tương ứng cho Controller
      if (oldAmount === 0) {
        console.log(`[Auto-Bid Hold] Đã đóng băng $${maxAmount} của User ${userId} cho phiên ${auctionId}`);
        return { success: true, message: "Đã thiết lập Auto-bid thành công." };
      } else {
        console.log(
          `[Auto-Bid Update] User ${userId} cập nhật Auto-bid lên $${maxAmount} (Chênh lệch: $${amountDifference})`,
        );
        return { success: true, message: "Đã cập nhật mức giá Auto-bid mới." };
      }
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 2. KÍCH HOẠT AUTO-BID (Bot tự động trả giá)
   * Hàm này được gọi bởi BiddingService SAU KHI có người khác đặt giá
   */
  static async triggerAutoBids(auctionId, currentPrice, currentBidderId) {
    const proxyKey = redisKeys.auctionProxy(auctionId);
    const auctionKey = redisKeys.auctionInfo(auctionId);

    // Lấy stepPrice từ Redis cho chắc chắn, không tin tham số truyền vào
    const auctionInfo = await redisClient.hGetAll(auctionKey);
    if (!auctionInfo || !auctionInfo.step_price) return;
    const stepPrice = parseFloat(auctionInfo.step_price);

    // Lấy toàn bộ danh sách cài auto-bid của phiên này từ Redis
    const proxies = await redisClient.hGetAll(proxyKey);
    if (Object.keys(proxies).length === 0) return;

    let bestCandidate = null;
    let highestMaxPrice = 0;

    // Tìm người có max_price cao nhất (bỏ qua người vừa đặt giá)
    for (const [userIdStr, maxPriceStr] of Object.entries(proxies)) {
      const uId = parseInt(userIdStr, 10);
      const mPrice = parseFloat(maxPriceStr);

      if (uId !== parseInt(currentBidderId, 10) && mPrice > highestMaxPrice) {
        highestMaxPrice = mPrice;
        bestCandidate = { userId: uId, maxPrice: mPrice };
      }
    }

    if (!bestCandidate) return;

    const nextBidAmount = currentPrice + stepPrice;

    // Nếu hạn mức của họ vẫn đủ để đè giá người vừa rồi
    if (bestCandidate.maxPrice >= nextBidAmount) {
      console.log(`[Auto-bid] Kích hoạt cho User ${bestCandidate.userId} tại mức giá $${nextBidAmount}`);

      // Require trễ để tránh Circular Dependency
      const BiddingService = require("./bidding");
      await BiddingService.placeBid(auctionId, bestCandidate.userId, nextBidAmount);
    }
  }

  /**
   * 3. HOÀN TIỀN (Chạy khi Worker đóng phiên)
   */
  static async releaseAutoBid(auctionId, userId, finalPrice) {
    const connection = await pool.getConnection();
    const proxyKey = `auction:${auctionId}:proxy`;

    try {
      await connection.beginTransaction();

      // Lấy số tiền đã đóng băng
      const heldAmount = await redisClient.hGet(proxyKey, userId.toString());
      if (!heldAmount) throw new Error("ERR_NO_AUTOBID_FOUND");

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

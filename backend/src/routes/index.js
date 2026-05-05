const express = require("express");

const authRoutes = require("./auth");
const auctionRoutes = require("./auction");

const router = express.Router();

router.use("/auth", authRoutes);

// 2. Nhóm Route Quản lý Phiên đấu giá (Bao gồm Tạo phiên, Đặt giá, Đặt cọc, Duyệt lô...)
router.use("/auctions", auctionRoutes);

// 3. Nhóm Route dành riêng cho Admin Dashboard (Tính năng mở rộng của Huy)
try {
  const adminRoutes = require("./admin");
  router.use("/admin", adminRoutes);
} catch (error) {
  console.warn("[Routes] Admin routes chưa được mount:", error.message);
}

module.exports = router;

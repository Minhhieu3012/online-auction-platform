const express = require("express");

const authRoutes = require("./auth");
const auctionRoutes = require("./auction");

const router = express.Router();

// Mount các module nghiệp vụ
router.use("/auth", authRoutes);
router.use("/auctions", auctionRoutes);

try {
  // Thử mount admin routes nếu tồn tại
  const adminRoutes = require("./admin");
  router.use("/admin", adminRoutes);
} catch (error) {
  console.warn("[Routes] Admin routes chưa được mount hoặc file không tồn tại.");
}

module.exports = router;
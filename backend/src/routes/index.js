const express = require("express");

const authRoutes = require("./auth");
const auctionRoutes = require("./auction");
const adminRoutes = require("./admin");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/auctions", auctionRoutes);

/**
 * Admin routes.
 * Frontend đang gọi:
 * - /api/admin/dashboard
 * - /api/admin/auctions
 * - /api/admin/users
 * - /api/admin/fraud-alerts
 * - /api/admin/settlements
 * - /api/admin/logs
 *
 * Vì vậy backend BẮT BUỘC phải mount admin tại /api/admin.
 * Không bọc try/catch ở đây để nếu admin route lỗi thì backend báo lỗi rõ,
 * không âm thầm bỏ mount rồi frontend bị 404.
 */
router.use("/admin", adminRoutes);

try {
  const notificationRoutes = require("./notifications");
  router.use("/notifications", notificationRoutes);
  console.info("[Routes] Notification routes mounted at /api/notifications");
} catch (error) {
  console.warn("[Routes] Notification routes chưa được mount:", error.message);
}

router.use((req, res) => {
  return res.status(404).json({
    success: false,
    error_code: "ERR_ROUTE_NOT_FOUND",
    message: `Không tìm thấy API: ${req.method} ${req.originalUrl}`,
  });
});

console.info("[Routes] Core routes mounted: /api/auth, /api/auctions, /api/admin");

module.exports = router;
const express = require("express");

const authRoutes = require("./auth");
const auctionRoutes = require("./auction");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/auctions", auctionRoutes);

try {
  const adminRoutes = require("./admin");
  router.use("/admin", adminRoutes);
} catch (error) {
  console.warn("[Routes] Admin routes chưa được mount:", error.message);
}

try {
  const notificationRoutes = require("./notifications");
  router.use("/notifications", notificationRoutes);
} catch (error) {
  console.warn("[Routes] Notification routes chưa được mount:", error.message);
}

module.exports = router;
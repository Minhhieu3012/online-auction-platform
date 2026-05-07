const express = require("express");

const authRoutes = require("./auth");
const auctionRoutes = require("./auction");
const adminRoutes = require("./admin");
const { sendError } = require("../utils/response");

const authModule = require("../middlewares/auth");
const authMiddleware = authModule.authMiddleware || authModule;

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/auctions", auctionRoutes);

/**
 * Admin routes.
 */
router.use("/admin", adminRoutes);

/**
 * Watchlist routes.
 * GET  /api/watchlist          — lấy danh sách theo dõi của user
 * POST /api/watchlist/:id      — thêm auction vào watchlist
 * DELETE /api/watchlist/:id    — xóa auction khỏi watchlist
 */
try {
  const WatchlistController = require("../controllers/watchlist");

  router.get("/watchlist", authMiddleware, (req, res) => WatchlistController.getWatchlist(req, res));

  router.post("/watchlist/:id", authMiddleware, (req, res) => WatchlistController.addToWatchlist(req, res));

  router.delete("/watchlist/:id", authMiddleware, (req, res) => WatchlistController.removeFromWatchlist(req, res));

  console.info("[Routes] Watchlist routes mounted at /api/watchlist");
} catch (error) {
  console.warn("[Routes] Watchlist routes không mount được:", error.message);
}

/**
 * Transaction routes.
 * GET /api/transactions         — lịch sử giao dịch của user
 */
try {
  const TransactionController = require("../controllers/transactions");

  router.get("/transactions", authMiddleware, (req, res) => TransactionController.getMyTransactions(req, res));

  console.info("[Routes] Transaction routes mounted at /api/transactions");
} catch (error) {
  console.warn("[Routes] Transaction routes không mount được:", error.message);
}

/**
 * Notification routes.
 */
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

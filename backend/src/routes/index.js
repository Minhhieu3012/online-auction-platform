const express = require("express");
const router = express.Router();

// SỬA LỖI Ở ĐÂY: Thêm ngoặc nhọn {} để lấy đúng hàm authMiddleware
// do file auth.js giờ đã export nhiều module (của Thành làm)
const { authMiddleware } = require("../middlewares/auth");
const checkIdempotency = require("../middlewares/idempotency");
const BiddingController = require("../controllers/bidding");

// 1. Route Đăng ký / Đăng nhập
router.use("/auth", require("./auth"));

// 2. Route Quản lý Phiên đấu giá
router.use("/auctions", require("./auction"));

// 3. Route Đặt giá
router.post("/auctions/:id/bids", authMiddleware, checkIdempotency, BiddingController.placeBid);

// API Cài đặt Auto-bid
router.post("/auctions/:id/autobid", authMiddleware, checkIdempotency, BiddingController.setupAutoBid);

router.get("/auctions/:id/bids", BiddingController.getBidHistory);

module.exports = router;

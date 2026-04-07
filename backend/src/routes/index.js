const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth");
const BiddingController = require("../controllers/bidding");

// 1. Route Đăng ký / Đăng nhập
router.use("/auth", require("./auth"));

// 2. Route Quản lý Phiên đấu giá (Đã đổi thành số nhiều)
router.use("/auctions", require("./auction"));

// 3. Route Đặt giá (Không bị nhầm lẫn nữa)
router.post("/auctions/:id/bids", authMiddleware, BiddingController.placeBid);

router.get("/auctions/:id/bids", BiddingController.getBidHistory);

module.exports = router;

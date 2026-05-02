const express = require("express");
const router = express.Router();
const AuctionController = require("../controllers/auction");
const authMiddleware = require("../middlewares/auth"); // Middleware kiểm tra Token

// Bắt buộc phải có Token hợp lệ mới được vào API này
router.post("/", authMiddleware, AuctionController.createAuction);

module.exports = router;

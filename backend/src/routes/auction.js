const express = require("express");
const router = express.Router();

// Import các Controller
const AuctionController = require("../controllers/auction");
const BiddingController = require("../controllers/bidding");

// Import Middleware bảo mật và nghiệp vụ
const { authMiddleware, authorize } = require("../middlewares/auth");
const { validateBidRequirements } = require("../middlewares/validateBid");

/**
 * ==========================================
 * CÁC ROUTE CÔNG KHAI (PUBLIC ROUTES)
 * ==========================================
 */

// Lấy danh sách các phiên đấu giá
router.get("/", AuctionController.listAuctions);

// Xem chi tiết một phiên đấu giá[cite: 10]
router.get("/:id", AuctionController.getAuctionById);

/**
 * ==========================================
 * CÁC ROUTE BẢO MẬT (PROTECTED ROUTES)
 * ==========================================
 */

// Tạo mới một phiên đấu giá (Yêu cầu đăng nhập)[cite: 10]
router.post(
  "/", 
  authMiddleware, 
  AuctionController.createAuction
);

/**
 * 1. authMiddleware: Xác thực Token (401)
 * 2. authorize("bidder"): Kiểm tra quyền người mua (403)
 * 3. validateBidRequirements: Kiểm tra số dư, tự bid, phiên tồn tại (403/400)
 */
router.post(
  "/:id/bid",
  authMiddleware,
  authorize("bidder"),
  validateBidRequirements,
  BiddingController.placeBid
);

module.exports = router;
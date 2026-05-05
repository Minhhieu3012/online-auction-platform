const express = require("express");

const AuctionController = require("../controllers/auction");
const BiddingController = require("../controllers/bidding");
const { authMiddleware, optionalAuth, authorize } = require("../middlewares/auth");
const checkIdempotency = require("../middlewares/idempotency");
const { validateBidRequirements } = require("../middlewares/validateBid"); // Bổ sung import bị thiếu
const { sendError } = require("../utils/response");

const router = express.Router();

let DepositController = null;

try {
  DepositController = require("../controllers/deposit");
} catch (error) {
  DepositController = null;
}

function safeController(controller, methodName, featureName) {
  return (req, res, next) => {
    const handler = controller?.[methodName];

    if (typeof handler !== "function") {
      return sendError(res, "ERR_FEATURE_NOT_READY", `${featureName} chưa được cấu hình trong backend.`, 501);
    }

    return handler(req, res, next);
  };
}

// ----------------------------------------------------
// BINDING CONTROLLERS
// ----------------------------------------------------
const listAuctions = safeController(AuctionController, "listAuctions", "Danh sách phiên đấu giá");
const listMyAuctions = safeController(AuctionController, "listMyAuctions", "Danh sách phiên của tôi");
const getAuctionById = safeController(AuctionController, "getAuctionById", "Chi tiết phiên đấu giá");
const createAuction = safeController(AuctionController, "createAuction", "Tạo phiên đấu giá");
const updateAuctionStatus = safeController(
  AuctionController,
  "updateAuctionStatus",
  "Cập nhật trạng thái phiên đấu giá",
);
const approveAuction = safeController(AuctionController, "approveAuction", "Duyệt phiên đấu giá");
const rejectAuction = safeController(AuctionController, "rejectAuction", "Từ chối phiên đấu giá");

const getDepositStatus = safeController(DepositController, "getDepositStatus", "Trạng thái đặt cọc");
const placeDeposit = safeController(DepositController, "placeDeposit", "Đặt cọc tham gia đấu giá"); // Sửa lại tên chuẩn

const getBidHistory = safeController(BiddingController, "getBidHistory", "Lịch sử đặt giá");
const placeBid = safeController(BiddingController, "placeBid", "Đặt giá");
const setupAutoBid = safeController(BiddingController, "setupAutoBid", "Auto-bid");

// ----------------------------------------------------
// PUBLIC ROUTES (Khách vãng lai)
// ----------------------------------------------------
router.get("/", optionalAuth, listAuctions);
router.get("/:id", optionalAuth, getAuctionById);
router.get("/:id/bids", optionalAuth, getBidHistory);

// ----------------------------------------------------
// USER ROUTES (Yêu cầu đăng nhập)
// ----------------------------------------------------
// Lấy danh sách của tôi (Cần đặt trước các route có :id)
router.get("/mine", authMiddleware, listMyAuctions);

// Tạo phiên đấu giá
router.post("/", authMiddleware, authorize("user", "admin"), checkIdempotency, createAuction);

// Đặt cọc
router.get("/:id/deposit", authMiddleware, getDepositStatus);
router.get("/:id/deposit-status", authMiddleware, getDepositStatus); // Alias FE
router.post("/:id/deposit", authMiddleware, checkIdempotency, placeDeposit);

// Đặt giá (Bảo vệ bằng Middleware validateBidRequirements)
router.post("/:id/bids", authMiddleware, authorize("user"), validateBidRequirements, checkIdempotency, placeBid);
router.post("/:id/bid", authMiddleware, authorize("user"), validateBidRequirements, checkIdempotency, placeBid); // Alias FE

// Auto-bid
router.post("/:id/autobid", authMiddleware, checkIdempotency, setupAutoBid);

// ----------------------------------------------------
// ADMIN ROUTES (Cực kỳ bảo mật)
// ----------------------------------------------------
router.patch("/:id/status", authMiddleware, authorize("admin"), updateAuctionStatus);
router.post("/:id/approve", authMiddleware, authorize("admin"), approveAuction);
router.post("/:id/reject", authMiddleware, authorize("admin"), rejectAuction);

module.exports = router;

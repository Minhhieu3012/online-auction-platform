const express = require("express");

const AuctionController = require("../controllers/auction");
const BiddingController = require("../controllers/bidding");
const { authMiddleware, optionalAuth, authorize } = require("../middlewares/auth");
const checkIdempotency = require("../middlewares/idempotency");
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

const listAuctions = safeController(AuctionController, "listAuctions", "Danh sách phiên đấu giá");
const listMyAuctions = safeController(AuctionController, "listMyAuctions", "Danh sách phiên của tôi");
const getAuctionById = safeController(AuctionController, "getAuctionById", "Chi tiết phiên đấu giá");
const createAuction = safeController(AuctionController, "createAuction", "Tạo phiên đấu giá");
const updateAuctionStatus = safeController(
  AuctionController,
  "updateAuctionStatus",
  "Cập nhật trạng thái phiên đấu giá",
);

const getDepositStatus = safeController(DepositController, "getDepositStatus", "Trạng thái đặt cọc");
const placeDeposit = safeController(DepositController, "placeDeposit", "Đặt cọc tham gia đấu giá");

const getBidHistory = safeController(BiddingController, "getBidHistory", "Lịch sử đặt giá");
const placeBid = safeController(BiddingController, "placeBid", "Đặt giá");
const setupAutoBid = safeController(BiddingController, "setupAutoBid", "Auto-bid");

// Map thêm 2 hàm của Admin (Từ code của chúng ta)
const approveAuction = safeController(AuctionController, "approveAuction", "Duyệt phiên đấu giá");
const rejectAuction = safeController(AuctionController, "rejectAuction", "Từ chối phiên đấu giá");

// Lấy danh sách các phiên đấu giá (Cho phép khách xem)
router.get("/", optionalAuth, listAuctions);

/**
 * IMPORTANT:
 * Các route cố định phải đặt trước "/:id".
 * Nếu không, "/mine" sẽ bị hiểu thành id = "mine".
 */
router.get("/mine", authMiddleware, listMyAuctions);

/**
 * USER ROUTES
 */
router.post("/", authMiddleware, checkIdempotency, createAuction);

/**
 * AUCTION DETAIL ROUTES
 */
router.get("/:id", optionalAuth, getAuctionById);

router.get("/:id/deposit", authMiddleware, getDepositStatus);

router.post("/:id/deposit", authMiddleware, checkIdempotency, placeDeposit);

router.get("/:id/bids", optionalAuth, getBidHistory);

router.post("/:id/bids", authMiddleware, checkIdempotency, placeBid);

/**
 * Alias cũ cho FE/team code còn gọi /bid.
 */
router.post("/:id/bid", authMiddleware, checkIdempotency, placeBid);

router.post("/:id/autobid", authMiddleware, checkIdempotency, setupAutoBid);
// Xem chi tiết một phiên đấu giá và lịch sử bid
router.get("/:id", optionalAuth, getAuctionById);
router.get("/:id/bids", optionalAuth, getBidHistory);

// Cập nhật trạng thái phiên (Dùng cho Admin duyệt phiên)
router.patch("/:id/status", authMiddleware, updateAuctionStatus);

// Lấy trạng thái đặt cọc của user hiện tại cho một phiên
router.get("/:id/deposit-status", authMiddleware, getDepositStatus);

// Tạo yêu cầu thanh toán đặt cọc qua Stripe
router.post("/:id/deposit", authMiddleware, checkIdempotency, createDeposit);

// User hoặc Admin đều có quyền đăng bán
router.post("/", authMiddleware, authorize("user", "admin"), checkIdempotency, createAuction);

router.get("/:id/deposit", authMiddleware, getDepositStatus);

router.post("/:id/deposit", authMiddleware, checkIdempotency, placeDeposit);

// Chỉ user thường mới được đấu giá + Validate nghiệp vụ
router.post("/:id/bids", authMiddleware, authorize("user"), validateBidRequirements, checkIdempotency, placeBid);

/**
 * ĐẶT GIÁ (PLACE BID)
 * 1. authMiddleware: Xác thực Token
 * 2. authorize("bidder"): Kiểm tra quyền người mua
 * 3. validateBidRequirements: Kiểm tra cọc, tự bid, phiên tồn tại
 * 4. checkIdempotency: Chống duplicate click
 */
router.post("/:id/bids", authMiddleware, authorize("user"), validateBidRequirements, checkIdempotency, placeBid);

// Alias cho FE/Code team đang gọi route không có số nhiều 's'
router.post("/:id/bid", authMiddleware, authorize("user"), validateBidRequirements, checkIdempotency, placeBid);

// Cấu hình đấu giá tự động (Proxy Bidding / Auto-bid)
router.post("/:id/autobid", authMiddleware, checkIdempotency, setupAutoBid);

/**
 * ==========================================
 * ADMIN ROUTES (Cực kỳ bảo mật)
 * ==========================================
 */
router.post("/:id/approve", authMiddleware, authorize("admin"), approveAuction);

router.post("/:id/reject", authMiddleware, authorize("admin"), rejectAuction);

module.exports = router;

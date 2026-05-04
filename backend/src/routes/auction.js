const express = require("express");

// Import các Controller
const AuctionController = require("../controllers/auction");
const BiddingController = require("../controllers/bidding");

// Import Middleware
const { authMiddleware, optionalAuth, authorize } = require("../middlewares/auth");
const checkIdempotency = require("../middlewares/idempotency");
const { validateBidRequirements } = require("../middlewares/validateBid");
const { sendError } = require("../utils/response");

const router = express.Router();

function safeController(controller, methodName, featureName) {
  return (req, res, next) => {
    const handler = controller?.[methodName];

    if (typeof handler !== "function") {
      return sendError(
        res,
        "ERR_FEATURE_NOT_READY",
        `${featureName} chưa được cấu hình trong backend.`,
        501,
      );
    }

    return handler(req, res, next);
  };
}

// Khởi tạo an toàn các handlers
const listAuctions = safeController(AuctionController, "listAuctions", "Danh sách phiên đấu giá");
const listMyAuctions = safeController(AuctionController, "listMyAuctions", "Danh sách phiên của tôi");
const getAuctionById = safeController(AuctionController, "getAuctionById", "Chi tiết phiên đấu giá");
const createAuction = safeController(AuctionController, "createAuction", "Tạo phiên đấu giá");
const updateAuctionStatus = safeController(AuctionController, "updateAuctionStatus", "Cập nhật trạng thái phiên đấu giá");

// Đã tích hợp Stripe vào AuctionController
const getDepositStatus = safeController(AuctionController, "getDepositStatus", "Trạng thái đặt cọc");
const createDeposit = safeController(AuctionController, "createDeposit", "Đặt cọc tham gia đấu giá");

const getBidHistory = safeController(BiddingController, "getBidHistory", "Lịch sử đặt giá");
const placeBid = safeController(BiddingController, "placeBid", "Đặt giá");
const setupAutoBid = safeController(BiddingController, "setupAutoBid", "Auto-bid");

/**
 * ==========================================
 * CÁC ROUTE CÔNG KHAI VÀ ƯU TIÊN (PUBLIC & PRIORITY ROUTES)
 * ==========================================
 */

// Lấy danh sách các phiên đấu giá
router.get("/", optionalAuth, listAuctions);

// [LƯU Ý KIẾN TRÚC]: Route '/mine' BẮT BUỘC phải đặt trước '/:id' 
// để tránh việc Express parse chữ "mine" thành tham số req.params.id
router.get("/mine", authMiddleware, listMyAuctions);

// Xem chi tiết một phiên đấu giá
router.get("/:id", optionalAuth, getAuctionById);
router.get("/:id/bids", optionalAuth, getBidHistory);

/**
 * ==========================================
 * CÁC ROUTE BẢO MẬT (PROTECTED ROUTES)
 * ==========================================
 */

// Tạo mới một phiên đấu giá (Yêu cầu đăng nhập)
router.post(
  "/",
  authMiddleware,
  checkIdempotency,
  createAuction,
);

// Cập nhật trạng thái phiên đấu giá
router.patch(
  "/:id/status",
  authMiddleware,
  updateAuctionStatus,
);

// Lấy trạng thái đặt cọc của user cho một phiên
router.get(
  "/:id/deposit",
  authMiddleware,
  getDepositStatus,
);

// Tạo yêu cầu thanh toán đặt cọc qua Stripe
router.post(
  "/:id/deposit",
  authMiddleware,
  checkIdempotency,
  createDeposit,
);

/**
 * 1. authMiddleware: Xác thực Token (401)
 * 2. authorize("bidder"): Kiểm tra quyền người mua (403)
 * 3. validateBidRequirements: Kiểm tra đã cọc thành công, không tự bid, phiên tồn tại (403/400)
 * 4. checkIdempotency: Chống duplicate request
 */
router.post(
  "/:id/bids",
  authMiddleware,
  authorize("bidder"),
  validateBidRequirements,
  checkIdempotency,
  placeBid,
);

/**
 * Alias cũ để không vỡ FE/team code đang gọi /bid.
 */
router.post(
  "/:id/bid",
  authMiddleware,
  authorize("bidder"),
  validateBidRequirements,
  checkIdempotency,
  placeBid,
);

// Cấu hình đấu giá tự động (Auto-bid)
router.post(
  "/:id/autobid",
  authMiddleware,
  checkIdempotency,
  setupAutoBid,
);

module.exports = router;
const express = require("express");

// Import các Controller
const AuctionController = require("../controllers/auction");
const BiddingController = require("../controllers/bidding");

// Import Middleware bảo mật và nghiệp vụ
const { authMiddleware, optionalAuth, authorize } = require("../middlewares/auth");
const checkIdempotency = require("../middlewares/idempotency");
const { validateBidRequirements } = require("../middlewares/validateBid");
const { sendError } = require("../utils/response");

const router = express.Router();

/**
 * Hàm bọc an toàn để kiểm tra method tồn tại trong Controller trước khi thực thi
 * Tránh lỗi hệ thống khi chưa kịp triển khai logic Backend.
 */
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

// Khởi tạo an toàn các handlers từ Controller
const listAuctions = safeController(AuctionController, "listAuctions", "Danh sách phiên đấu giá");
const listMyAuctions = safeController(AuctionController, "listMyAuctions", "Danh sách phiên của tôi");
const getAuctionById = safeController(AuctionController, "getAuctionById", "Chi tiết phiên đấu giá");
const createAuction = safeController(AuctionController, "createAuction", "Tạo phiên đấu giá");
const updateAuctionStatus = safeController(AuctionController, "updateAuctionStatus", "Cập nhật trạng thái phiên đấu giá");

// Tích hợp logic Đặt cọc (Stripe)
const getDepositStatus = safeController(AuctionController, "getDepositStatus", "Trạng thái đặt cọc");
const createDeposit = safeController(AuctionController, "createDeposit", "Đặt cọc tham gia đấu giá");

// Tích hợp logic Đấu giá
const getBidHistory = safeController(BiddingController, "getBidHistory", "Lịch sử đặt giá");
const placeBid = safeController(BiddingController, "placeBid", "Đặt giá");
const setupAutoBid = safeController(BiddingController, "setupAutoBid", "Auto-bid");

/**
 * ==========================================
 * CÁC ROUTE CÔNG KHAI VÀ ƯU TIÊN (PUBLIC & PRIORITY)
 * ==========================================
 */

// Lấy danh sách các phiên đấu giá (Cho phép khách xem)
router.get("/", optionalAuth, listAuctions);

/**
 * [SỬA LỖI KIẾN TRÚC]: Route '/mine' BẮT BUỘC phải đặt trước '/:id'
 * Lý do: Express đọc từ trên xuống, nếu để sau nó sẽ coi "mine" là một ID phiên đấu giá.
 */
router.get("/mine", authMiddleware, listMyAuctions);

// Xem chi tiết một phiên đấu giá và lịch sử bid
router.get("/:id", optionalAuth, getAuctionById);
router.get("/:id/bids", optionalAuth, getBidHistory);

/**
 * ==========================================
 * CÁC ROUTE BẢO MẬT (PROTECTED ROUTES)
 * ==========================================
 */

// Tạo mới một phiên đấu giá (Yêu cầu đăng nhập & chống trùng lặp)
router.post(
  "/",
  authMiddleware,
  checkIdempotency,
  createAuction,
);

// Cập nhật trạng thái phiên (Dùng cho Admin duyệt phiên)
router.patch(
  "/:id/status",
  authMiddleware,
  updateAuctionStatus,
);

// Lấy trạng thái đặt cọc của user hiện tại cho một phiên
router.get(
  "/:id/deposit-status",
  authMiddleware,
  getDepositStatus,
);

// Alias /deposit cho tương thích FE bản cũ
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
 * ĐẶT GIÁ (PLACE BID)
 * 1. authMiddleware: Xác thực Token
 * 2. authorize("bidder"): Kiểm tra quyền người mua
 * 3. validateBidRequirements: Kiểm tra cọc, tự bid, phiên tồn tại
 * 4. checkIdempotency: Chống duplicate click
 */
router.post(
  "/:id/bids",
  authMiddleware,
  authorize("user"),
  validateBidRequirements,
  checkIdempotency,
  placeBid,
);

// Alias cho FE/Code team đang gọi route không có số nhiều 's'
router.post(
  "/:id/bid",
  authMiddleware,
  authorize("user"),
  validateBidRequirements,
  checkIdempotency,
  placeBid,
);

// Cấu hình đấu giá tự động (Proxy Bidding / Auto-bid)
router.post(
  "/:id/autobid",
  authMiddleware,
  checkIdempotency,
  setupAutoBid,
);

module.exports = router;
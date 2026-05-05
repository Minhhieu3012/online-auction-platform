const express = require("express");

const AuctionController = require("../controllers/auction");
const BiddingController = require("../controllers/bidding");
const checkIdempotency = require("../middlewares/idempotency");
const { validateBidRequirements } = require("../middlewares/validateBid"); // Bổ sung import bị thiếu
const { sendError } = require("../utils/response");

const authModule = require("../middlewares/auth");
const authMiddleware = authModule.authMiddleware || authModule;
const authorize =
  authModule.authorize ||
  ((...allowedRoles) => {
    return (req, res, next) => {
      if (!req.user || !allowedRoles.includes(req.user.role)) {
        return sendError(res, "ERR_FORBIDDEN", "Bạn không có quyền thực hiện hành động này.", 403);
      }

      return next();
    };
  });

let DepositController = null;
let validateBidRequirements = null;

try {
  DepositController = require("../controllers/deposit");
} catch {
  DepositController = null;
}

try {
  const validateBidModule = require("../middlewares/validateBid");
  validateBidRequirements = validateBidModule.validateBidRequirements || validateBidModule;
} catch {
  validateBidRequirements = (req, res, next) => next();
}

const router = express.Router();

function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  return authMiddleware(req, res, next);
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

function validateAuctionId(req, res, next) {
  const auctionId = Number(req.params.id);

  if (!Number.isInteger(auctionId) || auctionId <= 0) {
    return sendError(res, "ERR_INVALID_AUCTION_ID", "ID phiên đấu giá không hợp lệ.", 400);
  }

  return next();
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
const approveAuction = safeController(AuctionController, "approveAuction", "Duyệt phiên đấu giá");
const rejectAuction = safeController(AuctionController, "rejectAuction", "Từ chối phiên đấu giá");

const approveAuction = safeController(AuctionController, "approveAuction", "Duyệt phiên đấu giá");
const rejectAuction = safeController(AuctionController, "rejectAuction", "Từ chối phiên đấu giá");

const getDepositStatus = safeController(
  DepositController || AuctionController,
  "getDepositStatus",
  "Trạng thái đặt cọc",
);

const createDeposit = safeController(
  DepositController || AuctionController,
  DepositController?.placeDeposit ? "placeDeposit" : "createDeposit",
  "Đặt cọc tham gia đấu giá",
);

const getBidHistory = safeController(BiddingController, "getBidHistory", "Lịch sử đặt giá");
const placeBid = safeController(BiddingController, "placeBid", "Đặt giá");
const setupAutoBid = safeController(BiddingController, "setupAutoBid", "Auto-bid");

/**
 * Public/listing routes.
 * Route cố định phải đứng trước /:id để /mine không bị hiểu thành id.
 */
router.get("/", optionalAuth, listAuctions);
router.get("/mine", authMiddleware, listMyAuctions);

/**
 * User tạo phiên. User thường luôn vào Pending để admin duyệt.
 * Admin vẫn có thể dùng cùng API nếu cần tạo/lên lịch phiên.
 */
router.post("/", authMiddleware, authorize("user", "admin"), checkIdempotency, createAuction);

/**
 * Detail routes.
 */
router.get("/:id", validateAuctionId, optionalAuth, getAuctionById);
router.get("/:id/bids", validateAuctionId, optionalAuth, getBidHistory);

/**
 * Deposit routes.
 * Giữ cả /deposit và /deposit-status để tương thích FE cũ/mới.
 */
router.get("/:id/deposit", validateAuctionId, authMiddleware, getDepositStatus);
router.get("/:id/deposit-status", validateAuctionId, authMiddleware, getDepositStatus);
router.post("/:id/deposit", validateAuctionId, authMiddleware, checkIdempotency, createDeposit);

/**
 * Bidding routes.
 * Giữ cả /bid và /bids để không phá code team.
 */
router.post(
  "/:id/bids",
  validateAuctionId,
  authMiddleware,
  authorize("user"),
  validateBidRequirements,
  checkIdempotency,
  placeBid,
);

router.post(
  "/:id/bid",
  validateAuctionId,
  authMiddleware,
  authorize("user"),
  validateBidRequirements,
  checkIdempotency,
  placeBid,
);

router.post("/:id/autobid", validateAuctionId, authMiddleware, authorize("user"), checkIdempotency, setupAutoBid);

/**
 * Admin aliases.
 * Admin page chính vẫn nên đi qua /api/admin/..., nhưng giữ alias này cho code team.
 */
router.patch("/:id/status", validateAuctionId, authMiddleware, authorize("admin"), updateAuctionStatus);

router.post("/:id/approve", validateAuctionId, authMiddleware, authorize("admin"), approveAuction);
router.patch("/:id/approve", validateAuctionId, authMiddleware, authorize("admin"), approveAuction);

router.post("/:id/reject", validateAuctionId, authMiddleware, authorize("admin"), rejectAuction);
router.patch("/:id/reject", validateAuctionId, authMiddleware, authorize("admin"), rejectAuction);

module.exports = router;
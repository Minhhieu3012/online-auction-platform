const express = require("express");

const AuctionController = require("../controllers/auction");
const BiddingController = require("../controllers/bidding");
const DepositController = require("../controllers/deposit");
const checkIdempotency = require("../middlewares/idempotency");
const { validateBidRequirements } = require("../middlewares/validateBid");
const { sendError } = require("../utils/response");
const { authenticate } = require("../middlewares/auth");

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

// Map Controllers
const listAuctions = safeController(AuctionController, "listAuctions", "Danh sách phiên đấu giá");
const listMyAuctions = safeController(AuctionController, "listMyAuctions", "Danh sách phiên của tôi");
const listWonAuctions = safeController(AuctionController, "listWonAuctions", "Danh sách phiên đã thắng");
const getAuctionById = safeController(AuctionController, "getAuctionById", "Chi tiết phiên đấu giá");
const getSettlementStatus = safeController(AuctionController, "getSettlementStatus", "Trạng thái settlement");
const createAuction = safeController(AuctionController, "createAuction", "Tạo phiên đấu giá");
const updateAuctionStatus = safeController(
  AuctionController,
  "updateAuctionStatus",
  "Cập nhật trạng thái phiên đấu giá",
);
const approveAuction = safeController(AuctionController, "approveAuction", "Duyệt phiên đấu giá");
const rejectAuction = safeController(AuctionController, "rejectAuction", "Từ chối phiên đấu giá");

const getDepositStatus = safeController(DepositController, "getDepositStatus", "Trạng thái đặt cọc");
const placeDeposit = safeController(DepositController, "placeDeposit", "Đặt cọc tham gia đấu giá");
const payRemaining = safeController(DepositController, "payRemaining", "Thanh toán phần còn lại");

const getBidHistory = safeController(BiddingController, "getBidHistory", "Lịch sử đặt giá");
const placeBid = safeController(BiddingController, "placeBid", "Đặt giá");
const setupAutoBid = safeController(BiddingController, "setupAutoBid", "Auto-bid");

/**
 * Public/listing routes.
 * QUAN TRỌNG: Các route tĩnh (/mine, /won) phải đứng TRƯỚC route động (/:id)
 * để Express không hiểu nhầm "mine"/"won" là auction ID.
 */
router.get("/", optionalAuth, listAuctions);
router.get("/mine", authMiddleware, listMyAuctions);
router.get("/won", authMiddleware, listWonAuctions);
router.post("/", authMiddleware, authorize("user", "admin"), checkIdempotency, createAuction);

/**
 * Detail routes.
 */
router.get("/:id", validateAuctionId, optionalAuth, getAuctionById);
router.get("/:id/bids", validateAuctionId, optionalAuth, getBidHistory);

/**
 * Settlement status route (check sau khi thanh toán Stripe).
 */
router.get("/:id/settlement-status", validateAuctionId, authMiddleware, getSettlementStatus);

/**
 * Deposit & Payment routes.
 */
router.get("/:id/deposit", validateAuctionId, authMiddleware, getDepositStatus);
router.get("/:id/deposit-status", validateAuctionId, authMiddleware, getDepositStatus);
router.post("/:id/deposit", validateAuctionId, authMiddleware, checkIdempotency, placeDeposit);
router.post("/:id/pay-remaining", validateAuctionId, authMiddleware, checkIdempotency, payRemaining);

/**
 * Bidding routes.
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
router.post("/:id/auto-bid", validateAuctionId, authMiddleware, authorize("user"), checkIdempotency, setupAutoBid);

/**
 * Admin aliases.
 */
router.patch("/:id/status", validateAuctionId, authMiddleware, authorize("admin"), updateAuctionStatus);
router.post("/:id/approve", validateAuctionId, authMiddleware, authorize("admin"), approveAuction);
router.patch("/:id/approve", validateAuctionId, authMiddleware, authorize("admin"), approveAuction);
router.post("/:id/reject", validateAuctionId, authMiddleware, authorize("admin"), rejectAuction);
router.patch("/:id/reject", validateAuctionId, authMiddleware, authorize("admin"), rejectAuction);

module.exports = router;

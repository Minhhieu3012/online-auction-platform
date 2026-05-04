const express = require("express");

const AuctionController = require("../controllers/auction");
const BiddingController = require("../controllers/bidding");
const { authMiddleware, optionalAuth } = require("../middlewares/auth");
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

const listAuctions = safeController(AuctionController, "listAuctions", "Danh sách phiên đấu giá");
const listMyAuctions = safeController(AuctionController, "listMyAuctions", "Danh sách phiên của tôi");
const getAuctionById = safeController(AuctionController, "getAuctionById", "Chi tiết phiên đấu giá");
const createAuction = safeController(AuctionController, "createAuction", "Tạo phiên đấu giá");

const getDepositStatus = safeController(DepositController, "getDepositStatus", "Trạng thái đặt cọc");
const placeDeposit = safeController(DepositController, "placeDeposit", "Đặt cọc tham gia đấu giá");

const getBidHistory = safeController(BiddingController, "getBidHistory", "Lịch sử đặt giá");
const placeBid = safeController(BiddingController, "placeBid", "Đặt giá");
const setupAutoBid = safeController(BiddingController, "setupAutoBid", "Auto-bid");

/**
 * PUBLIC ROUTES
 * Người chưa đăng nhập vẫn được xem danh sách và chi tiết phiên public.
 */
router.get("/", optionalAuth, listAuctions);
router.get("/:id", optionalAuth, getAuctionById);
router.get("/:id/bids", optionalAuth, getBidHistory);

/**
 * USER ROUTES
 * User thường vừa có thể tạo phiên đấu giá, vừa có thể tham gia bid.
 */
router.get("/mine", authMiddleware, listMyAuctions);

router.post(
  "/",
  authMiddleware,
  checkIdempotency,
  createAuction,
);

router.get(
  "/:id/deposit",
  authMiddleware,
  getDepositStatus,
);

router.post(
  "/:id/deposit",
  authMiddleware,
  checkIdempotency,
  placeDeposit,
);

router.post(
  "/:id/bids",
  authMiddleware,
  checkIdempotency,
  placeBid,
);

/**
 * Alias cũ để không vỡ FE/team code đang gọi /bid.
 */
router.post(
  "/:id/bid",
  authMiddleware,
  checkIdempotency,
  placeBid,
);

router.post(
  "/:id/autobid",
  authMiddleware,
  checkIdempotency,
  setupAutoBid,
);

module.exports = router;
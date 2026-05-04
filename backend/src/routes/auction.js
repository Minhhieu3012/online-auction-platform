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
 */
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
router.post(
  "/",
  authMiddleware,
  checkIdempotency,
  createAuction,
);

/**
 * AUCTION DETAIL ROUTES
 */
router.get("/:id", optionalAuth, getAuctionById);

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

router.get("/:id/bids", optionalAuth, getBidHistory);

router.post(
  "/:id/bids",
  authMiddleware,
  checkIdempotency,
  placeBid,
);

/**
 * Alias cũ cho FE/team code còn gọi /bid.
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
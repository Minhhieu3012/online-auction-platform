const express = require("express");
const router = express.Router();

const AuctionController = require("../controllers/auction");
const BiddingController = require("../controllers/bidding");

const { authMiddleware, authorize } = require("../middlewares/auth");
const { validateBidRequirements } = require("../middlewares/validateBid");

router.get("/", AuctionController.listAuctions);

router.get("/mine", authMiddleware, AuctionController.listMyAuctions);

router.get("/:id", AuctionController.getAuctionById);

router.post("/", authMiddleware, AuctionController.createAuction);

router.patch("/:id/status", authMiddleware, AuctionController.updateAuctionStatus);

router.post(
  "/:id/bid",
  authMiddleware,
  authorize("bidder"),
  validateBidRequirements,
  BiddingController.placeBid,
);

module.exports = router;
const express = require("express");
const router = express.Router();
const BiddingController = require("../controllers/bidding");

const authMiddleware = require("../middlewares/auth");
router.post("/auction/:id/bids", authMiddleware, BiddingController.placeBid);

module.exports = router;

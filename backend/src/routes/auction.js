const express = require("express");
const router = express.Router();
const AuctionController = require("../controllers/auction");
const authMiddleware = require("../middlewares/auth");

router.get("/", AuctionController.listAuctions);
router.get("/:id", AuctionController.getAuctionById);
router.post("/", authMiddleware, AuctionController.createAuction);

module.exports = router;
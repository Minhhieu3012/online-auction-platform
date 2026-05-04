const express = require("express");

const AdminController = require("../controllers/admin");
const { authMiddleware, authorize } = require("../middlewares/auth");

const router = express.Router();

router.use(authMiddleware);
router.use(authorize("admin"));

router.get("/dashboard", AdminController.dashboard);

router.get("/auctions", AdminController.listAuctions);
router.patch("/auctions/:id/approve", AdminController.approveAuction);
router.patch("/auctions/:id/reject", AdminController.rejectAuction);
router.patch("/auctions/:id/cancel", AdminController.cancelAuction);

router.get("/users", AdminController.listUsers);
router.patch("/users/:id/lock", AdminController.lockUser);
router.patch("/users/:id/unlock", AdminController.unlockUser);

router.get("/fraud-alerts", AdminController.listFraudAlerts);
router.patch("/fraud-alerts/:id", AdminController.updateFraudAlert);

router.get("/settlements", AdminController.listSettlements);
router.get("/logs", AdminController.listActionLogs);

module.exports = router;
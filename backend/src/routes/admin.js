const express = require("express");

const AdminController = require("../controllers/admin");
const AuctionController = require("../controllers/auction");
const authModule = require("../middlewares/auth");
const { sendError } = require("../utils/response");

const router = express.Router();

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

function safeController(methodName, featureName) {
  return (req, res, next) => {
    const handler = AdminController?.[methodName];

    if (typeof handler !== "function") {
      return sendError(res, "ERR_FEATURE_NOT_READY", `${featureName} chưa được cấu hình trong backend.`, 501);
    }

    return handler(req, res, next);
  };
}

function validateIdParam(paramName, errorCode, message) {
  return (req, res, next) => {
    const id = Number(req.params[paramName]);

    if (!Number.isInteger(id) || id <= 0) {
      return sendError(res, errorCode, message, 400);
    }

    return next();
  };
}

/**
 * Tất cả admin APIs đều yêu cầu đăng nhập admin.
 * Nếu frontend có token admin hợp lệ thì API trả data.
 * Nếu chưa login hoặc không phải admin thì trả 401/403.
 * Nếu còn 404 nghĩa là backend chưa chạy đúng file route này.
 */
router.use(authMiddleware);
router.use(authorize("admin"));

router.get("/dashboard", safeController("dashboard", "Dashboard quản trị"));

router.get("/auctions", safeController("listAuctions", "Danh sách phiên đấu giá admin"));

router.patch(
  "/auctions/:id/approve",
  validateIdParam("id", "ERR_INVALID_AUCTION_ID", "ID phiên đấu giá không hợp lệ."),
  safeController("approveAuction", "Duyệt phiên đấu giá"),
);

router.patch(
  "/auctions/:id/reject",
  validateIdParam("id", "ERR_INVALID_AUCTION_ID", "ID phiên đấu giá không hợp lệ."),
  safeController("rejectAuction", "Từ chối phiên đấu giá"),
);

router.patch(
  "/auctions/:id/cancel",
  validateIdParam("id", "ERR_INVALID_AUCTION_ID", "ID phiên đấu giá không hợp lệ."),
  safeController("cancelAuction", "Hủy phiên đấu giá"),
);

router.get("/users", safeController("listUsers", "Danh sách người dùng"));

router.patch(
  "/users/:id/lock",
  validateIdParam("id", "ERR_INVALID_USER_ID", "ID người dùng không hợp lệ."),
  safeController("lockUser", "Khóa người dùng"),
);

router.patch(
  "/users/:id/unlock",
  validateIdParam("id", "ERR_INVALID_USER_ID", "ID người dùng không hợp lệ."),
  safeController("unlockUser", "Mở khóa người dùng"),
);

router.get("/fraud-alerts", safeController("listFraudAlerts", "Danh sách cảnh báo gian lận"));

router.patch(
  "/fraud-alerts/:id",
  validateIdParam("id", "ERR_INVALID_ALERT_ID", "ID cảnh báo không hợp lệ."),
  safeController("updateFraudAlert", "Cập nhật cảnh báo gian lận"),
);

router.get("/settlements", safeController("listSettlements", "Đối soát thanh toán"));

router.get("/logs", safeController("listActionLogs", "Nhật ký quản trị"));

router.post(
  "/auctions/:id/force-end",
  validateIdParam("id", "ERR_INVALID_AUCTION_ID", "ID phiên đấu giá không hợp lệ."),
  AuctionController.forceEndAuction,
);

module.exports = router;

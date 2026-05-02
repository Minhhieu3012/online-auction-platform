const redisClient = require("../config/redis");
const { sendError } = require("../utils/response");

const checkIdempotency = async (req, res, next) => {
  const requestId = req.headers["x-request-id"];

  if (!requestId) {
    return next();
  }

  const userId = req.user?.id || "anonymous";
  const redisKey = `idempotency:user:${userId}:req:${requestId}`;

  try {
    // Atomic
    const isNewRequest = await redisClient.set(redisKey, "processing", {
      NX: true,
      EX: 10,
    });

    if (isNewRequest === null) {
      return sendError(
        res,
        "ERR_DUPLICATE_REQUEST",
        "Bạn thao tác quá nhanh. Hệ thống đang xử lý yêu cầu trước đó!",
        429,
      );
    }

    next();
  } catch (error) {
    console.error("[Idempotency Error]:", error.message);
    next();
  }
};

module.exports = checkIdempotency;

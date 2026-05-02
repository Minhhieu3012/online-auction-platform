const ANTI_SNIPING = {
  TRIGGER_WINDOW_SEC: 15, // Thời gian kích hoạt (giây cuối)
  EXTEND_BY_SEC: 30,
  MAX_EXTENSIONS: 10, // Số lần gia hạn tối đa
};

/**
 * Logic kiểm tra và tính toán gia hạn đấu giá
 */
const checkAntiSniping = (endTimeMs, extensionCount) => {
  const now = Date.now();
  const timeLeftSec = (endTimeMs - now) / 1000;

  // Nếu thời gian còn lại ít hơn window và chưa quá số lần gia hạn tối đa
  if (
    timeLeftSec > 0 &&
    timeLeftSec <= ANTI_SNIPING.TRIGGER_WINDOW_SEC &&
    extensionCount < ANTI_SNIPING.MAX_EXTENSIONS
  ) {
    return {
      shouldExtend: true,
      newEndTime: endTimeMs + ANTI_SNIPING.EXTEND_BY_SEC * 1000,
    };
  }

  return { shouldExtend: false };
};

module.exports = {
  ANTI_SNIPING,
  checkAntiSniping,
};

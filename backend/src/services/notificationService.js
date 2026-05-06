const logger = require("../utils/logger");

const DEFAULT_ACTION_URL = "/pages/live-auctions.html";
const VALID_NOTIFICATION_TYPES = new Set([
  "BID_OUTBID",
  "BID_LEADING",
  "AUCTION_APPROVED",
  "AUCTION_REJECTED",
  "AUCTION_ENDED",
  "AUCTION_WON",
  "DEPOSIT_SUCCEEDED",
  "DEPOSIT_REFUNDED",
  "PAYMENT_REQUIRED",
  "PAYMENT_SUCCESS",
  "FRAUD_ALERT",
  "SYSTEM",
]);

function normalizeId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function normalizeMoney(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(normalizeMoney(value));
}

function normalizeActionUrl(actionUrl, auctionId = null) {
  if (actionUrl) return actionUrl;
  if (auctionId) return `/pages/auction-detail.html?id=${auctionId}`;
  return DEFAULT_ACTION_URL;
}

function normalizeNotificationType(type) {
  const value = String(type || "SYSTEM").trim().toUpperCase();
  return VALID_NOTIFICATION_TYPES.has(value) ? value : "SYSTEM";
}

function uniqueIds(values = []) {
  return [...new Set(values.map(normalizeId).filter(Boolean))];
}

async function safeExecute(executor, sql, params = []) {
  if (!executor || typeof executor.execute !== "function") {
    throw new Error("NotificationService cần executor có hàm execute().");
  }

  return executor.execute(sql, params);
}

async function getAuctionInfo(executor, auctionId) {
  const safeAuctionId = normalizeId(auctionId);
  if (!safeAuctionId) return null;

  const [rows] = await safeExecute(
    executor,
    `
      SELECT
        a.id,
        a.created_by,
        a.winner_id,
        a.final_price,
        a.current_price,
        a.status,
        p.name AS product_name
      FROM Auctions a
      LEFT JOIN Products p ON p.id = a.product_id
      WHERE a.id = ?
      LIMIT 1
    `,
    [safeAuctionId],
  );

  return rows[0] || null;
}

async function getAdminUserIds(executor) {
  try {
    const [rows] = await safeExecute(
      executor,
      `
        SELECT id
        FROM Users
        WHERE LOWER(role) = 'admin'
          AND COALESCE(account_status, 'active') <> 'locked'
      `,
    );

    return uniqueIds(rows.map((row) => row.id));
  } catch (error) {
    if (error.code !== "ER_BAD_FIELD_ERROR") {
      logger.warn(`[NotificationService] Không thể lọc admin theo account_status: ${error.message}`);
    }

    const [rows] = await safeExecute(
      executor,
      `
        SELECT id
        FROM Users
        WHERE LOWER(role) = 'admin'
      `,
    );

    return uniqueIds(rows.map((row) => row.id));
  }
}

async function getWatcherUserIdsIfTableExists(executor, auctionId) {
  const safeAuctionId = normalizeId(auctionId);
  if (!safeAuctionId) return [];

  try {
    const [rows] = await safeExecute(
      executor,
      `
        SELECT user_id
        FROM Watchlists
        WHERE auction_id = ?
      `,
      [safeAuctionId],
    );

    return uniqueIds(rows.map((row) => row.user_id));
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE" || /Watchlists/i.test(error.message)) {
      return [];
    }

    logger.warn(`[NotificationService] Không thể lấy Watchlists: ${error.message}`);
    return [];
  }
}

async function getAuctionParticipantUserIds(executor, auctionId, options = {}) {
  const safeAuctionId = normalizeId(auctionId);
  if (!safeAuctionId) return [];

  const excludeUserIds = new Set(uniqueIds(options.excludeUserIds || []));
  const includeSeller = Boolean(options.includeSeller);

  const [rows] = await safeExecute(
    executor,
    `
      SELECT user_id
      FROM Bids
      WHERE auction_id = ?

      UNION

      SELECT user_id
      FROM auction_deposits
      WHERE auction_id = ?
        AND status IN ('SUCCEEDED', 'APPLIED_TO_WIN_PAYMENT', 'REFUNDED')
    `,
    [safeAuctionId, safeAuctionId],
  );

  const watcherIds = await getWatcherUserIdsIfTableExists(executor, safeAuctionId);
  let ids = uniqueIds([...rows.map((row) => row.user_id), ...watcherIds]);

  if (!includeSeller) {
    const auction = await getAuctionInfo(executor, safeAuctionId);
    const sellerId = normalizeId(auction?.created_by);
    if (sellerId) ids = ids.filter((id) => id !== sellerId);
  }

  return ids.filter((id) => !excludeUserIds.has(id));
}

async function notificationExists(executor, payload) {
  const userId = normalizeId(payload.userId);
  const auctionId = normalizeId(payload.auctionId);
  const type = normalizeNotificationType(payload.type);
  const title = String(payload.title || "").trim();

  if (!userId) return false;

  if (type === "SYSTEM" && title) {
    const [rows] = await safeExecute(
      executor,
      `
        SELECT id
        FROM Notifications
        WHERE user_id = ?
          AND type = ?
          AND auction_id <=> ?
          AND title = ?
        LIMIT 1
      `,
      [userId, type, auctionId, title],
    );

    return rows.length > 0;
  }

  const [rows] = await safeExecute(
    executor,
    `
      SELECT id
      FROM Notifications
      WHERE user_id = ?
        AND type = ?
        AND auction_id <=> ?
      LIMIT 1
    `,
    [userId, type, auctionId],
  );

  return rows.length > 0;
}

async function createNotification(executor, payload, options = {}) {
  const userId = normalizeId(payload.userId);
  const auctionId = normalizeId(payload.auctionId);
  const type = normalizeNotificationType(payload.type);
  const title = String(payload.title || "").trim();
  const message = String(payload.message || "").trim();
  const actionUrl = normalizeActionUrl(payload.actionUrl, auctionId);

  if (!userId || !title || !message) return null;

  if (options.dedupe) {
    const exists = await notificationExists(executor, {
      userId,
      auctionId,
      type,
      title,
    });

    if (exists) return null;
  }

  try {
    const [result] = await safeExecute(
      executor,
      `
        INSERT INTO Notifications
          (user_id, auction_id, type, title, message, action_url)
        VALUES
          (?, ?, ?, ?, ?, ?)
      `,
      [userId, auctionId, type, title, message, actionUrl],
    );

    return result.insertId || null;
  } catch (error) {
    logger.error(`[NotificationService] Không thể tạo thông báo ${type}: ${error.message}`);
    throw error;
  }
}

async function createMany(executor, userIds, payload, options = {}) {
  const ids = uniqueIds(userIds);
  const insertedIds = [];

  for (const userId of ids) {
    const notificationId = await createNotification(
      executor,
      {
        ...payload,
        userId,
      },
      options,
    );

    if (notificationId) insertedIds.push(notificationId);
  }

  return insertedIds;
}

async function notifyAuctionApproved(executor, payload) {
  const auction = await getAuctionInfo(executor, payload.auctionId);
  const title = auction?.product_name || payload.productName || `Phiên #${payload.auctionId}`;

  return createNotification(executor, {
    userId: payload.userId || auction?.created_by,
    auctionId: payload.auctionId,
    type: "AUCTION_APPROVED",
    title: "Phiên đấu giá đã được duyệt",
    message: `Phiên "${title}" đã được admin thông qua.`,
    actionUrl: `/pages/auction-detail.html?id=${payload.auctionId}`,
  });
}

async function notifyAuctionRejected(executor, payload) {
  const auction = await getAuctionInfo(executor, payload.auctionId);
  const title = auction?.product_name || payload.productName || `Phiên #${payload.auctionId}`;

  return createNotification(executor, {
    userId: payload.userId || auction?.created_by,
    auctionId: payload.auctionId,
    type: "AUCTION_REJECTED",
    title: "Phiên đấu giá bị từ chối",
    message: payload.reason || `Phiên "${title}" chưa được thông qua.`,
    actionUrl: "/pages/account.html#selling",
  });
}

async function notifyDepositSucceeded(executor, payload) {
  return createNotification(
    executor,
    {
      userId: payload.userId,
      auctionId: payload.auctionId,
      type: "DEPOSIT_SUCCEEDED",
      title: "Đặt cọc thành công",
      message: "Bạn đã đặt cọc thành công và có thể tham gia phiên đấu giá.",
      actionUrl: `/pages/auction-detail.html?id=${payload.auctionId}`,
    },
    { dedupe: true },
  );
}

async function notifyOutbid(executor, payload) {
  return createNotification(executor, {
    userId: payload.userId,
    auctionId: payload.auctionId,
    type: "BID_OUTBID",
    title: "Bạn đã bị vượt giá",
    message: `Có người vừa đặt giá cao hơn bạn. Giá hiện tại là ${formatMoney(payload.newBidAmount)}.`,
    actionUrl: `/pages/auction-detail.html?id=${payload.auctionId}`,
  });
}

async function notifyAuctionClosingSoon(executor, payload) {
  const auctionId = normalizeId(payload.auctionId);
  if (!auctionId) return [];

  const recipients = payload.userIds?.length
    ? uniqueIds(payload.userIds)
    : await getAuctionParticipantUserIds(executor, auctionId, { includeSeller: false });

  return createMany(
    executor,
    recipients,
    {
      auctionId,
      type: "SYSTEM",
      title: "Phiên sắp kết thúc",
      message: "Phiên đấu giá bạn quan tâm còn khoảng 5 phút nữa sẽ kết thúc.",
      actionUrl: `/pages/auction-detail.html?id=${auctionId}`,
    },
    { dedupe: true },
  );
}

async function notifyAuctionWon(executor, payload) {
  return createNotification(
    executor,
    {
      userId: payload.userId || payload.winnerId,
      auctionId: payload.auctionId,
      type: "AUCTION_WON",
      title: "Bạn đã thắng phiên đấu giá",
      message: `Bạn là người thắng phiên đấu giá với giá ${formatMoney(payload.finalPrice)}.`,
      actionUrl: `/pages/auction-detail.html?id=${payload.auctionId}`,
    },
    { dedupe: true },
  );
}

async function notifyAuctionLost(executor, payload) {
  return createNotification(
    executor,
    {
      userId: payload.userId,
      auctionId: payload.auctionId,
      type: "AUCTION_ENDED",
      title: "Bạn không thắng phiên này",
      message: "Phiên đấu giá đã kết thúc. Bạn không phải là người thắng cuộc.",
      actionUrl: `/pages/auction-detail.html?id=${payload.auctionId}`,
    },
    { dedupe: true },
  );
}

async function notifyAuctionLostToParticipants(executor, payload) {
  const recipients = payload.userIds?.length
    ? uniqueIds(payload.userIds)
    : await getAuctionParticipantUserIds(executor, payload.auctionId, {
        includeSeller: false,
        excludeUserIds: [payload.winnerId],
      });

  return createMany(
    executor,
    recipients,
    {
      auctionId: payload.auctionId,
      type: "AUCTION_ENDED",
      title: "Bạn không thắng phiên này",
      message: "Phiên đấu giá đã kết thúc. Bạn không phải là người thắng cuộc.",
      actionUrl: `/pages/auction-detail.html?id=${payload.auctionId}`,
    },
    { dedupe: true },
  );
}

async function notifyAuctionNoWinner(executor, payload) {
  const auction = await getAuctionInfo(executor, payload.auctionId);
  const sellerId = normalizeId(payload.userId || auction?.created_by);
  if (!sellerId) return null;

  return createNotification(
    executor,
    {
      userId: sellerId,
      auctionId: payload.auctionId,
      type: "AUCTION_ENDED",
      title: "Phiên kết thúc nhưng chưa có người thắng",
      message: "Phiên đấu giá đã kết thúc nhưng chưa có lượt giá hợp lệ.",
      actionUrl: "/pages/account.html#selling",
    },
    { dedupe: true },
  );
}

async function notifyPaymentRequired(executor, payload) {
  return createNotification(
    executor,
    {
      userId: payload.userId || payload.winnerId,
      auctionId: payload.auctionId,
      type: "PAYMENT_REQUIRED",
      title: "Vui lòng hoàn tất thanh toán",
      message: `Bạn cần thanh toán phần còn lại ${formatMoney(payload.remainingAmount)} để hoàn tất phiên đấu giá.`,
      actionUrl: `/pages/auction-detail.html?id=${payload.auctionId}`,
    },
    { dedupe: true },
  );
}

async function notifyPaymentSuccess(executor, payload) {
  const notifications = [];

  const winnerNotificationId = await createNotification(
    executor,
    {
      userId: payload.userId || payload.winnerId,
      auctionId: payload.auctionId,
      type: "PAYMENT_SUCCESS",
      title: "Thanh toán phiên đấu giá thành công",
      message: "Bạn đã hoàn tất thanh toán phiên đấu giá.",
      actionUrl: `/pages/auction-detail.html?id=${payload.auctionId}`,
    },
    { dedupe: true },
  );

  if (winnerNotificationId) notifications.push(winnerNotificationId);

  const auction = await getAuctionInfo(executor, payload.auctionId);
  const sellerId = normalizeId(payload.sellerId || auction?.created_by);
  const winnerId = normalizeId(payload.userId || payload.winnerId);

  if (sellerId && sellerId !== winnerId) {
    const sellerNotificationId = await createNotification(
      executor,
      {
        userId: sellerId,
        auctionId: payload.auctionId,
        type: "PAYMENT_SUCCESS",
        title: "Thanh toán phiên đấu giá thành công",
        message: "Người thắng đã hoàn tất thanh toán cho phiên đấu giá của bạn.",
        actionUrl: "/pages/account.html#selling",
      },
      { dedupe: true },
    );

    if (sellerNotificationId) notifications.push(sellerNotificationId);
  }

  return notifications;
}

async function notifyDepositRefunded(executor, payload) {
  return createNotification(
    executor,
    {
      userId: payload.userId,
      auctionId: payload.auctionId,
      type: "DEPOSIT_REFUNDED",
      title: "Tiền cọc đã được hoàn",
      message: `Tiền cọc${payload.amount ? ` ${formatMoney(payload.amount)}` : ""} của bạn đã được hoàn sau khi phiên đấu giá kết thúc.`,
      actionUrl: `/pages/auction-detail.html?id=${payload.auctionId}`,
    },
    { dedupe: true },
  );
}

async function notifyAdminsNewPendingAuction(executor, payload) {
  const adminIds = await getAdminUserIds(executor);
  const auction = await getAuctionInfo(executor, payload.auctionId);
  const title = auction?.product_name || payload.productName || `Phiên #${payload.auctionId}`;

  return createMany(
    executor,
    adminIds,
    {
      auctionId: payload.auctionId,
      type: "SYSTEM",
      title: "Có phiên mới đang chờ duyệt",
      message: `Phiên "${title}" vừa được gửi lên và cần admin kiểm duyệt.`,
      actionUrl: "/pages/admin.html#verification",
    },
    { dedupe: false },
  );
}

module.exports = {
  createNotification,
  createMany,
  getAuctionInfo,
  getAdminUserIds,
  getAuctionParticipantUserIds,
  notifyAuctionApproved,
  notifyAuctionRejected,
  notifyDepositSucceeded,
  notifyOutbid,
  notifyAuctionClosingSoon,
  notifyAuctionWon,
  notifyAuctionLost,
  notifyAuctionLostToParticipants,
  notifyAuctionNoWinner,
  notifyPaymentRequired,
  notifyPaymentSuccess,
  notifyDepositRefunded,
  notifyAdminsNewPendingAuction,
};
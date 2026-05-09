import { initTheme } from "../core/theme.js";
import { initSiteHeader } from "../core/header.js";
import apiClient from "../core/api-client.js";
import "../core/socket-client.js";

const FALLBACK_IMAGES = [
  "../assets/images/mockdata/1.png",
  "../assets/images/mockdata/2.png",
  "../assets/images/mockdata/3.png",
  "../assets/images/mockdata/4.png",
  "../assets/images/mockdata/5.png",
  "../assets/images/mockdata/6.png",
];

const MAX_VISIBLE_BIDS = 25;
const FINALIZE_REFETCH_DELAY_MS = 1800;

let auction = null;
let depositStatusObj = { has_deposit: false, status: "NONE" };
let settlementStatusObj = null;
let activeImageIndex = 0;
let countdownInterval = null;
let serverTimeOffset = 0;
let socketUnsubscribers = [];
let finalizeRefetchTimer = null;
let loadSequence = 0;

const elements = {};

function cacheElements() {
  elements.mainImage = document.querySelector("[data-main-image]");
  elements.thumbnailGrid = document.querySelector("[data-thumbnail-grid]");
  elements.currentBid = document.querySelector("[data-current-bid]");
  elements.minimumBid = document.querySelector("[data-minimum-bid]");
  elements.bidInput = document.querySelector("[data-bid-input]");

  elements.bidForm = document.querySelector("[data-bid-form]");
  elements.depositPanel = document.querySelector("[data-deposit-panel]");
  elements.guestPanel = document.querySelector("[data-guest-panel]");
  elements.ownerPanel = document.querySelector("[data-owner-panel]");
  elements.winnerPanel = document.querySelector("[data-winner-panel]");
  elements.depositActionBtn = document.querySelector("[data-deposit-action-btn]");

  elements.bidHistory = document.querySelector("[data-bid-history]");
  elements.activeBids = document.querySelector("[data-active-bids]");
  elements.hours = document.querySelector("[data-countdown-hours]");
  elements.minutes = document.querySelector("[data-countdown-minutes]");
  elements.seconds = document.querySelector("[data-countdown-seconds]");
  elements.toastStack = document.querySelector("[data-toast-stack]");

  elements.statusLabel = document.querySelector("[data-status-label]");
  elements.lotLabel = document.querySelector("[data-lot-label]");
  elements.productTitle = document.querySelector("[data-product-title]");
  elements.productDescription = document.querySelector("[data-product-description]");
  elements.provenance = document.querySelector("[data-provenance]");
  elements.condition = document.querySelector("[data-condition]");
  elements.startingPrice = document.querySelector("[data-starting-price]");
  elements.increment = document.querySelector("[data-increment]");
  elements.depositAmount = document.querySelector("[data-deposit-amount]");
  elements.depositInfoBox = document.querySelector("[data-deposit-info-box]");

  elements.galleryFrame = document.querySelector("[data-gallery-frame]");
  elements.lightbox = document.querySelector("[data-image-lightbox]");
  elements.lightboxImage = document.querySelector("[data-lightbox-image]");
  elements.lightboxClose = document.querySelector("[data-lightbox-close]");
  elements.lightboxPrev = document.querySelector("[data-lightbox-prev]");
  elements.lightboxNext = document.querySelector("[data-lightbox-next]");
  elements.proxyToggle = document.querySelector("[data-proxy-toggle]");
  elements.proxySettings = document.querySelector("[data-proxy-settings]");
  elements.proxyMaxInput = document.querySelector("[data-proxy-max]");
}

function getAuctionIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return Number(params.get("id"));
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatTwoDigits(value) {
  return String(value).padStart(2, "0");
}

function normalizeStatusKey(status) {
  return String(status || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function getStatusLabel(status) {
  const map = {
    pending: "CHỜ DUYỆT",
    scheduled: "SẮP DIỄN RA",
    active: "ĐANG DIỄN RA",
    closing: "ĐANG CHỐT",
    ended: "ĐÃ KẾT THÚC",
    payment_pending: "CHỜ THANH TOÁN",
    completed: "HOÀN TẤT",
    cancelled: "ĐÃ HỦY",
  };

  return map[normalizeStatusKey(status)] || "ĐANG CẬP NHẬT";
}

function parseTimeMs(value) {
  if (!value) return 0;
  if (typeof value === "number") return value;
  const text = String(value).trim();
  if (/^\d+$/.test(text)) return Number(text);
  const parsed = new Date(text).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatBidTime(value) {
  if (!value) return "Vừa xong";
  const time = parseTimeMs(value);
  if (!time) return "Vừa xong";

  const diffMinutes = Math.floor(Math.max(0, Date.now() + serverTimeOffset - time) / 60000);
  if (diffMinutes < 1) return "Vừa xong";
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;
  return `${Math.floor(diffMinutes / 60)} giờ trước`;
}

function getRawValue(object, keys, fallback = null) {
  for (const key of keys) {
    if (object && object[key] !== undefined && object[key] !== null) {
      return object[key];
    }
  }
  return fallback;
}

function toNullableNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function setDisplay(element, isVisible) {
  if (!element) return;
  element.style.display = isVisible ? "block" : "none";

  if (element === elements.bidForm) {
    const inputs = element.querySelectorAll("input, button");
    inputs.forEach((input) => {
      input.disabled = !isVisible;
    });
  }
}

function normalizeBid(rawBid = {}, index = 0) {
  const id = toNullableNumber(getRawValue(rawBid, ["id", "bidId", "bid_id"]));
  const userId = toNullableNumber(getRawValue(rawBid, ["userId", "user_id"]));
  const amount = Number(
    getRawValue(rawBid, ["amount", "bidAmount", "bid_amount", "price", "currentPrice", "current_price"], 0),
  );
  const createdAt = getRawValue(rawBid, ["createdAt", "created_at", "time", "timestamp"], null);

  return {
    id,
    bidId: id,
    userId,
    bidder: getRawValue(rawBid, ["bidder", "username", "displayName"], "Ẩn danh"),
    amount,
    createdAt,
    time: formatBidTime(createdAt),
    highlight: Boolean(rawBid.highlight || index === 0),
  };
}

function getBidKey(bid) {
  if (bid.id) return `id:${bid.id}`;
  return `fallback:${bid.userId || "unknown"}:${bid.amount}:${bid.createdAt || bid.time}`;
}

function mergeBidHistory(primary = [], secondary = []) {
  const map = new Map();
  [...primary, ...secondary].forEach((bid) => {
    const normalizedBid = normalizeBid(bid);
    if (!normalizedBid.amount) return;
    const key = getBidKey(normalizedBid);

    if (!map.has(key)) {
      map.set(key, normalizedBid);
      return;
    }

    map.set(key, {
      ...map.get(key),
      ...normalizedBid,
      highlight: map.get(key).highlight || normalizedBid.highlight,
    });
  });

  return Array.from(map.values())
    .sort((a, b) => {
      const timeA = parseTimeMs(a.createdAt);
      const timeB = parseTimeMs(b.createdAt);
      if (timeA && timeB && timeA !== timeB) return timeB - timeA;
      if (a.id && b.id && a.id !== b.id) return b.id - a.id;
      return b.amount - a.amount;
    })
    .slice(0, MAX_VISIBLE_BIDS)
    .map((bid, index) => ({ ...bid, highlight: index === 0 }));
}

function normalizeAuction(rawAuction = {}) {
  const id = Number(rawAuction.id);
  const image = rawAuction.image_url || rawAuction.imageUrl || FALLBACK_IMAGES[id % FALLBACK_IMAGES.length];
  const rawBids = rawAuction.bidHistory || rawAuction.bid_history || rawAuction.bids || [];

  const currentPrice = Number(getRawValue(rawAuction, ["current_price", "currentPrice"], 0));
  const finalPrice = toNullableNumber(getRawValue(rawAuction, ["final_price", "finalPrice"]));
  const winnerId = toNullableNumber(getRawValue(rawAuction, ["winner_id", "winnerId"]));
  const endTime = parseTimeMs(getRawValue(rawAuction, ["end_time", "endTime"]));
  const status = getRawValue(rawAuction, ["status"], "Active");

  return {
    id,
    lot: rawAuction.lot || `Lô #${String(id).padStart(3, "0")}`,
    title: rawAuction.product_name || rawAuction.productName || rawAuction.title || rawAuction.name || "Vật phẩm",
    description: rawAuction.description || "Đang cập nhật...",
    status,
    rawStatus: normalizeStatusKey(status),
    currentBid:
      finalPrice !== null && ["payment_pending", "completed", "ended"].includes(normalizeStatusKey(status))
        ? finalPrice
        : currentPrice,
    startingPrice: Number(
      getRawValue(rawAuction, ["starting_price", "startingPrice", "current_price", "currentPrice"], 0),
    ),
    increment: Number(getRawValue(rawAuction, ["step_price", "stepPrice"], 1000)),
    depositAmount: Number(getRawValue(rawAuction, ["deposit_amount", "depositAmount"], 0)),
    requiresDeposit: Boolean(getRawValue(rawAuction, ["requires_deposit", "requiresDeposit"], false)),
    endTime,
    winnerId,
    finalPrice,
    createdBy: toNullableNumber(getRawValue(rawAuction, ["created_by", "createdBy"])),
    version: Number(getRawValue(rawAuction, ["version"], 0)),
    bidCount: Number(getRawValue(rawAuction, ["bid_count", "bidCount"], rawBids.length)),
    images: [image],
    bidHistory: mergeBidHistory(rawBids.map(normalizeBid), []),
  };
}

function mergeAuctionState(incomingAuction) {
  if (!auction) {
    auction = incomingAuction;
    return;
  }

  const incomingIsFinal = ["ended", "payment_pending", "completed", "cancelled"].includes(incomingAuction.rawStatus);
  const shouldTrustIncoming =
    incomingAuction.version >= auction.version || incomingIsFinal || incomingAuction.winnerId !== null;

  auction = {
    ...auction,
    ...incomingAuction,
    currentBid: shouldTrustIncoming
      ? Math.max(Number(auction.currentBid || 0), Number(incomingAuction.currentBid || 0))
      : Number(auction.currentBid || 0),
    version: Math.max(Number(auction.version || 0), Number(incomingAuction.version || 0)),
    winnerId: incomingAuction.winnerId !== null ? incomingAuction.winnerId : auction.winnerId,
    finalPrice: incomingAuction.finalPrice !== null ? incomingAuction.finalPrice : auction.finalPrice,
    bidHistory: mergeBidHistory(incomingAuction.bidHistory, auction.bidHistory),
  };

  if (!shouldTrustIncoming) {
    auction.status = auction.status || incomingAuction.status;
    auction.rawStatus = auction.rawStatus || incomingAuction.rawStatus;
  }
}

function getMinimumBid() {
  if (!auction) return 0;
  return Number(auction.currentBid || 0) + Number(auction.increment || 0);
}

function showToast(title, message, type = "info") {
  if (!elements.toastStack) return;
  const toast = document.createElement("article");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<p class="toast-title">${title}</p><p class="toast-message">${message}</p>`;
  elements.toastStack.appendChild(toast);
  window.setTimeout(() => toast.remove(), 3800);
}

function getCurrentUser() {
  return apiClient.getAuthUser();
}

function isLoggedIn() {
  return Boolean(apiClient.getAuthToken() && getCurrentUser());
}

function isAdminUser() {
  const user = getCurrentUser();
  return String(user?.role || "").toLowerCase() === "admin";
}

function hasCurrentUserBid(currentUserId) {
  if (!currentUserId || !auction?.bidHistory?.length) return false;
  return auction.bidHistory.some((bid) => Number(bid.userId) === Number(currentUserId));
}

function scheduleFinalizeRefetch(delay = FINALIZE_REFETCH_DELAY_MS) {
  if (finalizeRefetchTimer) return;

  finalizeRefetchTimer = window.setTimeout(async () => {
    finalizeRefetchTimer = null;
    await loadAuctionDetail({ reason: "finalize-refetch" });

    if (auction && auction.winnerId === null && auction.bidHistory.length > 0) {
      scheduleFinalizeRefetch(3000);
    }
  }, delay);
}

function renderActionPanel() {
  if (!auction) return;

  const nowServer = Date.now() + serverTimeOffset;
  const timeExpired = auction.endTime > 0 && auction.endTime <= nowServer;
  const finalStatuses = ["ended", "payment_pending", "completed", "cancelled"];
  const isAuctionEnded = timeExpired || finalStatuses.includes(auction.rawStatus);

  const isGuest = !isLoggedIn();
  const currentUser = getCurrentUser();
  const currentUserId = currentUser ? Number(currentUser.id) : null;
  const isOwner = currentUserId === Number(auction.createdBy);

  const hasDeposit = Boolean(depositStatusObj?.has_deposit);
  const currentDepositStatus = depositStatusObj?.status || "NONE";
  const isDepositSucceeded = currentDepositStatus === "SUCCEEDED" || currentDepositStatus === "APPLIED_TO_WIN_PAYMENT";
  const isWinner = currentUserId !== null && auction.winnerId !== null && currentUserId === Number(auction.winnerId);

  setDisplay(elements.bidForm, false);
  setDisplay(elements.depositPanel, false);
  setDisplay(elements.winnerPanel, false);
  setDisplay(elements.guestPanel, false);
  setDisplay(elements.ownerPanel, false);

  if (isAuctionEnded) {
    setDisplay(elements.winnerPanel, true);

    if (auction.winnerId === null && auction.bidHistory.length > 0) {
      elements.winnerPanel.innerHTML = `<h3 style="color: var(--warning);">ĐANG XỬ LÝ KẾT QUẢ PHIÊN ĐẤU GIÁ...</h3><p>Hệ thống đang xác định người thắng từ lịch sử bid hợp lệ.</p>`;
      scheduleFinalizeRefetch();
      return;
    }

    if (auction.winnerId === null && auction.bidHistory.length === 0) {
      elements.winnerPanel.innerHTML = `<h3 style="color: var(--text-muted);">Phiên đấu giá đã kết thúc, chưa có người thắng.</h3>`;
      return;
    }

    if (isGuest) {
      elements.winnerPanel.innerHTML = `<h3 style="color: var(--text-muted);">Phiên đấu giá đã kết thúc.</h3><p>Giá chốt: ${formatMoney(auction.finalPrice ?? auction.currentBid)}</p>`;
      return;
    }

    if (isAdminUser()) {
      setDisplay(elements.ownerPanel, true);
      if (elements.ownerPanel) {
        elements.ownerPanel.innerHTML = `
        <p style="color: var(--text-muted); font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase;">
          ◇ Chế độ xem quản trị — không thể đặt giá
        </p>
      `;
      }
      return;
    }

    if (isOwner) {
      elements.winnerPanel.innerHTML = `<h3 style="color: var(--text-muted);">Phiên kết thúc. Giá chốt: ${formatMoney(auction.finalPrice ?? auction.currentBid)}</h3>`;
      return;
    }

    if (isWinner) {
      const finalAmount = Number(auction.finalPrice ?? auction.currentBid ?? 0);

      // Đã thanh toán → hiện thông tin, KHÔNG hiện nút
      if (settlementStatusObj?.status === "PAID") {
        const paidDate = settlementStatusObj.paidAt
          ? new Date(settlementStatusObj.paidAt).toLocaleString("vi-VN")
          : "vừa xong";

        elements.winnerPanel.innerHTML = `
      <h3 style="color: var(--success);">✅ ĐÃ THANH TOÁN THÀNH CÔNG</h3>
      <p>Giá chốt: <strong>${formatMoney(finalAmount)}</strong></p>
      <p style="color: var(--text-muted); font-size: 13px;">Thanh toán lúc: ${paidDate}</p>
      <p style="color: var(--text-muted); font-size: 13px; margin-top: 8px;">
        Cảm ơn bạn đã tham gia đấu giá! Vật phẩm sẽ sớm được liên hệ giao nhận.
      </p>
    `;
        return;
      }

      // Chưa thanh toán → hiện nút như cũ
      const depositApplied =
        currentDepositStatus === "APPLIED_TO_WIN_PAYMENT"
          ? Number(depositStatusObj.amount || auction.depositAmount || 0)
          : Number(settlementStatusObj?.depositApplied ?? auction.depositAmount ?? 0);
      const remaining = Number(settlementStatusObj?.remainingAmount ?? Math.max(0, finalAmount - depositApplied));

      elements.winnerPanel.innerHTML = `
    <h3 style="color: var(--success);">🎉 BẠN ĐÃ THẮNG PHIÊN ĐẤU GIÁ</h3>
    <p>Giá thắng: ${formatMoney(finalAmount)} - Tiền cọc dự kiến khấu trừ: ${formatMoney(depositApplied)}</p>
    <p style="font-weight:bold;">Cần thanh toán thêm: ${formatMoney(remaining)}</p>
    ${remaining > 0 ? `<button type="button" class="button button-primary" id="btn-pay-remaining" style="margin-top:15px; width:100%;">THANH TOÁN NGAY</button>` : ""}
  `;

      const btn = document.getElementById("btn-pay-remaining");
      if (btn) {
        btn.onclick = async () => {
          try {
            const res = await apiClient.post(`/auctions/${auction.id}/pay-remaining`);
            if (res.data?.url) window.location.href = res.data.url;
          } catch (error) {
            showToast("Lỗi", error.message, "error");
          }
        };
      }
      return;
    }

    const paidStatuses = ["SUCCEEDED", "REFUNDED", "REFUND_PENDING", "REFUND_FAILED", "APPLIED_TO_WIN_PAYMENT"];
    const didPay = hasDeposit && paidStatuses.includes(currentDepositStatus);
    const didBid = hasCurrentUserBid(currentUserId);

    if (!didPay && !didBid) {
      elements.winnerPanel.innerHTML = `<h3 style="color: var(--text-muted);">Phiên đã kết thúc. Bạn không tham gia phiên này.</h3>`;
      return;
    }

    const refundMsg = currentDepositStatus === "REFUNDED" ? "Tiền cọc đã hoàn tất." : "Đang xử lý hoàn cọc nếu có.";
    elements.winnerPanel.innerHTML = `<h3 style="color: var(--text-muted);">Bạn không thắng phiên đấu giá này.</h3><p style="color: var(--warning);">${refundMsg}</p>`;
    return;
  }

  if (isGuest) {
    setDisplay(elements.guestPanel, true);
    return;
  }

  if (isOwner) {
    setDisplay(elements.ownerPanel, true);
    return;
  }

  if (auction.requiresDeposit && !isDepositSucceeded) {
    setDisplay(elements.depositPanel, true);
    if (elements.depositActionBtn) {
      elements.depositActionBtn.textContent =
        currentDepositStatus === "PENDING" ? "Tiếp Tục Thanh Toán Cọc" : "Đặt Cọc Để Tham Gia";
    }
    return;
  }

  setDisplay(elements.bidForm, true);
}

function updateUIWithNewBid(data = {}) {
  if (!auction || Number(data.auctionId || data.auction_id) !== Number(auction.id)) return;

  const incomingVersion = Number(data.version || 0);
  const nextAmount = Number(
    getRawValue(data, ["currentPrice", "current_price", "amount", "bidAmount", "bid_amount", "price"], 0),
  );

  if (incomingVersion > 0 && incomingVersion < Number(auction.version || 0)) {
    console.warn("[Realtime] Bỏ qua lượt giá cũ.", { current: auction.version, incoming: incomingVersion });
    return;
  }

  if (nextAmount > 0 && nextAmount < Number(auction.currentBid || 0)) {
    console.warn("[Realtime] Bỏ qua current price thấp hơn state hiện tại.", {
      current: auction.currentBid,
      incoming: nextAmount,
    });
    return;
  }

  const normalizedBid = normalizeBid(data);
  auction.currentBid = Math.max(Number(auction.currentBid || 0), nextAmount);
  auction.version = Math.max(Number(auction.version || 0), incomingVersion || Number(auction.version || 0) + 1);

  const newEndTime = getRawValue(data, ["newEndTime", "new_end_time", "endTime", "end_time"], null);
  if (newEndTime) {
    const parsedEndTime = parseTimeMs(newEndTime);
    if (parsedEndTime > auction.endTime) auction.endTime = parsedEndTime;
  }

  auction.bidHistory = mergeBidHistory([normalizedBid], auction.bidHistory || []);
  auction.bidCount = Math.max(Number(auction.bidCount || 0), auction.bidHistory.length);

  renderBidPanel();
  renderBidHistory();
  renderActionPanel();

  if (elements.currentBid) {
    elements.currentBid.style.color = "var(--success)";
    window.setTimeout(() => {
      elements.currentBid.style.color = "";
    }, 1000);
  }
}

function updateUIWithFinalizedAuction(data = {}) {
  if (!auction || Number(data.auctionId || data.auction_id) !== Number(auction.id)) return;

  auction.winnerId = toNullableNumber(getRawValue(data, ["winnerId", "winner_id", "userId", "user_id"]));
  auction.finalPrice = toNullableNumber(
    getRawValue(data, ["finalPrice", "final_price", "amount", "currentPrice", "current_price"]),
  );
  auction.currentBid = Number(auction.finalPrice ?? auction.currentBid ?? 0);
  auction.status = getRawValue(data, ["status"], auction.winnerId ? "Payment Pending" : "Ended");
  auction.rawStatus = normalizeStatusKey(auction.status);
  auction.version = Math.max(Number(auction.version || 0), Number(data.version || 0));

  renderBidPanel();
  renderActionPanel();
  scheduleFinalizeRefetch(800);
}

function unbindSocketEvents() {
  socketUnsubscribers.forEach((unsubscribe) => unsubscribe());
  socketUnsubscribers = [];
}

function bindSocketEvents() {
  if (!window.socketClient || !auction) return;

  unbindSocketEvents();
  window.socketClient.connect(auction.id);

  socketUnsubscribers.push(window.socketClient.on("new_bid", updateUIWithNewBid));
  socketUnsubscribers.push(window.socketClient.on("auction_winner", updateUIWithFinalizedAuction));
  socketUnsubscribers.push(window.socketClient.on("auction_finalized", updateUIWithFinalizedAuction));

  socketUnsubscribers.push(
    window.socketClient.on("auction_extended", (data) => {
      if (Number(data.auctionId || data.auction_id) !== Number(auction.id)) return;

      const newEndTime = getRawValue(data, ["newEndTime", "new_end_time", "endTime", "end_time"], null);
      const parsedEndTime = parseTimeMs(newEndTime);
      const nowMs = Date.now() + serverTimeOffset;

      // Nếu newEndTime <= now → admin force end, không phải gia hạn
      if (parsedEndTime && parsedEndTime <= nowMs) {
        auction.endTime = parsedEndTime;
        auction.status = "Ended";
        auction.rawStatus = "ended";
        renderBidPanel();
        renderActionPanel();
        scheduleFinalizeRefetch(1000);
        return;
      }

      // Gia hạn thật sự
      if (parsedEndTime > auction.endTime) {
        auction.endTime = parsedEndTime;
        showToast("Gia hạn phiên", "Phiên đấu giá đã được gia hạn để đảm bảo công bằng.", "info");
      }
    }),
  );

  socketUnsubscribers.push(
    window.socketClient.on("auction_ended", (data) => {
      if (Number(data.auctionId || data.auction_id) !== Number(auction.id)) return;

      auction.status = data.status || "Ended";
      auction.rawStatus = "ended";

      const endTime = getRawValue(data, ["endTime", "end_time"], null);
      if (endTime) auction.endTime = parseTimeMs(endTime);

      renderBidPanel();
      renderActionPanel();
      scheduleFinalizeRefetch(1500);

      if (data.forcedByAdmin) {
        showToast("Phiên đã kết thúc", "Admin đã kết thúc phiên đấu giá.", "info");
      }
    }),
  );
}

function setActiveImage(index) {
  if (!auction) return;
  activeImageIndex = Math.max(0, Math.min(index, auction.images.length - 1));
  const image = auction.images[activeImageIndex];
  if (elements.mainImage) elements.mainImage.src = image;
  if (elements.lightboxImage) elements.lightboxImage.src = image;
  elements.thumbnailGrid
    ?.querySelectorAll(".thumbnail-button")
    .forEach((btn, i) => btn.classList.toggle("is-active", i === activeImageIndex));
}

function renderGallery() {
  if (!elements.thumbnailGrid || !auction) return;
  elements.thumbnailGrid.innerHTML = auction.images
    .map(
      (img, index) => `
        <button type="button" class="thumbnail-button ${index === activeImageIndex ? "is-active" : ""}" data-index="${index}">
          <img src="${img}" alt="Thumbnail ${index + 1}" />
        </button>
      `,
    )
    .join("");

  elements.thumbnailGrid.querySelectorAll("[data-index]").forEach((btn) => {
    btn.onclick = () => setActiveImage(Number(btn.dataset.index));
  });
}

function renderAuction() {
  if (!auction) return;

  renderGallery();
  if (elements.mainImage) elements.mainImage.src = auction.images[0];
  if (elements.productTitle) elements.productTitle.textContent = auction.title;
  if (elements.productDescription) elements.productDescription.textContent = auction.description;
  if (elements.lotLabel) elements.lotLabel.textContent = auction.lot;
  if (elements.provenance) elements.provenance.textContent = "Đã xác thực bởi BrosGem Protocol.";
  if (elements.condition) elements.condition.textContent = "Tình trạng được cập nhật theo hồ sơ phiên đấu giá.";
  if (elements.startingPrice) elements.startingPrice.textContent = formatMoney(auction.startingPrice);
  if (elements.increment) elements.increment.textContent = formatMoney(auction.increment);
  if (elements.depositAmount) elements.depositAmount.textContent = formatMoney(auction.depositAmount);
  if (elements.depositInfoBox) elements.depositInfoBox.style.display = auction.requiresDeposit ? "block" : "none";

  renderBidPanel();
  renderBidHistory();
  renderActionPanel();
}

function renderBidPanel() {
  if (!auction) return;

  const minBid = getMinimumBid();
  if (elements.currentBid) elements.currentBid.textContent = formatMoney(auction.currentBid);
  if (elements.minimumBid) elements.minimumBid.textContent = `Giá tối thiểu: ${formatMoney(minBid)}`;
  if (elements.bidInput) {
    elements.bidInput.placeholder = String(minBid);
    elements.bidInput.min = String(minBid);
  }
  if (elements.activeBids)
    elements.activeBids.textContent = `${auction.bidHistory?.length || auction.bidCount || 0} bids`;
  if (elements.statusLabel) elements.statusLabel.textContent = getStatusLabel(auction.status);
}

function renderBidHistory() {
  if (!elements.bidHistory || !auction) return;

  if (!auction.bidHistory || auction.bidHistory.length === 0) {
    elements.bidHistory.innerHTML = `<div class="bid-history-row"><span>Chưa có lượt giá</span></div>`;
    return;
  }

  elements.bidHistory.innerHTML = auction.bidHistory
    .map(
      (bid) => `
        <div class="bid-history-row" data-bid-id="${bid.id || ""}">
          <span>${bid.bidder}</span>
          <span class="${bid.highlight ? "bid-amount-highlight" : ""}">${formatMoney(bid.amount)}</span>
          <span>${bid.time}</span>
        </div>
      `,
    )
    .join("");
}

function updateCountdown() {
  if (!auction) return;

  const nowServer = Date.now() + serverTimeOffset;
  const distance = Math.max(0, auction.endTime - nowServer);

  const totalSeconds = Math.floor(distance / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (elements.hours) elements.hours.textContent = formatTwoDigits(hours);
  if (elements.minutes) elements.minutes.textContent = formatTwoDigits(minutes);
  if (elements.seconds) elements.seconds.textContent = formatTwoDigits(seconds);

  if (distance <= 0 && ["active", "closing"].includes(auction.rawStatus)) {
    auction.status = "Closing";
    auction.rawStatus = "closing";
    renderActionPanel();
    scheduleFinalizeRefetch(1000);
  }
}

async function handleManualBid(event) {
  event.preventDefault();
  if (!auction || !isLoggedIn()) return;

  const input = elements.bidInput;
  const submitButton = elements.bidForm.querySelector("button[type='submit']");
  const bidValue = Number(String(input?.value || "").replace(/[^0-9.]/g, ""));

  if (bidValue < getMinimumBid()) {
    showToast("Từ chối", "Giá đặt quá thấp.", "warning");
    return;
  }

  submitButton.disabled = true;

  const isProxyChecked = elements.proxyToggle?.checked;

  try {
    if (isProxyChecked) {
      // ----------------------------------------
      // LUỒNG 1: XỬ LÝ AUTO-BID (PROXY BIDDING)
      // ----------------------------------------
      const maxBudget = Number(String(elements.proxyMaxInput?.value || "").replace(/[^0-9.]/g, ""));

      if (maxBudget < getMinimumBid()) {
        showToast("Từ chối", "Hạn mức uỷ thác phải lớn hơn hoặc bằng bước giá tiếp theo.", "warning");
        submitButton.disabled = false;
        return;
      }

      // Giả định route API của bạn là /auctions/:id/auto-bid (hãy điều chỉnh nếu route trong index.js của bạn khác)
      await apiClient.post(`/auctions/${auction.id}/auto-bid`, { maxAmount: maxBudget });
      showToast("Thành công", "Đã lưu cấu hình tự động trả giá.", "success");
    } else {
      // ----------------------------------------
      // LUỒNG 2: XỬ LÝ TRẢ GIÁ THỦ CÔNG (NHƯ CŨ)
      // ----------------------------------------
      const res = await apiClient.post(`/auctions/${auction.id}/bids`, { bidAmount: bidValue });
      showToast("Thành công", "Lượt giá đã được ghi nhận.", "success");
      if (input) input.value = "";
      updateUIWithNewBid(res.data);
    }
  } catch (error) {
    showToast("Lỗi", error.message, "error");
    if (error.errorCode === "ERR_AUCTION_ENDED") loadAuctionDetail({ reason: "bid-ended" });
  } finally {
    submitButton.disabled = false;
  }
}

async function loadDepositStatus(auctionId) {
  if (!isLoggedIn()) {
    depositStatusObj = { has_deposit: false, status: "NONE" };
    return;
  }

  try {
    const depRes = await apiClient.get(`/auctions/${auctionId}/deposit-status`);
    depositStatusObj = depRes.data || { has_deposit: false, status: "NONE" };
  } catch (error) {
    depositStatusObj = { has_deposit: false, status: "NONE" };
  }
}

async function loadSettlementStatus(auctionId) {
  if (!isLoggedIn()) {
    settlementStatusObj = null;
    return;
  }
  try {
    const res = await apiClient.get(`/auctions/${auctionId}/settlement-status`, null, { auth: true });
    settlementStatusObj = res.data?.settlement || null;
  } catch {
    settlementStatusObj = null;
  }
}

async function loadAuctionDetail(options = {}) {
  const id = getAuctionIdFromUrl();
  if (!id) return;

  const requestId = ++loadSequence;

  try {
    const res = await apiClient.get(`/auctions/${id}`, null, { auth: true });
    if (requestId < loadSequence && options.reason !== "finalize-refetch") return;

    const serverTime = new Date(res.data?.server_time || Date.now()).getTime();
    serverTimeOffset = serverTime - Date.now();

    const incomingAuction = normalizeAuction(res.data.auction);
    mergeAuctionState(incomingAuction);

    await Promise.all([loadDepositStatus(id), loadSettlementStatus(id)]);
    renderAuction();
    bindSocketEvents();

    if (countdownInterval) window.clearInterval(countdownInterval);
    countdownInterval = window.setInterval(updateCountdown, 1000);
    updateCountdown();
  } catch (error) {
    showToast("Lỗi", "Không tải được phiên.", "error");
  }
}

function bindEvents() {
  if (elements.proxyToggle && elements.proxySettings) {
    elements.proxyToggle.addEventListener("change", (e) => {
      elements.proxySettings.style.display = e.target.checked ? "block" : "none";
      if (e.target.checked && elements.bidInput) {
        // Tự động điền giá trị gợi ý lớn hơn giá hiện tại
        elements.proxyMaxInput.value = getMinimumBid() * 2;
        elements.proxyMaxInput.focus();
      }
    });
  }
  if (elements.bidForm) elements.bidForm.addEventListener("submit", handleManualBid);

  if (elements.depositActionBtn) {
    elements.depositActionBtn.addEventListener("click", async () => {
      try {
        const res = await apiClient.post(`/auctions/${auction.id}/deposit`);
        if (res.data?.url) window.location.href = res.data.url;
      } catch (error) {
        showToast("Lỗi", error.message, "error");
      }
    });
  }

  elements.galleryFrame?.addEventListener("click", () => {
    if (elements.lightbox) elements.lightbox.style.display = "flex";
    document.body.classList.add("is-menu-open");
  });

  elements.lightboxClose?.addEventListener("click", () => {
    if (elements.lightbox) elements.lightbox.style.display = "none";
    document.body.classList.remove("is-menu-open");
  });

  elements.lightboxPrev?.addEventListener("click", () => setActiveImage(activeImageIndex - 1));
  elements.lightboxNext?.addEventListener("click", () => setActiveImage(activeImageIndex + 1));

  window.addEventListener("beforeunload", () => {
    unbindSocketEvents();
    window.socketClient?.leaveRoom?.(auction?.id);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initSiteHeader({ hideAfter: 120, topRevealOffset: 12 });
  cacheElements();
  bindEvents();
  loadAuctionDetail({ reason: "initial" });
});

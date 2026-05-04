import { initTheme } from "../core/theme.js";
import { initSiteHeader } from "../core/header.js";
import apiClient from "../core/api-client.js";

const FALLBACK_IMAGES = [
  "../assets/images/mockdata/1.png",
  "../assets/images/mockdata/2.png",
  "../assets/images/mockdata/3.png",
  "../assets/images/mockdata/4.png",
  "../assets/images/mockdata/5.png",
  "../assets/images/mockdata/6.png",
];

let auction = null;
let activeImageIndex = 0;
let countdownInterval = null;

const elements = {};

function cacheElements() {
  elements.mainImage = document.querySelector("[data-main-image]");
  elements.thumbnailGrid = document.querySelector("[data-thumbnail-grid]");
  elements.currentBid = document.querySelector("[data-current-bid]");
  elements.minimumBid = document.querySelector("[data-minimum-bid]");
  elements.bidInput = document.querySelector("[data-bid-input]");
  elements.bidForm = document.querySelector("[data-bid-form]");
  elements.bidHistory = document.querySelector("[data-bid-history]");
  elements.activeBids = document.querySelector("[data-active-bids]");
  elements.hours = document.querySelector("[data-countdown-hours]");
  elements.minutes = document.querySelector("[data-countdown-minutes]");
  elements.seconds = document.querySelector("[data-countdown-seconds]");
  elements.toastStack = document.querySelector("[data-toast-stack]");

  elements.simulateBid = document.querySelector("[data-simulate-bid]");
  elements.simulateSoftClose = document.querySelector("[data-simulate-soft-close]");

  elements.statusLabel = document.querySelector("[data-status-label]");
  elements.liveChip = document.querySelector("[data-live-chip]");
  elements.lotLabel = document.querySelector("[data-lot-label]");
  elements.productTitle = document.querySelector("[data-product-title]");
  elements.productDescription = document.querySelector("[data-product-description]");
  elements.provenance = document.querySelector("[data-provenance]");
  elements.condition = document.querySelector("[data-condition]");
  elements.startingPrice = document.querySelector("[data-starting-price]");
  elements.increment = document.querySelector("[data-increment]");

  elements.lightbox = document.querySelector("[data-image-lightbox]");
  elements.lightboxImage = document.querySelector("[data-lightbox-image]");
  elements.lightboxFrame = document.querySelector("[data-lightbox-frame]");
  elements.lightboxCaption = document.querySelector("[data-lightbox-caption]");
  elements.lightboxClose = document.querySelector("[data-lightbox-close]");
  elements.lightboxPrev = document.querySelector("[data-lightbox-prev]");
  elements.lightboxNext = document.querySelector("[data-lightbox-next]");
  elements.galleryFrame = document.querySelector("[data-gallery-frame]");
}

function getAuctionIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return Number(params.get("id"));
}

function getFallbackImage(id) {
  const index = Math.abs(Number(id || 0)) % FALLBACK_IMAGES.length;
  return FALLBACK_IMAGES[index];
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
    .replace(/\s+/g, "_");
}

function getStatusLabel(status) {
  const map = {
    pending: "CHỜ DUYỆT",
    rejected: "BỊ TỪ CHỐI",
    scheduled: "ĐÃ LÊN LỊCH",
    active: "ĐANG DIỄN RA",
    closing: "SẮP ĐÓNG",
    ended: "ĐÃ KẾT THÚC",
    payment_pending: "CHỜ THANH TOÁN",
    completed: "ĐÃ HOÀN TẤT",
    cancelled: "ĐÃ HỦY",
  };

  return map[normalizeStatusKey(status)] || "ĐANG CẬP NHẬT";
}

function formatBidTime(value) {
  if (!value) return "Vừa xong";

  const time = new Date(value).getTime();

  if (Number.isNaN(time)) return String(value);

  const diffMs = Math.max(0, Date.now() - time);
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "Vừa xong";
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;

  return `${Math.floor(diffHours / 24)} ngày trước`;
}

function normalizeAuction(rawAuction) {
  const id = rawAuction.id;
  const image = rawAuction.imageUrl || rawAuction.image_url || getFallbackImage(id);
  const title = rawAuction.title || rawAuction.productName || rawAuction.product_name || "Vật phẩm chưa đặt tên";
  const currentPrice = Number(rawAuction.currentPrice || rawAuction.current_price || 0);
  const stepPrice = Number(rawAuction.stepPrice || rawAuction.step_price || 0);

  const bidHistory = Array.isArray(rawAuction.bidHistory)
    ? rawAuction.bidHistory.map((bid, index) => ({
        id: bid.id || `${id}-${index}`,
        bidder: bid.bidder || "B***R",
        amount: Number(bid.amount || bid.bid_amount || 0),
        time: formatBidTime(bid.time || bid.created_at),
        highlight: index === 0 || Boolean(bid.highlight),
      }))
    : [];

  return {
    id,
    lot: rawAuction.lot || `Lô #${String(id).padStart(3, "0")}`,
    title,
    description: rawAuction.description || "Thông tin chi tiết đang được chuẩn bị bởi đội ngũ chuyên gia.",
    provenance: rawAuction.sellerUsername
      ? `Người đăng: ${rawAuction.sellerUsername}. Hồ sơ chứng thực đang được hệ thống lưu trữ.`
      : "Thông tin nguồn gốc sẽ được cập nhật sau khi xác minh.",
    condition: rawAuction.condition || "Báo cáo tình trạng sẽ được cập nhật sau khi hồ sơ hoàn tất.",
    status: rawAuction.status || "Active",
    currentBid: currentPrice,
    startingPrice: currentPrice,
    increment: stepPrice || 1000,
    endTime: new Date(rawAuction.endTime || rawAuction.end_time || Date.now()).getTime(),
    activeBids: Number(rawAuction.bidCount || rawAuction.bid_count || bidHistory.length || 0),

    createdBy: rawAuction.createdBy || rawAuction.created_by,
    requiresDeposit: Boolean(rawAuction.requiresDeposit ?? rawAuction.requires_deposit),
    depositAmount: Number(rawAuction.depositAmount || rawAuction.deposit_amount || 0),
    userDeposit: rawAuction.userDeposit || rawAuction.user_deposit || null,
    canBid: Boolean(rawAuction.canBid),

    images: [image, ...FALLBACK_IMAGES.filter((fallbackImage) => fallbackImage !== image)].slice(0, 4),
    bidHistory,
  };
}

function getMinimumBid() {
  if (!auction) return 0;
  return Number(auction.currentBid || 0) + Number(auction.increment || 0);
}

function showToast(title, message, type = "info") {
  if (!elements.toastStack) return;

  const toast = document.createElement("article");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <p class="toast-title">${title}</p>
    <p class="toast-message">${message}</p>
  `;

  elements.toastStack.appendChild(toast);

  window.setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-6px)";
  }, 3200);

  window.setTimeout(() => toast.remove(), 3800);
}

function getCurrentUser() {
  return apiClient.getAuthUser();
}

function isLoggedIn() {
  return Boolean(apiClient.getAuthToken() && getCurrentUser());
}

function getActiveImage() {
  return auction?.images?.[activeImageIndex] || auction?.images?.[0] || FALLBACK_IMAGES[0];
}

function setActiveImage(index) {
  if (!auction) return;

  activeImageIndex = Math.max(0, Math.min(index, auction.images.length - 1));
  const image = getActiveImage();

  if (elements.mainImage) elements.mainImage.src = image;
  if (elements.lightboxImage) elements.lightboxImage.src = image;

  elements.thumbnailGrid?.querySelectorAll("[data-thumbnail-index]").forEach((button) => {
    button.classList.toggle("is-active", Number(button.dataset.thumbnailIndex) === activeImageIndex);
  });
}

function renderGallery() {
  if (!elements.thumbnailGrid || !auction) return;

  elements.thumbnailGrid.innerHTML = auction.images
    .map(
      (img, index) => `
        <button
          type="button"
          class="thumbnail-button ${index === activeImageIndex ? "is-active" : ""}"
          data-thumbnail-index="${index}"
          aria-label="Ảnh ${index + 1}"
        >
          <img src="${img}" alt="Ảnh thu nhỏ ${index + 1}" />
        </button>
      `,
    )
    .join("");

  elements.thumbnailGrid.querySelectorAll("[data-thumbnail-index]").forEach((button) => {
    button.addEventListener("click", () => setActiveImage(Number(button.dataset.thumbnailIndex)));
  });

  setActiveImage(0);
}

function openLightbox() {
  if (!auction || !elements.lightbox) return;

  elements.lightbox.hidden = false;
  document.body.classList.add("is-menu-open");

  if (elements.lightboxImage) {
    elements.lightboxImage.src = getActiveImage();
  }
}

function closeLightbox() {
  if (!elements.lightbox) return;

  elements.lightbox.hidden = true;
  document.body.classList.remove("is-menu-open");
}

function showPreviousImage() {
  if (!auction) return;

  const nextIndex = activeImageIndex === 0 ? auction.images.length - 1 : activeImageIndex - 1;
  setActiveImage(nextIndex);
}

function showNextImage() {
  if (!auction) return;

  const nextIndex = activeImageIndex === auction.images.length - 1 ? 0 : activeImageIndex + 1;
  setActiveImage(nextIndex);
}

function renderProductCopy() {
  if (!auction) return;

  const label = getStatusLabel(auction.status);

  if (elements.statusLabel) elements.statusLabel.textContent = label;
  if (elements.liveChip) elements.liveChip.textContent = label;
  if (elements.lotLabel) elements.lotLabel.textContent = auction.lot;
  if (elements.productTitle) elements.productTitle.textContent = auction.title;
  if (elements.productDescription) elements.productDescription.textContent = auction.description;
  if (elements.provenance) elements.provenance.textContent = auction.provenance;
  if (elements.condition) elements.condition.textContent = auction.condition;
  if (elements.startingPrice) elements.startingPrice.textContent = formatMoney(auction.startingPrice);
  if (elements.increment) elements.increment.textContent = formatMoney(auction.increment);
}

function renderBidPanel() {
  if (!auction) return;

  const minimumBid = getMinimumBid();

  if (elements.currentBid) elements.currentBid.textContent = formatMoney(auction.currentBid);
  if (elements.minimumBid) elements.minimumBid.textContent = `Giá tối thiểu: ${formatMoney(minimumBid)}`;
  if (elements.activeBids) elements.activeBids.textContent = `${auction.activeBids} LƯỢT GIÁ`;

  if (elements.bidInput) {
    elements.bidInput.placeholder = String(minimumBid);
    elements.bidInput.min = String(minimumBid);
    elements.bidInput.step = String(auction.increment);
  }
}

function renderBidHistory() {
  if (!elements.bidHistory || !auction) return;

  if (auction.bidHistory.length === 0) {
    elements.bidHistory.innerHTML = `
      <div class="bid-history-row">
        <span class="bidder-mask">Chưa có lượt giá</span>
        <span>-</span>
        <span>-</span>
      </div>
    `;
    return;
  }

  elements.bidHistory.innerHTML = auction.bidHistory
    .map(
      (bid) => `
        <div class="bid-history-row">
          <span class="bidder-mask">${bid.bidder}</span>
          <span class="${bid.highlight ? "bid-amount-highlight" : ""}">${formatMoney(bid.amount)}</span>
          <span>${bid.time}</span>
        </div>
      `,
    )
    .join("");
}

function buildBidFormContent() {
  const minimumBid = getMinimumBid();

  return `
    <label class="bid-input-field">
      <span>Nhập mức giá của bạn</span>
      <input
        type="number"
        min="${minimumBid}"
        step="${auction.increment}"
        placeholder="${minimumBid}"
        data-bid-input
      />
    </label>

    <button type="submit" class="button button-primary" style="width: 100%;">
      ĐẶT GIÁ NGAY
    </button>

    <p style="margin: 12px 0 0; color: var(--text-muted); font-size: 12px; line-height: 1.5;">
      Giá tối thiểu: <strong>${formatMoney(minimumBid)}</strong>
    </p>
  `;
}

function renderBidAccess() {
  if (!elements.bidForm || !auction) return;

  const statusKey = normalizeStatusKey(auction.status);
  const currentUser = getCurrentUser();
  const isOwner = currentUser && Number(currentUser.id) === Number(auction.createdBy);
  const depositStatus = auction.userDeposit?.status || null;

  if (!isLoggedIn()) {
    elements.bidForm.innerHTML = `
      <button type="button" class="button button-primary" data-login-to-bid style="width: 100%;">
        ĐĂNG NHẬP ĐỂ THAM GIA ĐẤU GIÁ
      </button>
      <p style="margin: 12px 0 0; color: var(--text-muted); font-size: 12px; line-height: 1.5;">
        Bạn có thể xem phiên đấu giá, nhưng cần đăng nhập và đặt cọc để trả giá.
      </p>
    `;

    elements.bidForm.querySelector("[data-login-to-bid]")?.addEventListener("click", () => {
      const currentUrl = `${window.location.pathname}${window.location.search}`;
      window.location.href = `./login.html?redirect=${encodeURIComponent(currentUrl)}`;
    });

    return;
  }

  if (isOwner) {
    elements.bidForm.innerHTML = `
      <p style="text-align: center; color: var(--text-muted);">
        Bạn là người tạo phiên này nên không thể tự tham gia trả giá.
      </p>
    `;
    return;
  }

  if (statusKey !== "active") {
    elements.bidForm.innerHTML = `
      <p style="text-align: center; color: var(--text-muted);">
        Phiên hiện ở trạng thái <strong>${getStatusLabel(auction.status)}</strong>, chưa thể đặt giá.
      </p>
    `;
    return;
  }

  if (auction.requiresDeposit && depositStatus !== "SUCCEEDED") {
    elements.bidForm.innerHTML = `
      <div style="display: grid; gap: 14px;">
        <div style="padding: 16px; border: 1px solid var(--border); background: var(--surface);">
          <p class="eyebrow" style="margin-bottom: 8px;">Điều kiện tham gia</p>
          <h3 style="margin: 0 0 8px;">Cần đặt cọc ${formatMoney(auction.depositAmount)}</h3>
          <p style="margin: 0; color: var(--text-muted); line-height: 1.5;">
            Người thua sẽ được hoàn cọc về tài khoản. Người thắng được trừ cọc vào khoản thanh toán cuối.
          </p>
        </div>

        <button type="button" class="button button-primary" data-place-deposit style="width: 100%;">
          ĐẶT CỌC ĐỂ THAM GIA
        </button>
      </div>
    `;

    elements.bidForm.querySelector("[data-place-deposit]")?.addEventListener("click", handlePlaceDeposit);
    return;
  }

  elements.bidForm.innerHTML = buildBidFormContent();
  elements.bidInput = elements.bidForm.querySelector("[data-bid-input]");
}

function renderAuction() {
  renderGallery();
  renderProductCopy();
  renderBidPanel();
  renderBidHistory();
  renderBidAccess();
}

function updateCountdown() {
  if (!auction) return;

  const distance = Math.max(0, auction.endTime - Date.now());
  const totalSeconds = Math.floor(distance / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (elements.hours) elements.hours.textContent = formatTwoDigits(hours);
  if (elements.minutes) elements.minutes.textContent = formatTwoDigits(minutes);
  if (elements.seconds) elements.seconds.textContent = formatTwoDigits(seconds);

  if (distance <= 0 && normalizeStatusKey(auction.status) === "active") {
    auction.status = "Ended";
    renderProductCopy();
    renderBidAccess();
  }
}

function updateUIWithNewBid(data) {
  if (!auction) return;

  const eventAuctionId = Number(data.auctionId || data.auction_id);

  if (eventAuctionId && eventAuctionId !== Number(auction.id)) {
    return;
  }

  const nextAmount = Number(data.bidAmount || data.price || data.amount || 0);

  if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
    return;
  }

  auction.currentBid = nextAmount;
  auction.activeBids += 1;

  auction.bidHistory.forEach((bid) => {
    bid.highlight = false;
  });

  auction.bidHistory.unshift({
    id: `${Date.now()}`,
    bidder: data.bidder || "Ẩn danh",
    amount: nextAmount,
    time: "Vừa xong",
    highlight: true,
  });

  auction.bidHistory = auction.bidHistory.slice(0, 10);

  renderBidPanel();
  renderBidHistory();
  renderBidAccess();

  if (elements.currentBid) {
    elements.currentBid.style.color = "var(--success)";
    elements.currentBid.style.transform = "scale(1.04)";
    elements.currentBid.style.transition = "all 240ms ease";

    window.setTimeout(() => {
      elements.currentBid.style.color = "";
      elements.currentBid.style.transform = "";
    }, 700);
  }
}

function bindSocketEvents() {
  if (!window.socketClient || !auction) {
    return;
  }

  window.socketClient.connect(auction.id);

  window.socketClient.on("new_bid", updateUIWithNewBid);

  window.socketClient.on("auction_extended", (data) => {
    const parsedEndTime = new Date(data.newEndTime || data.end_time).getTime();

    if (!Number.isNaN(parsedEndTime) && parsedEndTime > auction.endTime) {
      auction.endTime = parsedEndTime;
      updateCountdown();
      showToast("Cộng giờ tự động", "Phiên đấu giá được gia hạn để chống sniping.", "info");
    }
  });

  window.socketClient.on("fraud_detected", () => {
    showToast("Cảnh báo an ninh", "Hệ thống đã ghi nhận tín hiệu bất thường trong phiên này.", "warning");
  });

  window.socketClient.on("auction_winner", (data) => {
    const currentUser = getCurrentUser();

    if (currentUser && String(currentUser.id) === String(data.userId || data.user_id)) {
      showToast("Bạn đã thắng phiên đấu giá", "Hãy hoàn tất thanh toán phần còn lại để nhận tài sản.", "success");
      elements.bidForm.innerHTML = `
        <div style="display: grid; gap: 14px; text-align: center;">
          <h3 style="color: var(--success); margin: 0;">
            Bạn đã thắng với giá ${formatMoney(data.amount || auction.currentBid)}
          </h3>
          <a href="${data.paymentUrl || `./checkout.html?auctionId=${auction.id}`}" class="button button-primary">
            Thanh Toán Ngay
          </a>
        </div>
      `;
      return;
    }

    showToast("Phiên đã kết thúc", "Phiên đấu giá đã khép lại.", "info");
    renderBidAccess();
  });
}

async function handlePlaceDeposit() {
  if (!auction) return;

  if (!isLoggedIn()) {
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    window.location.href = `./login.html?redirect=${encodeURIComponent(currentUrl)}`;
    return;
  }

  const ok = window.confirm(`Xác nhận đặt cọc ${formatMoney(auction.depositAmount)} để tham gia phiên này?`);

  if (!ok) return;

  try {
    const response = await apiClient.post(`/auctions/${auction.id}/deposit`, {});

    auction.userDeposit = response.data?.deposit || {
      status: "SUCCEEDED",
      amount: auction.depositAmount,
    };

    auction.canBid = true;

    showToast("Đặt cọc thành công", response.message || "Bạn đã đủ điều kiện tham gia trả giá.", "success");
    renderBidAccess();
  } catch (error) {
    showToast("Không thể đặt cọc", error.message || "Vui lòng thử lại sau.", "error");
  }
}

async function handleManualBid(event) {
  event.preventDefault();

  if (!auction) {
    showToast("Đang tải", "Vui lòng chờ dữ liệu tải xong.", "warning");
    return;
  }

  if (!isLoggedIn()) {
    renderBidAccess();
    return;
  }

  const input = elements.bidForm?.querySelector("[data-bid-input]");
  const rawValue = String(input?.value || "").replace(/[^0-9.]/g, "");
  const bidValue = Number(rawValue);
  const minimumBid = getMinimumBid();

  if (!Number.isFinite(bidValue) || bidValue < minimumBid) {
    showToast("Lượt giá bị từ chối", `Giá đặt phải lớn hơn hoặc bằng ${formatMoney(minimumBid)}.`, "warning");
    return;
  }

  const controls = elements.bidForm.querySelectorAll("button, input");
  controls.forEach((control) => {
    control.disabled = true;
  });

  try {
    const response = await apiClient.post(`/auctions/${auction.id}/bids`, {
      bidAmount: bidValue,
    });

    showToast("Đặt giá thành công", response.message || "Lượt giá đã được ghi nhận.", "success");

    if (input) input.value = "";
  } catch (error) {
    if (error.errorCode === "ERR_DEPOSIT_REQUIRED") {
      auction.canBid = false;
      auction.userDeposit = null;
      renderBidAccess();
      showToast("Cần đặt cọc", error.message || "Bạn cần đặt cọc trước khi trả giá.", "warning");
      return;
    }

    showToast("Không thể đặt giá", error.message || "Vui lòng thử lại sau.", "error");
  } finally {
    controls.forEach((control) => {
      control.disabled = false;
    });
  }
}

function disableDemoControls() {
  elements.simulateBid?.addEventListener("click", () => {
    showToast("Đã dùng dữ liệu thật", "Hãy mở tài khoản thứ hai để test real-time.", "info");
  });

  elements.simulateSoftClose?.addEventListener("click", () => {
    showToast("Đã dùng dữ liệu thật", "Gia hạn thời gian sẽ đến từ Backend/AI.", "info");
  });
}

function bindEvents() {
  elements.bidForm?.addEventListener("submit", handleManualBid);

  disableDemoControls();

  elements.galleryFrame?.addEventListener("click", openLightbox);

  elements.galleryFrame?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openLightbox();
    }
  });

  elements.lightboxClose?.addEventListener("click", closeLightbox);
  elements.lightboxPrev?.addEventListener("click", showPreviousImage);
  elements.lightboxNext?.addEventListener("click", showNextImage);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeLightbox();
    }
  });
}

async function loadAuctionDetail() {
  const auctionId = getAuctionIdFromUrl();

  if (!auctionId) {
    showToast("Thiếu ID", "Không tìm thấy ID phiên đấu giá trên URL.", "error");
    return;
  }

  try {
    const response = await apiClient.get(`/auctions/${auctionId}`, null, {
      auth: true,
      idempotency: false,
      redirectOnUnauthorized: false,
    });

    const rawAuction = response.data?.auction;

    if (!rawAuction) {
      throw new Error("Backend không trả về dữ liệu phiên đấu giá.");
    }

    auction = normalizeAuction(rawAuction);

    renderAuction();
    updateCountdown();

    if (countdownInterval) window.clearInterval(countdownInterval);
    countdownInterval = window.setInterval(updateCountdown, 1000);

    bindSocketEvents();
  } catch (error) {
    showToast("Không thể tải phiên", error.message || "Không thể lấy thông tin từ Backend.", "error");
  }
}

function initAuctionDetailPage() {
  initTheme();

  initSiteHeader({
    hideAfter: 120,
    topRevealOffset: 12,
  });

  cacheElements();
  bindEvents();
  loadAuctionDetail();
}

document.addEventListener("DOMContentLoaded", initAuctionDetailPage);
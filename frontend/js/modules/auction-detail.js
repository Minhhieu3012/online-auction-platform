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
let depositStatusObj = null; // Quản lý state đặt cọc của user hiện tại
let activeImageIndex = 0;
let countdownInterval = null;

const elements = {};

function cacheElements() {
  elements.mainImage = document.querySelector("[data-main-image]");
  elements.thumbnailGrid = document.querySelector("[data-thumbnail-grid]");
  elements.currentBid = document.querySelector("[data-current-bid]");
  elements.minimumBid = document.querySelector("[data-minimum-bid]");
  elements.bidInput = document.querySelector("[data-bid-input]");
  
  // Các panel điều hướng flow
  elements.bidForm = document.querySelector("[data-bid-form]");
  elements.depositPanel = document.querySelector("[data-deposit-panel]");
  elements.depositActionBtn = document.querySelector("[data-deposit-action-btn]");
  elements.winnerPanel = document.querySelector("[data-winner-panel]");
  
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
  elements.depositAmount = document.querySelector("[data-deposit-amount]");
  elements.depositInfoBox = document.querySelector("[data-deposit-info-box]");

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
    completed: "ĐĐÃ HOÀN TẤT",
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
  const depositAmount = Number(rawAuction.depositAmount || rawAuction.deposit_amount || 0);

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
    condition: rawAuction.condition || "Báo cáo tình trạng sẽ được đồng bộ khi hồ sơ sản phẩm hoàn tất.",
    status: rawAuction.status || "Active",
    rawStatus: normalizeStatusKey(rawAuction.status),
    currentBid: currentPrice,
    startingPrice: currentPrice,
    increment: stepPrice || 1000,
    depositAmount,
    requiresDeposit: Boolean(rawAuction.requiresDeposit ?? rawAuction.requires_deposit),
    endTime: new Date(rawAuction.endTime || rawAuction.end_time || Date.now()).getTime(),
    activeBids: Number(rawAuction.bidCount || rawAuction.bid_count || bidHistory.length || 0),

    createdBy: rawAuction.createdBy || rawAuction.created_by,
    winnerId: rawAuction.winnerId || rawAuction.winner_id || null,
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

function setBidFormBusy(isBusy) {
  const controls = elements.bidForm?.querySelectorAll("button, input") || [];
  const submitButton = elements.bidForm?.querySelector("[type='submit']");
  const depositBtn = elements.depositActionBtn;

  controls.forEach((control) => {
    control.disabled = isBusy;
  });
  
  if (depositBtn) {
    depositBtn.disabled = isBusy;
    if (isBusy) {
      depositBtn.dataset.originalText = depositBtn.textContent.trim();
      depositBtn.textContent = "Đang xử lý...";
    } else {
      depositBtn.textContent = depositBtn.dataset.originalText || "Thanh Toán Tiền Cọc";
    }
  }

  if (!submitButton) return;

  if (isBusy) {
    submitButton.dataset.originalText = submitButton.textContent.trim();
    submitButton.textContent = "Đang xử lý...";
    return;
  }

  submitButton.textContent = submitButton.dataset.originalText || "ĐẶT GIÁ NGAY";
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

  const statusLabelText = getStatusLabel(auction.status);

  if (elements.statusLabel) elements.statusLabel.textContent = statusLabelText;
  if (elements.liveChip) elements.liveChip.textContent = statusLabelText;
  if (elements.lotLabel) elements.lotLabel.textContent = auction.lot;
  if (elements.productTitle) elements.productTitle.textContent = auction.title;
  if (elements.productDescription) elements.productDescription.textContent = auction.description;
  if (elements.provenance) elements.provenance.textContent = auction.provenance;
  if (elements.condition) elements.condition.textContent = auction.condition;
  if (elements.startingPrice) elements.startingPrice.textContent = formatMoney(auction.startingPrice);
  if (elements.increment) elements.increment.textContent = formatMoney(auction.increment);

  if (auction.requiresDeposit) {
    if (elements.depositInfoBox) elements.depositInfoBox.hidden = false;
    if (elements.depositAmount) elements.depositAmount.textContent = formatMoney(auction.depositAmount);
  } else {
    if (elements.depositInfoBox) elements.depositInfoBox.hidden = true;
  }

  if (elements.mainImage) {
    elements.mainImage.alt = auction.title;
  }
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
// --- LOGIC PHÂN QUYỀN GIAO DIỆN CHÍNH ---
function renderActionPanel() {
  if (!auction) return;

  const isEnded = auction.endTime <= Date.now() || ["ended", "payment_pending", "completed"].includes(auction.rawStatus);
  const isGuest = !isLoggedIn();
  const currentUser = getCurrentUser();
  const isOwner = currentUser && Number(currentUser.id) === Number(auction.createdBy);

  // 1. Đấu giá kết thúc
  if (isEnded) {
    if (elements.bidForm) elements.bidForm.hidden = true;
    if (elements.depositPanel) elements.depositPanel.hidden = true;
    if (elements.winnerPanel) elements.winnerPanel.hidden = false;

    if (isGuest || isOwner) {
      elements.winnerPanel.innerHTML = `
        <h3 style="margin-bottom: 10px;">Phiên đấu giá đã kết thúc.</h3>
        <p>Giá chốt: <strong>${formatMoney(auction.currentBid)}</strong></p>
      `;
      return;
    }

    if (String(auction.winnerId) === String(currentUser.id)) {
      elements.winnerPanel.innerHTML = `
        <h3 style="color: var(--success); margin-bottom: 10px;">🎉 BẠN ĐÃ CHIẾN THẮNG</h3>
        <p>Giá thắng: ${formatMoney(auction.currentBid)}</p>
        <p>Tiền cọc đã cấn trừ: ${formatMoney(auction.depositAmount)}</p>
        <hr style="border-color: rgba(255,255,255,0.1); margin: 10px 0;">
        <p style="font-weight:bold;">Cần thanh toán: ${formatMoney(Math.max(0, auction.currentBid - auction.depositAmount))}</p>
        <button class="button button-primary" style="margin-top: 15px;" onclick="location.reload()">Kiểm Tra Nút Thanh Toán</button>
      `;
    } else {
      let refundText = depositStatusObj?.status === 'REFUNDED' ? "Tiền cọc đã được hoàn thành công." : "Tiền cọc của bạn đang được hoàn lại.";
      elements.winnerPanel.innerHTML = `
        <h3 style="color: var(--text-muted); margin-bottom: 10px;">Bạn không thắng phiên này</h3>
        ${depositStatusObj && depositStatusObj.status !== 'NONE' ? `<p style="color: var(--warning);">${refundText}</p>` : ""}
      `;
    }
    return;
  }

  // 2. Đang diễn ra
  if (elements.winnerPanel) elements.winnerPanel.hidden = true;

  if (isGuest || isOwner) {
    if (elements.depositPanel) elements.depositPanel.hidden = true;
    if (elements.bidForm) {
      elements.bidForm.hidden = false;
      if (isGuest) {
        elements.bidForm.innerHTML = `
          <button type="button" class="button button-primary" onclick="window.location.href='./login.html'" style="width: 100%;">
            ĐĂNG NHẬP ĐỂ THAM GIA ĐẤU GIÁ
          </button>
          <p style="margin: 12px 0 0; color: var(--text-muted); font-size: 12px; line-height: 1.5; text-align: center;">
            Bạn có thể xem phiên đấu giá, nhưng cần đăng nhập để trả giá.
          </p>
        `;
      } else {
        elements.bidForm.innerHTML = `
          <p style="text-align: center; color: var(--text-muted);">
            Bạn là người tạo phiên này nên không thể tự tham gia trả giá.
          </p>
        `;
      }
    }
    return;
  }

  const currentDepositStatus = auction.userDeposit?.status || depositStatusObj?.status;

  if (auction.requiresDeposit && currentDepositStatus !== 'SUCCEEDED') {
    if (elements.bidForm) elements.bidForm.hidden = true;
    if (elements.depositPanel) elements.depositPanel.hidden = false;
    if (elements.depositActionBtn && currentDepositStatus === 'PENDING') {
      elements.depositActionBtn.textContent = "Tiếp Tục Thanh Toán Đặt Cọc";
    }
  } else {
    // Đã cọc hoặc không cần cọc -> Hiện form bid thật (do HTML load tĩnh đã có)
    if (elements.bidForm) elements.bidForm.hidden = false;
    if (elements.depositPanel) elements.depositPanel.hidden = true;
  }
}

function renderAuction() {
  renderGallery();
  renderProductCopy();
  renderBidPanel();
  renderBidHistory();
  renderActionPanel();
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
    auction.rawStatus = "ended";
    
    if (elements.statusLabel) {
      elements.statusLabel.textContent = "ĐÃ KẾT THÚC";
      elements.statusLabel.style.borderColor = "var(--danger)";
      elements.statusLabel.style.color = "var(--danger)";
    }

    if (elements.liveChip) {
      elements.liveChip.textContent = "ĐÃ KẾT THÚC";
      elements.liveChip.style.borderColor = "var(--danger)";
      elements.liveChip.style.color = "var(--danger)";
    }

    renderActionPanel(); 
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
    const eventAuctionId = Number(data.auctionId || data.auction_id);
    if (eventAuctionId && Number(auction.id) !== eventAuctionId) {
      return;
    }

    const currentUser = getCurrentUser();
    if (currentUser && String(currentUser.id) === String(data.userId || data.user_id)) {
      showToast("Bạn đã thắng phiên đấu giá", "Hãy hoàn tất thanh toán phần còn lại để nhận tài sản.", "success");
    } else {
      showToast("Phiên đã kết thúc", "Phiên đấu giá đã khép lại.", "info");
    }

    // Force reload page status on winner received
    auction.endTime = 0;
    auction.winnerId = data.userId || data.user_id;
    updateCountdown();
  });
}

// Xử lý tạo link thanh toán cọc qua Stripe
async function handleDepositClick() {
  if (!auction) return;
  setBidFormBusy(true);

  try {
    const res = await apiClient.post(`/auctions/${auction.id}/deposit`);
    if (res.data?.url) {
      window.location.href = res.data.url;
    } else if (res.data?.deposit) {
      // Fallback for mock backend mode
      auction.userDeposit = res.data.deposit;
      depositStatusObj = res.data.deposit;
      showToast("Đặt cọc thành công", "Bạn đã đủ điều kiện tham gia trả giá.", "success");
      renderActionPanel();
    }
  } catch (error) {
    showToast("Lỗi Khởi Tạo", error.message || "Không thể tạo phiên thanh toán", "error");
  } finally {
    setBidFormBusy(false);
  }
}

async function handleManualBid(event) {
  event.preventDefault();

  if (!auction) {
    showToast("Đang tải", "Vui lòng chờ dữ liệu tải xong.", "warning");
    return;
  }

  if (!isLoggedIn()) {
    renderActionPanel();
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

  setBidFormBusy(true);

  try {
    const response = await apiClient.post(`/auctions/${auction.id}/bids`, {
      bidAmount: bidValue,
    });

    showToast("Đặt giá thành công", response.message || "Lượt giá đã được ghi nhận.", "success");

    if (input) input.value = "";
  } catch (error) {
    if (error.errorCode === "ERR_DEPOSIT_REQUIRED") {
      auction.canBid = false;
      if (auction.userDeposit) auction.userDeposit.status = "NONE";
      if (depositStatusObj) depositStatusObj.status = "NONE";
      renderActionPanel();
      showToast("Cần đặt cọc", error.message || "Bạn cần đặt cọc trước khi trả giá.", "warning");
      return;
    }

    showToast("Không thể đặt giá", error.message || "Vui lòng thử lại sau.", "error");
  } finally {
    setBidFormBusy(false);
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
  if (elements.bidForm) elements.bidForm.addEventListener("submit", handleManualBid);
  if (elements.depositActionBtn) elements.depositActionBtn.addEventListener("click", handleDepositClick);
  if (elements.proxyToggle) elements.proxyToggle.addEventListener("change", handleProxyToggle);

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

function checkParamsURL() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("deposit") === "success") {
    showToast("Đặt Cọc Thành Công", "Chúc bạn may mắn trong phiên đấu giá!", "success");
    window.history.replaceState({}, document.title, window.location.pathname + "?id=" + auction.id);
  } else if (params.get("deposit") === "failed") {
    showToast("Thanh toán bị hủy", "Bạn chưa hoàn tất thanh toán tiền cọc.", "warning");
    window.history.replaceState({}, document.title, window.location.pathname + "?id=" + auction.id);
  }
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

    // Load Deposit Status song song nếu đã login
    if (isLoggedIn()) {
      try {
        const depRes = await apiClient.get(`/auctions/${auctionId}/deposit-status`);
        depositStatusObj = depRes.data;
        // Gắn luôn vào object auction để tiện dụng toàn cục
        auction.userDeposit = depositStatusObj;
      } catch (e) {
        console.warn("[Auction Detail] Lỗi load trạng thái cọc:", e);
      }
    }

    renderAuction();
    updateCountdown();
    checkParamsURL();

    if (countdownInterval) {
      window.clearInterval(countdownInterval);
    }

    countdownInterval = window.setInterval(updateCountdown, 1000);

    bindSocketEvents();
  } catch (error) {
    console.error("[Auction Detail] Không thể tải dữ liệu:", error);
    showToast("Không thể tải chi tiết", error.message || "Vui lòng kiểm tra Backend.", "error");
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
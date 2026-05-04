// frontend/js/modules/auction-detail.js
/**
 * Auction Detail Module
 * Đã kết hợp: Giao diện đầy đủ + Logic API Backend thật + Real-time Socket.io + Dịch TV
 */
import { initTheme } from "../core/theme.js";
import { initSiteHeader } from "../core/header.js";
import apiClient from "../core/api-client.js";

const FALLBACK_IMAGES = [
  "../assets/images/mockdata/1.png",
  "../assets/images/mockdata/2.png",
  "../assets/images/mockdata/3.png",
];

let auction = null;
let activeImageIndex = 0;
let countdownInterval = null;
const elements = {};

// --- HÀM TRỢ GIÚP (UI HELPERS) ---
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
  elements.proxyToggle = document.querySelector("[data-proxy-toggle]");
  elements.proxyMax = document.querySelector("[data-proxy-max]");
  elements.proxySettings = document.querySelector("[data-proxy-settings]");

  elements.statusLabel = document.querySelector("[data-status-label]");
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

function requireLoginForBid() {
  const token = apiClient.getAuthToken();
  const user = apiClient.getAuthUser();

  if (!token || !user) {
    showToast("Yêu Cầu Đăng Nhập", "Vui lòng đăng nhập trước khi đặt giá.", "warning");
    window.setTimeout(() => {
      const currentUrl = `${window.location.pathname}${window.location.search}`;
      window.location.href = `./login.html?redirect=${encodeURIComponent(currentUrl)}`;
    }, 1500);
    return false;
  }
  return true;
}

function setBidFormBusy(isBusy) {
  const controls = elements.bidForm?.querySelectorAll("button, input") || [];
  const submitButton = elements.bidForm?.querySelector("[type='submit']");

  controls.forEach((control) => {
    control.disabled = isBusy;
  });

  if (!submitButton) return;

  if (isBusy) {
    submitButton.dataset.originalText = submitButton.textContent.trim();
    submitButton.textContent = "Đang xử lý...";
    return;
  }
  submitButton.textContent = submitButton.dataset.originalText || "ĐẶT GIÁ NGAY";
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

function getFallbackImage(id) {
  const index = Math.abs(Number(id || 0)) % FALLBACK_IMAGES.length;
  return FALLBACK_IMAGES[index];
}

function normalizeStatus(status) {
  const statusMap = {
      active: "ĐANG DIỄN RA",
      scheduled: "ĐÃ LÊN LỊCH",
      closing: "SẮP ĐÓNG",
      ended: "ĐÃ KẾT THÚC",
      payment_pending: "CHỜ THANH TOÁN"
  };
  return statusMap[String(status).toLowerCase()] || "ĐANG DIỄN RA";
}

function formatBidTime(value) {
  if (!value) return "Vừa xong";
  const time = new Date(value).getTime();
  if (!time) return String(value);

  const diffMs = Math.max(0, Date.now() - time);
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "Vừa xong";
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} ngày trước`;
}

function normalizeAuction(rawAuction) {
  const id = rawAuction.id;
  const image = rawAuction.imageUrl || rawAuction.image_url || getFallbackImage(id);
  const title = rawAuction.title || rawAuction.productName || rawAuction.product_name || "Vật phẩm chưa đặt tên";
  const currentPrice = Number(rawAuction.currentPrice || rawAuction.current_price || 0);
  const stepPrice = Number(rawAuction.stepPrice || rawAuction.step_price || 0);

  const bidHistory = Array.isArray(rawAuction.bidHistory)
    ? rawAuction.bidHistory.map((bid, index) => ({
        bidder: bid.bidder || "B***R",
        amount: Number(bid.amount || bid.bid_amount || 0),
        time: formatBidTime(bid.time || bid.created_at),
        highlight: index === 0 || Boolean(bid.highlight),
      }))
    : [];

  return {
    id,
    lot: rawAuction.lot || `Lô #${String(id).padStart(3, "0")} • ${rawAuction.category || "Bộ Sưu Tập Tư Nhân"}`,
    title,
    description: rawAuction.description || "Thông tin chi tiết đang được chuẩn bị bởi đội ngũ chuyên gia.",
    provenance: rawAuction.sellerUsername
      ? `Người đăng: ${rawAuction.sellerUsername}. Các tài liệu chứng thực đang được kiểm duyệt.`
      : "Thông tin nguồn gốc sẽ được cập nhật sau khi chuyên gia xác minh.",
    condition: "Báo cáo tình trạng sẽ được đồng bộ trong bản cập nhật sau.",
    status: normalizeStatus(rawAuction.status),
    currentBid: currentPrice,
    startingPrice: currentPrice,
    increment: stepPrice || 1000,
    endTime: new Date(rawAuction.endTime || rawAuction.end_time || Date.now()).getTime(),
    activeBids: Number(rawAuction.bidCount || rawAuction.bid_count || bidHistory.length || 0),
    has360: false,
    images: [image, ...FALLBACK_IMAGES.filter((fallbackImage) => fallbackImage !== image)].slice(0, 3),
    bidHistory,
  };
}

function getMinimumBid() {
  return Math.round(auction.currentBid + auction.increment);
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

// --- LOGIC HÌNH ẢNH (GALLERY & LIGHTBOX) ---
function getActiveImage() {
  return auction.images[activeImageIndex] || auction.images[0];
}

function setActiveImage(index) {
  activeImageIndex = Math.max(0, Math.min(index, auction.images.length - 1));
  const image = getActiveImage();

  if (elements.mainImage) elements.mainImage.src = image;
  if (elements.lightboxImage) elements.lightboxImage.src = image;

  if (elements.thumbnailGrid) {
    elements.thumbnailGrid.querySelectorAll("[data-thumbnail-index]").forEach((button) => {
      const buttonIndex = Number(button.dataset.thumbnailIndex);
      button.classList.toggle("is-active", buttonIndex === activeImageIndex);
    });
  }
}

function renderGallery() {
  if (!elements.thumbnailGrid) return;
  elements.thumbnailGrid.innerHTML = auction.images
    .map(
      (img, index) => `
        <button
            type="button"
            class="thumbnail-button ${index === activeImageIndex ? "is-active" : ""}"
            data-thumbnail="${img}"
            data-thumbnail-index="${index}"
        >
            <img src="${img}" alt="Ảnh thu nhỏ ${index + 1}" />
        </button>
    `,
    ).join("");

  elements.thumbnailGrid.querySelectorAll(".thumbnail-button").forEach((btn) => {
    btn.addEventListener("click", () => setActiveImage(Number(btn.dataset.thumbnailIndex)));
  });
  setActiveImage(0);
}

function openLightbox() {
  if (!auction || !elements.lightbox) return;
  elements.lightbox.hidden = false;
  document.body.classList.add("is-menu-open");
  elements.lightboxImage.src = getActiveImage();
}

function closeLightbox() {
  if (!elements.lightbox) return;
  elements.lightbox.hidden = true;
  document.body.classList.remove("is-menu-open");
}

function showPreviousImage() {
  const nextIndex = activeImageIndex === 0 ? auction.images.length - 1 : activeImageIndex - 1;
  setActiveImage(nextIndex);
}

function showNextImage() {
  const nextIndex = activeImageIndex === auction.images.length - 1 ? 0 : activeImageIndex + 1;
  setActiveImage(nextIndex);
}

// --- LOGIC ĐẶT GIÁ THỜI GIAN THỰC (API & SOCKET.IO) ---
function updateUIWithNewBid(data) {
  auction.currentBid = Number(data.bidAmount || data.price || data.amount);
  auction.activeBids += 1;

  if (data.newEndTime) {
    const parsedEndTime = /^\d+$/.test(String(data.newEndTime))
      ? Number(data.newEndTime) : new Date(data.newEndTime).getTime();

    if (parsedEndTime > auction.endTime) {
      auction.endTime = parsedEndTime;
      updateCountdown();
      showToast("Gia hạn thời gian", "Có lượt trả giá phút chót! Hệ thống tự động kích hoạt tính năng Anti-Sniping.", "info");
    }
  }

  auction.bidHistory.forEach((b) => (b.highlight = false));
  auction.bidHistory.unshift({
    bidder: data.bidder || data.user_id || data.userId || "Ẩn danh",
    amount: auction.currentBid,
    time: "Vừa xong",
    highlight: true,
  });
  auction.bidHistory = auction.bidHistory.slice(0, 10);

  renderBidPanel();
  renderBidHistory();

  if (elements.currentBid) {
    elements.currentBid.classList.add("highlight-pulse");
    setTimeout(() => elements.currentBid.classList.remove("highlight-pulse"), 1000);
  }
}

function bindSocketEvents() {
  if (!window.socketClient) {
    console.warn("[Socket] Thư viện socketClient chưa được tải.");
    return;
  }

  window.socketClient.connect(auction.id);

  window.socketClient.on("new_bid", (data) => {
    updateUIWithNewBid(data);
  });

  window.socketClient.on("auction_extended", (data) => {
    const parsedEndTime = new Date(data.newEndTime || data.end_time).getTime();
    if (parsedEndTime > auction.endTime) {
      auction.endTime = parsedEndTime;
      updateCountdown();
      showToast("Cộng giờ tự động", `Hệ thống AI vừa cộng thêm thời gian để đảm bảo công bằng!`, "info");
    }
  });

  window.socketClient.on("fraud_detected", () => {
    showToast("Cảnh báo an ninh", "Phát hiện thao túng giá, hệ thống đã ghi nhận.", "warning");
  });

  window.socketClient.on("auction_winner", (data) => {
    const currentUser = window.apiClient.getAuthUser();

    if (currentUser && String(currentUser.id) === String(data.userId)) {
      showToast("🎉 BẠN ĐÃ THẮNG!", "Hãy tiến hành thanh toán để nhận tài sản.", "success");
      if (elements.bidForm) {
        elements.bidForm.innerHTML = `
                    <div style="text-align: center; margin-top: 15px;">
                        <h3 style="color: #4CAF50; margin-bottom: 10px;">Bạn đã thắng với giá $${data.amount}</h3>
                        <a href="${data.paymentUrl || './checkout.html'}" class="button is-primary is-large" style="width: 100%; background-color: #635bff; color: white;">
                            💳 Thanh Toán Stripe
                        </a>
                    </div>
                `;
      }
    } else {
      showToast("Đã Kết Thúc", "Phiên đấu giá đã khép lại.", "info");
      if (elements.bidForm) {
        elements.bidForm.innerHTML = `<p style="text-align: center; color: red;">Phiên đấu giá đã khép lại.</p>`;
      }
    }
  });
}

async function handleManualBid(event) {
  event.preventDefault();

  if (!auction) {
    showToast("Đang Tải", "Vui lòng chờ dữ liệu tải xong.");
    return;
  }

  if (!requireLoginForBid()) return;

  const rawValue = elements.bidInput.value.replace(/[^0-9.]/g, "");
  const bidValue = Number(rawValue);
  const minimumBid = getMinimumBid();

  if (!bidValue || bidValue < minimumBid) {
    showToast("Từ Chối Lượt Giá", `Giá trị phải lớn hơn hoặc bằng ${formatMoney(minimumBid)}`, "warning");
    return;
  }

  const proxyEnabled = elements.proxyToggle?.checked;
  const proxyMax = Number(elements.proxyMax?.value);

  if (proxyEnabled && (!proxyMax || proxyMax < bidValue)) {
    showToast("Lỗi Proxy", "Hạn mức Proxy phải cao hơn mức giá bạn nhập.", "warning");
    return;
  }

  setBidFormBusy(true);

  try {
    if (proxyEnabled) {
      await apiClient.post(`/auctions/${auction.id}/autobid`, { maxAmount: proxyMax });
      showToast("Đã bật Proxy", `Hệ thống sẽ thay bạn trả giá đến ngưỡng ${formatMoney(proxyMax)}.`);
    }

    const response = await apiClient.post(`/auctions/${auction.id}/bids`, {
      bidAmount: bidValue,
    });

    if (response.success) {
      showToast("Thành công", "Lệnh đã gửi vào Kafka. Đang chờ đồng bộ...", "success");
      elements.bidInput.value = "";
    }
  } catch (error) {
    showToast("Lỗi Hệ Thống", error.message || "Không thể đặt giá lúc này.", "error");
  } finally {
    setBidFormBusy(false);
  }
}

// --- RENDER COMPONENT ---
function renderProductCopy() {
  if (elements.statusLabel) elements.statusLabel.textContent = auction.status;
  if (elements.lotLabel) elements.lotLabel.textContent = auction.lot;
  if (elements.productTitle) elements.productTitle.textContent = auction.title;
  if (elements.productDescription) elements.productDescription.textContent = auction.description;
  if (elements.provenance) elements.provenance.textContent = auction.provenance;
  if (elements.condition) elements.condition.textContent = auction.condition;
  if (elements.startingPrice) elements.startingPrice.textContent = formatMoney(auction.startingPrice);
  if (elements.increment) elements.increment.textContent = formatMoney(auction.increment);
}

function renderBidPanel() {
  if (elements.currentBid) elements.currentBid.textContent = formatMoney(auction.currentBid);
  if (elements.minimumBid) elements.minimumBid.textContent = `Giá Tối Thiểu: ${formatMoney(getMinimumBid())}`;
  
  if (elements.bidInput) {
    elements.bidInput.placeholder = String(getMinimumBid());
    elements.bidInput.min = String(getMinimumBid());
    elements.bidInput.step = String(auction.increment);
  }
  if (elements.activeBids) elements.activeBids.textContent = `${auction.activeBids} LƯỢT GIÁ`;
}

function renderBidHistory() {
  if (!elements.bidHistory) return;

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
    ).join("");
}

function renderAuction() {
  renderGallery();
  renderProductCopy();
  renderBidPanel();
  renderBidHistory();
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
}

// --- SỰ KIỆN KHÁC ---
function handleProxyToggle() {
  if (elements.proxySettings && elements.proxyToggle) {
    elements.proxySettings.hidden = !elements.proxyToggle.checked;
  }
}

function simulateExternalBid() {
  if (!auction) return;
  showToast("Giả lập bị vô hiệu", "API Thật đã được kết nối. Hãy dùng tài khoản thứ 2 để test Real-time.");
}

function simulateSoftClose() {
  if (!auction) return;
  auction.endTime += 30 * 1000;
  updateCountdown();
  showToast("Cộng 30s", "Giả lập cộng giờ thành công.");
}

function bindEvents() {
  if (elements.bidForm) elements.bidForm.addEventListener("submit", handleManualBid);
  if (elements.proxyToggle) elements.proxyToggle.addEventListener("change", handleProxyToggle);
  if (elements.simulateBid) elements.simulateBid.addEventListener("click", simulateExternalBid);
  if (elements.simulateSoftClose) elements.simulateSoftClose.addEventListener("click", simulateSoftClose);

  if (elements.galleryFrame) {
    elements.galleryFrame.addEventListener("click", openLightbox);
    elements.galleryFrame.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openLightbox();
      }
    });
  }

  if (elements.lightboxClose) elements.lightboxClose.addEventListener("click", closeLightbox);
  if (elements.lightboxPrev) elements.lightboxPrev.addEventListener("click", showPreviousImage);
  if (elements.lightboxNext) elements.lightboxNext.addEventListener("click", showNextImage);
}

async function loadAuctionDetail() {
  const auctionId = getAuctionIdFromUrl();

  if (!auctionId) {
    showToast("Lỗi ID", "Không tìm thấy ID của phiên đấu giá trên URL.");
    return;
  }

  try {
    const response = await apiClient.get(`/auctions/${auctionId}`, null, { auth: false });
    auction = normalizeAuction(response.data?.auction);

    renderAuction();
    updateCountdown();

    if (countdownInterval) window.clearInterval(countdownInterval);
    countdownInterval = window.setInterval(updateCountdown, 1000);

    bindSocketEvents();
  } catch (error) {
    showToast("Lỗi Truy Xuất", error.message || "Không thể lấy thông tin từ Backend.", "error");
  }
}

function initAuctionDetailPage() {
  initTheme();
  initSiteHeader({ hideAfter: 120, topRevealOffset: 12 });
  cacheElements();
  bindEvents();
  loadAuctionDetail();
}

document.addEventListener("DOMContentLoaded", initAuctionDetailPage);
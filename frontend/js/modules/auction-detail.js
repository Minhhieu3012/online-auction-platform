/**
 * Auction Detail Module
 * Đã kết hợp: Giao diện đầy đủ (Countdown, History, Images, i18n) + Logic API thật + Real-time Socket.io
 */
import { initTheme } from "../core/theme.js";
import { initI18n, t, onLanguageChange } from "../core/i18n.js";
import { initSiteHeader } from "../core/header.js";
import apiClient from "../core/api-client.js";

const FALLBACK_IMAGES = [
    "../assets/images/mockdata/1.png",
    "../assets/images/mockdata/2.png",
    "../assets/images/mockdata/3.png"
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
    
    // Nút giả lập & Proxy
    elements.simulateBid = document.querySelector("[data-simulate-bid]");
    elements.simulateSoftClose = document.querySelector("[data-simulate-soft-close]");
    elements.proxyToggle = document.querySelector("[data-proxy-toggle]");
    elements.proxyMax = document.querySelector("[data-proxy-max]");
    elements.proxySettings = document.querySelector("[data-proxy-settings]");

    // UI & Detail info
    elements.statusLabel = document.querySelector("[data-status-label]");
    elements.lotLabel = document.querySelector("[data-lot-label]");
    elements.productTitle = document.querySelector("[data-product-title]");
    elements.productDescription = document.querySelector("[data-product-description]");
    elements.provenance = document.querySelector("[data-provenance]");
    elements.condition = document.querySelector("[data-condition]");
    elements.startingPrice = document.querySelector("[data-starting-price]");
    elements.increment = document.querySelector("[data-increment]");

    // Lightbox
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
        showToast("Login Required", "Please sign in before placing a bid.", "warning");

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

    if (!submitButton) {
        return;
    }

    if (isBusy) {
        submitButton.dataset.originalText = submitButton.textContent.trim();
        submitButton.textContent = "Placing Bid...";
        return;
    }

    submitButton.textContent = submitButton.dataset.originalText || "Place Bid Now";
}

function formatMoney(value) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0
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
    return String(status || "Active").trim();
}

function formatBidTime(value) {
    if (!value) return "Just now";

    const time = new Date(value).getTime();
    if (!time) return String(value);

    const diffMs = Math.max(0, Date.now() - time);
    const diffMinutes = Math.floor(diffMs / 60000);

    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    
    return `${diffDays}d ago`;
}

function normalizeAuction(rawAuction) {
    const id = rawAuction.id;
    const image = rawAuction.imageUrl || rawAuction.image_url || getFallbackImage(id);
    const title = rawAuction.title || rawAuction.productName || rawAuction.product_name || "Untitled Auction Lot";
    const currentPrice = Number(rawAuction.currentPrice || rawAuction.current_price || 0);
    const stepPrice = Number(rawAuction.stepPrice || rawAuction.step_price || 0);

    const bidHistory = Array.isArray(rawAuction.bidHistory)
        ? rawAuction.bidHistory.map((bid, index) => ({
            bidder: bid.bidder || "B***R",
            amount: Number(bid.amount || bid.bid_amount || 0),
            time: formatBidTime(bid.time || bid.created_at),
            highlight: index === 0 || Boolean(bid.highlight)
        }))
        : [];

    return {
        id,
        lot: rawAuction.lot || `Lot #${String(id).padStart(3, "0")} • ${rawAuction.category || "Private Collection"}`,
        title,
        description: rawAuction.description || "Auction detail is being prepared by the specialist team.",
        provenance: rawAuction.sellerUsername
            ? `Submitted by ${rawAuction.sellerUsername}. Additional provenance documents pending backend expansion.`
            : "Provenance information will be updated after specialist verification.",
        condition: "Condition report will be connected in a later backend scope.",
        status: normalizeStatus(rawAuction.status),
        currentBid: currentPrice,
        startingPrice: currentPrice,
        increment: stepPrice || 100,
        endTime: new Date(rawAuction.endTime || rawAuction.end_time || Date.now()).getTime(),
        activeBids: Number(rawAuction.bidCount || rawAuction.bid_count || bidHistory.length || 0),
        has360: false,
        images: [image, ...FALLBACK_IMAGES.filter((fallbackImage) => fallbackImage !== image)].slice(0, 3),
        bidHistory
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

    window.setTimeout(() => {
        toast.remove();
    }, 3800);
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
    
    elements.thumbnailGrid.innerHTML = auction.images.map((img, index) => `
        <button
            type="button"
            class="thumbnail-button ${index === activeImageIndex ? "is-active" : ""}"
            data-thumbnail="${img}"
            data-thumbnail-index="${index}"
        >
            <img src="${img}" alt="${auction.title} thumbnail ${index + 1}" />
        </button>
    `).join("");

    elements.thumbnailGrid.querySelectorAll(".thumbnail-button").forEach(btn => {
        btn.addEventListener("click", () => setActiveImage(Number(btn.dataset.thumbnailIndex)));
    });

    setActiveImage(0);
}

function openLightbox() {
    if (!auction || !elements.lightbox) return;
    elements.lightbox.hidden = false;
    document.body.classList.add("is-menu-open");
    elements.lightboxImage.src = getActiveImage();
    elements.lightboxImage.alt = `${auction.title} enlarged preview`;
    if (elements.lightboxCaption) {
        elements.lightboxCaption.textContent = auction.has360 ? t("detail.lightboxCaption360") : t("detail.lightboxCaption");
    }
}

function closeLightbox() {
    if (!elements.lightbox) return;
    elements.lightbox.hidden = true;
    document.body.classList.remove("is-menu-open");
    if (elements.lightboxFrame) elements.lightboxFrame.classList.remove("is-zooming");
    if (elements.lightboxImage) elements.lightboxImage.style.transformOrigin = "center";
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
    // 1. Cập nhật dữ liệu Auction cục bộ
    auction.currentBid = Number(data.bidAmount || data.price || data.amount);
    auction.activeBids += 1;

    // 2. Cập nhật thời gian nếu có Anti-sniping
    if (data.newEndTime) {
        const parsedEndTime = /^\d+$/.test(String(data.newEndTime))
            ? Number(data.newEndTime)
            : new Date(data.newEndTime).getTime();
        
        if (parsedEndTime > auction.endTime) {
            auction.endTime = parsedEndTime;
            updateCountdown();
            showToast("Phiên gia hạn", "Có người đặt giá phút chót, phiên đấu giá được cộng thêm thời gian!", "info");
        }
    }

    // 3. Thêm vào lịch sử hiển thị
    auction.bidHistory.forEach(b => b.highlight = false);
    auction.bidHistory.unshift({
        bidder: data.bidder || data.user_id || data.userId || "Anonymous",
        amount: auction.currentBid,
        time: "Just now",
        highlight: true
    });
    auction.bidHistory = auction.bidHistory.slice(0, 10);

    // 4. Render lại UI
    renderBidPanel();
    renderBidHistory();
    
    // 5. Hiệu ứng visual (từ nhánh dev)
    if (elements.currentBid) {
        elements.currentBid.classList.add("highlight-pulse");
        setTimeout(() => elements.currentBid.classList.remove("highlight-pulse"), 1000);
    }
}

function bindSocketEvents() {
    const socket = window.io ? window.io(CONFIG.API.BASE_URL.replace('/api', '')) : null;
    if (!socket) {
        console.warn("[Socket.io] Không tìm thấy thư viện Socket.io, Real-time có thể không hoạt động.");
        return;
    }

    socket.on('new_bid', (data) => {
        if (data.auctionId && Number(data.auctionId) === auction.id) {
            updateUIWithNewBid(data);
        }
    });

    socket.on('fraud_detected', () => {
        showToast("Cảnh báo an ninh", "Hệ thống AI phát hiện dấu hiệu mồi giá!", "warning");
    });
}

async function handleManualBid(event) {
    event.preventDefault();

    if (!auction) {
        showToast("Auction Loading", "Please wait until auction detail is loaded.");
        return;
    }

    if (!requireLoginForBid()) return;

    // LÀM SẠCH DỮ LIỆU: Loại bỏ ký tự lạ
    const rawValue = elements.bidInput.value.replace(/[^0-9.]/g, '');
    const bidValue = Number(rawValue);
    const minimumBid = getMinimumBid();

    if (!bidValue || bidValue < minimumBid) {
        showToast(t("toast.bidRejected"), t("toast.bidRejectedDesc", { amount: formatMoney(minimumBid) }), "warning");
        return;
    }

    const proxyEnabled = elements.proxyToggle?.checked;
    const proxyMax = Number(elements.proxyMax?.value);

    if (proxyEnabled && (!proxyMax || proxyMax < bidValue)) {
        showToast(t("toast.proxyInvalid"), t("toast.proxyInvalidDesc"), "warning");
        return;
    }

    setBidFormBusy(true);

    try {
        if (proxyEnabled) {
            await apiClient.post(`/auctions/${auction.id}/autobid`, { maxAmount: proxyMax });
            showToast("Proxy Enabled", `Proxy bidding limit set to ${formatMoney(proxyMax)}.`);
        }

        // GỌI API ĐẶT GIÁ
        const response = await apiClient.post(`/auctions/${auction.id}/bids`, {
            bidAmount: bidValue
        });

        if (response.success) {
            showToast("Thành công", "Giá thầu đã được gửi. Đang chờ hệ thống đồng bộ...", "success");
            elements.bidInput.value = "";
            
            // CHÚ Ý TỪ DEV: Ở môi trường thật, chúng ta không tự ý cập nhật UI (Optimistic Update)
            // mà sẽ nhường quyền đó lại cho Socket.io thông qua hàm updateUIWithNewBid() ở trên 
            // để đảm bảo tính nhất quán dữ liệu của Kafka phân tán.
        }
    } catch (error) {
        console.error("[Place Bid] Failed:", error);
        showToast("Bid Failed", error.message || "Cannot place bid right now.", "error");
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
    if (elements.minimumBid) elements.minimumBid.textContent = t("detail.minBid", { amount: formatMoney(getMinimumBid()) });
    if (elements.bidInput) {
        elements.bidInput.placeholder = String(getMinimumBid());
        elements.bidInput.min = String(getMinimumBid());
        elements.bidInput.step = String(auction.increment);
    }
    if (elements.activeBids) elements.activeBids.textContent = t("detail.activeBids", { count: auction.activeBids });
}

function renderBidHistory() {
    if (!elements.bidHistory) return;

    if (auction.bidHistory.length === 0) {
        elements.bidHistory.innerHTML = `
            <div class="bid-history-row">
                <span class="bidder-mask">No bids yet</span>
                <span>-</span>
                <span>-</span>
            </div>
        `;
        return;
    }

    elements.bidHistory.innerHTML = auction.bidHistory.map(bid => `
        <div class="bid-history-row">
            <span class="bidder-mask">${bid.bidder}</span>
            <span class="${bid.highlight ? "bid-amount-highlight" : ""}">${formatMoney(bid.amount)}</span>
            <span>${bid.time}</span>
        </div>
    `).join("");
}

function renderAuction() {
    renderGallery();
    renderProductCopy();
    renderBidPanel();
    renderBidHistory();

    const proxyInfoButton = document.querySelector(".proxy-info-button");
    if (proxyInfoButton) {
        proxyInfoButton.dataset.tooltip = t("detail.proxyTooltip");
    }
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
        if (elements.proxyToggle.checked) {
            showToast(t("toast.proxyEnabled"), t("toast.proxyEnabledDesc"));
        }
    }
}

function simulateExternalBid() {
    if (!auction) return;
    showToast("Simulation Disabled", "External bids should now be tested through another logged-in account (Real API is connected).");
}

function simulateSoftClose() {
    if (!auction) return;
    // Chỉ hoạt động giả lập cho môi trường dev
    auction.endTime += 30 * 1000;
    updateCountdown();
    showToast(t("toast.auctionExtended"), t("toast.auctionExtendedDesc"));
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
        showToast("Missing Auction", "No auction ID was provided in the URL.");
        return;
    }

    try {
        const response = await apiClient.get(`/auctions/${auctionId}`, null, {
            auth: false
        });

        auction = normalizeAuction(response.data?.auction);

        renderAuction();
        updateCountdown();

        if (countdownInterval) {
            window.clearInterval(countdownInterval);
        }

        countdownInterval = window.setInterval(updateCountdown, 1000);
        
        // Bật Socket sau khi đã lấy xong chi tiết sản phẩm
        bindSocketEvents();

    } catch (error) {
        console.error("[Auction Detail] Cannot load auction:", error);
        showToast("Auction Load Failed", error.message || "Cannot load auction detail from backend.", "error");
    }
}

function initAuctionDetailPage() {
    initTheme();
    initI18n();
    initSiteHeader({ hideAfter: 120, topRevealOffset: 12 });
    cacheElements();
    bindEvents();
    
    // Khởi chạy lấy dữ liệu từ Backend thật
    loadAuctionDetail();

    onLanguageChange(() => {
        if (auction) {
            renderAuction();
        }
    });
}

document.addEventListener("DOMContentLoaded", initAuctionDetailPage);
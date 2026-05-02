/**
 * Auction Detail Module: Giai đoạn 4 - Bidding API Bridge (Integrated)
 * Kết hợp logic API Bridge vào cấu trúc UI chuyên nghiệp.
 */

import { initTheme } from "../core/theme.js";
import { initI18n, t, onLanguageChange } from "../core/i18n.js";
import { initSiteHeader } from "../core/header.js";

const AUCTIONS = {
    842: {
        id: 842,
        lot: "Lot #842 • Private Collection",
        title: "The Midnight Chronograph 'Trinity' Edition",
        description:
            "A singular masterpiece of horological engineering, the Midnight Chronograph represents the pinnacle of 21st-century artisanal watchmaking. Commissioned in 2021 as a one-off prototype, this timepiece features a unique hand-skeletonized movement housed in a case of brushed Grade 5 titanium with warm gold inlay.",
        provenance: "Acquired from a private Swiss estate. First time appearing at public auction.",
        condition: "Mint condition, original documentation and presentation case included.",
        status: "Live Now",
        currentBid: 285000,
        startingPrice: 145000,
        increment: 5000,
        endTime: Date.now() + 4 * 60 * 60 * 1000 + 12 * 60 * 1000 + 48 * 1000,
        activeBids: 24,
        has360: true,
        images: [
            "../assets/images/mockdata/1.png",
            "../assets/images/mockdata/2.png",
            "../assets/images/mockdata/3.png"
        ],
        bidHistory: [
            { bidder: "J***S", amount: 285000, time: "2m ago", highlight: true },
            { bidder: "A***K", amount: 280000, time: "12m ago", highlight: false },
            { bidder: "M***D", amount: 275000, time: "45m ago", highlight: false },
            { bidder: "L***P", amount: 270000, time: "1h ago", highlight: false }
        ]
    },
    118: {
        id: 118,
        lot: "Lot #118 • Fine Art",
        title: "Fragmented Echo No. 4",
        description:
            "A contemporary abstract composition carrying layered mineral textures and a restrained visual rhythm. The piece belongs to a private modern art archive and enters public auction for the first time.",
        provenance: "Private collection, Singapore. Acquired directly from the artist studio.",
        condition: "Excellent condition with gallery certificate included.",
        status: "Live Now",
        currentBid: 38000,
        startingPrice: 22000,
        increment: 2000,
        endTime: Date.now() + 18 * 60 * 60 * 1000 + 42 * 60 * 1000,
        activeBids: 8,
        has360: false,
        images: [
            "../assets/images/mockdata/2.png",
            "../assets/images/mockdata/4.png",
            "../assets/images/mockdata/6.png"
        ],
        bidHistory: [
            { bidder: "R***N", amount: 38000, time: "4m ago", highlight: true },
            { bidder: "C***E", amount: 36000, time: "19m ago", highlight: false },
            { bidder: "T***A", amount: 34000, time: "33m ago", highlight: false }
        ]
    },
    883: {
        id: 883,
        lot: "Lot #883 • Automotive",
        title: "1962 GTO Heritage",
        description:
            "An automotive icon preserved in collector-grade condition, presented with careful documentation and period-correct detailing. A commanding lot designed for serious collectors.",
        provenance: "European private garage, climate-controlled ownership history.",
        condition: "Collector-grade preservation with verified inspection record.",
        status: "Live Now",
        currentBid: 3800000,
        startingPrice: 2400000,
        increment: 50000,
        endTime: Date.now() + 2 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000,
        activeBids: 42,
        has360: false,
        images: [
            "../assets/images/mockdata/3.png",
            "../assets/images/mockdata/5.png",
            "../assets/images/mockdata/1.png"
        ],
        bidHistory: [
            { bidder: "V***R", amount: 3800000, time: "1m ago", highlight: true },
            { bidder: "N***T", amount: 3750000, time: "8m ago", highlight: false },
            { bidder: "B***L", amount: 3700000, time: "22m ago", highlight: false }
        ]
    }
};

let auction = null;
let activeImageIndex = 0;
const elements = {};

// --- UTILS ---

function formatMoney(value) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0
    }).format(value);
}

function formatTwoDigits(value) {
    return String(value).padStart(2, "0");
}

function getMinimumBid() {
    return auction.currentBid + auction.increment;
}

// --- CORE RENDER ---

function cacheElements() {
    elements.mainImage = document.querySelector("[data-main-image]");
    elements.galleryFrame = document.querySelector("[data-gallery-frame]");
    elements.thumbnailGrid = document.querySelector("[data-thumbnail-grid]");
    elements.statusLabel = document.querySelector("[data-status-label]");
    elements.lotLabel = document.querySelector("[data-lot-label]");
    elements.productTitle = document.querySelector("[data-product-title]");
    elements.productDescription = document.querySelector("[data-product-description]");
    elements.provenance = document.querySelector("[data-provenance]");
    elements.condition = document.querySelector("[data-condition]");
    elements.startingPrice = document.querySelector("[data-starting-price]");
    elements.increment = document.querySelector("[data-increment]");
    elements.currentBid = document.querySelector("[data-current-bid]");
    elements.minimumBid = document.querySelector("[data-minimum-bid]");
    elements.bidInput = document.querySelector("[data-bid-input]");
    elements.bidForm = document.querySelector("[data-bid-form]");
    elements.proxyToggle = document.querySelector("[data-proxy-toggle]");
    elements.proxySettings = document.querySelector("[data-proxy-settings]");
    elements.proxyMax = document.querySelector("[data-proxy-max]");
    elements.bidHistory = document.querySelector("[data-bid-history]");
    elements.activeBids = document.querySelector("[data-active-bids]");
    elements.hours = document.querySelector("[data-countdown-hours]");
    elements.minutes = document.querySelector("[data-countdown-minutes]");
    elements.seconds = document.querySelector("[data-countdown-seconds]");
    elements.toastStack = document.querySelector("[data-toast-stack]");
    elements.simulateBid = document.querySelector("[data-simulate-bid]");
    elements.simulateSoftClose = document.querySelector("[data-simulate-soft-close]");

    elements.lightbox = document.querySelector("[data-image-lightbox]");
    elements.lightboxImage = document.querySelector("[data-lightbox-image]");
    elements.lightboxFrame = document.querySelector("[data-lightbox-frame]");
    elements.lightboxCaption = document.querySelector("[data-lightbox-caption]");
    elements.lightboxClose = document.querySelector("[data-lightbox-close]");
    elements.lightboxPrev = document.querySelector("[data-lightbox-prev]");
    elements.lightboxNext = document.querySelector("[data-lightbox-next]");
}

function showToast(title, message, type = "info") {
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

function renderBidPanel() {
    elements.currentBid.textContent = formatMoney(auction.currentBid);
    elements.minimumBid.textContent = t("detail.minBid", { amount: formatMoney(getMinimumBid()) });
    elements.bidInput.placeholder = String(getMinimumBid());
    elements.bidInput.min = String(getMinimumBid());
}

function renderBidHistory() {
    elements.bidHistory.innerHTML = auction.bidHistory.map(bid => `
        <div class="bid-history-row">
            <span class="bidder-mask">${bid.bidder}</span>
            <span class="${bid.highlight ? "bid-amount-highlight" : ""}">${formatMoney(bid.amount)}</span>
            <span>${bid.time}</span>
        </div>
    `).join("");
}

// --- CORE BIDDING LOGIC (API BRIDGE) ---

async function handleManualBid(event) {
    event.preventDefault();

    const bidValue = parseFloat(elements.bidInput.value);
    const minimumBid = getMinimumBid();

    // 1. Kiểm tra dữ liệu đầu vào
    if (!bidValue || isNaN(bidValue) || bidValue < minimumBid) {
        showToast(t("toast.bidRejected"), t("toast.bidRejectedDesc", { amount: formatMoney(minimumBid) }), "error");
        return;
    }

    const submitBtn = event.currentTarget.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
        /**
         * 2. API BRIDGE: Web -> Gọi API /auctions/:id/bids
         */
        const response = await window.apiClient.post(`/auctions/${auction.id}/bids`, { 
            bidAmount: bidValue 
        });

        if (response.success) {
            showToast("Bid Placed!", "Your offer has been broadcasted to the network.", "success");
            elements.bidInput.value = "";
            // UI sẽ được cập nhật tự động qua Socket
        } else {
            showToast("Bid Rejected", response.message || "An error occurred.", "warning");
        }
    } catch (error) {
        console.error("[Bidding Error]:", error);
        showToast("Connection Error", "The bidding bridge is temporarily down.", "error");
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

// --- SOCKET.IO & REAL-TIME LOGIC ---

function updateUIWithNewBid(data) {
    // Cập nhật dữ liệu cục bộ
    auction.currentBid = data.bidAmount;
    auction.activeBids += 1;

    // Cập nhật lịch sử
    auction.bidHistory.forEach(b => b.highlight = false);
    auction.bidHistory.unshift({
        bidder: data.bidder || "Anonymous",
        amount: data.bidAmount,
        time: "Just now",
        highlight: true
    });
    auction.bidHistory = auction.bidHistory.slice(0, 6);

    // Re-render các thành phần phụ thuộc
    renderBidPanel();
    renderBidHistory();
    elements.activeBids.textContent = t("detail.activeBids", { count: auction.activeBids });

    // Hiệu ứng Visual
    elements.currentBid.classList.add("highlight-pulse");
    setTimeout(() => elements.currentBid.classList.remove("highlight-pulse"), 1000);
}

function bindSocketEvents() {
    const socket = window.io ? window.io("http://localhost:3000") : null;
    
    if (!socket) {
        console.warn("[Real-time] Socket.io client not found.");
        return;
    }

    // 1. Lắng nghe giá thầu mới (Từ Kafka Consumer Node.js báo lên)
    socket.on('new_bid', (data) => {
        if (data.auctionId && Number(data.auctionId) !== auction.id) return;
        updateUIWithNewBid(data);
    });

    // 2. Lắng nghe lệnh gia hạn thời gian
    socket.on('auction_extended', (data) => {
        if (data.auction_id && Number(data.auction_id) !== auction.id) return;
        const extendBy = data.extend_by || 30;
        auction.endTime += extendBy * 1000;
        showToast("AUCTION EXTENDED", `Time added: +${extendBy}s due to late bid activity!`, "info");
    });

    // 3. Lắng nghe cảnh báo gian lận
    socket.on('fraud_detected', (data) => {
        showToast("SECURITY ALERT", "Suspicious bidding behavior detected and reported.", "warning");
    });
}

// --- GALLERY & LIGHTBOX (保持 - GIỮ NGUYÊN) ---

function setActiveImage(index) {
    activeImageIndex = Math.max(0, Math.min(index, auction.images.length - 1));
    const image = auction.images[activeImageIndex];
    elements.mainImage.src = image;
    elements.lightboxImage.src = image;
    elements.thumbnailGrid.querySelectorAll("[data-thumbnail-index]").forEach(button => {
        button.classList.toggle("is-active", Number(button.dataset.thumbnailIndex) === activeImageIndex);
    });
}

function renderGallery() {
    elements.mainImage.src = auction.images[0];
    const thumbnails = auction.images.map((img, i) => `
        <button type="button" class="thumbnail-button ${i === 0 ? "is-active" : ""}" data-thumbnail-index="${i}">
            <img src="${img}" alt="Thumbnail ${i + 1}" />
        </button>
    `).join("");
    elements.thumbnailGrid.innerHTML = thumbnails + (auction.has360 ? `<button type="button" class="thumbnail-button thumbnail-more" data-360>${t("detail.view360")}</button>` : "");
    
    elements.thumbnailGrid.querySelectorAll("[data-thumbnail-index]").forEach(btn => {
        btn.addEventListener("click", () => setActiveImage(Number(btn.dataset.thumbnailIndex)));
    });
}

// --- INITIALIZATION ---

function updateCountdown() {
    const distance = Math.max(0, auction.endTime - Date.now());
    const totalSeconds = Math.floor(distance / 1000);
    elements.hours.textContent = formatTwoDigits(Math.floor(totalSeconds / 3600));
    elements.minutes.textContent = formatTwoDigits(Math.floor((totalSeconds % 3600) / 60));
    elements.seconds.textContent = formatTwoDigits(totalSeconds % 60);
}

function initAuctionDetailPage() {
    initTheme();
    initI18n();
    initSiteHeader({ hideAfter: 120, topRevealOffset: 12 });

    cacheElements();

    const params = new URLSearchParams(window.location.search);
    const id = Number(params.get("id")) || 842;
    auction = structuredClone(AUCTIONS[id]);

    // Render ban đầu
    renderGallery();
    elements.productTitle.textContent = auction.title;
    elements.productDescription.textContent = auction.description;
    elements.lotLabel.textContent = auction.lot;
    elements.provenance.textContent = auction.provenance;
    elements.condition.textContent = auction.condition;
    elements.startingPrice.textContent = formatMoney(auction.startingPrice);
    elements.increment.textContent = formatMoney(auction.increment);
    elements.activeBids.textContent = t("detail.activeBids", { count: auction.activeBids });

    renderBidPanel();
    renderBidHistory();

    // Bind Sự kiện
    elements.bidForm.addEventListener("submit", handleManualBid);
    bindSocketEvents();
    
    window.setInterval(updateCountdown, 1000);
    updateCountdown();

    onLanguageChange(() => location.reload());
}

document.addEventListener("DOMContentLoaded", initAuctionDetailPage);
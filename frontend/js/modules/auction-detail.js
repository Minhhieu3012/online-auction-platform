/**
 * Auction Detail Module
 * Đã kết hợp: Giao diện đầy đủ (Countdown, History, Images) + Logic API thật
 */
import { initTheme } from "../core/theme.js";
import { initI18n, t, onLanguageChange } from "../core/i18n.js";
import { initSiteHeader } from "../core/header.js";

const AUCTIONS = {
    842: {
        id: 842,
        lot: "Lot #842 • Private Collection",
        title: "The Midnight Chronograph 'Trinity' Edition",
        description: "A singular masterpiece of horological engineering...",
        provenance: "Acquired from a private Swiss estate.",
        condition: "Mint condition, original documentation included.",
        status: "Live Now",
        currentBid: 285000,
        startingPrice: 145000,
        increment: 5000,
        endTime: Date.now() + 4 * 60 * 60 * 1000,
        activeBids: 24,
        has360: true,
        images: ["../assets/images/mockdata/1.png", "../assets/images/mockdata/2.png"],
        bidHistory: [
            { bidder: "J***S", amount: 285000, time: "2m ago", highlight: true }
        ]
    }
};

let auction = null;
let activeImageIndex = 0;
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
}

function formatMoney(value) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0
    }).format(value);
}

function getMinimumBid() {
    return Math.round(auction.currentBid + auction.increment);
}

function showToast(title, message, type = "info") {
    const toast = document.createElement("article");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<p class="toast-title">${title}</p><p class="toast-message">${message}</p>`;
    if (elements.toastStack) elements.toastStack.appendChild(toast);
    window.setTimeout(() => { toast.style.opacity = "0"; toast.remove(); }, 3800);
}

// --- LOGIC ĐẶT GIÁ THỜI GIAN THỰC (API BRIDGE) ---

async function handleManualBid(event) {
    event.preventDefault();

    // LÀM SẠCH DỮ LIỆU: Loại bỏ tất cả ký tự không phải số trước khi parse
    const rawValue = elements.bidInput.value.replace(/[^0-9.]/g, '');
    const bidValue = parseFloat(rawValue);
    const minimumBid = getMinimumBid();

    console.log(`[Debug] Bid: ${bidValue}, Min: ${minimumBid}`);

    // Kiểm tra tính hợp lệ cơ bản tại Client
    if (!bidValue || isNaN(bidValue) || bidValue < minimumBid) {
        showToast(t("toast.bidRejected"), t("toast.bidRejectedDesc", { amount: formatMoney(minimumBid) }), "warning");
        return;
    }

    const submitBtn = event.currentTarget.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
        // GỌI API THẬT
        const response = await window.apiClient.post(`/auctions/${auction.id}/bids`, { 
            bidAmount: bidValue 
        });

        if (response.success) {
            showToast("Thành công", "Giá thầu đã được gửi. Đang chờ hệ thống AI phê duyệt...", "success");
            elements.bidInput.value = "";
            // CHÚ Ý: Không gọi updateUI ở đây. UI sẽ tự cập nhật khi nhận tin nhắn từ Socket.io.
        } else {
            showToast("Thất bại", response.message || "Không thể đặt giá.", "error");
        }
    } catch (error) {
        console.error("[Bidding Error]:", error);
        showToast("Lỗi kết nối", error.message || "Không thể kết nối đến máy chủ đấu giá.", "error");
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

// --- LOGIC SOCKET.IO (HỨNG KẾT QUẢ TỪ KAFKA) ---

function updateUIWithNewBid(data) {
    // 1. Cập nhật dữ liệu Auction cục bộ
    auction.currentBid = data.bidAmount;
    auction.activeBids += 1;

    // 2. Thêm vào lịch sử hiển thị
    auction.bidHistory.forEach(b => b.highlight = false);
    auction.bidHistory.unshift({
        bidder: data.bidder || "Anonymous",
        amount: data.bidAmount,
        time: "Just now",
        highlight: true
    });
    auction.bidHistory = auction.bidHistory.slice(0, 6); // Chỉ giữ lại 6 người gần nhất

    // 3. Render lại bảng điều khiển
    renderBidPanel();
    renderBidHistory();
    
    // 4. Hiệu ứng visual thông báo giá mới
    if (elements.currentBid) {
        elements.currentBid.classList.add("highlight-pulse");
        setTimeout(() => elements.currentBid.classList.remove("highlight-pulse"), 1000);
    }
}

function bindSocketEvents() {
    const socket = window.io ? window.io("http://localhost:3000") : null;
    if (!socket) return;

    // Lắng nghe sự kiện giá thầu mới sau khi đã qua Redis/Kafka/AI
    socket.on('new_bid', (data) => {
        if (data.auctionId && Number(data.auctionId) === auction.id) {
            updateUIWithNewBid(data);
        }
    });

    socket.on('fraud_detected', () => {
        showToast("Cảnh báo an ninh", "Hệ thống AI phát hiện dấu hiệu mồi giá!", "warning");
    });
}

// --- RENDER VÀ KHỞI TẠO ---

function renderBidPanel() {
    if (elements.currentBid) elements.currentBid.textContent = formatMoney(auction.currentBid);
    if (elements.minimumBid) elements.minimumBid.textContent = t("detail.minBid", { amount: formatMoney(getMinimumBid()) });
    if (elements.bidInput) elements.bidInput.placeholder = String(getMinimumBid());
    if (elements.activeBids) elements.activeBids.textContent = `${auction.activeBids} ACTIVE BIDS`;
}

function renderBidHistory() {
    if (!elements.bidHistory) return;
    elements.bidHistory.innerHTML = auction.bidHistory.map(bid => `
        <div class="bid-history-row">
            <span class="bidder-mask">${bid.bidder}</span>
            <span class="${bid.highlight ? "bid-amount-highlight" : ""}">${formatMoney(bid.amount)}</span>
            <span>${bid.time}</span>
        </div>
    `).join("");
}

function updateCountdown() {
    const distance = Math.max(0, auction.endTime - Date.now());
    const totalSeconds = Math.floor(distance / 1000);
    if (elements.hours) elements.hours.textContent = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    if (elements.minutes) elements.minutes.textContent = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    if (elements.seconds) elements.seconds.textContent = String(totalSeconds % 60).padStart(2, "0");
}

function initAuctionDetailPage() {
    initTheme();
    initI18n();
    initSiteHeader({ hideAfter: 120, topRevealOffset: 12 });
    cacheElements();

    const params = new URLSearchParams(window.location.search);
    const id = Number(params.get("id")) || 842;
    
    // Copy an toàn dữ liệu giả lập
    auction = structuredClone(AUCTIONS[id]) || structuredClone(AUCTIONS[842]);

    renderBidPanel();
    renderBidHistory();
    bindSocketEvents();

    if (elements.bidForm) elements.bidForm.addEventListener("submit", handleManualBid);
    window.setInterval(updateCountdown, 1000);
    updateCountdown();
}

document.addEventListener("DOMContentLoaded", initAuctionDetailPage);
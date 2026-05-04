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
    "../assets/images/mockdata/7.png"
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
    elements.proxyToggle = document.querySelector("[data-proxy-toggle]");
    elements.proxyMax = document.querySelector("[data-proxy-max]");
    elements.proxySettings = document.querySelector("[data-proxy-settings]");

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
        maximumFractionDigits: 0
    }).format(Number(value || 0));
}

function formatTwoDigits(value) {
    return String(value).padStart(2, "0");
}

function normalizeStatus(status) {
    const value = String(status || "").trim().toLowerCase();

    if (value === "active") return "active";
    if (value === "scheduled") return "scheduled";
    if (value === "closing") return "closing";
    if (value === "ended") return "ended";
    if (value === "payment pending") return "payment_pending";
    if (value === "completed") return "completed";

    return value || "active";
}

function getStatusLabel(status) {
    const labels = {
        active: "ĐANG DIỄN RA",
        scheduled: "ĐÃ LÊN LỊCH",
        closing: "SẮP ĐÓNG",
        ended: "ĐÃ KẾT THÚC",
        payment_pending: "CHỜ THANH TOÁN",
        completed: "ĐÃ HOÀN TẤT"
    };

    return labels[status] || "ĐANG DIỄN RA";
}

function formatBidTime(value) {
    if (!value) return "Vừa xong";

    const time = new Date(value).getTime();

    if (Number.isNaN(time)) {
        return String(value);
    }

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
    const status = normalizeStatus(rawAuction.status);

    const bidHistory = Array.isArray(rawAuction.bidHistory)
        ? rawAuction.bidHistory.map((bid, index) => ({
            id: bid.id || `${id}-${index}`,
            bidder: bid.bidder || "B***R",
            amount: Number(bid.amount || bid.bid_amount || 0),
            time: formatBidTime(bid.time || bid.created_at),
            highlight: index === 0 || Boolean(bid.highlight)
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
        status,
        currentBid: currentPrice,
        startingPrice: currentPrice,
        increment: stepPrice || 1000,
        endTime: new Date(rawAuction.endTime || rawAuction.end_time || Date.now()).getTime(),
        activeBids: Number(rawAuction.bidCount || rawAuction.bid_count || bidHistory.length || 0),
        images: [image, ...FALLBACK_IMAGES.filter((fallbackImage) => fallbackImage !== image)].slice(0, 4),
        bidHistory
    };
}

function getMinimumBid() {
    if (!auction) {
        return 0;
    }

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

    window.setTimeout(() => {
        toast.remove();
    }, 3800);
}

function requireLoginForBid() {
    const token = apiClient.getAuthToken();
    const user = apiClient.getAuthUser();

    if (!token || !user) {
        showToast("Yêu cầu đăng nhập", "Vui lòng đăng nhập trước khi đặt giá.", "warning");

        window.setTimeout(() => {
            const currentUrl = `${window.location.pathname}${window.location.search}`;
            window.location.href = `./login.html?redirect=${encodeURIComponent(currentUrl)}`;
        }, 900);

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

function getActiveImage() {
    return auction?.images?.[activeImageIndex] || auction?.images?.[0] || FALLBACK_IMAGES[0];
}

function setActiveImage(index) {
    if (!auction) return;

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
    if (!elements.thumbnailGrid || !auction) return;

    elements.thumbnailGrid.innerHTML = auction.images
        .map((img, index) => `
            <button
                type="button"
                class="thumbnail-button ${index === activeImageIndex ? "is-active" : ""}"
                data-thumbnail-index="${index}"
                aria-label="Ảnh ${index + 1}"
            >
                <img src="${img}" alt="Ảnh thu nhỏ ${index + 1}" />
            </button>
        `)
        .join("");

    elements.thumbnailGrid.querySelectorAll("[data-thumbnail-index]").forEach((button) => {
        button.addEventListener("click", () => {
            setActiveImage(Number(button.dataset.thumbnailIndex));
        });
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

    const statusLabel = getStatusLabel(auction.status);

    if (elements.statusLabel) elements.statusLabel.textContent = statusLabel;
    if (elements.liveChip) elements.liveChip.textContent = statusLabel;
    if (elements.lotLabel) elements.lotLabel.textContent = auction.lot;
    if (elements.productTitle) elements.productTitle.textContent = auction.title;
    if (elements.productDescription) elements.productDescription.textContent = auction.description;
    if (elements.provenance) elements.provenance.textContent = auction.provenance;
    if (elements.condition) elements.condition.textContent = auction.condition;
    if (elements.startingPrice) elements.startingPrice.textContent = formatMoney(auction.startingPrice);
    if (elements.increment) elements.increment.textContent = formatMoney(auction.increment);

    if (elements.mainImage) {
        elements.mainImage.alt = auction.title;
    }
}

function renderBidPanel() {
    if (!auction) return;

    const minimumBid = getMinimumBid();

    if (elements.currentBid) elements.currentBid.textContent = formatMoney(auction.currentBid);
    if (elements.minimumBid) elements.minimumBid.textContent = `Giá tối thiểu: ${formatMoney(minimumBid)}`;

    if (elements.bidInput) {
        elements.bidInput.placeholder = String(minimumBid);
        elements.bidInput.min = String(minimumBid);
        elements.bidInput.step = String(auction.increment);
    }

    if (elements.activeBids) {
        elements.activeBids.textContent = `${auction.activeBids} LƯỢT GIÁ`;
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
        .map((bid) => `
            <div class="bid-history-row">
                <span class="bidder-mask">${bid.bidder}</span>
                <span class="${bid.highlight ? "bid-amount-highlight" : ""}">${formatMoney(bid.amount)}</span>
                <span>${bid.time}</span>
            </div>
        `)
        .join("");
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

    if (distance <= 0) {
        auction.status = "ended";

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

        if (elements.bidForm) {
            elements.bidForm.querySelectorAll("button, input").forEach((control) => {
                control.disabled = true;
            });
        }
    }
}

function updateUIWithNewBid(data) {
    if (!auction) return;

    const eventAuctionId = Number(data.auctionId || data.auction_id);

    if (eventAuctionId && Number(auction.id) !== eventAuctionId) {
        return;
    }

    const nextAmount = Number(data.bidAmount || data.price || data.amount || 0);

    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
        return;
    }

    const currentUser = apiClient.getAuthUser();
    const bidderId = data.bidder || data.user_id || data.userId;
    const isOwnBid = currentUser && String(currentUser.id) === String(bidderId);

    auction.currentBid = nextAmount;
    auction.activeBids += 1;

    if (data.newEndTime || data.end_time) {
        const parsedEndTime = new Date(data.newEndTime || data.end_time).getTime();

        if (!Number.isNaN(parsedEndTime) && parsedEndTime > auction.endTime) {
            auction.endTime = parsedEndTime;
            showToast("Gia hạn thời gian", "Có lượt giá phút chót. Phiên đấu giá đã được cộng giờ tự động.", "info");
        }
    }

    auction.bidHistory.forEach((bid) => {
        bid.highlight = false;
    });

    auction.bidHistory.unshift({
        id: `${Date.now()}-${Math.random()}`,
        bidder: isOwnBid ? "Bạn" : data.bidderName || data.bidder || "Ẩn danh",
        amount: auction.currentBid,
        time: "Vừa xong",
        highlight: true
    });

    auction.bidHistory = auction.bidHistory.slice(0, 10);

    renderBidPanel();
    renderBidHistory();
    updateCountdown();

    if (elements.currentBid) {
        elements.currentBid.classList.add("highlight-pulse");
        elements.currentBid.style.color = "var(--success)";
        elements.currentBid.style.transform = "scale(1.035)";

        window.setTimeout(() => {
            elements.currentBid.classList.remove("highlight-pulse");
            elements.currentBid.style.color = "";
            elements.currentBid.style.transform = "";
        }, 900);
    }

    showToast(
        isOwnBid ? "Đặt giá thành công" : "Có lượt giá mới",
        `${isOwnBid ? "Bạn" : "Một thành viên"} vừa đặt ${formatMoney(nextAmount)}.`,
        isOwnBid ? "success" : "info"
    );
}

function bindSocketEvents() {
    if (!window.socketClient || !auction) {
        return;
    }

    window.socketClient.connect(auction.id);

    window.socketClient.on("new_bid", updateUIWithNewBid);

    window.socketClient.on("auction_extended", (data) => {
        const eventAuctionId = Number(data.auctionId || data.auction_id);

        if (eventAuctionId && Number(auction.id) !== eventAuctionId) {
            return;
        }

        const parsedEndTime = new Date(data.newEndTime || data.end_time).getTime();

        if (!Number.isNaN(parsedEndTime) && parsedEndTime > auction.endTime) {
            auction.endTime = parsedEndTime;
            updateCountdown();
            showToast("Cộng giờ tự động", "Hệ thống đã cộng thêm thời gian để đảm bảo công bằng.", "info");
        }
    });

    window.socketClient.on("fraud_detected", () => {
        showToast("Cảnh báo an ninh", "Hệ thống đã ghi nhận một tín hiệu bất thường trong phiên đấu giá.", "warning");
    });

    window.socketClient.on("auction_winner", (data) => {
        const eventAuctionId = Number(data.auctionId || data.auction_id);

        if (eventAuctionId && Number(auction.id) !== eventAuctionId) {
            return;
        }

        const currentUser = apiClient.getAuthUser();

        if (currentUser && String(currentUser.id) === String(data.userId || data.user_id)) {
            showToast("Bạn đã thắng phiên đấu giá", "Hãy hoàn tất thanh toán để nhận tài sản.", "success");

            if (elements.bidForm) {
                elements.bidForm.innerHTML = `
                    <div style="display: grid; gap: 14px; text-align: center;">
                        <h3 style="color: var(--success); margin: 0;">Bạn đã thắng với giá ${formatMoney(data.amount || auction.currentBid)}</h3>
                        <a href="${data.paymentUrl || "./checkout.html"}" class="button button-primary">
                            Thanh Toán Ngay
                        </a>
                    </div>
                `;
            }

            return;
        }

        showToast("Phiên đã kết thúc", "Phiên đấu giá đã khép lại.", "info");

        if (elements.bidForm) {
            elements.bidForm.innerHTML = `<p style="text-align: center; color: var(--text-muted);">Phiên đấu giá đã kết thúc.</p>`;
        }
    });
}

async function handleManualBid(event) {
    event.preventDefault();

    if (!auction) {
        showToast("Đang tải", "Vui lòng chờ dữ liệu đấu giá tải xong.", "warning");
        return;
    }

    if (!requireLoginForBid()) return;

    const rawValue = String(elements.bidInput?.value || "").replace(/[^0-9.]/g, "");
    const bidValue = Number(rawValue);
    const minimumBid = getMinimumBid();

    if (!Number.isFinite(bidValue) || bidValue < minimumBid) {
        showToast("Lượt giá bị từ chối", `Giá đặt phải lớn hơn hoặc bằng ${formatMoney(minimumBid)}.`, "warning");
        return;
    }

    const proxyEnabled = Boolean(elements.proxyToggle?.checked);
    const proxyMax = Number(elements.proxyMax?.value || 0);

    if (proxyEnabled && (!Number.isFinite(proxyMax) || proxyMax < bidValue)) {
        showToast("Proxy không hợp lệ", "Hạn mức proxy phải lớn hơn hoặc bằng mức giá bạn nhập.", "warning");
        return;
    }

    setBidFormBusy(true);

    try {
        if (proxyEnabled) {
            await apiClient.post(`/auctions/${auction.id}/autobid`, {
                maxAmount: proxyMax
            });

            showToast("Đã bật trả giá tự động", `Hệ thống sẽ tự trả giá thay bạn đến ${formatMoney(proxyMax)}.`, "success");
        }

        const response = await apiClient.post(`/auctions/${auction.id}/bids`, {
            bidAmount: bidValue
        });

        showToast("Đã gửi lệnh đặt giá", response.message || "Lượt giá đang được đồng bộ qua hệ thống real-time.", "success");

        if (elements.bidInput) {
            elements.bidInput.value = "";
        }
    } catch (error) {
        showToast("Không thể đặt giá", error.message || "Vui lòng thử lại sau.", "error");
    } finally {
        setBidFormBusy(false);
    }
}

function handleProxyToggle() {
    if (elements.proxySettings && elements.proxyToggle) {
        elements.proxySettings.hidden = !elements.proxyToggle.checked;
    }
}

function disableDemoControls() {
    if (elements.simulateBid) {
        elements.simulateBid.addEventListener("click", () => {
            showToast("Đã kết nối dữ liệu thật", "Hãy dùng tài khoản thứ hai để test real-time thay vì giả lập.", "info");
        });
    }

    if (elements.simulateSoftClose) {
        elements.simulateSoftClose.addEventListener("click", () => {
            showToast("Đã kết nối dữ liệu thật", "Gia hạn thời gian sẽ đến từ Backend hoặc AI qua socket.", "info");
        });
    }
}

function bindEvents() {
    if (elements.bidForm) elements.bidForm.addEventListener("submit", handleManualBid);
    if (elements.proxyToggle) elements.proxyToggle.addEventListener("change", handleProxyToggle);

    disableDemoControls();

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

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeLightbox();
        }
    });
}

async function loadAuctionDetail() {
    const auctionId = getAuctionIdFromUrl();

    if (!auctionId) {
        showToast("Thiếu ID phiên đấu giá", "Không tìm thấy ID trên URL.", "error");
        return;
    }

    try {
        const response = await apiClient.get(`/auctions/${auctionId}`, null, {
            auth: false,
            idempotency: false
        });

        const rawAuction = response.data?.auction;

        if (!rawAuction) {
            throw new Error("Backend không trả về dữ liệu phiên đấu giá.");
        }

        auction = normalizeAuction(rawAuction);

        renderAuction();
        updateCountdown();

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
        topRevealOffset: 12
    });

    cacheElements();
    bindEvents();
    loadAuctionDetail();
}

document.addEventListener("DOMContentLoaded", initAuctionDetailPage);
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

function getAuctionIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return Number(params.get("id"));
}

function requireLoginForBid() {
    const token = apiClient.getAuthToken();
    const user = apiClient.getAuthUser();

    if (!token || !user) {
        showToast("Login Required", "Please sign in before placing a bid.");

        window.setTimeout(() => {
            const currentUrl = `${window.location.pathname}${window.location.search}`;
            window.location.href = `./login.html?redirect=${encodeURIComponent(currentUrl)}`;
        }, 700);

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
    if (!value) {
        return "Just now";
    }

    const time = new Date(value).getTime();

    if (!time) {
        return String(value);
    }

    const diffMs = Math.max(0, Date.now() - time);
    const diffMinutes = Math.floor(diffMs / 60000);

    if (diffMinutes < 1) {
        return "Just now";
    }

    if (diffMinutes < 60) {
        return `${diffMinutes}m ago`;
    }

    const diffHours = Math.floor(diffMinutes / 60);

    if (diffHours < 24) {
        return `${diffHours}h ago`;
    }

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
    return auction.currentBid + auction.increment;
}

function getActiveImage() {
    return auction.images[activeImageIndex] || auction.images[0];
}

function setActiveImage(index) {
    activeImageIndex = Math.max(0, Math.min(index, auction.images.length - 1));

    const image = getActiveImage();

    elements.mainImage.src = image;
    elements.lightboxImage.src = image;

    elements.thumbnailGrid.querySelectorAll("[data-thumbnail-index]").forEach((button) => {
        const buttonIndex = Number(button.dataset.thumbnailIndex);
        button.classList.toggle("is-active", buttonIndex === activeImageIndex);
    });
}

function createThumbnailButton(image, index) {
    return `
        <button
            type="button"
            class="thumbnail-button ${index === activeImageIndex ? "is-active" : ""}"
            data-thumbnail="${image}"
            data-thumbnail-index="${index}"
        >
            <img src="${image}" alt="${auction.title} thumbnail ${index + 1}" />
        </button>
    `;
}

function renderGallery() {
    activeImageIndex = 0;

    elements.mainImage.src = auction.images[0];
    elements.mainImage.alt = auction.title;

    const thumbnails = auction.images.map(createThumbnailButton).join("");
    const viewer360Button = auction.has360
        ? `<button type="button" class="thumbnail-button thumbnail-more" data-360-view>${t("detail.view360")}</button>`
        : `<button type="button" class="thumbnail-button thumbnail-more">${t("detail.more", { count: Math.max(0, 12 - auction.images.length) })}</button>`;

    elements.thumbnailGrid.innerHTML = `${thumbnails}${viewer360Button}`;

    elements.thumbnailGrid.querySelectorAll("[data-thumbnail-index]").forEach((button) => {
        button.addEventListener("click", () => {
            setActiveImage(Number(button.dataset.thumbnailIndex));
        });
    });

    const view360Button = elements.thumbnailGrid.querySelector("[data-360-view]");

    if (view360Button) {
        view360Button.addEventListener("click", () => {
            showToast(t("toast.preview360"), t("toast.preview360Desc"));
        });
    }
}

function renderProductCopy() {
    elements.statusLabel.textContent = auction.status;
    elements.lotLabel.textContent = auction.lot;
    elements.productTitle.textContent = auction.title;
    elements.productDescription.textContent = auction.description;
    elements.provenance.textContent = auction.provenance;
    elements.condition.textContent = auction.condition;
    elements.startingPrice.textContent = formatMoney(auction.startingPrice);
    elements.increment.textContent = formatMoney(auction.increment);
}

function renderBidPanel() {
    elements.currentBid.textContent = formatMoney(auction.currentBid);
    elements.minimumBid.textContent = t("detail.minBid", { amount: formatMoney(getMinimumBid()) });
    elements.bidInput.placeholder = String(getMinimumBid());
    elements.bidInput.min = String(getMinimumBid());
    elements.bidInput.step = String(auction.increment);
    elements.activeBids.textContent = t("detail.activeBids", { count: auction.activeBids });
}

function createBidHistoryRow(bid) {
    return `
        <div class="bid-history-row">
            <span class="bidder-mask">${bid.bidder}</span>
            <span class="${bid.highlight ? "bid-amount-highlight" : ""}">${formatMoney(bid.amount)}</span>
            <span>${bid.time}</span>
        </div>
    `;
}

function renderBidHistory() {
    if (auction.bidHistory.length === 0) {
        elements.bidHistory.innerHTML = `
            <div class="bid-history-row">
                <span class="bidder-mask">No bids</span>
                <span>-</span>
                <span>-</span>
            </div>
        `;
        return;
    }

    elements.bidHistory.innerHTML = auction.bidHistory.map(createBidHistoryRow).join("");
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
    if (!auction) {
        return;
    }

    const distance = Math.max(0, auction.endTime - Date.now());
    const totalSeconds = Math.floor(distance / 1000);

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    elements.hours.textContent = formatTwoDigits(hours);
    elements.minutes.textContent = formatTwoDigits(minutes);
    elements.seconds.textContent = formatTwoDigits(seconds);
}

function showToast(title, message) {
    if (!elements.toastStack) {
        return;
    }

    const toast = document.createElement("article");

    toast.className = "toast";
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

function addOptimisticBid({ amount, bidder = "YOU" }) {
    auction.currentBid = amount;
    auction.activeBids += 1;

    auction.bidHistory = auction.bidHistory.map((bid) => ({
        ...bid,
        highlight: false
    }));

    auction.bidHistory.unshift({
        bidder,
        amount,
        time: "Just now",
        highlight: true
    });

    auction.bidHistory = auction.bidHistory.slice(0, 6);

    renderBidPanel();
    renderBidHistory();
}

async function handleManualBid(event) {
    event.preventDefault();

    if (!auction) {
        showToast("Auction Loading", "Please wait until auction detail is loaded.");
        return;
    }

    if (!requireLoginForBid()) {
        return;
    }

    const bidValue = Number(elements.bidInput.value);
    const minimumBid = getMinimumBid();

    if (!bidValue || bidValue < minimumBid) {
        showToast(t("toast.bidRejected"), t("toast.bidRejectedDesc", { amount: formatMoney(minimumBid) }));
        return;
    }

    const proxyEnabled = elements.proxyToggle.checked;
    const proxyMax = Number(elements.proxyMax.value);

    if (proxyEnabled && (!proxyMax || proxyMax < bidValue)) {
        showToast(t("toast.proxyInvalid"), t("toast.proxyInvalidDesc"));
        return;
    }

    setBidFormBusy(true);

    try {
        if (proxyEnabled) {
            await apiClient.post(`/auctions/${auction.id}/autobid`, {
                maxAmount: proxyMax
            });

            showToast("Proxy Enabled", `Proxy bidding limit set to ${formatMoney(proxyMax)}.`);
        }

        const response = await apiClient.post(`/auctions/${auction.id}/bids`, {
            bidAmount: bidValue
        });

        const currentPrice = Number(response.data?.currentPrice || bidValue);

        addOptimisticBid({
            amount: currentPrice,
            bidder: "YOU"
        });

        if (response.data?.endTime) {
            const parsedEndTime = /^\d+$/.test(String(response.data.endTime))
                ? Number(response.data.endTime)
                : new Date(response.data.endTime).getTime();

            if (parsedEndTime) {
                auction.endTime = parsedEndTime;
                updateCountdown();
            }
        }

        elements.bidInput.value = "";

        showToast("Bid Placed", response.message || `Your bid ${formatMoney(currentPrice)} has been placed.`);

        window.setTimeout(() => {
            loadAuctionDetail();
        }, 900);
    } catch (error) {
        console.error("[Place Bid] Failed:", error);
        showToast("Bid Failed", error.message || "Cannot place bid right now.");
    } finally {
        setBidFormBusy(false);
    }
}

function handleProxyToggle() {
    elements.proxySettings.hidden = !elements.proxyToggle.checked;

    if (elements.proxyToggle.checked) {
        showToast(t("toast.proxyEnabled"), t("toast.proxyEnabledDesc"));
    }
}

function simulateExternalBid() {
    if (!auction) {
        return;
    }

    showToast("Simulation Disabled", "External bids should now be tested through another logged-in account.");
}

function simulateSoftClose() {
    if (!auction) {
        return;
    }

    auction.endTime += 30 * 1000;
    updateCountdown();
    showToast(t("toast.auctionExtended"), t("toast.auctionExtendedDesc"));
}

function openLightbox() {
    if (!auction) {
        return;
    }

    elements.lightbox.hidden = false;
    document.body.classList.add("is-menu-open");

    elements.lightboxImage.src = getActiveImage();
    elements.lightboxImage.alt = `${auction.title} enlarged preview`;
    elements.lightboxCaption.textContent = auction.has360
        ? t("detail.lightboxCaption360")
        : t("detail.lightboxCaption");
}

function closeLightbox() {
    elements.lightbox.hidden = true;
    document.body.classList.remove("is-menu-open");
    elements.lightboxFrame.classList.remove("is-zooming");
    elements.lightboxImage.style.transformOrigin = "center";
}

function showPreviousImage() {
    const nextIndex = activeImageIndex === 0 ? auction.images.length - 1 : activeImageIndex - 1;
    setActiveImage(nextIndex);
}

function showNextImage() {
    const nextIndex = activeImageIndex === auction.images.length - 1 ? 0 : activeImageIndex + 1;
    setActiveImage(nextIndex);
}

function handleLightboxMouseMove(event) {
    const rect = elements.lightboxFrame.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    elements.lightboxFrame.classList.add("is-zooming");
    elements.lightboxImage.style.transformOrigin = `${x}% ${y}%`;
}

function handleLightboxMouseLeave() {
    elements.lightboxFrame.classList.remove("is-zooming");
    elements.lightboxImage.style.transformOrigin = "center";
}

function bindLightboxEvents() {
    elements.lightboxClose.addEventListener("click", closeLightbox);
    elements.lightboxPrev.addEventListener("click", showPreviousImage);
    elements.lightboxNext.addEventListener("click", showNextImage);

    elements.lightbox.addEventListener("click", (event) => {
        if (event.target === elements.lightbox) {
            closeLightbox();
        }
    });

    elements.lightboxFrame.addEventListener("mousemove", handleLightboxMouseMove);
    elements.lightboxFrame.addEventListener("mouseleave", handleLightboxMouseLeave);

    window.addEventListener("keydown", (event) => {
        if (elements.lightbox.hidden) {
            return;
        }

        if (event.key === "Escape") {
            closeLightbox();
        }

        if (event.key === "ArrowLeft") {
            showPreviousImage();
        }

        if (event.key === "ArrowRight") {
            showNextImage();
        }
    });
}

function bindEvents() {
    elements.bidForm.addEventListener("submit", handleManualBid);
    elements.proxyToggle.addEventListener("change", handleProxyToggle);
    elements.simulateBid.addEventListener("click", simulateExternalBid);
    elements.simulateSoftClose.addEventListener("click", simulateSoftClose);

    elements.galleryFrame.addEventListener("click", openLightbox);
    elements.galleryFrame.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openLightbox();
        }
    });

    bindLightboxEvents();
}

async function loadAuctionDetail() {
    const auctionId = getAuctionIdFromUrl();

    if (!auctionId) {
        showToast("Missing Auction", "No auction ID was provided.");
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
    } catch (error) {
        console.error("[Auction Detail] Cannot load auction:", error);
        showToast("Auction Load Failed", error.message || "Cannot load auction detail from backend.");
    }
}

function initAuctionDetailPage() {
    initTheme();
    initI18n();

    initSiteHeader({
        hideAfter: 120,
        topRevealOffset: 12,
        lockWhenMenuOpen: true
    });

    cacheElements();
    bindEvents();
    loadAuctionDetail();

    onLanguageChange(() => {
        if (auction) {
            renderAuction();
        }
    });
}

document.addEventListener("DOMContentLoaded", initAuctionDetailPage);
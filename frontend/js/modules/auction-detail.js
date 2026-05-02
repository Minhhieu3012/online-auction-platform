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
    const id = Number(params.get("id"));

    if (AUCTIONS[id]) {
        return id;
    }

    return 842;
}

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

    elements.galleryFrame.addEventListener("click", openLightbox);
    elements.galleryFrame.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openLightbox();
        }
    });
}

function renderProductCopy() {
    elements.statusLabel.textContent = t("detail.liveNow");
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

function addBid({ bidder, amount, messageTitle = t("toast.newBid"), messagePrefix = "A new collector placed" }) {
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

    showToast(messageTitle, `${messagePrefix} ${formatMoney(amount)}.`);
}

function handleManualBid(event) {
    event.preventDefault();

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

    addBid({
        bidder: "YOU",
        amount: bidValue,
        messageTitle: proxyEnabled ? t("toast.proxyActivated") : t("toast.bidPlaced"),
        messagePrefix: proxyEnabled ? t("toast.proxyBidPrefix") : t("toast.manualBidPrefix")
    });

    elements.bidInput.value = "";
}

function handleProxyToggle() {
    elements.proxySettings.hidden = !elements.proxyToggle.checked;

    if (elements.proxyToggle.checked) {
        showToast(t("toast.proxyEnabled"), t("toast.proxyEnabledDesc"));
    }
}

function simulateExternalBid() {
    const nextAmount = getMinimumBid();
    const bidders = ["J***S", "A***K", "M***D", "L***P", "R***N"];
    const bidder = bidders[Math.floor(Math.random() * bidders.length)];

    addBid({
        bidder,
        amount: nextAmount,
        messageTitle: t("toast.newBid"),
        messagePrefix: t("toast.externalBidPrefix", { bidder })
    });
}

function simulateSoftClose() {
    auction.endTime += 30 * 1000;
    updateCountdown();
    showToast(t("toast.auctionExtended"), t("toast.auctionExtendedDesc"));
}

function openLightbox() {
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

    bindLightboxEvents();
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

    const auctionId = getAuctionIdFromUrl();
    auction = structuredClone(AUCTIONS[auctionId]);

    renderAuction();
    bindEvents();
    updateCountdown();

    window.setInterval(updateCountdown, 1000);

    onLanguageChange(() => {
        renderAuction();
    });
}

document.addEventListener("DOMContentLoaded", initAuctionDetailPage);
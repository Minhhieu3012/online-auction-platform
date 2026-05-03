import { initTheme } from "../core/theme.js";
import { initI18n, t, onLanguageChange } from "../core/i18n.js";
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

const STATUS_LABELS = {
    active: "Active",
    closing: "Closing Soon",
    scheduled: "Scheduled",
    ended: "Ended",
    payment_pending: "Payment Pending",
    completed: "Completed"
};

const VALID_STATUS_FILTERS = ["all", "active", "scheduled", "closing", "ended"];
const VALID_SORTS = ["ending-soon", "highest-bid", "newest", "most-bids"];

const DEFAULT_STATUS = "active";
const DEFAULT_CATEGORY = "all";
const DEFAULT_SORT = "ending-soon";
const DEFAULT_VISIBLE_COUNT = 8;

let AUCTION_LOTS = [];

const state = {
    status: DEFAULT_STATUS,
    category: DEFAULT_CATEGORY,
    search: "",
    sort: DEFAULT_SORT,
    visibleCount: DEFAULT_VISIBLE_COUNT,
    isLoading: false
};

function normalizeStatus(status) {
    const value = String(status || "").trim().toLowerCase();

    if (value === "payment pending") {
        return "payment_pending";
    }

    return value || "active";
}

function normalizeCategory(category) {
    return String(category || "collectibles")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-");
}

function formatMoney(value) {
    const numberValue = Number(value || 0);

    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0
    }).format(numberValue);
}

function getFallbackImage(id) {
    const index = Math.abs(Number(id || 0)) % FALLBACK_IMAGES.length;

    return FALLBACK_IMAGES[index];
}

function normalizeAuction(rawAuction) {
    const id = rawAuction.id;
    const status = normalizeStatus(rawAuction.status);
    const category = normalizeCategory(rawAuction.category);
    const currentPrice = Number(rawAuction.currentPrice || rawAuction.current_price || 0);
    const stepPrice = Number(rawAuction.stepPrice || rawAuction.step_price || 0);

    return {
        id,
        lot: rawAuction.lot || `Lot ${String(id).padStart(3, "0")}`,
        title: rawAuction.title || rawAuction.productName || rawAuction.product_name || "Untitled Auction Lot",
        description: rawAuction.description || "",
        category,
        status,
        image: rawAuction.imageUrl || rawAuction.image_url || getFallbackImage(id),
        estimate: rawAuction.estimate || "Estimate available on request",
        currentBid: currentPrice ? formatMoney(currentPrice) : "",
        startingBid: formatMoney(currentPrice || stepPrice || 0),
        bidCount: Number(rawAuction.bidCount || rawAuction.bid_count || 0),
        endingAt: rawAuction.endTime || rawAuction.end_time || rawAuction.endingAt || new Date().toISOString(),
        createdAt: rawAuction.createdAt || rawAuction.created_at || new Date().toISOString()
    };
}

function getNumberFromMoney(value) {
    if (!value) {
        return 0;
    }

    return Number(String(value).replace(/[^0-9.]/g, "")) || 0;
}

function getInitialStateFromUrl() {
    const params = new URLSearchParams(window.location.search);

    const statusParam = params.get("status");
    const categoryParam = params.get("category");
    const sortParam = params.get("sort");
    const searchParam = params.get("q");

    state.status = VALID_STATUS_FILTERS.includes(statusParam) ? statusParam : DEFAULT_STATUS;
    state.category = categoryParam || DEFAULT_CATEGORY;
    state.sort = VALID_SORTS.includes(sortParam) ? sortParam : DEFAULT_SORT;
    state.search = searchParam || "";
}

function updateUrl() {
    const params = new URLSearchParams();

    if (state.status && state.status !== DEFAULT_STATUS) {
        params.set("status", state.status);
    }

    if (state.category && state.category !== DEFAULT_CATEGORY) {
        params.set("category", state.category);
    }

    if (state.sort && state.sort !== DEFAULT_SORT) {
        params.set("sort", state.sort);
    }

    if (state.search.trim()) {
        params.set("q", state.search.trim());
    }

    const nextUrl = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;

    window.history.replaceState({}, "", nextUrl);
}

function getCountdownLabel(lot) {
    if (lot.status === "ended" || lot.status === "completed") {
        return t("collections.auctionEnded");
    }

    const now = Date.now();
    const target = new Date(lot.endingAt).getTime();
    const distance = Math.max(0, target - now);
    const totalSeconds = Math.floor(distance / 1000);

    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const timeText = days > 0
        ? `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`
        : `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;

    if (lot.status === "scheduled") {
        return `${t("collections.startsIn")} ${timeText}`;
    }

    return `${t("collections.endsIn")} ${timeText}`;
}

function getFilteredLots() {
    const normalizedSearch = state.search.trim().toLowerCase();

    return AUCTION_LOTS
        .filter((lot) => {
            const matchesStatus = state.status === "all" || lot.status === state.status;
            const matchesCategory = state.category === "all" || lot.category === state.category;
            const matchesSearch = !normalizedSearch
                || lot.title.toLowerCase().includes(normalizedSearch)
                || lot.lot.toLowerCase().includes(normalizedSearch)
                || lot.category.toLowerCase().includes(normalizedSearch);

            return matchesStatus && matchesCategory && matchesSearch;
        })
        .sort((a, b) => {
            if (state.sort === "highest-bid") {
                return getNumberFromMoney(b.currentBid || b.startingBid) - getNumberFromMoney(a.currentBid || a.startingBid);
            }

            if (state.sort === "newest") {
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            }

            if (state.sort === "most-bids") {
                return b.bidCount - a.bidCount;
            }

            return new Date(a.endingAt).getTime() - new Date(b.endingAt).getTime();
        });
}

function getStatusClass(status) {
    if (status === "active") {
        return "status-active";
    }

    if (status === "closing") {
        return "status-closing";
    }

    if (status === "ended" || status === "completed") {
        return "status-ended";
    }

    return "status-scheduled";
}

function createAuctionCard(lot) {
    const priceLabel = lot.status === "scheduled"
        ? t("collections.startingBid")
        : t("collections.currentBid");

    const priceValue = lot.status === "scheduled"
        ? lot.startingBid
        : lot.currentBid || lot.startingBid;

    return `
        <article class="auction-card" data-lot-id="${lot.id}">
            <div class="auction-card-media">
                <img src="${lot.image}" alt="${lot.title}" />
                <span class="status-badge ${getStatusClass(lot.status)}">${STATUS_LABELS[lot.status] || lot.status}</span>
            </div>

            <div class="auction-card-body">
                <div class="auction-card-meta">
                    <span>${lot.lot}</span>
                    <span>${t("collections.bids", { count: lot.bidCount })}</span>
                </div>

                <h3>${lot.title}</h3>
                <p>${lot.estimate}</p>

                <div class="auction-card-divider"></div>

                <div class="auction-card-bottom">
                    <div>
                        <span class="field-label">${priceLabel}</span>
                        <strong>${priceValue}</strong>
                    </div>

                    <div>
                        <span class="field-label">${lot.status === "scheduled" ? t("collections.notOpen") : "Time"}</span>
                        <strong>${getCountdownLabel(lot)}</strong>
                    </div>
                </div>

                <a href="./product-detail.html?id=${lot.id}" class="button button-outline" style="margin-top: 22px;">
                    ${t("collections.viewDetails")}
                </a>
            </div>
        </article>
    `;
}

function updateStatusTabs() {
    document.querySelectorAll("[data-status-filter]").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.statusFilter === state.status);
    });
}

function updateCategorySelect() {
    const categorySelect = document.querySelector("[data-category-filter]");

    if (categorySelect) {
        categorySelect.value = state.category;
    }
}

function updateSortSelect() {
    const sortSelect = document.querySelector("[data-sort-select]");

    if (sortSelect) {
        sortSelect.value = state.sort;
    }
}

function updateSearchInput() {
    const searchInput = document.querySelector("[data-search-input]");

    if (searchInput) {
        searchInput.value = state.search;
    }
}

function updateCurrentSortLabel() {
    const currentSortElement = document.querySelector("[data-current-sort]");
    const sortSelect = document.querySelector("[data-sort-select]");

    if (!currentSortElement || !sortSelect) {
        return;
    }

    const selectedOption = sortSelect.querySelector(`option[value="${state.sort}"]`);
    currentSortElement.textContent = selectedOption?.textContent || "Ending Soonest";
}

function renderLots() {
    const grid = document.querySelector("[data-auction-grid]");
    const emptyState = document.querySelector("[data-empty-state]");
    const resultCount = document.querySelector("[data-result-count]");
    const showingLabel = document.querySelector("[data-showing-label]");
    const loadMoreButton = document.querySelector("[data-load-more]");

    if (!grid) {
        return;
    }

    if (state.isLoading) {
        grid.innerHTML = `
            <article class="auction-card">
                <div class="auction-card-body">
                    <p class="eyebrow">Loading</p>
                    <h3>Fetching auction lots...</h3>
                    <p>Connecting to backend inventory.</p>
                </div>
            </article>
        `;
        return;
    }

    const filteredLots = getFilteredLots();
    const visibleLots = filteredLots.slice(0, state.visibleCount);

    grid.innerHTML = visibleLots.map(createAuctionCard).join("");

    if (emptyState) {
        emptyState.hidden = filteredLots.length > 0;
    }

    if (resultCount) {
        resultCount.textContent = t("collections.lotsFound", { count: filteredLots.length });
    }

    if (showingLabel) {
        showingLabel.textContent = t("collections.showing", {
            visible: visibleLots.length,
            total: filteredLots.length
        });
    }

    if (loadMoreButton) {
        loadMoreButton.hidden = visibleLots.length >= filteredLots.length;
    }

    updateCurrentSortLabel();
}

function renderAuctionList() {
    updateStatusTabs();
    updateCategorySelect();
    updateSortSelect();
    updateSearchInput();
    renderLots();
}

async function fetchAuctions() {
    state.isLoading = true;
    renderLots();

    try {
        const response = await apiClient.get("/auctions", null, {
            auth: false
        });

        const auctions = response.data?.auctions || [];

        AUCTION_LOTS = auctions.map(normalizeAuction);
    } catch (error) {
        console.error("[Auction List] Cannot load auctions:", error);
        AUCTION_LOTS = [];
    } finally {
        state.isLoading = false;
        renderAuctionList();
    }
}

function bindFilterEvents() {
    document.querySelectorAll("[data-status-filter]").forEach((button) => {
        button.addEventListener("click", () => {
            state.status = button.dataset.statusFilter || DEFAULT_STATUS;
            state.visibleCount = DEFAULT_VISIBLE_COUNT;
            updateUrl();
            renderAuctionList();
        });
    });

    const categorySelect = document.querySelector("[data-category-filter]");

    if (categorySelect) {
        categorySelect.addEventListener("change", () => {
            state.category = categorySelect.value || DEFAULT_CATEGORY;
            state.visibleCount = DEFAULT_VISIBLE_COUNT;
            updateUrl();
            renderAuctionList();
        });
    }

    const sortSelect = document.querySelector("[data-sort-select]");

    if (sortSelect) {
        sortSelect.addEventListener("change", () => {
            state.sort = sortSelect.value || DEFAULT_SORT;
            updateUrl();
            renderAuctionList();
        });
    }

    const searchInput = document.querySelector("[data-search-input]");

    if (searchInput) {
        searchInput.addEventListener("input", () => {
            state.search = searchInput.value;
            state.visibleCount = DEFAULT_VISIBLE_COUNT;
            updateUrl();
            renderAuctionList();
        });
    }

    const loadMoreButton = document.querySelector("[data-load-more]");

    if (loadMoreButton) {
        loadMoreButton.addEventListener("click", () => {
            state.visibleCount += 4;
            renderAuctionList();
        });
    }

    const resetButton = document.querySelector("[data-reset-filters]");

    if (resetButton) {
        resetButton.addEventListener("click", () => {
            state.status = DEFAULT_STATUS;
            state.category = DEFAULT_CATEGORY;
            state.search = "";
            state.sort = DEFAULT_SORT;
            state.visibleCount = DEFAULT_VISIBLE_COUNT;

            updateUrl();
            renderAuctionList();
        });
    }
}

function initAuctionListPage() {
    initTheme();
    initI18n();

    initSiteHeader({
        hideAfter: 120,
        topRevealOffset: 12
    });

    getInitialStateFromUrl();
    bindFilterEvents();
    renderAuctionList();
    fetchAuctions();

    window.setInterval(renderLots, 1000);

    onLanguageChange(() => {
        renderAuctionList();
    });
}

document.addEventListener("DOMContentLoaded", initAuctionListPage);
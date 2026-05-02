import { initTheme } from "../core/theme.js";
import { initI18n, t, onLanguageChange } from "../core/i18n.js";
import { initSiteHeader } from "../core/header.js";

const AUCTION_LOTS = [
    {
        id: 842,
        lot: "Lot 842",
        title: "The Midnight Chronograph",
        category: "horology",
        status: "active",
        image: "../assets/images/mockdata/1.png",
        estimate: "$220,000 - $340,000",
        currentBid: "$285,000",
        startingBid: "$145,000",
        bidCount: 24,
        endingAt: "2026-05-12T18:30:00",
        createdAt: "2026-04-30T10:00:00"
    },
    {
        id: 118,
        lot: "Lot 118",
        title: "Fragmented Echo",
        category: "fine-art",
        status: "active",
        image: "../assets/images/mockdata/2.png",
        estimate: "$900,000 - $1.4M",
        currentBid: "$1,220,000",
        startingBid: "$720,000",
        bidCount: 18,
        endingAt: "2026-05-13T21:00:00",
        createdAt: "2026-04-28T10:00:00"
    },
    {
        id: 883,
        lot: "Lot 883",
        title: "1962 GTO Heritage",
        category: "automotive",
        status: "active",
        image: "../assets/images/mockdata/3.png",
        estimate: "$3.4M - $4.2M",
        currentBid: "$3,800,000",
        startingBid: "$2,900,000",
        bidCount: 42,
        endingAt: "2026-05-15T08:00:00",
        createdAt: "2026-04-27T10:00:00"
    },
    {
        id: 254,
        lot: "Lot 254",
        title: "Imperial Sapphire Necklace",
        category: "jewelry",
        status: "active",
        image: "../assets/images/mockdata/4.png",
        estimate: "$220,000 - $350,000",
        currentBid: "$295,000",
        startingBid: "$180,000",
        bidCount: 32,
        endingAt: "2026-05-14T11:20:00",
        createdAt: "2026-04-26T10:00:00"
    },
    {
        id: 402,
        lot: "Lot 402",
        title: "Patek Philippe Ref. 2499",
        category: "horology",
        status: "closing",
        image: "../assets/images/mockdata/5.png",
        estimate: "$1.2M - $1.8M",
        currentBid: "$1,450,000",
        startingBid: "$950,000",
        bidCount: 14,
        endingAt: "2026-05-10T19:10:00",
        createdAt: "2026-04-22T10:00:00"
    },
    {
        id: 721,
        lot: "Lot 721",
        title: "Diamond Tennis Bracelet",
        category: "jewelry",
        status: "closing",
        image: "../assets/images/mockdata/6.png",
        estimate: "$68,000 - $92,000",
        currentBid: "$81,000",
        startingBid: "$42,000",
        bidCount: 21,
        endingAt: "2026-05-10T20:00:00",
        createdAt: "2026-04-21T10:00:00"
    },
    {
        id: 7,
        lot: "Lot 007",
        title: "1964 Aston Martin DB5",
        category: "automotive",
        status: "scheduled",
        image: "../assets/images/mockdata/7.png",
        estimate: "$800,000 - $1.1M",
        currentBid: "",
        startingBid: "$750,000",
        bidCount: 0,
        endingAt: "2026-05-18T18:00:00",
        createdAt: "2026-04-20T10:00:00"
    },
    {
        id: 611,
        lot: "Lot 611",
        title: "Rare Emerald Signet Ring",
        category: "jewelry",
        status: "scheduled",
        image: "../assets/images/mockdata/1.png",
        estimate: "$42,000 - $66,000",
        currentBid: "",
        startingBid: "$30,000",
        bidCount: 0,
        endingAt: "2026-05-19T18:00:00",
        createdAt: "2026-04-19T10:00:00"
    },
    {
        id: 319,
        lot: "Lot 319",
        title: "Art Deco Vase",
        category: "collectibles",
        status: "ended",
        image: "../assets/images/mockdata/2.png",
        estimate: "$38,000 - $48,000",
        currentBid: "$42,500",
        startingBid: "$22,000",
        bidCount: 11,
        endingAt: "2026-04-25T18:00:00",
        createdAt: "2026-04-01T10:00:00"
    },
    {
        id: 520,
        lot: "Lot 520",
        title: "Private Estate Timepiece",
        category: "horology",
        status: "ended",
        image: "../assets/images/mockdata/3.png",
        estimate: "$120,000 - $160,000",
        currentBid: "$138,000",
        startingBid: "$90,000",
        bidCount: 16,
        endingAt: "2026-04-22T18:00:00",
        createdAt: "2026-03-28T10:00:00"
    }
];

const STATUS_LABELS = {
    active: "Active",
    closing: "Closing Soon",
    scheduled: "Scheduled",
    ended: "Ended"
};

const VALID_STATUS_FILTERS = ["all", "active", "scheduled", "closing", "ended"];
const VALID_SORTS = ["ending-soon", "highest-bid", "newest", "most-bids"];

const state = {
    status: "active",
    category: "all",
    search: "",
    sort: "ending-soon",
    visibleCount: 8
};

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

    state.status = VALID_STATUS_FILTERS.includes(statusParam) ? statusParam : "active";
    state.category = categoryParam || "all";
    state.sort = VALID_SORTS.includes(sortParam) ? sortParam : "ending-soon";
    state.search = searchParam || "";
}

function updateUrl() {
    const params = new URLSearchParams();

    if (state.status && state.status !== "active") {
        params.set("status", state.status);
    }

    if (state.category && state.category !== "all") {
        params.set("category", state.category);
    }

    if (state.sort && state.sort !== "ending-soon") {
        params.set("sort", state.sort);
    }

    if (state.search.trim()) {
        params.set("q", state.search.trim());
    }

    const nextUrl = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : `${window.location.pathname}?status=active`;

    window.history.replaceState({}, "", nextUrl);
}

function getCountdownLabel(lot) {
    if (lot.status === "ended") {
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

    if (status === "ended") {
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
                <span class="status-badge ${getStatusClass(lot.status)}">${STATUS_LABELS[lot.status]}</span>
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

function bindFilterEvents() {
    document.querySelectorAll("[data-status-filter]").forEach((button) => {
        button.addEventListener("click", () => {
            state.status = button.dataset.statusFilter || "active";
            state.visibleCount = 8;
            updateUrl();
            renderAuctionList();
        });
    });

    const categorySelect = document.querySelector("[data-category-filter]");

    if (categorySelect) {
        categorySelect.addEventListener("change", () => {
            state.category = categorySelect.value || "all";
            state.visibleCount = 8;
            updateUrl();
            renderAuctionList();
        });
    }

    const sortSelect = document.querySelector("[data-sort-select]");

    if (sortSelect) {
        sortSelect.addEventListener("change", () => {
            state.sort = sortSelect.value || "ending-soon";
            updateUrl();
            renderAuctionList();
        });
    }

    const searchInput = document.querySelector("[data-search-input]");

    if (searchInput) {
        searchInput.addEventListener("input", () => {
            state.search = searchInput.value;
            state.visibleCount = 8;
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
            state.status = "active";
            state.category = "all";
            state.search = "";
            state.sort = "ending-soon";
            state.visibleCount = 8;

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

    window.setInterval(renderLots, 1000);

    onLanguageChange(() => {
        renderAuctionList();
    });
}

document.addEventListener("DOMContentLoaded", initAuctionListPage);
import { initTheme } from "../core/theme.js";
import { initI18n } from "../core/i18n.js";
import { initSiteHeader } from "../core/header.js";

let WATCHLIST_ITEMS = [
    {
        id: 842,
        lotNumber: "Lot #842",
        title: "The Midnight Chronograph",
        category: "Horology",
        status: "active",
        image: "../assets/images/mockdata/1.png",
        estimate: "$220,000 - $340,000",
        currentBid: "$285,000",
        bidCount: 24,
        endingLabel: "04h 12m",
        description: "Private collection chronograph with verified provenance and refined titanium-gold execution."
    },
    {
        id: 118,
        lotNumber: "Lot #118",
        title: "Fragmented Echo",
        category: "Fine Art",
        status: "active",
        image: "../assets/images/mockdata/2.png",
        estimate: "$900,000 - $1.4M",
        currentBid: "$1,220,000",
        bidCount: 18,
        endingLabel: "18h 42m",
        description: "Contemporary fine art work with strong collector attention and gallery-backed provenance."
    },
    {
        id: 883,
        lotNumber: "Lot #883",
        title: "1962 GTO Heritage",
        category: "Automotive",
        status: "active",
        image: "../assets/images/mockdata/3.png",
        estimate: "$3.4M - $4.2M",
        currentBid: "$3,800,000",
        bidCount: 42,
        endingLabel: "2d 04h",
        description: "Collector-grade automotive icon preserved with documented ownership and specialist review."
    },
    {
        id: 254,
        lotNumber: "Lot #254",
        title: "Imperial Sapphire Necklace",
        category: "Jewelry",
        status: "active",
        image: "../assets/images/mockdata/4.png",
        estimate: "$220,000 - $350,000",
        currentBid: "$295,000",
        bidCount: 32,
        endingLabel: "3d 12h",
        description: "High jewelry necklace with sapphire centerpiece and private-collection documentation."
    },
    {
        id: 402,
        lotNumber: "Lot #402",
        title: "Patek Philippe Ref. 2499",
        category: "Horology",
        status: "closing",
        image: "../assets/images/mockdata/5.png",
        estimate: "$1.2M - $1.8M",
        currentBid: "$1,450,000",
        bidCount: 14,
        endingLabel: "02h 45m",
        description: "Rare horology lot entering its final auction window with elevated collector interest."
    },
    {
        id: 721,
        lotNumber: "Lot #721",
        title: "Diamond Tennis Bracelet",
        category: "Jewelry",
        status: "closing",
        image: "../assets/images/mockdata/6.png",
        estimate: "$68,000 - $92,000",
        currentBid: "$81,000",
        bidCount: 21,
        endingLabel: "01h 18m",
        description: "Jewelry lot closing soon with strong estimate alignment and compact bidding history."
    },
    {
        id: 7,
        lotNumber: "Lot #007",
        title: "1964 Aston Martin DB5",
        category: "Automotive",
        status: "scheduled",
        image: "../assets/images/mockdata/7.png",
        estimate: "$800,000 - $1.1M",
        currentBid: "Not open",
        bidCount: 0,
        endingLabel: "Starts in 4d",
        description: "Scheduled collector car lot prepared for premium automotive audience."
    },
    {
        id: 319,
        lotNumber: "Lot #319",
        title: "Art Deco Vase",
        category: "Collectibles",
        status: "ended",
        image: "../assets/images/mockdata/2.png",
        estimate: "$38,000 - $48,000",
        currentBid: "$42,500",
        bidCount: 11,
        endingLabel: "Ended",
        description: "Ended collectible lot retained for post-auction tracking and reference."
    }
];

const FILTER_TITLES = {
    all: "All Saved Lots",
    active: "Active Watchlist",
    closing: "Closing Soon",
    scheduled: "Scheduled Lots",
    ended: "Ended Lots"
};

const STATUS_LABELS = {
    active: "Active",
    closing: "Closing Soon",
    scheduled: "Scheduled",
    ended: "Ended"
};

const state = {
    filter: "all",
    search: "",
    selectedIds: []
};

function showToast(title, message) {
    const toastStack = document.querySelector("[data-toast-stack]");

    if (!toastStack) {
        return;
    }

    const toast = document.createElement("article");

    toast.className = "toast";
    toast.innerHTML = `
        <p class="toast-title">${title}</p>
        <p class="toast-message">${message}</p>
    `;

    toastStack.appendChild(toast);

    window.setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(-6px)";
    }, 3200);

    window.setTimeout(() => {
        toast.remove();
    }, 3800);
}

function getFilteredItems() {
    const query = state.search.trim().toLowerCase();

    return WATCHLIST_ITEMS.filter((item) => {
        const matchesFilter = state.filter === "all" || item.status === state.filter;
        const searchableText = [
            item.lotNumber,
            item.title,
            item.category,
            item.status,
            item.estimate,
            item.currentBid,
            item.description
        ].join(" ").toLowerCase();

        const matchesSearch = !query || searchableText.includes(query);

        return matchesFilter && matchesSearch;
    });
}

function updateCounts() {
    const countAll = document.querySelector("[data-count-all]");
    const countActive = document.querySelector("[data-count-active]");
    const countClosing = document.querySelector("[data-count-closing]");
    const countScheduled = document.querySelector("[data-count-scheduled]");
    const countEnded = document.querySelector("[data-count-ended]");

    const counts = {
        all: WATCHLIST_ITEMS.length,
        active: WATCHLIST_ITEMS.filter((item) => item.status === "active").length,
        closing: WATCHLIST_ITEMS.filter((item) => item.status === "closing").length,
        scheduled: WATCHLIST_ITEMS.filter((item) => item.status === "scheduled").length,
        ended: WATCHLIST_ITEMS.filter((item) => item.status === "ended").length
    };

    if (countAll) {
        countAll.textContent = counts.all;
    }

    if (countActive) {
        countActive.textContent = counts.active;
    }

    if (countClosing) {
        countClosing.textContent = counts.closing;
    }

    if (countScheduled) {
        countScheduled.textContent = counts.scheduled;
    }

    if (countEnded) {
        countEnded.textContent = counts.ended;
    }
}

function createWatchCard(item) {
    const isSelected = state.selectedIds.includes(item.id);

    return `
        <article class="watch-card-large ${isSelected ? "is-selected" : ""}" data-watch-card="${item.id}">
            <div class="watch-card-media">
                <img src="${item.image}" alt="${item.title}" />
                <span class="watch-status">${STATUS_LABELS[item.status]}</span>
            </div>

            <div class="watch-card-body">
                <div class="watch-card-topline">
                    <span>${item.lotNumber}</span>
                    <span>${item.category}</span>
                </div>

                <h3>${item.title}</h3>
                <p>${item.description}</p>

                <div class="watch-card-stats">
                    <div>
                        <span>Current Bid</span>
                        <strong>${item.currentBid}</strong>
                    </div>

                    <div>
                        <span>Estimate</span>
                        <strong>${item.estimate}</strong>
                    </div>

                    <div>
                        <span>Bids</span>
                        <strong>${item.bidCount}</strong>
                    </div>

                    <div>
                        <span>Window</span>
                        <strong>${item.endingLabel}</strong>
                    </div>
                </div>

                <div class="watch-card-actions">
                    <a href="./product-detail.html?id=${item.id}" class="button button-primary">
                        ${item.status === "scheduled" ? "View Lot" : "Bid / View"}
                    </a>

                    <button
                        type="button"
                        class="watch-icon-action ${isSelected ? "is-active" : ""}"
                        data-toggle-compare="${item.id}"
                        aria-label="Toggle compare"
                    >
                        ⇄
                    </button>

                    <button
                        type="button"
                        class="watch-icon-action is-danger"
                        data-remove-watch="${item.id}"
                        aria-label="Remove from watchlist"
                    >
                        ×
                    </button>
                </div>
            </div>
        </article>
    `;
}

function renderWatchlist() {
    const grid = document.querySelector("[data-watchlist-grid]");
    const empty = document.querySelector("[data-watchlist-empty]");
    const visibleCount = document.querySelector("[data-visible-count]");
    const selectedCount = document.querySelector("[data-selected-count]");
    const title = document.querySelector("[data-watchlist-title]");

    if (!grid) {
        return;
    }

    const filteredItems = getFilteredItems();

    grid.innerHTML = filteredItems.map(createWatchCard).join("");

    if (empty) {
        empty.hidden = filteredItems.length > 0;
    }

    if (visibleCount) {
        visibleCount.textContent = `${filteredItems.length} visible`;
    }

    if (selectedCount) {
        selectedCount.textContent = state.selectedIds.length;
    }

    if (title) {
        title.textContent = FILTER_TITLES[state.filter] || FILTER_TITLES.all;
    }

    document.querySelectorAll("[data-toggle-compare]").forEach((button) => {
        button.addEventListener("click", () => {
            toggleCompare(Number(button.dataset.toggleCompare));
        });
    });

    document.querySelectorAll("[data-remove-watch]").forEach((button) => {
        button.addEventListener("click", () => {
            removeFromWatchlist(Number(button.dataset.removeWatch));
        });
    });

    updateTabs();
    updateCounts();
    renderComparePanel();
}

function updateTabs() {
    document.querySelectorAll("[data-watchlist-filter]").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.watchlistFilter === state.filter);
    });
}

function toggleCompare(id) {
    const alreadySelected = state.selectedIds.includes(id);

    if (alreadySelected) {
        state.selectedIds = state.selectedIds.filter((selectedId) => selectedId !== id);
        renderWatchlist();
        return;
    }

    if (state.selectedIds.length >= 3) {
        showToast("Compare Limit", "You can compare up to 3 lots at the same time.");
        return;
    }

    state.selectedIds = [...state.selectedIds, id];
    renderWatchlist();
}

function removeFromWatchlist(id) {
    const item = WATCHLIST_ITEMS.find((watchItem) => watchItem.id === id);

    WATCHLIST_ITEMS = WATCHLIST_ITEMS.filter((watchItem) => watchItem.id !== id);
    state.selectedIds = state.selectedIds.filter((selectedId) => selectedId !== id);

    showToast("Removed", `${item?.title || "Lot"} removed from your watchlist.`);
    renderWatchlist();
}

function renderComparePanel() {
    const compareStatus = document.querySelector("[data-compare-status]");
    const compareEmpty = document.querySelector("[data-compare-empty]");
    const compareList = document.querySelector("[data-compare-list]");
    const clearButton = document.querySelector("[data-clear-compare]");

    const selectedItems = state.selectedIds
        .map((id) => WATCHLIST_ITEMS.find((item) => item.id === id))
        .filter(Boolean);

    if (compareStatus) {
        compareStatus.textContent = `${selectedItems.length} / 3`;
    }

    if (compareEmpty) {
        compareEmpty.hidden = selectedItems.length > 0;
    }

    if (compareList) {
        compareList.hidden = selectedItems.length === 0;
        compareList.innerHTML = selectedItems.map((item) => `
            <article class="compare-item">
                <div class="compare-item-header">
                    <img src="${item.image}" alt="${item.title}" />
                    <div>
                        <p>${item.lotNumber}</p>
                        <h3>${item.title}</h3>
                    </div>
                </div>

                <div class="compare-table">
                    <div class="compare-row">
                        <span>Status</span>
                        <strong>${STATUS_LABELS[item.status]}</strong>
                    </div>

                    <div class="compare-row">
                        <span>Category</span>
                        <strong>${item.category}</strong>
                    </div>

                    <div class="compare-row">
                        <span>Current Bid</span>
                        <strong>${item.currentBid}</strong>
                    </div>

                    <div class="compare-row">
                        <span>Estimate</span>
                        <strong>${item.estimate}</strong>
                    </div>

                    <div class="compare-row">
                        <span>Bids</span>
                        <strong>${item.bidCount}</strong>
                    </div>
                </div>
            </article>
        `).join("");
    }

    if (clearButton) {
        clearButton.hidden = selectedItems.length === 0;
    }
}

function bindEvents() {
    document.querySelectorAll("[data-watchlist-filter]").forEach((button) => {
        button.addEventListener("click", () => {
            state.filter = button.dataset.watchlistFilter || "all";
            renderWatchlist();
        });
    });

    const searchInput = document.querySelector("[data-watchlist-search]");

    if (searchInput) {
        searchInput.addEventListener("input", () => {
            state.search = searchInput.value;
            renderWatchlist();
        });
    }

    const clearButton = document.querySelector("[data-clear-compare]");

    if (clearButton) {
        clearButton.addEventListener("click", () => {
            state.selectedIds = [];
            renderWatchlist();
        });
    }
}

function initWatchlistPage() {
    initTheme();
    initI18n();

    initSiteHeader({
        hideAfter: 120,
        topRevealOffset: 12
    });

    bindEvents();
    renderWatchlist();
}

document.addEventListener("DOMContentLoaded", initWatchlistPage);
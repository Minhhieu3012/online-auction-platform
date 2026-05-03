import { initTheme } from "../core/theme.js";
import { initI18n } from "../core/i18n.js";
import { initSiteHeader } from "../core/header.js";
import apiClient from "../core/api-client.js";

const TAB_COPY = {
    overview: {
        title: "Overview",
        subtitle: "Monitor auction operations, verification requests, fraud signals, settlements, and user access from one control layer."
    },
    auctions: {
        title: "Auction Management",
        subtitle: "Inspect backend auction lots, track prices, filter status, and jump into live auction details."
    },
    verification: {
        title: "Verification Queue",
        subtitle: "Review seller-submitted assets before they become auction listings."
    },
    fraud: {
        title: "Fraud Alerts",
        subtitle: "Inspect risk signals from bidding behavior, IP affinity, account age, and unusual increments."
    },
    settlements: {
        title: "Settlements",
        subtitle: "Track post-auction payment status, buyer records, and transaction actions."
    },
    users: {
        title: "Users",
        subtitle: "Review member access, verification state, account capability, and risk profile."
    }
};

const FALLBACK_IMAGES = [
    "../assets/images/mockdata/1.png",
    "../assets/images/mockdata/2.png",
    "../assets/images/mockdata/3.png",
    "../assets/images/mockdata/4.png",
    "../assets/images/mockdata/5.png",
    "../assets/images/mockdata/6.png",
    "../assets/images/mockdata/7.png"
];

const state = {
    auctions: [],
    filteredAuctions: [],
    search: "",
    status: "all",
    category: "all",
    sort: "ending-soon",
    isLoading: false
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

function setActiveTab(tabName) {
    const nextCopy = TAB_COPY[tabName] || TAB_COPY.overview;

    document.querySelectorAll("[data-admin-tab]").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.adminTab === tabName);
    });

    document.querySelectorAll("[data-admin-panel]").forEach((panel) => {
        panel.classList.toggle("is-active", panel.dataset.adminPanel === tabName);
    });

    const titleElement = document.querySelector("[data-admin-title]");
    const subtitleElement = document.querySelector("[data-admin-subtitle]");

    if (titleElement) {
        titleElement.textContent = nextCopy.title;
    }

    if (subtitleElement) {
        subtitleElement.textContent = nextCopy.subtitle;
    }

    window.history.replaceState(null, "", `#${tabName}`);
}

function requireSession() {
    const token = apiClient.getAuthToken();
    const user = apiClient.getAuthUser();

    if (!token || !user) {
        apiClient.clearAuth();

        window.location.replace(`./login.html?redirect=${encodeURIComponent("./admin.html")}`);
        return null;
    }

    return user;
}

function normalizeStatus(value) {
    const status = String(value || "").trim().toLowerCase();

    if (status === "payment pending") {
        return "payment_pending";
    }

    return status || "unknown";
}

function normalizeCategory(value) {
    return String(value || "collectibles")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-");
}

function getFallbackImage(id) {
    const index = Math.abs(Number(id || 0)) % FALLBACK_IMAGES.length;

    return FALLBACK_IMAGES[index];
}

function normalizeAuction(rawAuction) {
    const id = rawAuction.id;
    const currentPrice = Number(rawAuction.currentPrice || rawAuction.current_price || 0);
    const stepPrice = Number(rawAuction.stepPrice || rawAuction.step_price || 0);
    const bidCount = Number(rawAuction.bidCount || rawAuction.bid_count || 0);
    const category = normalizeCategory(rawAuction.category);
    const status = normalizeStatus(rawAuction.status);

    return {
        id,
        lot: rawAuction.lot || `Lot ${String(id || 0).padStart(3, "0")}`,
        title: rawAuction.title || rawAuction.productName || rawAuction.product_name || "Untitled Auction Lot",
        description: rawAuction.description || "",
        category,
        status,
        currentPrice,
        stepPrice,
        bidCount,
        seller: rawAuction.sellerUsername || rawAuction.seller_username || "Unknown seller",
        imageUrl: rawAuction.imageUrl || rawAuction.image_url || getFallbackImage(id),
        endTime: rawAuction.endTime || rawAuction.end_time || null,
        createdAt: rawAuction.createdAt || rawAuction.created_at || null
    };
}

function formatCurrency(value) {
    const numberValue = Number(value || 0);

    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0
    }).format(numberValue);
}

function formatNumber(value) {
    return new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 0
    }).format(Number(value || 0));
}

function formatDateTime(value) {
    if (!value) {
        return "Not set";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    }).format(date);
}

function getStatusClass(status) {
    if (status === "active") {
        return "is-active-status";
    }

    if (status === "scheduled") {
        return "is-scheduled-status";
    }

    if (status === "closing") {
        return "is-closing-status";
    }

    if (status === "ended" || status === "completed") {
        return "is-ended-status";
    }

    return "is-pending";
}

function getStatusLabel(status) {
    const map = {
        active: "Active",
        scheduled: "Scheduled",
        closing: "Closing",
        ended: "Ended",
        completed: "Completed",
        payment_pending: "Payment Pending"
    };

    return map[status] || "Unknown";
}

function setText(selector, value) {
    const element = document.querySelector(selector);

    if (element) {
        element.textContent = value;
    }
}

function updateCurrentUser(user) {
    setText("[data-current-admin-name]", user?.username || user?.name || "Current Session User");
    setText("[data-current-admin-email]", user?.email || "session@brosgem.com");
}

function calculateStats() {
    const total = state.auctions.length;
    const active = state.auctions.filter((auction) => auction.status === "active").length;
    const scheduled = state.auctions.filter((auction) => auction.status === "scheduled").length;
    const ended = state.auctions.filter((auction) => ["ended", "completed"].includes(auction.status)).length;
    const totalBids = state.auctions.reduce((sum, auction) => sum + auction.bidCount, 0);
    const totalVolume = state.auctions.reduce((sum, auction) => sum + auction.currentPrice, 0);

    return {
        total,
        active,
        scheduled,
        ended,
        totalBids,
        totalVolume
    };
}

function updateStats() {
    const stats = calculateStats();

    setText("[data-total-auctions]", String(stats.total).padStart(2, "0"));
    setText("[data-active-auctions]", String(stats.active).padStart(2, "0"));
    setText("[data-scheduled-auctions]", String(stats.scheduled).padStart(2, "0"));
    setText("[data-ended-auctions]", String(stats.ended).padStart(2, "0"));
    setText("[data-total-bids]", String(stats.totalBids).padStart(2, "0"));
    setText("[data-total-volume]", formatCurrency(stats.totalVolume));
}

function updateBackendStatus(isOnline) {
    setText("[data-backend-status]", isOnline ? "OK" : "OFF");
    setText(
        "[data-backend-status-copy]",
        isOnline
            ? "Auction API responded successfully."
            : "Auction API did not respond. Check backend server."
    );

    setText(
        "[data-admin-engine-label]",
        isOnline
            ? "Backend auction API connected"
            : "Backend auction API unavailable"
    );
}

function getFilteredAuctions() {
    const keyword = state.search.trim().toLowerCase();

    return state.auctions
        .filter((auction) => {
            const matchesSearch = !keyword
                || auction.title.toLowerCase().includes(keyword)
                || auction.lot.toLowerCase().includes(keyword)
                || auction.seller.toLowerCase().includes(keyword)
                || auction.category.toLowerCase().includes(keyword);

            const matchesStatus = state.status === "all" || auction.status === state.status;
            const matchesCategory = state.category === "all" || auction.category === state.category;

            return matchesSearch && matchesStatus && matchesCategory;
        })
        .sort((a, b) => {
            if (state.sort === "highest-bid") {
                return b.currentPrice - a.currentPrice;
            }

            if (state.sort === "newest") {
                return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
            }

            if (state.sort === "most-bids") {
                return b.bidCount - a.bidCount;
            }

            return new Date(a.endTime || 0).getTime() - new Date(b.endTime || 0).getTime();
        });
}

function createOverviewAuctionRow(auction) {
    return `
        <div class="admin-request-row">
            <img src="${auction.imageUrl}" alt="${auction.title}" />
            <div>
                <strong>${auction.title}</strong>
                <span>${auction.lot} • ${auction.category.replace("-", " ")} • ${formatCurrency(auction.currentPrice)}</span>
            </div>
            <b>${getStatusLabel(auction.status)}</b>
        </div>
    `;
}

function renderOverviewSnapshot() {
    const list = document.querySelector("[data-overview-auction-list]");

    if (!list) {
        return;
    }

    if (state.isLoading) {
        list.innerHTML = `
            <div class="admin-empty-mini">
                <span>◇</span>
                <p>Loading backend auctions...</p>
            </div>
        `;
        return;
    }

    const topAuctions = [...state.auctions]
        .sort((a, b) => b.currentPrice - a.currentPrice)
        .slice(0, 3);

    if (topAuctions.length === 0) {
        list.innerHTML = `
            <div class="admin-empty-mini">
                <span>◇</span>
                <p>No auction lots found. Publish your first lot.</p>
            </div>
        `;
        return;
    }

    list.innerHTML = topAuctions.map(createOverviewAuctionRow).join("");
}

function createAuctionTableRow(auction) {
    return `
        <tr>
            <td>
                <strong>${auction.lot}</strong>
                <span class="admin-table-muted">#${auction.id}</span>
            </td>
            <td>
                <div class="admin-auction-asset">
                    <img src="${auction.imageUrl}" alt="${auction.title}" />
                    <div>
                        <strong>${auction.title}</strong>
                        <span>${auction.description ? auction.description.slice(0, 72) : "No description"}${auction.description.length > 72 ? "..." : ""}</span>
                    </div>
                </div>
            </td>
            <td>${auction.category.replace("-", " ")}</td>
            <td>${auction.seller}</td>
            <td>
                <span class="admin-status ${getStatusClass(auction.status)}">${getStatusLabel(auction.status)}</span>
            </td>
            <td>${formatCurrency(auction.currentPrice)}</td>
            <td>${formatNumber(auction.bidCount)}</td>
            <td>${formatDateTime(auction.endTime)}</td>
            <td>
                <div class="admin-row-actions">
                    <a href="./product-detail.html?id=${auction.id}">View</a>
                    <a href="./publish-lot.html">Create</a>
                </div>
            </td>
        </tr>
    `;
}

function renderAuctionTable() {
    const tableBody = document.querySelector("[data-admin-auction-table]");
    const emptyState = document.querySelector("[data-admin-auction-empty]");
    const countElement = document.querySelector("[data-admin-auction-count]");
    const showingElement = document.querySelector("[data-admin-auction-showing]");

    if (!tableBody) {
        return;
    }

    if (state.isLoading) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="9">
                    <div class="admin-table-state">
                        <span>◇</span>
                        <p>Loading auctions from backend...</p>
                    </div>
                </td>
            </tr>
        `;

        if (emptyState) {
            emptyState.hidden = true;
        }

        return;
    }

    state.filteredAuctions = getFilteredAuctions();

    if (countElement) {
        countElement.textContent = `${state.auctions.length} auctions loaded`;
    }

    if (showingElement) {
        showingElement.textContent = `Showing ${state.filteredAuctions.length} records`;
    }

    if (state.filteredAuctions.length === 0) {
        tableBody.innerHTML = "";

        if (emptyState) {
            emptyState.hidden = false;
        }

        return;
    }

    if (emptyState) {
        emptyState.hidden = true;
    }

    tableBody.innerHTML = state.filteredAuctions.map(createAuctionTableRow).join("");
}

function renderAdminData() {
    updateStats();
    renderOverviewSnapshot();
    renderAuctionTable();
}

async function fetchAuctions() {
    state.isLoading = true;
    renderAdminData();

    try {
        const response = await apiClient.get("/auctions", null, {
            auth: false
        });

        const auctions = response.data?.auctions || [];

        state.auctions = auctions.map(normalizeAuction);
        updateBackendStatus(true);
    } catch (error) {
        console.error("[Admin] Cannot fetch auctions:", error);
        state.auctions = [];
        updateBackendStatus(false);
        showToast("Auction API Failed", error.message || "Cannot load auction management data.");
    } finally {
        state.isLoading = false;
        renderAdminData();
    }
}

function updatePendingCount() {
    const pendingCards = Array.from(document.querySelectorAll("[data-review-card]"))
        .filter((card) => !card.classList.contains("is-approved") && !card.classList.contains("is-declined"));

    const pendingCountElements = document.querySelectorAll("[data-pending-count], [data-verification-count]");

    pendingCountElements.forEach((element) => {
        if (element.hasAttribute("data-verification-count")) {
            element.textContent = `${pendingCards.length} pending`;
        } else {
            element.textContent = String(pendingCards.length).padStart(2, "0");
        }
    });
}

function handleReviewAction(button) {
    const action = button.dataset.reviewAction;
    const card = button.closest("[data-review-card]");
    const status = card?.querySelector("[data-review-status]");

    if (!card || !status) {
        return;
    }

    card.classList.remove("is-approved", "is-declined");

    if (action === "approve") {
        card.classList.add("is-approved");
        status.textContent = "Approved";

        showToast("Request Approved", "Asset request approved as UI-ready mock. It can move to auction configuration next.");
    }

    if (action === "decline") {
        card.classList.add("is-declined");
        status.textContent = "Declined";

        showToast("Request Declined", "Asset request declined as UI-ready mock. Seller feedback can connect later.");
    }

    updatePendingCount();
}

function bindAdminTabs() {
    document.querySelectorAll("[data-admin-tab]").forEach((button) => {
        button.addEventListener("click", () => {
            setActiveTab(button.dataset.adminTab);
        });
    });

    document.querySelectorAll("[data-admin-jump]").forEach((button) => {
        button.addEventListener("click", () => {
            setActiveTab(button.dataset.adminJump);
        });
    });

    const initialTab = window.location.hash.replace("#", "") || "overview";

    if (TAB_COPY[initialTab]) {
        setActiveTab(initialTab);
    }
}

function bindReviewActions() {
    document.querySelectorAll("[data-review-action]").forEach((button) => {
        button.addEventListener("click", () => {
            handleReviewAction(button);
        });
    });

    updatePendingCount();
}

function bindToastButtons() {
    document.querySelectorAll("[data-admin-toast]").forEach((button) => {
        button.addEventListener("click", () => {
            showToast("Admin", button.dataset.adminToast);
        });
    });
}

function bindAuctionFilters() {
    const searchInput = document.querySelector("[data-admin-auction-search]");
    const statusFilter = document.querySelector("[data-admin-status-filter]");
    const categoryFilter = document.querySelector("[data-admin-category-filter]");
    const sortFilter = document.querySelector("[data-admin-sort-filter]");
    const resetButton = document.querySelector("[data-reset-admin-auction-filters]");

    if (searchInput) {
        searchInput.addEventListener("input", () => {
            state.search = searchInput.value;
            renderAuctionTable();
        });
    }

    if (statusFilter) {
        statusFilter.addEventListener("change", () => {
            state.status = statusFilter.value;
            renderAuctionTable();
        });
    }

    if (categoryFilter) {
        categoryFilter.addEventListener("change", () => {
            state.category = categoryFilter.value;
            renderAuctionTable();
        });
    }

    if (sortFilter) {
        sortFilter.addEventListener("change", () => {
            state.sort = sortFilter.value;
            renderAuctionTable();
        });
    }

    if (resetButton) {
        resetButton.addEventListener("click", () => {
            state.search = "";
            state.status = "all";
            state.category = "all";
            state.sort = "ending-soon";

            if (searchInput) {
                searchInput.value = "";
            }

            if (statusFilter) {
                statusFilter.value = "all";
            }

            if (categoryFilter) {
                categoryFilter.value = "all";
            }

            if (sortFilter) {
                sortFilter.value = "ending-soon";
            }

            renderAuctionTable();
        });
    }
}

function bindRefreshButtons() {
    document.querySelectorAll("[data-refresh-auctions]").forEach((button) => {
        button.addEventListener("click", () => {
            fetchAuctions();
        });
    });
}

function initAdminPage() {
    const user = requireSession();

    if (!user) {
        return;
    }

    initTheme();
    initI18n();

    initSiteHeader({
        hideAfter: 120,
        topRevealOffset: 12
    });

    updateCurrentUser(user);
    bindAdminTabs();
    bindReviewActions();
    bindToastButtons();
    bindAuctionFilters();
    bindRefreshButtons();

    fetchAuctions();
}

document.addEventListener("DOMContentLoaded", initAdminPage);
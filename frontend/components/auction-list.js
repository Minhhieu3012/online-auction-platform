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
  "../assets/images/mockdata/7.png",
];
const STATUS_LABELS = {
  active: "Active",
  closing: "Closing Soon",
  scheduled: "Scheduled",
  ended: "Ended",
  payment_pending: "Payment Pending",
  completed: "Completed",
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
  isLoading: false,
};

function normalizeStatus(status) {
  const value = String(status || "")
    .trim()
    .toLowerCase();
  return value === "payment pending" ? "payment_pending" : value || "active";
}
function normalizeCategory(category) {
  return String(category || "collectibles")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}
function formatMoney(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    Number(value || 0),
  );
}
function getFallbackImage(id) {
  return FALLBACK_IMAGES[Math.abs(Number(id || 0)) % FALLBACK_IMAGES.length];
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
    createdAt: rawAuction.createdAt || rawAuction.created_at || new Date().toISOString(),
  };
}

function getNumberFromMoney(value) {
  return value ? Number(String(value).replace(/[^0-9.]/g, "")) || 0 : 0;
}

function getInitialStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  state.status = VALID_STATUS_FILTERS.includes(params.get("status")) ? params.get("status") : DEFAULT_STATUS;
  state.category = params.get("category") || DEFAULT_CATEGORY;
  state.sort = VALID_SORTS.includes(params.get("sort")) ? params.get("sort") : DEFAULT_SORT;
  state.search = params.get("q") || "";
}

function updateUrl() {
  const params = new URLSearchParams();
  if (state.status !== DEFAULT_STATUS) params.set("status", state.status);
  if (state.category !== DEFAULT_CATEGORY) params.set("category", state.category);
  if (state.sort !== DEFAULT_SORT) params.set("sort", state.sort);
  if (state.search.trim()) params.set("q", state.search.trim());
  window.history.replaceState(
    {},
    "",
    params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname,
  );
}

function getCountdownLabel(lot) {
  if (lot.status === "ended" || lot.status === "completed") return t("collections.auctionEnded");
  const distance = Math.max(0, new Date(lot.endingAt).getTime() - Date.now());
  const totalSeconds = Math.floor(distance / 1000);
  const days = Math.floor(totalSeconds / 86400),
    hours = Math.floor((totalSeconds % 86400) / 3600),
    minutes = Math.floor((totalSeconds % 3600) / 60),
    seconds = totalSeconds % 60;
  const timeText =
    days > 0
      ? `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`
      : `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
  return lot.status === "scheduled"
    ? `${t("collections.startsIn")} ${timeText}`
    : `${t("collections.endsIn")} ${timeText}`;
}

function getFilteredLots() {
  const ns = state.search.trim().toLowerCase();
  return AUCTION_LOTS.filter(
    (lot) =>
      (state.status === "all" || lot.status === state.status) &&
      (state.category === "all" || lot.category === state.category) &&
      (!ns ||
        lot.title.toLowerCase().includes(ns) ||
        lot.lot.toLowerCase().includes(ns) ||
        lot.category.toLowerCase().includes(ns)),
  ).sort((a, b) =>
    state.sort === "highest-bid"
      ? getNumberFromMoney(b.currentBid || b.startingBid) - getNumberFromMoney(a.currentBid || a.startingBid)
      : state.sort === "newest"
        ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        : state.sort === "most-bids"
          ? b.bidCount - a.bidCount
          : new Date(a.endingAt).getTime() - new Date(b.endingAt).getTime(),
  );
}

function getStatusClass(status) {
  return status === "active"
    ? "status-active"
    : status === "closing"
      ? "status-closing"
      : status === "ended" || status === "completed"
        ? "status-ended"
        : "status-scheduled";
}

function createAuctionCard(lot) {
  const priceLabel = lot.status === "scheduled" ? t("collections.startingBid") : t("collections.currentBid");
  const priceValue = lot.status === "scheduled" ? lot.startingBid : lot.currentBid || lot.startingBid;
  return `
        <article class="auction-card" data-lot-id="${lot.id}">
            <div class="auction-card-media"><img src="${lot.image}" alt="${lot.title}" /><span class="status-badge ${getStatusClass(lot.status)}">${STATUS_LABELS[lot.status] || lot.status}</span></div>
            <div class="auction-card-body">
                <div class="auction-card-meta"><span>${lot.lot}</span><span>${t("collections.bids", { count: lot.bidCount })}</span></div>
                <h3>${lot.title}</h3><p>${lot.estimate}</p>
                <div class="auction-card-divider"></div>
                <div class="auction-card-bottom">
                    <div>
                        <span class="field-label">${priceLabel}</span>
                        <strong style="display:inline-block" data-auction-card-price="${lot.id}">${priceValue}</strong>
                    </div>
                    <div>
                        <span class="field-label">${lot.status === "scheduled" ? t("collections.notOpen") : "Time"}</span>
                        <strong>${getCountdownLabel(lot)}</strong>
                    </div>
                </div>
                <a href="./auction-detail.html?id=${lot.id}" class="button button-outline" style="margin-top: 22px;">${t("collections.viewDetails")}</a>
            </div>
        </article>
    `;
}

function updateStatusTabs() {
  document
    .querySelectorAll("[data-status-filter]")
    .forEach((b) => b.classList.toggle("is-active", b.dataset.statusFilter === state.status));
}
function updateCategorySelect() {
  const s = document.querySelector("[data-category-filter]");
  if (s) s.value = state.category;
}
function updateSortSelect() {
  const s = document.querySelector("[data-sort-select]");
  if (s) s.value = state.sort;
}
function updateSearchInput() {
  const s = document.querySelector("[data-search-input]");
  if (s) s.value = state.search;
}
function updateCurrentSortLabel() {
  const cs = document.querySelector("[data-current-sort]"),
    ss = document.querySelector("[data-sort-select]");
  if (cs && ss) cs.textContent = ss.querySelector(`option[value="${state.sort}"]`)?.textContent || "Ending Soonest";
}

function renderLots() {
  const grid = document.querySelector("[data-auction-grid]"),
    emptyState = document.querySelector("[data-empty-state]"),
    resultCount = document.querySelector("[data-result-count]"),
    showingLabel = document.querySelector("[data-showing-label]"),
    loadMoreButton = document.querySelector("[data-load-more]");
  if (!grid) return;
  if (state.isLoading) {
    grid.innerHTML = `<article class="auction-card"><div class="auction-card-body"><p class="eyebrow">Loading</p><h3>Fetching auction lots...</h3><p>Connecting to backend inventory.</p></div></article>`;
    return;
  }

  const filteredLots = getFilteredLots(),
    visibleLots = filteredLots.slice(0, state.visibleCount);
  grid.innerHTML = visibleLots.map(createAuctionCard).join("");
  if (emptyState) emptyState.hidden = filteredLots.length > 0;
  if (resultCount) resultCount.textContent = t("collections.lotsFound", { count: filteredLots.length });
  if (showingLabel)
    showingLabel.textContent = t("collections.showing", { visible: visibleLots.length, total: filteredLots.length });
  if (loadMoreButton) loadMoreButton.hidden = visibleLots.length >= filteredLots.length;
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
    const response = await apiClient.get("/auctions", null, { auth: false });
    AUCTION_LOTS = (response.data?.auctions || []).map(normalizeAuction);
  } catch (error) {
    console.error("[Auction List]", error);
    AUCTION_LOTS = [];
  } finally {
    state.isLoading = false;
    renderAuctionList();
  }
}

function bindFilterEvents() {
  document.querySelectorAll("[data-status-filter]").forEach((b) =>
    b.addEventListener("click", () => {
      state.status = b.dataset.statusFilter || DEFAULT_STATUS;
      state.visibleCount = DEFAULT_VISIBLE_COUNT;
      updateUrl();
      renderAuctionList();
    }),
  );
  const cs = document.querySelector("[data-category-filter]");
  if (cs)
    cs.addEventListener("change", () => {
      state.category = cs.value || DEFAULT_CATEGORY;
      state.visibleCount = DEFAULT_VISIBLE_COUNT;
      updateUrl();
      renderAuctionList();
    });
  const ss = document.querySelector("[data-sort-select]");
  if (ss)
    ss.addEventListener("change", () => {
      state.sort = ss.value || DEFAULT_SORT;
      updateUrl();
      renderAuctionList();
    });
  const si = document.querySelector("[data-search-input]");
  if (si)
    si.addEventListener("input", () => {
      state.search = si.value;
      state.visibleCount = DEFAULT_VISIBLE_COUNT;
      updateUrl();
      renderAuctionList();
    });
  const lm = document.querySelector("[data-load-more]");
  if (lm)
    lm.addEventListener("click", () => {
      state.visibleCount += 4;
      renderAuctionList();
    });
  const rb = document.querySelector("[data-reset-filters]");
  if (rb)
    rb.addEventListener("click", () => {
      state.status = DEFAULT_STATUS;
      state.category = DEFAULT_CATEGORY;
      state.search = "";
      state.sort = DEFAULT_SORT;
      state.visibleCount = DEFAULT_VISIBLE_COUNT;
      updateUrl();
      renderAuctionList();
    });
}

function initAuctionListPage() {
  initTheme();
  initI18n();
  initSiteHeader({ hideAfter: 120, topRevealOffset: 12 });
  getInitialStateFromUrl();
  bindFilterEvents();
  renderAuctionList();
  fetchAuctions();
  window.setInterval(renderLots, 1000);
  onLanguageChange(() => renderAuctionList());

  // --- KÍCH HOẠT REAL-TIME GIẬT GIÁ NGOÀI DANH SÁCH ---
  if (window.socketClient) {
    window.socketClient.connect("global");
    window.socketClient.on("new_bid", (data) => {
      const priceElement = document.querySelector(`[data-auction-card-price="${data.auctionId}"]`);
      if (priceElement) {
        const newPrice = Number(data.bidAmount || data.price || data.amount || 0);
        priceElement.textContent = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }).format(newPrice);

        // Hiệu ứng giật giá
        priceElement.style.color = "var(--success)";
        priceElement.style.transform = "scale(1.1)";
        priceElement.style.transition = "all 0.3s ease";

        setTimeout(() => {
          priceElement.style.color = "";
          priceElement.style.transform = "scale(1)";
        }, 500);
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", initAuctionListPage);

import { initTheme } from "../core/theme.js";
import { initSiteHeader } from "../core/header.js";
import apiClient from "../core/api-client.js";
import "../core/socket-client.js";

const API_ORIGIN = window.BROSGEM_API_ORIGIN || "http://localhost:3000";
const PAGE_SIZE = 8;
const CLOSING_SOON_WINDOW_MS = 5 * 60 * 1000;

const PLACEHOLDER_IMAGE = `data:image/svg+xml;utf8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="900" height="700" viewBox="0 0 900 700">
    <rect width="900" height="700" fill="#151516"/>
    <rect x="42" y="42" width="816" height="616" fill="none" stroke="#c5a059" stroke-opacity=".5"/>
    <text x="450" y="330" text-anchor="middle" fill="#c5a059" font-family="Arial, sans-serif" font-size="34" font-weight="700" letter-spacing="7">BROSGEM</text>
    <text x="450" y="380" text-anchor="middle" fill="#aeb6c2" font-family="Arial, sans-serif" font-size="18" letter-spacing="4">DATABASE IMAGE</text>
  </svg>
`)}`;

const state = {
  allAuctions: [],
  filteredAuctions: [],
  visibleCount: PAGE_SIZE,
  status: "active",
  category: "all",
  search: "",
  sort: "ending-soon",
  searchTimer: null,
  countdownTimer: null,
};

const elements = {};

function cacheElements() {
  elements.grid = document.querySelector("[data-auction-grid]");
  elements.emptyState = document.querySelector("[data-empty-state]");
  elements.resultCount = document.querySelector("[data-result-count]");
  elements.showingLabel = document.querySelector("[data-showing-label]");
  elements.categoryFilter = document.querySelector("[data-category-filter]");
  elements.searchInput = document.querySelector("[data-search-input]");
  elements.loadMoreButton = document.querySelector("[data-load-more]");
  elements.resetFiltersButton = document.querySelector("[data-reset-filters]");
  elements.statusButtons = Array.from(document.querySelectorAll("[data-status-filter]"));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeKey(value) {
  return normalizeText(value).replace(/[\s_]+/g, "-");
}

function normalizeStatus(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  const map = {
    active: "active",
    closing: "closing",
    closing_soon: "closing",
    scheduled: "scheduled",
    ended: "ended",
    completed: "completed",
    complete: "completed",
    payment_pending: "payment_pending",
    pending: "pending",
    rejected: "rejected",
    cancelled: "cancelled",
    canceled: "cancelled",
  };

  return map[normalized] || normalized || "active";
}

function normalizeCategory(value) {
  const normalized = normalizeKey(value);

  const map = {
    horology: "horology",
    "fine-art": "fine-art",
    fineart: "fine-art",
    automotive: "automotive",
    jewelry: "jewelry",
    jewellery: "jewelry",
    collectibles: "collectibles",
    collectible: "collectibles",
  };

  return map[normalized] || normalized || "collectibles";
}

function getRawValue(object, keys, fallback = null) {
  for (const key of keys) {
    if (object && object[key] !== undefined && object[key] !== null) {
      return object[key];
    }
  }

  return fallback;
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function parseTimeMs(value) {
  if (!value) return 0;
  if (typeof value === "number") return value;

  const text = String(value).trim();

  if (!text) return 0;

  if (/^\d+$/.test(text)) {
    return Number(text);
  }

  const normalizedText = text.includes("T") ? text : text.replace(" ", "T");
  const parsed = new Date(normalizedText).getTime();

  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDateTime(value) {
  const time = parseTimeMs(value);

  if (!time) {
    return "Chưa đặt";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(time));
}

function formatCountdown(endTime) {
  const endTimeMs = parseTimeMs(endTime);

  if (!endTimeMs) {
    return "Đang cập nhật";
  }

  const distance = endTimeMs - Date.now();

  if (distance <= 0) {
    return "Đã kết thúc";
  }

  const totalSeconds = Math.floor(distance / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatStartsIn(startTime) {
  const startTimeMs = parseTimeMs(startTime);

  if (!startTimeMs) {
    return "Chưa đặt";
  }

  const distance = startTimeMs - Date.now();

  if (distance <= 0) {
    return "Sắp mở";
  }

  const totalSeconds = Math.floor(distance / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getStatusLabel(status) {
  const map = {
    active: "Đang Mở",
    scheduled: "Đã Lên Lịch",
    closing: "Sắp Đóng",
    ended: "Đã Kết Thúc",
    payment_pending: "Chờ Thanh Toán",
    completed: "Hoàn Tất",
    cancelled: "Đã Hủy",
    pending: "Chờ Duyệt",
    rejected: "Bị Từ Chối",
  };

  return map[normalizeStatus(status)] || "Đang Cập Nhật";
}

function getStatusClass(status) {
  const normalized = normalizeStatus(status);

  if (normalized === "active") return "status-active";
  if (normalized === "closing") return "status-closing";
  if (normalized === "scheduled") return "status-scheduled";
  if (normalized === "ended") return "status-ended";
  if (normalized === "completed") return "status-completed";

  return "status-active";
}

function deriveAuctionStatus(rawStatus, startTime, endTime, nowMs = Date.now()) {
  const normalized = normalizeStatus(rawStatus);
  const startMs = parseTimeMs(startTime);
  const endMs = parseTimeMs(endTime);

  if (normalized === "pending") {
    return "pending";
  }

  if (normalized === "rejected") {
    return "rejected";
  }

  if (normalized === "cancelled") {
    return "cancelled";
  }

  if (normalized === "payment_pending") {
    return "payment_pending";
  }

  if (normalized === "completed") {
    return "completed";
  }

  if (endMs && endMs <= nowMs) {
    return "ended";
  }

  if (startMs && startMs > nowMs) {
    return "scheduled";
  }

  if (endMs && endMs > nowMs && endMs - nowMs <= CLOSING_SOON_WINDOW_MS) {
    return "closing";
  }

  return "active";
}

function refreshDerivedStatuses() {
  const nowMs = Date.now();
  let hasStatusChanged = false;

  state.allAuctions = state.allAuctions.map((auction) => {
    const nextStatus = deriveAuctionStatus(
      auction.rawStatus || auction.status,
      auction.startTime,
      auction.endTime,
      nowMs,
    );
    const nextNormalizedStatus = normalizeStatus(nextStatus);

    if (nextNormalizedStatus !== auction.normalizedStatus) {
      hasStatusChanged = true;
    }

    return {
      ...auction,
      status: nextStatus,
      normalizedStatus: nextNormalizedStatus,
    };
  });

  return hasStatusChanged;
}

function resolveImageUrl(value) {
  const raw = String(value || "").trim();

  if (!raw) {
    return PLACEHOLDER_IMAGE;
  }

  if (raw.startsWith("data:") || raw.startsWith("blob:")) {
    return raw;
  }

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  if (raw.startsWith("/uploads/")) {
    return `${API_ORIGIN}${raw}`;
  }

  if (raw.startsWith("uploads/")) {
    return `${API_ORIGIN}/${raw}`;
  }

  if (raw.startsWith("../") || raw.startsWith("./") || raw.startsWith("/")) {
    return raw;
  }

  return `../${raw.replace(/^\/+/, "")}`;
}

function getAuctionTitle(rawAuction) {
  return getRawValue(
    rawAuction,
    ["title", "product_name", "productName", "name", "product_title", "productTitle"],
    "Vật phẩm đấu giá",
  );
}

function normalizeAuction(rawAuction = {}) {
  const id = toNumber(getRawValue(rawAuction, ["id", "auction_id", "auctionId"]), 0);
  const rawStatus = getRawValue(rawAuction, ["status"], "Active");
  const currentPrice = toNumber(getRawValue(rawAuction, ["currentPrice", "current_price", "price"], 0), 0);
  const startingPrice = toNumber(
    getRawValue(rawAuction, ["startingPrice", "starting_price", "currentPrice", "current_price"], currentPrice),
    currentPrice,
  );
  const stepPrice = toNumber(getRawValue(rawAuction, ["stepPrice", "step_price", "increment"], 0), 0);
  const depositAmount = toNumber(getRawValue(rawAuction, ["depositAmount", "deposit_amount"], 0), 0);
  const bidCount = toNumber(getRawValue(rawAuction, ["bidCount", "bid_count", "bidsCount"], 0), 0);
  const category = getRawValue(rawAuction, ["category", "product_category"], "collectibles");
  const endTime = getRawValue(rawAuction, ["endTime", "end_time", "endsAt", "ends_at"], null);
  const startTime = getRawValue(rawAuction, ["startTime", "start_time", "startsAt", "starts_at"], null);
  const createdAt = getRawValue(rawAuction, ["createdAt", "created_at"], null);
  const imageUrl = getRawValue(rawAuction, ["imageUrl", "image_url", "productImage", "product_image"], null);
  const derivedStatus = deriveAuctionStatus(rawStatus, startTime, endTime);

  return {
    id,
    lot: getRawValue(rawAuction, ["lot"], `Lô #${String(id).padStart(3, "0")}`),
    title: getAuctionTitle(rawAuction),
    description: getRawValue(rawAuction, ["description", "product_description"], "Đang cập nhật mô tả tài sản."),
    category: category || "collectibles",
    normalizedCategory: normalizeCategory(category),
    rawStatus: normalizeStatus(rawStatus),
    status: derivedStatus,
    normalizedStatus: normalizeStatus(derivedStatus),
    currentPrice,
    startingPrice,
    stepPrice,
    depositAmount,
    requiresDeposit: Boolean(getRawValue(rawAuction, ["requiresDeposit", "requires_deposit"], false)),
    bidCount,
    startTime,
    endTime,
    createdAt,
    imageUrl: resolveImageUrl(imageUrl),
  };
}

function getAuctionsFromPayload(payload) {
  const candidates = [
    payload?.data?.auctions,
    payload?.data?.items,
    payload?.data?.results,
    payload?.data,
    payload?.auctions,
    payload?.items,
    payload,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
}

function getSortLabel(sortValue) {
  const map = {
    "ending-soon": "Sắp Kết Thúc",
    "highest-bid": "Giá Cao Nhất",
    newest: "Mới Nhất",
    "most-bids": "Nhiều Lượt Giá Nhất",
  };

  return map[sortValue] || "Sắp Kết Thúc";
}

function setStatusButtons() {
  elements.statusButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.statusFilter === state.status);
  });
}

function applyFiltersAndSort() {
  refreshDerivedStatuses();

  const searchNeedle = normalizeText(state.search);

  let result = [...state.allAuctions];

  if (state.status !== "all") {
    result = result.filter((auction) => auction.normalizedStatus === normalizeStatus(state.status));
  }

  if (state.category !== "all") {
    result = result.filter((auction) => auction.normalizedCategory === normalizeCategory(state.category));
  }

  if (searchNeedle) {
    result = result.filter((auction) => {
      const haystack = normalizeText(
        [
          auction.title,
          auction.description,
          auction.category,
          auction.lot,
          auction.status,
          auction.rawStatus,
          auction.id,
        ].join(" "),
      );

      return haystack.includes(searchNeedle);
    });
  }

  result.sort((left, right) => {
    if (state.sort === "highest-bid") {
      return right.currentPrice - left.currentPrice;
    }

    if (state.sort === "newest") {
      return parseTimeMs(right.createdAt || right.startTime) - parseTimeMs(left.createdAt || left.startTime);
    }

    if (state.sort === "most-bids") {
      return right.bidCount - left.bidCount;
    }

    const leftEnd = parseTimeMs(left.endTime);
    const rightEnd = parseTimeMs(right.endTime);
    const nowMs = Date.now();

    const leftFutureEnd = leftEnd && leftEnd > nowMs ? leftEnd : Number.MAX_SAFE_INTEGER;
    const rightFutureEnd = rightEnd && rightEnd > nowMs ? rightEnd : Number.MAX_SAFE_INTEGER;

    if (leftFutureEnd !== rightFutureEnd) {
      return leftFutureEnd - rightFutureEnd;
    }

    return rightEnd - leftEnd;
  });

  state.filteredAuctions = result;
}

function renderCounters() {
  const total = state.filteredAuctions.length;
  const visible = Math.min(state.visibleCount, total);

  if (elements.resultCount) {
    elements.resultCount.textContent = `Tìm thấy ${total} lô`;
  }

  if (elements.showingLabel) {
    elements.showingLabel.textContent = `Đang hiển thị ${visible} / ${total} lô`;
  }

  if (elements.currentSort) {
    elements.currentSort.textContent = getSortLabel(state.sort);
  }

  if (elements.loadMoreButton) {
    elements.loadMoreButton.hidden = visible >= total;
    elements.loadMoreButton.disabled = visible >= total;
  }
}

function renderEmptyState() {
  const hasItems = state.filteredAuctions.length > 0;

  if (elements.emptyState) {
    elements.emptyState.hidden = hasItems;
  }

  if (elements.grid) {
    elements.grid.hidden = !hasItems;
  }
}

function renderAuctionCard(auction) {
  const detailHref = `./auction-detail.html?id=${encodeURIComponent(auction.id)}`;
  const isActive = auction.normalizedStatus === "active" || auction.normalizedStatus === "closing";
  const isScheduled = auction.normalizedStatus === "scheduled";

  return `
    <article class="auction-card collection-auction-card" data-auction-id="${escapeHtml(auction.id)}">
      <a href="${detailHref}" class="auction-card-link" style="color: inherit; text-decoration: none;">
        <div class="auction-card-media">
          <img
            src="${escapeHtml(auction.imageUrl)}"
            alt="${escapeHtml(auction.title)}"
            loading="lazy"
            onerror="this.onerror=null;this.src='${PLACEHOLDER_IMAGE}'"
          />
          <span class="status-badge ${getStatusClass(auction.status)}">${getStatusLabel(auction.status)}</span>
        </div>

        <div class="auction-card-body">
          <div class="auction-card-meta">
            <span>${escapeHtml(auction.lot)}</span>
            <span>${auction.bidCount} lượt giá</span>
          </div>

          <h3>${escapeHtml(auction.title)}</h3>
          <p>${escapeHtml(auction.description)}</p>

          <div class="auction-card-divider"></div>

          <div class="auction-card-bottom">
            <div>
              <span class="field-label">Giá Hiện Tại</span>
              <strong>${formatMoney(auction.currentPrice)}</strong>
            </div>

            <div>
              <span class="field-label">${isActive ? "Kết Thúc Trong" : isScheduled ? "Bắt Đầu Trong" : "Thời Gian"}</span>
              <strong data-countdown-card="${escapeHtml(auction.id)}">
                ${isActive ? formatCountdown(auction.endTime) : isScheduled ? formatStartsIn(auction.startTime) : formatDateTime(auction.startTime || auction.endTime)}
              </strong>
            </div>
          </div>

          <div class="auction-card-bottom" style="margin-top: 18px;">
            <div>
              <span class="field-label">Bước Giá</span>
              <strong>${auction.stepPrice > 0 ? formatMoney(auction.stepPrice) : "Đang cập nhật"}</strong>
            </div>

            <div>
              <span class="field-label">Tiền Cọc</span>
              <strong>${auction.requiresDeposit ? formatMoney(auction.depositAmount) : "Không yêu cầu"}</strong>
            </div>
          </div>
        </div>
      </a>

      <div style="padding: 0 18px 16px; margin-top: -4px;">
        <button
          type="button"
          class="button button-outline"
          style="width: 100%; font-size: 11px; letter-spacing: 0.12em; padding: 10px;"
          data-watchlist-btn="${escapeHtml(auction.id)}"
          onclick="handleWatchlistToggle(${Number(auction.id)}, this)"
        >
          ♡ Theo Dõi
        </button>
      </div>
    </article>
  `;
}

function renderAuctions() {
  if (!elements.grid) return;

  applyFiltersAndSort();

  const visibleAuctions = state.filteredAuctions.slice(0, state.visibleCount);

  elements.grid.innerHTML = visibleAuctions.map(renderAuctionCard).join("");

  renderCounters();
  renderEmptyState();
}

function renderLoadingState() {
  if (elements.grid) {
    elements.grid.hidden = false;
    elements.grid.innerHTML = `
      <article class="auction-card" style="min-height: 280px; display: grid; place-items: center; border: 1px solid var(--border);">
        <div style="text-align: center;">
          <span style="color: var(--primary); font-size: 28px;">◇</span>
          <p style="margin-top: 12px; color: var(--text-muted); font-weight: 800; letter-spacing: .14em; text-transform: uppercase;">
            Đang tải phiên đấu giá thật từ database...
          </p>
        </div>
      </article>
    `;
  }

  if (elements.emptyState) {
    elements.emptyState.hidden = true;
  }

  if (elements.resultCount) {
    elements.resultCount.textContent = "Đang tải lô...";
  }

  if (elements.showingLabel) {
    elements.showingLabel.textContent = "Đang hiển thị 0 / 0 lô";
  }
}

function renderErrorState(message) {
  if (elements.grid) {
    elements.grid.hidden = false;
    elements.grid.innerHTML = `
      <article class="auction-card" style="min-height: 280px; display: grid; place-items: center; border: 1px solid rgba(225,96,96,.5);">
        <div style="text-align: center; max-width: 520px; padding: 32px;">
          <span style="color: #ff8f8f; font-size: 28px;">!</span>
          <h3 style="margin-top: 14px; color: var(--text);">Không thể tải phiên đấu giá</h3>
          <p style="margin-top: 8px; color: var(--text-muted); line-height: 1.7;">${escapeHtml(message)}</p>
          <button type="button" class="button button-outline" data-retry-load style="margin-top: 18px;">Thử Lại</button>
        </div>
      </article>
    `;

    elements.grid.querySelector("[data-retry-load]")?.addEventListener("click", loadAuctions);
  }

  if (elements.emptyState) {
    elements.emptyState.hidden = true;
  }

  renderCounters();
}

async function loadAuctions() {
  renderLoadingState();

  const query = {};

  try {
    const response = await apiClient.get("/auctions", query, {
      auth: false,
      redirectOnUnauthorized: false,
      idempotency: false,
    });

    const rawAuctions = getAuctionsFromPayload(response);

    state.allAuctions = rawAuctions.map(normalizeAuction).filter((auction) => auction.id > 0);

    state.visibleCount = PAGE_SIZE;

    renderAuctions();
  } catch (error) {
    state.allAuctions = [];
    state.filteredAuctions = [];
    renderErrorState(error.message || "Backend chưa trả dữ liệu đấu giá.");
  }
}

function refreshVisibleCountdowns() {
  const hasStatusChanged = refreshDerivedStatuses();

  if (hasStatusChanged) {
    renderAuctions();
    return;
  }

  document.querySelectorAll("[data-countdown-card]").forEach((element) => {
    const auctionId = Number(element.dataset.countdownCard);
    const auction = state.filteredAuctions.find((item) => Number(item.id) === auctionId);

    if (!auction) return;

    if (auction.normalizedStatus === "active" || auction.normalizedStatus === "closing") {
      element.textContent = formatCountdown(auction.endTime);
    }

    if (auction.normalizedStatus === "scheduled") {
      element.textContent = formatStartsIn(auction.startTime);
    }
  });
}

function resetFilters() {
  state.status = "active";
  state.category = "all";
  state.search = "";
  state.sort = "ending-soon";
  state.visibleCount = PAGE_SIZE;

  if (elements.categoryFilter) elements.categoryFilter.value = "all";
  if (elements.searchInput) elements.searchInput.value = "";
  if (elements.sortSelect) elements.sortSelect.value = "ending-soon";

  setStatusButtons();
  renderAuctions();
}

function bindEvents() {
  elements.statusButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextStatus = button.dataset.statusFilter || "active";

      if (state.status === nextStatus) {
        return;
      }

      state.status = nextStatus;
      state.visibleCount = PAGE_SIZE;
      setStatusButtons();
      renderAuctions();
    });
  });

  elements.categoryFilter?.addEventListener("change", () => {
    state.category = elements.categoryFilter.value || "all";
    state.visibleCount = PAGE_SIZE;
    renderAuctions();
  });

  elements.searchInput?.addEventListener("input", () => {
    state.search = elements.searchInput.value || "";

    window.clearTimeout(state.searchTimer);
    state.searchTimer = window.setTimeout(() => {
      state.visibleCount = PAGE_SIZE;
      renderAuctions();
    }, 240);
  });

  elements.loadMoreButton?.addEventListener("click", () => {
    state.visibleCount += PAGE_SIZE;
    renderAuctions();
  });

  elements.resetFiltersButton?.addEventListener("click", resetFilters);
}

function bindSocketEvents() {
  if (!window.socketClient) return;

  window.socketClient.connect("global");

  window.socketClient.on("new_bid", () => {
    loadAuctions();
  });

  window.socketClient.on("auction_winner", () => {
    loadAuctions();
  });

  window.socketClient.on("auction_finalized", () => {
    loadAuctions();
  });
}

function startCountdownTicker() {
  if (state.countdownTimer) {
    window.clearInterval(state.countdownTimer);
  }

  state.countdownTimer = window.setInterval(refreshVisibleCountdowns, 1000);
}

function initLiveAuctionsPage() {
  initTheme();
  initSiteHeader({ hideAfter: 120, topRevealOffset: 12 });

  cacheElements();
  bindEvents();
  bindSocketEvents();
  setStatusButtons();
  startCountdownTicker();
  loadAuctions();
  syncWatchlistState();
}

// ─── WATCHLIST TOGGLE ────────────────────────────────────────────────────────
const watchlistState = new Set(); // lưu id các auction đang theo dõi

async function syncWatchlistState() {
  const token = apiClient.getAuthToken();
  if (!token) return;

  try {
    const res = await apiClient.get("/watchlist", null, {
      auth: true,
      redirectOnUnauthorized: false,
    });
    const auctions = res?.data?.auctions || [];
    auctions.forEach((a) => watchlistState.add(Number(a.auctionId)));
    refreshWatchlistButtons();
  } catch {
    // Không bắt buộc — user chưa login thì bỏ qua
  }
}

function refreshWatchlistButtons() {
  document.querySelectorAll("[data-watchlist-btn]").forEach((btn) => {
    const id = Number(btn.dataset.watchlistBtn);
    const isWatching = watchlistState.has(id);
    btn.textContent = isWatching ? "♥ Đang Theo Dõi" : "♡ Theo Dõi";
    btn.style.color = isWatching ? "var(--primary)" : "";
    btn.style.borderColor = isWatching ? "var(--primary)" : "";
  });
}

window.handleWatchlistToggle = async function (auctionId, button) {
  const token = apiClient.getAuthToken();
  if (!token) {
    window.location.href = "./login.html?redirect=" + encodeURIComponent(window.location.href);
    return;
  }

  const isWatching = watchlistState.has(auctionId);
  button.disabled = true;
  button.textContent = "...";

  try {
    if (isWatching) {
      await apiClient.delete(`/watchlist/${auctionId}`, { auth: true });
      watchlistState.delete(auctionId);
    } else {
      await apiClient.post(`/watchlist/${auctionId}`, null, { auth: true });
      watchlistState.add(auctionId);
    }
    refreshWatchlistButtons();
  } catch (error) {
    button.textContent = isWatching ? "♥ Đang Theo Dõi" : "♡ Theo Dõi";
    console.error("[Watchlist]", error.message);
  } finally {
    button.disabled = false;
  }
};

document.addEventListener("DOMContentLoaded", initLiveAuctionsPage);

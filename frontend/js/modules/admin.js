import { initTheme } from "../core/theme.js";
import { initSiteHeader } from "../core/header.js";
import apiClient from "../core/api-client.js";

const TAB_COPY = {
  overview: {
    title: "Tổng Quan",
    subtitle: "Giám sát hoạt động đấu giá, yêu cầu chờ duyệt, tín hiệu gian lận, thanh toán và người dùng.",
  },
  auctions: {
    title: "Quản Lý Đấu Giá",
    subtitle: "Duyệt phiên do user gửi, mở phiên để mọi người đấu giá, theo dõi trạng thái và dòng tiền.",
  },
  verification: {
    title: "Hàng Đợi Xác Minh",
    subtitle: "Các phiên trạng thái Scheduled được xem như tài sản đang chờ admin duyệt.",
  },
  fraud: {
    title: "Cảnh Báo Gian Lận",
    subtitle: "Theo dõi cảnh báo từ AI Engine hoặc Backend proxy, tùy kiến trúc team đang triển khai.",
  },
  settlements: {
    title: "Đối Soát Tài Chính",
    subtitle: "Theo dõi trạng thái Payment Pending và Completed sau khi phiên đấu giá kết thúc.",
  },
  users: {
    title: "Người Dùng",
    subtitle: "Quản lý phiên người dùng hiện tại và hồ sơ liên quan.",
  },
};

const FALLBACK_IMAGES = [
  "../assets/images/mockdata/1.png",
  "../assets/images/mockdata/2.png",
  "../assets/images/mockdata/3.png",
  "../assets/images/mockdata/4.png",
  "../assets/images/mockdata/5.png",
  "../assets/images/mockdata/6.png",
  "../assets/images/mockdata/7.png",
];

const FRAUD_ALERT_SOURCES = [
  { name: "Backend /api/alerts", type: "backend", endpoint: "/alerts" },
  { name: "Backend /api/admin/alerts", type: "backend", endpoint: "/admin/alerts" },
  { name: "Backend /api/fraud-alerts", type: "backend", endpoint: "/fraud-alerts" },
  { name: "AI FastAPI trực tiếp", type: "absolute", endpoint: "http://127.0.0.1:8000/api/v1/alerts" },
];

const state = {
  auctions: [],
  filteredAuctions: [],
  alerts: [],
  activeAlertSource: "",
  search: "",
  status: "all",
  category: "all",
  sort: "ending-soon",
  isLoading: false,
  isFraudLoading: false,
  fraudError: "",
};

function showToast(title, message, type = "info") {
  const toastStack = document.querySelector("[data-toast-stack]");
  if (!toastStack) return;

  const toast = document.createElement("article");
  toast.className = `toast toast-${type}`;
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function setActiveTab(tabName) {
  const nextCopy = TAB_COPY[tabName] || TAB_COPY.overview;

  document.querySelectorAll("[data-admin-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.adminTab === tabName);
  });

  document.querySelectorAll("[data-admin-panel]").forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.adminPanel === tabName);
  });

  setText("[data-admin-title]", nextCopy.title);
  setText("[data-admin-subtitle]", nextCopy.subtitle);

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

  if (status === "payment pending") return "payment_pending";
  if (status === "đang mở") return "active";
  if (status === "đã lên lịch") return "scheduled";
  if (status === "sắp đóng") return "closing";
  if (status === "đã kết thúc") return "ended";
  if (status === "đã hoàn tất") return "completed";

  return status || "unknown";
}

function normalizeCategory(value) {
  return String(value || "collectibles").trim().toLowerCase().replace(/\s+/g, "-");
}

function getFallbackImage(id) {
  return FALLBACK_IMAGES[Math.abs(Number(id || 0)) % FALLBACK_IMAGES.length];
}

function normalizeAuction(rawAuction) {
  const id = rawAuction.id;

  return {
    id,
    lot: rawAuction.lot || `Lô #${String(id || 0).padStart(3, "0")}`,
    title: rawAuction.title || rawAuction.productName || rawAuction.product_name || "Chưa có tên",
    description: rawAuction.description || "",
    category: normalizeCategory(rawAuction.category),
    status: normalizeStatus(rawAuction.status),
    currentPrice: Number(rawAuction.currentPrice || rawAuction.current_price || 0),
    stepPrice: Number(rawAuction.stepPrice || rawAuction.step_price || 0),
    bidCount: Number(rawAuction.bidCount || rawAuction.bid_count || 0),
    seller: rawAuction.sellerUsername || rawAuction.seller_username || rawAuction.seller || "Không rõ",
    imageUrl: rawAuction.imageUrl || rawAuction.image_url || getFallbackImage(id),
    endTime: rawAuction.endTime || rawAuction.end_time || null,
    createdAt: rawAuction.createdAt || rawAuction.created_at || null,
    createdBy: rawAuction.createdBy || rawAuction.created_by || null,
  };
}

function parseReasons(value) {
  if (!value) return "Chưa có mô tả chi tiết.";

  if (Array.isArray(value)) {
    return value.join(" / ");
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.join(" / ");
      return String(parsed);
    } catch {
      return value;
    }
  }

  return String(value);
}

function normalizeAlert(rawAlert) {
  const score = Number(
    rawAlert.lss ||
      rawAlert.lss_score ||
      rawAlert.liveShillScore ||
      rawAlert.live_shill_score ||
      rawAlert.risk_score ||
      rawAlert.score ||
      0,
  );

  const auctionId =
    rawAlert.auctionId ||
    rawAlert.auction_id ||
    rawAlert.auctionID ||
    rawAlert.auction ||
    rawAlert.auction_id_detected ||
    "N/A";

  const userId =
    rawAlert.userId ||
    rawAlert.user_id ||
    rawAlert.suspectedUserId ||
    rawAlert.suspected_user_id ||
    rawAlert.bidder_id ||
    "N/A";

  const username =
    rawAlert.suspectedUsername ||
    rawAlert.suspected_username ||
    rawAlert.username ||
    rawAlert.user_name ||
    rawAlert.bidder_username ||
    `User #${userId}`;

  return {
    id: rawAlert.id || `${auctionId}-${userId}-${rawAlert.createdAt || rawAlert.created_at || Date.now()}`,
    auctionId,
    userId,
    username,
    score: Number.isFinite(score) ? score : 0,
    reason: parseReasons(rawAlert.reason || rawAlert.reasons || rawAlert.message || rawAlert.details),
    createdAt: rawAlert.createdAt || rawAlert.created_at || rawAlert.timestamp || new Date().toISOString(),
    raw: rawAlert,
  };
}

function normalizeAlertsResponse(response) {
  const candidates = [
    response?.data?.alerts,
    response?.data?.items,
    response?.data?.fraudAlerts,
    response?.data?.fraud_alerts,
    response?.alerts,
    response?.items,
    response?.fraudAlerts,
    response?.fraud_alerts,
    response?.data,
    response,
  ];

  const arrayValue = candidates.find((candidate) => Array.isArray(candidate));
  return arrayValue ? arrayValue.map(normalizeAlert) : [];
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDateTime(value) {
  if (!value) return "Chưa đặt";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("vi-VN", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getStatusClass(status) {
  if (status === "active") return "is-active-status";
  if (status === "scheduled") return "is-scheduled-status";
  if (status === "closing") return "is-closing-status";
  if (status === "ended" || status === "completed") return "is-ended-status";
  if (status === "payment_pending") return "is-pending";
  return "is-pending";
}

function getStatusLabel(status) {
  const map = {
    active: "Đang mở",
    scheduled: "Chờ duyệt",
    closing: "Sắp đóng",
    ended: "Đã kết thúc",
    completed: "Đã hoàn tất",
    payment_pending: "Chờ thanh toán",
  };

  return map[status] || "Không rõ";
}

function updateCurrentUser(user) {
  setText("[data-current-admin-name]", user?.username || user?.name || user?.fullName || "Admin Session");
  setText("[data-current-admin-email]", user?.email || "admin@brosgem.com");
}

function calculateStats() {
  const total = state.auctions.length;
  const active = state.auctions.filter((auction) => auction.status === "active").length;
  const scheduled = state.auctions.filter((auction) => auction.status === "scheduled").length;
  const ended = state.auctions.filter((auction) => ["ended", "completed"].includes(auction.status)).length;
  const totalBids = state.auctions.reduce((sum, auction) => sum + auction.bidCount, 0);
  const totalVolume = state.auctions.reduce((sum, auction) => sum + auction.currentPrice, 0);

  return { total, active, scheduled, ended, totalBids, totalVolume };
}

function updateStats() {
  const stats = calculateStats();

  setText("[data-total-auctions]", String(stats.total).padStart(2, "0"));
  setText("[data-active-auctions]", String(stats.active).padStart(2, "0"));
  setText("[data-scheduled-auctions]", String(stats.scheduled).padStart(2, "0"));
  setText("[data-ended-auctions]", String(stats.ended).padStart(2, "0"));
  setText("[data-total-bids]", String(stats.totalBids).padStart(2, "0"));
  setText("[data-total-volume]", formatCurrency(stats.totalVolume));
  setText("[data-verification-count]", `${stats.scheduled} yêu cầu đang chờ`);
}

function updateBackendStatus(isOnline) {
  setText("[data-backend-status]", isOnline ? "OK" : "OFF");
  setText("[data-backend-status-copy]", isOnline ? "Node.js Backend đang hoạt động tốt." : "Mất kết nối tới Backend.");
  setText("[data-admin-engine-label]", isOnline ? "Backend đấu giá đã kết nối" : "Backend đấu giá hiện không khả dụng");
}

function getFilteredAuctions() {
  const keyword = state.search.trim().toLowerCase();

  return state.auctions
    .filter((auction) => {
      const matchesSearch =
        !keyword ||
        auction.title.toLowerCase().includes(keyword) ||
        auction.lot.toLowerCase().includes(keyword) ||
        auction.seller.toLowerCase().includes(keyword) ||
        auction.category.toLowerCase().includes(keyword);

      const matchesStatus = state.status === "all" || auction.status === state.status;
      const matchesCategory = state.category === "all" || auction.category === state.category;

      return matchesSearch && matchesStatus && matchesCategory;
    })
    .sort((a, b) => {
      if (state.sort === "highest-bid") return b.currentPrice - a.currentPrice;
      if (state.sort === "newest") {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
      if (state.sort === "most-bids") return b.bidCount - a.bidCount;

      return new Date(a.endTime || 0).getTime() - new Date(b.endTime || 0).getTime();
    });
}

function createOverviewAuctionRow(auction) {
  return `
    <div class="admin-request-row">
      <img src="${escapeHtml(auction.imageUrl)}" alt="${escapeHtml(auction.title)}" />
      <div>
        <strong>${escapeHtml(auction.title)}</strong>
        <span>${escapeHtml(auction.lot)} • ${escapeHtml(auction.category.replace("-", " "))} • ${formatCurrency(auction.currentPrice)}</span>
      </div>
      <b>${getStatusLabel(auction.status)}</b>
    </div>
  `;
}

function renderOverviewSnapshot() {
  const list = document.querySelector("[data-overview-auction-list]");
  if (!list) return;

  if (state.isLoading) {
    list.innerHTML = `
      <div class="admin-empty-mini">
        <span>◇</span>
        <p>Đang tải các lô từ máy chủ...</p>
      </div>
    `;
    return;
  }

  const topAuctions = [...state.auctions].sort((a, b) => b.currentPrice - a.currentPrice).slice(0, 3);

  if (topAuctions.length === 0) {
    list.innerHTML = `
      <div class="admin-empty-mini">
        <span>◇</span>
        <p>Chưa có lô đấu giá nào từ database.</p>
      </div>
    `;
    return;
  }

  list.innerHTML = topAuctions.map(createOverviewAuctionRow).join("");
}

function getAuctionActions(auction) {
  const viewAction = `<a href="./product-detail.html?id=${encodeURIComponent(auction.id)}">Xem</a>`;

  if (auction.status === "scheduled") {
    return `
      ${viewAction}
      <button type="button" data-approve-auction="${auction.id}">Duyệt</button>
      <button type="button" data-reject-auction="${auction.id}" class="is-danger">Từ chối</button>
    `;
  }

  if (auction.status === "active" || auction.status === "closing") {
    return `
      ${viewAction}
      <button type="button" data-end-auction="${auction.id}">Kết thúc</button>
    `;
  }

  if (auction.status === "payment_pending") {
    return `
      ${viewAction}
      <a href="./checkout.html?auctionId=${encodeURIComponent(auction.id)}">Thanh toán</a>
    `;
  }

  return viewAction;
}

function createAuctionTableRow(auction) {
  const description = auction.description || "Chưa có mô tả";

  return `
    <tr>
      <td>
        <strong>${escapeHtml(auction.lot)}</strong>
        <span class="admin-table-muted">#${escapeHtml(auction.id)}</span>
      </td>
      <td>
        <div class="admin-auction-asset">
          <img src="${escapeHtml(auction.imageUrl)}" alt="${escapeHtml(auction.title)}" />
          <div>
            <strong>${escapeHtml(auction.title)}</strong>
            <span>${escapeHtml(description.slice(0, 72))}${description.length > 72 ? "..." : ""}</span>
          </div>
        </div>
      </td>
      <td>${escapeHtml(auction.category.replace("-", " "))}</td>
      <td>${escapeHtml(auction.seller)}</td>
      <td>
        <span class="admin-status ${getStatusClass(auction.status)}">${getStatusLabel(auction.status)}</span>
      </td>
      <td>${formatCurrency(auction.currentPrice)}</td>
      <td>${formatNumber(auction.bidCount)}</td>
      <td>${formatDateTime(auction.endTime)}</td>
      <td>
        <div class="admin-row-actions">
          ${getAuctionActions(auction)}
        </div>
      </td>
    </tr>
  `;
}

function renderAuctionTable() {
  const tableBody = document.querySelector("[data-admin-auction-table]");
  const emptyState = document.querySelector("[data-admin-auction-empty]");

  if (!tableBody) return;

  if (state.isLoading) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="9">
          <div class="admin-table-state">
            <span>◇</span>
            <p>Đang tải dữ liệu từ máy chủ...</p>
          </div>
        </td>
      </tr>
    `;

    if (emptyState) emptyState.hidden = true;
    return;
  }

  state.filteredAuctions = getFilteredAuctions();

  setText("[data-admin-auction-count]", `${state.auctions.length} lô đã tải`);
  setText("[data-admin-auction-showing]", `Đang hiển thị ${state.filteredAuctions.length} bản ghi`);

  if (state.filteredAuctions.length === 0) {
    tableBody.innerHTML = "";
    if (emptyState) emptyState.hidden = false;
    return;
  }

  if (emptyState) emptyState.hidden = true;

  tableBody.innerHTML = state.filteredAuctions.map(createAuctionTableRow).join("");
  bindAuctionRowActions();
}

function renderVerificationQueue() {
  const grid = document.querySelector("[data-verification-grid]");
  if (!grid) return;

  const pendingAuctions = state.auctions.filter((auction) => auction.status === "scheduled");

  if (pendingAuctions.length === 0) {
    grid.innerHTML = `
      <div class="admin-empty-state" style="grid-column: 1 / -1;">
        <span>◇</span>
        <h4>Không có yêu cầu nào đang chờ</h4>
        <p>Khi user gửi tài sản đấu giá, phiên sẽ xuất hiện tại đây với trạng thái Chờ duyệt.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = pendingAuctions
    .map(
      (auction) => `
        <article class="verification-card" data-review-card>
          <div class="verification-media">
            <img src="${escapeHtml(auction.imageUrl)}" alt="${escapeHtml(auction.title)}" />
            <span data-review-status>Đang Chờ</span>
          </div>

          <div class="verification-body">
            <p>${escapeHtml(auction.lot)}</p>
            <h4>${escapeHtml(auction.title)}</h4>

            <dl>
              <div>
                <dt>Danh Mục</dt>
                <dd>${escapeHtml(auction.category.replace("-", " "))}</dd>
              </div>
              <div>
                <dt>Người Gửi</dt>
                <dd>${escapeHtml(auction.seller)}</dd>
              </div>
              <div>
                <dt>Giá Khởi Điểm</dt>
                <dd>${formatCurrency(auction.currentPrice)}</dd>
              </div>
              <div>
                <dt>Bước Giá</dt>
                <dd>${formatCurrency(auction.stepPrice)}</dd>
              </div>
            </dl>

            <p class="verification-note">${escapeHtml(auction.description || "Chưa có ghi chú thẩm định.")}</p>

            <div class="verification-actions">
              <button type="button" class="button button-primary" data-approve-auction="${auction.id}">
                Phê Duyệt
              </button>
              <button type="button" class="button button-outline" data-reject-auction="${auction.id}">
                Từ Chối
              </button>
            </div>
          </div>
        </article>
      `,
    )
    .join("");

  bindAuctionRowActions();
}

function renderAdminData() {
  updateStats();
  renderOverviewSnapshot();
  renderAuctionTable();
  renderVerificationQueue();
}

async function fetchAuctions() {
  state.isLoading = true;
  renderAdminData();

  try {
    const response = await apiClient.get("/auctions", null, {
      auth: false,
      idempotency: false,
    });

    state.auctions = (response.data?.auctions || []).map(normalizeAuction);
    updateBackendStatus(true);
  } catch (error) {
    console.error("[Admin] Không thể tải auction:", error);
    state.auctions = [];
    updateBackendStatus(false);
    showToast("Lỗi hệ thống", error.message || "Không thể tải danh sách đấu giá.", "error");
  } finally {
    state.isLoading = false;
    renderAdminData();
  }
}

async function patchJson(endpoint, body) {
  if (typeof apiClient.patch === "function") {
    return apiClient.patch(endpoint, body);
  }

  return apiClient.request(endpoint, {
    method: "PATCH",
    body,
  });
}

async function updateAuctionStatus(auctionId, status) {
  const statusLabel = status === "Active" ? "duyệt" : status === "Ended" ? "từ chối/kết thúc" : "cập nhật";

  try {
    await patchJson(`/auctions/${auctionId}/status`, { status });

    showToast(
      "Cập nhật thành công",
      status === "Active"
        ? "Phiên đã được duyệt và mở công khai cho người dùng đấu giá."
        : `Phiên đã được ${statusLabel}.`,
      "success",
    );

    await fetchAuctions();
  } catch (error) {
    console.error("[Admin Status Error]:", error);
    showToast("Cập nhật thất bại", error.message || "Không thể đổi trạng thái phiên đấu giá.", "error");
  }
}

function bindAuctionRowActions() {
  document.querySelectorAll("[data-approve-auction]").forEach((button) => {
    button.addEventListener("click", () => {
      updateAuctionStatus(button.dataset.approveAuction, "Active");
    });
  });

  document.querySelectorAll("[data-reject-auction]").forEach((button) => {
    button.addEventListener("click", () => {
      updateAuctionStatus(button.dataset.rejectAuction, "Ended");
    });
  });

  document.querySelectorAll("[data-end-auction]").forEach((button) => {
    button.addEventListener("click", () => {
      updateAuctionStatus(button.dataset.endAuction, "Ended");
    });
  });
}

async function fetchAbsoluteJson(url) {
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

async function requestFraudAlertsFromSource(source) {
  if (source.type === "backend") {
    return apiClient.get(source.endpoint, null, {
      auth: true,
      idempotency: false,
      redirectOnUnauthorized: false,
    });
  }

  return fetchAbsoluteJson(source.endpoint);
}

async function requestFirstAvailableAlertSource() {
  const errors = [];

  for (const source of FRAUD_ALERT_SOURCES) {
    try {
      const response = await requestFraudAlertsFromSource(source);
      return { source, response };
    } catch (error) {
      errors.push(`${source.name}: ${error.message || "Không rõ lỗi"}`);
    }
  }

  throw new Error(errors.join(" | "));
}

function getRiskMeta(score) {
  if (score > 0.6) {
    return { className: "fraud-critical", label: "Rủi Ro Nghiêm Trọng" };
  }

  if (score >= 0.4) {
    return { className: "fraud-medium", label: "Rủi Ro Trung Bình" };
  }

  return { className: "fraud-low", label: "Rủi Ro Thấp" };
}

function renderFraudAlerts() {
  const list = document.getElementById("ai-fraud-list");
  const summaryButton = document.getElementById("fraud-summary-btn");
  const sourceLabel = document.querySelector("[data-fraud-source-label]");

  if (!list) return;

  if (sourceLabel) {
    sourceLabel.textContent = state.activeAlertSource
      ? `Nguồn dữ liệu: ${state.activeAlertSource}`
      : "Nguồn dữ liệu: đang dò tự động";
  }

  if (state.isFraudLoading) {
    list.innerHTML = `
      <div class="admin-empty-mini" style="text-align: center; padding: 40px;">
        <span>◇</span>
        <p>Đang dò nguồn cảnh báo: Backend proxy hoặc AI FastAPI...</p>
      </div>
    `;

    if (summaryButton) summaryButton.textContent = "Đang tải...";
    return;
  }

  if (state.fraudError) {
    list.innerHTML = `
      <div class="admin-empty-mini" style="text-align: center; padding: 40px;">
        <span style="font-size: 24px; color: var(--danger);">△</span>
        <h4 style="margin-top: 10px; color: var(--danger);">Chưa lấy được cảnh báo</h4>
        <p>${escapeHtml(state.fraudError)}</p>
        <button type="button" class="button button-outline" data-refresh-fraud-alerts style="margin-top: 16px;">
          Thử Lại
        </button>
      </div>
    `;

    if (summaryButton) summaryButton.textContent = "Không khả dụng";

    list.querySelector("[data-refresh-fraud-alerts]")?.addEventListener("click", fetchFraudAlerts);
    return;
  }

  if (state.alerts.length === 0) {
    list.innerHTML = `
      <div class="admin-empty-mini" style="text-align: center; padding: 40px;">
        <span style="font-size: 24px; color: var(--success);">◇</span>
        <h4 style="margin-top: 10px; color: var(--success);">Hệ thống an toàn</h4>
        <p>Nguồn cảnh báo đã phản hồi nhưng chưa có cảnh báo gian lận nào.</p>
      </div>
    `;

    if (summaryButton) summaryButton.textContent = "0 rủi ro cao";
    return;
  }

  const criticalCount = state.alerts.filter((alert) => alert.score > 0.6).length;

  list.innerHTML = state.alerts
    .map((alert) => {
      const risk = getRiskMeta(alert.score);
      const createdAt = new Date(alert.createdAt);
      const timeString = Number.isNaN(createdAt.getTime())
        ? "Không rõ"
        : new Intl.DateTimeFormat("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            day: "2-digit",
            month: "2-digit",
          }).format(createdAt);

      return `
        <article class="fraud-row ${risk.className}" data-fraud-alert-id="${escapeHtml(alert.id)}">
          <div>
            <span>${risk.label}</span>
            <strong>${(alert.score * 100).toFixed(1)}</strong>
            <small>Điểm LSS</small>
          </div>

          <div>
            <h4>User: ${escapeHtml(alert.username)} → Phiên: ${escapeHtml(alert.auctionId)}</h4>
            <p>Lý do: ${escapeHtml(alert.reason)}</p>
          </div>

          <time>${timeString}</time>

          <div class="fraud-actions">
            <button type="button" data-review-fraud="${escapeHtml(alert.id)}">Kiểm Tra</button>
            ${
              alert.score > 0.6
                ? `<button type="button" style="color: var(--danger)" data-lock-fraud="${escapeHtml(alert.userId)}">Khóa Tạm</button>`
                : ""
            }
          </div>
        </article>
      `;
    })
    .join("");

  if (summaryButton) {
    summaryButton.textContent = `${criticalCount} rủi ro cao`;
  }
}

async function fetchFraudAlerts() {
  state.isFraudLoading = true;
  state.fraudError = "";
  renderFraudAlerts();

  try {
    const result = await requestFirstAvailableAlertSource();
    state.activeAlertSource = result.source.name;
    state.alerts = normalizeAlertsResponse(result.response);
  } catch (error) {
    console.error("[Admin] Không thể tải fraud alerts:", error);
    state.alerts = [];
    state.activeAlertSource = "";
    state.fraudError =
      error?.message || "Không thể kết nối Backend proxy hoặc AI FastAPI. Hãy kiểm tra route alert và port 8000.";
  } finally {
    state.isFraudLoading = false;
    renderFraudAlerts();
  }
}

function addAlertFromSocket(payload) {
  const nextAlert = normalizeAlert(payload);
  state.alerts = [nextAlert, ...state.alerts].slice(0, 50);
  state.activeAlertSource = state.activeAlertSource || "Socket Backend";
  renderFraudAlerts();
  showToast("Cảnh báo gian lận mới", `AI vừa gửi cảnh báo cho phiên ${nextAlert.auctionId}.`, "warning");
}

function updateAuctionFromSocket(payload) {
  const auctionId = Number(payload.auctionId || payload.auction_id);
  const nextAmount = Number(payload.bidAmount || payload.price || payload.amount || 0);

  if (!auctionId || !Number.isFinite(nextAmount) || nextAmount <= 0) return;

  const targetAuction = state.auctions.find((auction) => Number(auction.id) === auctionId);

  if (!targetAuction) {
    fetchAuctions();
    return;
  }

  targetAuction.currentPrice = nextAmount;
  targetAuction.bidCount += 1;

  if (payload.newEndTime || payload.end_time) {
    targetAuction.endTime = payload.newEndTime || payload.end_time;
  }

  renderAdminData();
}

function bindSocketEvents() {
  if (!window.socketClient) return;

  window.socketClient.connect("global");
  window.socketClient.on("new_bid", updateAuctionFromSocket);
  window.socketClient.on("fraud_detected", addAlertFromSocket);
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

function bindToastButtons() {
  document.querySelectorAll("[data-admin-toast]").forEach((button) => {
    button.addEventListener("click", () => {
      showToast("Admin", button.dataset.adminToast, "info");
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

      if (searchInput) searchInput.value = "";
      if (statusFilter) statusFilter.value = "all";
      if (categoryFilter) categoryFilter.value = "all";
      if (sortFilter) sortFilter.value = "ending-soon";

      renderAuctionTable();
    });
  }
}

function bindRefreshButtons() {
  document.querySelectorAll("[data-refresh-auctions]").forEach((button) => {
    button.addEventListener("click", fetchAuctions);
  });

  document.querySelectorAll("[data-refresh-fraud-alerts], #fraud-summary-btn").forEach((button) => {
    button.addEventListener("click", fetchFraudAlerts);
  });
}

function initAdminPage() {
  const user = requireSession();

  if (!user) return;

  initTheme();

  initSiteHeader({
    hideAfter: 120,
    topRevealOffset: 12,
  });

  updateCurrentUser(user);
  bindAdminTabs();
  bindToastButtons();
  bindAuctionFilters();
  bindRefreshButtons();
  bindSocketEvents();

  fetchAuctions();
  fetchFraudAlerts();

  window.setInterval(fetchFraudAlerts, 10000);
}

document.addEventListener("DOMContentLoaded", initAdminPage);
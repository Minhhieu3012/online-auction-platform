import { initTheme } from "../core/theme.js";
import { initSiteHeader } from "../core/header.js";
import apiClient from "../core/api-client.js";

const FALLBACK_IMAGE = "../assets/images/mockdata/1.png";

const TAB_COPY = {
  overview: {
    title: "Tổng Quan",
    subtitle: "Theo dõi trạng thái hệ thống, phiên chờ duyệt, cọc, thanh toán và cảnh báo rủi ro.",
  },
  auctions: {
    title: "Quản Lý Cuộc Đấu Giá",
    subtitle: "Duyệt, từ chối, hủy và theo dõi toàn bộ vòng đời các phiên đấu giá.",
  },
  verification: {
    title: "Phiên Chờ Duyệt",
    subtitle: "User tạo phiên đấu giá, admin xem và chốt thông qua hoặc không thông qua.",
  },
  settlements: {
    title: "Đối Soát Thanh Toán",
    subtitle: "Theo dõi người thắng, cọc đã trừ và số tiền còn phải thanh toán.",
  },
  fraud: {
    title: "Cảnh Báo Gian Lận",
    subtitle: "Theo dõi cảnh báo AI/fraud đã được đồng bộ vào hệ thống.",
  },
  users: {
    title: "Người Dùng",
    subtitle: "Quản lý tài khoản, khóa hoặc mở khóa người dùng rủi ro.",
  },
  logs: {
    title: "Nhật Ký Quản Trị",
    subtitle: "Lưu dấu các hành động quan trọng của admin.",
  },
};

const state = {
  currentUser: null,
  dashboard: null,

  auctions: [],
  auctionSearch: "",
  auctionStatus: "all",
  auctionCategory: "all",
  auctionSort: "pending-first",

  users: [],
  userSearch: "",
  userRole: "all",
  userStatus: "all",

  alerts: [],
  settlements: [],
  logs: [],

  isLoadingAuctions: false,
  isLoadingDashboard: false,
  isLoadingUsers: false,
};

function showToast(title, message, type = "info") {
  const stack = document.querySelector("[data-toast-stack]");
  if (!stack) return;

  const toast = document.createElement("article");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <p class="toast-title">${title}</p>
    <p class="toast-message">${message}</p>
  `;

  stack.appendChild(toast);

  window.setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-6px)";
  }, 3200);

  window.setTimeout(() => toast.remove(), 3800);
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
  const el = document.querySelector(selector);
  if (el) el.textContent = value;
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatNumber(value) {
  return new Intl.NumberFormat("vi-VN").format(Number(value || 0));
}

function formatDateTime(value) {
  if (!value) return "Chưa đặt";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Không rõ";

  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function normalizeStatus(status) {
  return String(status || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function getStatusLabel(status) {
  const map = {
    pending: "Chờ duyệt",
    rejected: "Bị từ chối",
    scheduled: "Đã lên lịch",
    active: "Đang mở",
    closing: "Sắp đóng",
    ended: "Đã kết thúc",
    payment_pending: "Chờ thanh toán",
    completed: "Hoàn tất",
    cancelled: "Đã hủy",
  };

  return map[normalizeStatus(status)] || "Không rõ";
}

function getStatusClass(status) {
  const value = normalizeStatus(status);

  if (value === "active") return "is-active-status";
  if (value === "scheduled") return "is-scheduled-status";
  if (value === "closing") return "is-closing-status";
  if (value === "completed") return "is-settled";
  if (["pending", "payment_pending"].includes(value)) return "is-pending";
  if (["ended", "rejected", "cancelled"].includes(value)) return "is-ended-status";

  return "is-pending";
}

function requireAdmin() {
  const token = apiClient.getAuthToken();
  const user = apiClient.getAuthUser();

  if (!token || !user) {
    apiClient.clearAuth();
    window.location.replace(`./login.html?redirect=${encodeURIComponent("./admin.html")}`);
    return null;
  }

  if (user.role !== "admin") {
    showToast("Không có quyền truy cập", "Trang này chỉ dành cho tài khoản admin.", "error");
    window.setTimeout(() => {
      window.location.replace("./account.html");
    }, 900);
    return null;
  }

  return user;
}

function setActiveTab(tabName) {
  const safeTab = TAB_COPY[tabName] ? tabName : "overview";
  const copy = TAB_COPY[safeTab];

  document.querySelectorAll("[data-admin-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.adminTab === safeTab);
  });

  document.querySelectorAll("[data-admin-panel]").forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.adminPanel === safeTab);
  });

  setText("[data-admin-title]", copy.title);
  setText("[data-admin-subtitle]", copy.subtitle);

  window.history.replaceState(null, "", `#${safeTab}`);

  if (safeTab === "users" && state.users.length === 0) fetchUsers();
  if (safeTab === "fraud" && state.alerts.length === 0) fetchFraudAlerts();
  if (safeTab === "settlements" && state.settlements.length === 0) fetchSettlements();
  if (safeTab === "logs" && state.logs.length === 0) fetchLogs();
}

async function apiGet(endpoint, query = null) {
  return apiClient.get(endpoint, query, {
    auth: true,
    idempotency: false,
  });
}

async function apiPatch(endpoint, body = {}) {
  if (typeof apiClient.patch === "function") {
    return apiClient.patch(endpoint, body, { auth: true });
  }

  return apiClient.request(endpoint, {
    method: "PATCH",
    body,
    auth: true,
  });
}

function renderDashboard() {
  const stats = state.dashboard?.stats || {};
  const topAuctions = state.dashboard?.topAuctions || [];

  setText("[data-stat-total-auctions]", String(stats.total_auctions || 0).padStart(2, "0"));
  setText("[data-stat-pending-auctions]", String(stats.pending_auctions || 0).padStart(2, "0"));
  setText("[data-stat-active-auctions]", String(stats.active_auctions || 0).padStart(2, "0"));
  setText("[data-stat-total-volume]", formatMoney(stats.total_volume || 0));
  setText("[data-stat-successful-deposits]", formatMoney(stats.successful_deposits || 0));
  setText("[data-stat-open-fraud-alerts]", String(stats.open_fraud_alerts || 0).padStart(2, "0"));

  const list = document.querySelector("[data-overview-auction-list]");
  if (!list) return;

  if (topAuctions.length === 0) {
    list.innerHTML = `
      <div class="admin-empty-mini">
        <span>◇</span>
        <p>Chưa có phiên đấu giá nào.</p>
      </div>
    `;
    return;
  }

  list.innerHTML = topAuctions
    .map(
      (auction) => `
        <div class="admin-request-row">
          <img src="${escapeHtml(auction.imageUrl || FALLBACK_IMAGE)}" alt="${escapeHtml(auction.title)}" />
          <div>
            <strong>${escapeHtml(auction.title)}</strong>
            <span>${escapeHtml(auction.lot)} • ${getStatusLabel(auction.status)} • ${formatMoney(auction.currentPrice)}</span>
          </div>
          <b>${formatNumber(auction.bidCount)} giá</b>
        </div>
      `,
    )
    .join("");
}

async function fetchDashboard() {
  state.isLoadingDashboard = true;

  try {
    const response = await apiGet("/admin/dashboard");
    state.dashboard = response.data;
    setText("[data-admin-engine-label]", "Admin API đã kết nối");
    setText("[data-backend-status]", "OK");
    setText("[data-backend-status-copy]", "Backend admin đang hoạt động tốt.");
    renderDashboard();
  } catch (error) {
    setText("[data-admin-engine-label]", "Admin API lỗi");
    setText("[data-backend-status]", "OFF");
    setText("[data-backend-status-copy]", error.message || "Không thể kết nối API admin.");
    showToast("Không thể tải admin dashboard", error.message || "Kiểm tra backend route /api/admin/dashboard.", "error");
  } finally {
    state.isLoadingDashboard = false;
  }
}

function buildAuctionQuery() {
  return {
    q: state.auctionSearch,
    status: state.auctionStatus === "all" ? "" : state.auctionStatus,
    category: state.auctionCategory === "all" ? "" : state.auctionCategory,
    sort: state.auctionSort,
  };
}

async function fetchAuctions() {
  state.isLoadingAuctions = true;
  renderAuctionTable();

  try {
    const response = await apiGet("/admin/auctions", buildAuctionQuery());
    state.auctions = response.data?.auctions || [];
  } catch (error) {
    state.auctions = [];
    showToast("Không thể tải phiên đấu giá", error.message || "Backend admin auctions chưa sẵn sàng.", "error");
  } finally {
    state.isLoadingAuctions = false;
    renderAuctionTable();
    renderVerificationQueue();
  }
}

function getAuctionActions(auction) {
  const id = escapeHtml(auction.id);
  const status = normalizeStatus(auction.status);
  const view = `<a href="./product-detail.html?id=${id}">Xem</a>`;

  if (status === "pending" || status === "rejected") {
    return `
      ${view}
      <button type="button" data-approve-auction="${id}">Duyệt</button>
      <button type="button" class="is-danger" data-reject-auction="${id}">Từ chối</button>
    `;
  }

  if (["scheduled", "active", "closing", "payment_pending"].includes(status)) {
    return `
      ${view}
      <button type="button" class="is-danger" data-cancel-auction="${id}">Hủy</button>
    `;
  }

  return view;
}

function renderAuctionTable() {
  const table = document.querySelector("[data-admin-auction-table]");
  const empty = document.querySelector("[data-admin-auction-empty]");

  if (!table) return;

  if (state.isLoadingAuctions) {
    table.innerHTML = `
      <tr>
        <td colspan="9">
          <div class="admin-table-state">
            <span>◇</span>
            <p>Đang tải phiên đấu giá...</p>
          </div>
        </td>
      </tr>
    `;
    if (empty) empty.hidden = true;
    return;
  }

  setText("[data-admin-auction-count]", `Đã tải ${state.auctions.length} phiên`);
  setText("[data-admin-auction-showing]", `Đang hiển thị ${state.auctions.length} bản ghi`);

  if (state.auctions.length === 0) {
    table.innerHTML = "";
    if (empty) empty.hidden = false;
    return;
  }

  if (empty) empty.hidden = true;

  table.innerHTML = state.auctions
    .map(
      (auction) => `
        <tr>
          <td>
            <strong>${escapeHtml(auction.lot)}</strong>
            <span class="admin-table-muted">#${escapeHtml(auction.id)}</span>
          </td>

          <td>
            <div class="admin-auction-asset">
              <img src="${escapeHtml(auction.imageUrl || FALLBACK_IMAGE)}" alt="${escapeHtml(auction.title)}" />
              <div>
                <strong>${escapeHtml(auction.title)}</strong>
                <span>${escapeHtml((auction.category || "collectibles").replace("-", " "))}</span>
              </div>
            </div>
          </td>

          <td>
            <strong>${escapeHtml(auction.sellerUsername || "Không rõ")}</strong>
            <span class="admin-table-muted">${escapeHtml(auction.sellerEmail || "")}</span>
          </td>

          <td>
            <span class="admin-status ${getStatusClass(auction.status)}">${getStatusLabel(auction.status)}</span>
          </td>

          <td>
            <strong>${auction.requiresDeposit ? formatMoney(auction.depositAmount) : "Không yêu cầu"}</strong>
            <span class="admin-table-muted">${formatNumber(auction.depositCount)} đã cọc</span>
          </td>

          <td>${formatMoney(auction.currentPrice)}</td>
          <td>${formatNumber(auction.bidCount)}</td>
          <td>${formatDateTime(auction.endTime)}</td>

          <td>
            <div class="admin-row-actions">
              ${getAuctionActions(auction)}
            </div>
          </td>
        </tr>
      `,
    )
    .join("");

  bindAuctionActionButtons();
}

function renderVerificationQueue() {
  const grid = document.querySelector("[data-verification-grid]");
  const pending = state.auctions.filter((auction) => normalizeStatus(auction.status) === "pending");

  setText("[data-verification-count]", `${pending.length} yêu cầu đang chờ`);

  if (!grid) return;

  if (pending.length === 0) {
    grid.innerHTML = `
      <div class="admin-empty-state" style="grid-column: 1 / -1;">
        <span>◇</span>
        <h4>Không có phiên chờ duyệt</h4>
        <p>Khi user tạo cuộc đấu giá mới, phiên sẽ xuất hiện tại đây.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = pending
    .map(
      (auction) => `
        <article class="verification-card">
          <div class="verification-media">
            <img src="${escapeHtml(auction.imageUrl || FALLBACK_IMAGE)}" alt="${escapeHtml(auction.title)}" />
            <span>Chờ duyệt</span>
          </div>

          <div class="verification-body">
            <p>${escapeHtml(auction.lot)} • ${escapeHtml(auction.sellerUsername || "Người bán")}</p>
            <h4>${escapeHtml(auction.title)}</h4>

            <dl>
              <div>
                <dt>Danh mục</dt>
                <dd>${escapeHtml(auction.category || "collectibles")}</dd>
              </div>
              <div>
                <dt>Giá khởi điểm</dt>
                <dd>${formatMoney(auction.currentPrice)}</dd>
              </div>
              <div>
                <dt>Bước giá</dt>
                <dd>${formatMoney(auction.stepPrice)}</dd>
              </div>
              <div>
                <dt>Tiền cọc</dt>
                <dd>${auction.requiresDeposit ? formatMoney(auction.depositAmount) : "Không yêu cầu"}</dd>
              </div>
            </dl>

            <p class="verification-note">${escapeHtml(auction.description || "Không có mô tả.")}</p>

            <div class="verification-actions">
              <button type="button" class="button button-primary" data-approve-auction="${escapeHtml(auction.id)}">
                Thông Qua
              </button>
              <button type="button" class="button button-outline" data-reject-auction="${escapeHtml(auction.id)}">
                Không Thông Qua
              </button>
            </div>
          </div>
        </article>
      `,
    )
    .join("");

  bindAuctionActionButtons();
}

async function approveAuction(auctionId) {
  const ok = window.confirm("Duyệt phiên đấu giá này và cho phép hiển thị công khai?");
  if (!ok) return;

  try {
    await apiPatch(`/admin/auctions/${auctionId}/approve`);
    showToast("Đã duyệt phiên", "Phiên đấu giá đã được thông qua.", "success");
    await Promise.all([fetchDashboard(), fetchAuctions()]);
  } catch (error) {
    showToast("Duyệt thất bại", error.message || "Không thể duyệt phiên đấu giá.", "error");
  }
}

async function rejectAuction(auctionId) {
  const reason = window.prompt("Nhập lý do từ chối phiên đấu giá:", "Thông tin phiên chưa đạt yêu cầu duyệt.");
  if (reason === null) return;

  try {
    await apiPatch(`/admin/auctions/${auctionId}/reject`, { reason });
    showToast("Đã từ chối phiên", "Phiên đấu giá đã được chuyển sang trạng thái Rejected.", "success");
    await Promise.all([fetchDashboard(), fetchAuctions()]);
  } catch (error) {
    showToast("Từ chối thất bại", error.message || "Không thể từ chối phiên đấu giá.", "error");
  }
}

async function cancelAuction(auctionId) {
  const reason = window.prompt("Nhập lý do hủy phiên đấu giá:", "Admin hủy phiên đấu giá.");
  if (reason === null) return;

  try {
    await apiPatch(`/admin/auctions/${auctionId}/cancel`, { reason });
    showToast("Đã hủy phiên", "Phiên đấu giá đã được hủy.", "success");
    await Promise.all([fetchDashboard(), fetchAuctions()]);
  } catch (error) {
    showToast("Hủy thất bại", error.message || "Không thể hủy phiên đấu giá.", "error");
  }
}

function bindAuctionActionButtons() {
  document.querySelectorAll("[data-approve-auction]").forEach((button) => {
    button.addEventListener("click", () => approveAuction(button.dataset.approveAuction), { once: true });
  });

  document.querySelectorAll("[data-reject-auction]").forEach((button) => {
    button.addEventListener("click", () => rejectAuction(button.dataset.rejectAuction), { once: true });
  });

  document.querySelectorAll("[data-cancel-auction]").forEach((button) => {
    button.addEventListener("click", () => cancelAuction(button.dataset.cancelAuction), { once: true });
  });
}

function buildUserQuery() {
  return {
    q: state.userSearch,
    role: state.userRole === "all" ? "" : state.userRole,
    status: state.userStatus === "all" ? "" : state.userStatus,
  };
}

async function fetchUsers() {
  state.isLoadingUsers = true;
  renderUsers();

  try {
    const response = await apiGet("/admin/users", buildUserQuery());
    state.users = response.data?.users || [];
  } catch (error) {
    state.users = [];
    showToast("Không thể tải người dùng", error.message || "Kiểm tra API /api/admin/users.", "error");
  } finally {
    state.isLoadingUsers = false;
    renderUsers();
  }
}

function renderUsers() {
  const table = document.querySelector("[data-user-table]");
  if (!table) return;

  if (state.isLoadingUsers) {
    table.innerHTML = `
      <tr>
        <td colspan="9">
          <div class="admin-table-state">
            <span>◇</span>
            <p>Đang tải người dùng...</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  if (state.users.length === 0) {
    table.innerHTML = `
      <tr>
        <td colspan="9">
          <div class="admin-table-state">
            <span>◇</span>
            <p>Không có người dùng nào khớp bộ lọc.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  table.innerHTML = state.users
    .map(
      (user) => `
        <tr>
          <td>
            <strong>${escapeHtml(user.username)}</strong>
            <span class="admin-table-muted">#${escapeHtml(user.id)}</span>
          </td>
          <td>${escapeHtml(user.email)}</td>
          <td>${escapeHtml(user.role)}</td>
          <td>
            <span class="admin-status ${user.accountStatus === "locked" ? "is-ended-status" : "is-settled"}">
              ${user.accountStatus === "locked" ? "Đã khóa" : "Hoạt động"}
            </span>
          </td>
          <td>${formatMoney(user.balance)}</td>
          <td>${formatNumber(user.auctionCount)}</td>
          <td>${formatNumber(user.bidCount)}</td>
          <td>${formatNumber(user.fraudAlertCount)}</td>
          <td>
            <div class="admin-row-actions">
              ${
                user.role === "admin"
                  ? "<span>Admin</span>"
                  : user.accountStatus === "locked"
                    ? `<button type="button" data-unlock-user="${escapeHtml(user.id)}">Mở khóa</button>`
                    : `<button type="button" class="is-danger" data-lock-user="${escapeHtml(user.id)}">Khóa</button>`
              }
            </div>
          </td>
        </tr>
      `,
    )
    .join("");

  bindUserActions();
}

function bindUserActions() {
  document.querySelectorAll("[data-lock-user]").forEach((button) => {
    button.addEventListener("click", () => updateUserStatus(button.dataset.lockUser, "lock"), { once: true });
  });

  document.querySelectorAll("[data-unlock-user]").forEach((button) => {
    button.addEventListener("click", () => updateUserStatus(button.dataset.unlockUser, "unlock"), { once: true });
  });
}

async function updateUserStatus(userId, action) {
  const ok = window.confirm(action === "lock" ? "Khóa tài khoản người dùng này?" : "Mở khóa tài khoản người dùng này?");
  if (!ok) return;

  try {
    await apiPatch(`/admin/users/${userId}/${action}`);
    showToast("Cập nhật thành công", action === "lock" ? "Đã khóa tài khoản." : "Đã mở khóa tài khoản.", "success");
    await fetchUsers();
  } catch (error) {
    showToast("Cập nhật thất bại", error.message || "Không thể cập nhật trạng thái người dùng.", "error");
  }
}

async function fetchFraudAlerts() {
  const list = document.getElementById("ai-fraud-list");
  if (list) {
    list.innerHTML = `
      <div class="admin-empty-mini" style="text-align: center; padding: 40px">
        <span>◇</span>
        <p>Đang tải cảnh báo...</p>
      </div>
    `;
  }

  try {
    const response = await apiGet("/admin/fraud-alerts");
    state.alerts = response.data?.alerts || [];
  } catch (error) {
    state.alerts = [];
    showToast("Không thể tải cảnh báo", error.message || "Kiểm tra API /api/admin/fraud-alerts.", "error");
  } finally {
    renderFraudAlerts();
  }
}

function renderFraudAlerts() {
  const list = document.getElementById("ai-fraud-list");
  const summary = document.getElementById("fraud-summary-btn");
  if (!list) return;

  const highRisk = state.alerts.filter((alert) => Number(alert.riskScore) >= 0.6).length;
  if (summary) summary.textContent = `${highRisk} rủi ro cao`;

  if (state.alerts.length === 0) {
    list.innerHTML = `
      <div class="admin-empty-mini" style="text-align: center; padding: 40px">
        <span>◇</span>
        <p>Chưa có cảnh báo gian lận nào.</p>
      </div>
    `;
    return;
  }

  list.innerHTML = state.alerts
    .map((alert) => {
      const score = Number(alert.riskScore || 0);
      const riskClass = score >= 0.6 ? "fraud-critical" : score >= 0.4 ? "fraud-medium" : "fraud-low";
      const riskLabel = score >= 0.6 ? "Rủi ro cao" : score >= 0.4 ? "Rủi ro trung bình" : "Rủi ro thấp";
      const reasons = Array.isArray(alert.reasons) ? alert.reasons.join(" / ") : String(alert.reasons || "Không rõ");

      return `
        <article class="fraud-row ${riskClass}">
          <div>
            <span>${riskLabel}</span>
            <strong>${(score * 100).toFixed(1)}</strong>
            <small>Điểm rủi ro</small>
          </div>
          <div>
            <h4>${escapeHtml(alert.username)} → Phiên #${escapeHtml(alert.auctionId)}</h4>
            <p>${escapeHtml(reasons)}</p>
          </div>
          <time>${formatDateTime(alert.createdAt)}</time>
          <div class="fraud-actions">
            <button type="button" data-review-alert="${escapeHtml(alert.id)}">Review</button>
            <button type="button" data-dismiss-alert="${escapeHtml(alert.id)}">Dismiss</button>
          </div>
        </article>
      `;
    })
    .join("");

  bindFraudActions();
}

function bindFraudActions() {
  document.querySelectorAll("[data-review-alert]").forEach((button) => {
    button.addEventListener("click", () => updateFraudAlert(button.dataset.reviewAlert, "REVIEWING"), { once: true });
  });

  document.querySelectorAll("[data-dismiss-alert]").forEach((button) => {
    button.addEventListener("click", () => updateFraudAlert(button.dataset.dismissAlert, "DISMISSED"), { once: true });
  });
}

async function updateFraudAlert(alertId, status) {
  try {
    await apiPatch(`/admin/fraud-alerts/${alertId}`, { status });
    showToast("Đã cập nhật cảnh báo", "Trạng thái cảnh báo đã được lưu.", "success");
    await fetchFraudAlerts();
  } catch (error) {
    showToast("Cập nhật thất bại", error.message || "Không thể cập nhật cảnh báo.", "error");
  }
}

async function fetchSettlements() {
  try {
    const response = await apiGet("/admin/settlements");
    state.settlements = response.data?.settlements || [];
  } catch (error) {
    state.settlements = [];
    showToast("Không thể tải đối soát", error.message || "Kiểm tra API /api/admin/settlements.", "error");
  } finally {
    renderSettlements();
  }
}

function renderSettlements() {
  const table = document.querySelector("[data-settlement-table]");
  if (!table) return;

  if (state.settlements.length === 0) {
    table.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="admin-table-state">
            <span>◇</span>
            <p>Chưa có dữ liệu đối soát.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  table.innerHTML = state.settlements
    .map(
      (item) => `
        <tr>
          <td>
            <strong>#${escapeHtml(item.auctionId)} ${escapeHtml(item.auctionTitle)}</strong>
          </td>
          <td>${escapeHtml(item.winnerUsername)}</td>
          <td>${formatMoney(item.finalPrice)}</td>
          <td>${formatMoney(item.depositAppliedAmount)}</td>
          <td>${formatMoney(item.remainingAmount)}</td>
          <td><span class="admin-status ${item.status === "PAID" ? "is-settled" : "is-pending"}">${escapeHtml(item.status)}</span></td>
          <td>${formatDateTime(item.dueAt)}</td>
        </tr>
      `,
    )
    .join("");
}

async function fetchLogs() {
  try {
    const response = await apiGet("/admin/logs");
    state.logs = response.data?.logs || [];
  } catch (error) {
    state.logs = [];
    showToast("Không thể tải nhật ký", error.message || "Kiểm tra API /api/admin/logs.", "error");
  } finally {
    renderLogs();
  }
}

function renderLogs() {
  const table = document.querySelector("[data-admin-log-table]");
  if (!table) return;

  if (state.logs.length === 0) {
    table.innerHTML = `
      <tr>
        <td colspan="5">
          <div class="admin-table-state">
            <span>◇</span>
            <p>Chưa có nhật ký quản trị.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  table.innerHTML = state.logs
    .map(
      (log) => `
        <tr>
          <td>${escapeHtml(log.adminUsername)}</td>
          <td>${escapeHtml(log.action)}</td>
          <td>${escapeHtml(log.targetType)} #${escapeHtml(log.targetId || "-")}</td>
          <td>${escapeHtml(log.note || "-")}</td>
          <td>${formatDateTime(log.createdAt)}</td>
        </tr>
      `,
    )
    .join("");
}

function bindTabs() {
  document.querySelectorAll("[data-admin-tab]").forEach((button) => {
    button.addEventListener("click", () => setActiveTab(button.dataset.adminTab));
  });

  document.querySelectorAll("[data-admin-jump]").forEach((button) => {
    button.addEventListener("click", () => setActiveTab(button.dataset.adminJump));
  });

  const initialTab = window.location.hash.replace("#", "") || "overview";
  setActiveTab(initialTab);
}

function bindFilters() {
  const auctionSearch = document.querySelector("[data-admin-auction-search]");
  const auctionStatus = document.querySelector("[data-admin-status-filter]");
  const auctionCategory = document.querySelector("[data-admin-category-filter]");
  const auctionSort = document.querySelector("[data-admin-sort-filter]");

  if (auctionSearch) {
    auctionSearch.addEventListener("input", () => {
      state.auctionSearch = auctionSearch.value;
      fetchAuctions();
    });
  }

  if (auctionStatus) {
    auctionStatus.addEventListener("change", () => {
      state.auctionStatus = auctionStatus.value;
      fetchAuctions();
    });
  }

  if (auctionCategory) {
    auctionCategory.addEventListener("change", () => {
      state.auctionCategory = auctionCategory.value;
      fetchAuctions();
    });
  }

  if (auctionSort) {
    auctionSort.addEventListener("change", () => {
      state.auctionSort = auctionSort.value;
      fetchAuctions();
    });
  }

  const userSearch = document.querySelector("[data-admin-user-search]");
  const userRole = document.querySelector("[data-admin-user-role]");
  const userStatus = document.querySelector("[data-admin-user-status]");

  if (userSearch) {
    userSearch.addEventListener("input", () => {
      state.userSearch = userSearch.value;
      fetchUsers();
    });
  }

  if (userRole) {
    userRole.addEventListener("change", () => {
      state.userRole = userRole.value;
      fetchUsers();
    });
  }

  if (userStatus) {
    userStatus.addEventListener("change", () => {
      state.userStatus = userStatus.value;
      fetchUsers();
    });
  }
}

function bindRefreshButtons() {
  document.querySelectorAll("[data-refresh-all]").forEach((button) => {
    button.addEventListener("click", refreshAll);
  });

  document.querySelectorAll("[data-refresh-auctions]").forEach((button) => {
    button.addEventListener("click", fetchAuctions);
  });

  document.querySelectorAll("[data-refresh-users]").forEach((button) => {
    button.addEventListener("click", fetchUsers);
  });

  document.querySelectorAll("[data-refresh-fraud-alerts]").forEach((button) => {
    button.addEventListener("click", fetchFraudAlerts);
  });

  document.querySelectorAll("[data-refresh-settlements]").forEach((button) => {
    button.addEventListener("click", fetchSettlements);
  });

  document.querySelectorAll("[data-refresh-logs]").forEach((button) => {
    button.addEventListener("click", fetchLogs);
  });
}

function bindSocketEvents() {
  if (!window.socketClient) return;

  window.socketClient.connect("global");

  window.socketClient.on("new_bid", () => {
    fetchDashboard();
    fetchAuctions();
  });

  window.socketClient.on("fraud_detected", () => {
    fetchFraudAlerts();
    fetchDashboard();
  });
}

async function refreshAll() {
  await Promise.allSettled([
    fetchDashboard(),
    fetchAuctions(),
    fetchFraudAlerts(),
    fetchSettlements(),
    fetchUsers(),
    fetchLogs(),
  ]);
}

function initAdminPage() {
  const user = requireAdmin();
  if (!user) return;

  state.currentUser = user;

  initTheme();
  initSiteHeader({
    hideAfter: 120,
    topRevealOffset: 12,
  });

  bindTabs();
  bindFilters();
  bindRefreshButtons();
  bindSocketEvents();

  fetchDashboard();
  fetchAuctions();
}

document.addEventListener("DOMContentLoaded", initAdminPage);
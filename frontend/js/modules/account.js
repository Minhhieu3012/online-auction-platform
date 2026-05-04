import { initTheme } from "../core/theme.js";
import { initSiteHeader } from "../core/header.js";
import apiClient from "../core/api-client.js";

const FALLBACK_IMAGE = "../assets/images/mockdata/1.png";

const TAB_COPY = {
  overview: {
    title: "Tổng Quan",
    subtitle: "Theo dõi hoạt động trả giá, danh mục quan tâm, yêu cầu bán và trạng thái thanh toán của bạn ở một nơi duy nhất.",
  },
  bids: {
    title: "Lượt Giá Của Tôi",
    subtitle: "Theo dõi các phiên bạn đang tham gia, vị thế dẫn đầu, lượt bị vượt giá và hành động tiếp theo.",
  },
  watching: {
    title: "Đang Theo Dõi",
    subtitle: "Xem lại các lô bạn quan tâm và muốn quay lại đấu giá sau.",
  },
  won: {
    title: "Đấu Giá Đã Thắng",
    subtitle: "Các phiên bạn thắng và trạng thái thanh toán sau đấu giá sẽ xuất hiện tại đây.",
  },
  selling: {
    title: "Bán Hàng",
    subtitle: "Theo dõi các tài sản bạn đã gửi lên, trạng thái chờ duyệt và các phiên đang mở.",
  },
  payments: {
    title: "Thanh Toán",
    subtitle: "Theo dõi hóa đơn, trạng thái đối soát và các khoản thanh toán cần hoàn tất.",
  },
  settings: {
    title: "Cài Đặt",
    subtitle: "Xem thông tin hồ sơ, email, ID người dùng và tùy chọn thông báo.",
  },
};

const state = {
  user: null,
  myAuctions: [],
};

function injectAccountRuntimeStyles() {
  if (document.querySelector('style[data-account-runtime-style="true"]')) return;

  const style = document.createElement("style");
  style.dataset.accountRuntimeStyle = "true";
  style.textContent = `
    .dashboard-card,
    .account-runtime-card {
      border: 1px solid var(--border);
      background:
        linear-gradient(135deg, rgba(197, 160, 89, 0.045), transparent 34%),
        var(--surface);
      padding: clamp(24px, 3vw, 34px);
      box-shadow: var(--shadow-card, none);
    }

    .dashboard-card-heading,
    .account-card-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      margin-bottom: 24px;
    }

    .dashboard-card-heading h3,
    .account-card-heading h3 {
      margin: 0;
      color: var(--text);
      font-size: 16px;
      font-weight: 900;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }

    .dashboard-card-heading a,
    .account-card-heading a {
      color: var(--primary);
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .account-empty-state {
      display: grid;
      place-items: center;
      gap: 14px;
      min-height: 220px;
      border: 1px dashed var(--border);
      color: var(--text-muted);
      text-align: center;
      padding: 28px;
    }

    .account-empty-state span {
      color: var(--primary);
      font-size: 22px;
    }

    .account-empty-state p {
      max-width: 620px;
      margin: 0;
      color: var(--text-soft);
      line-height: 1.7;
    }

    .dashboard-stat-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 18px;
    }

    .dashboard-stat-card {
      border: 1px solid var(--border);
      background: var(--surface);
      padding: 26px;
    }

    .dashboard-stat-card span {
      display: block;
      margin-bottom: 22px;
      color: var(--text-muted);
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }

    .dashboard-stat-card strong {
      display: block;
      color: var(--text);
      font-size: clamp(36px, 5vw, 52px);
      font-weight: 400;
      line-height: 1;
    }

    .dashboard-stat-card p {
      margin: 14px 0 0;
      color: var(--text-muted);
      line-height: 1.5;
    }

    .account-selling-grid {
      display: grid;
      gap: 18px;
    }

    .account-selling-card {
      display: grid;
      grid-template-columns: 180px 1fr;
      gap: 22px;
      padding: 18px;
      border: 1px solid var(--border);
      background: var(--bg);
    }

    .account-selling-card img {
      width: 180px;
      height: 140px;
      object-fit: cover;
      background: var(--surface-muted);
      border: 1px solid var(--border);
    }

    .account-selling-card h4 {
      margin: 0 0 10px;
      color: var(--text);
      font-size: 22px;
      line-height: 1.25;
    }

    .account-selling-card p {
      color: var(--text-soft);
      line-height: 1.65;
    }

    .account-selling-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 14px 22px;
      margin-top: 12px;
      color: var(--text-muted);
      font-size: 13px;
    }

    .account-selling-meta strong {
      color: var(--text);
    }

    .account-status-pill {
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      padding: 4px 10px;
      border: 1px solid var(--border);
      color: var(--primary);
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .account-status-pill.is-pending {
      border-color: rgba(197, 160, 89, 0.62);
      background: var(--primary-soft);
      color: var(--primary);
    }

    .account-status-pill.is-active {
      border-color: rgba(64, 201, 139, 0.5);
      color: var(--success);
    }

    .account-status-pill.is-rejected,
    .account-status-pill.is-cancelled {
      border-color: rgba(255, 120, 120, 0.55);
      color: #ff8f8f;
    }

    .account-settings-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
    }

    .account-setting-field {
      display: grid;
      gap: 8px;
    }

    .account-setting-field span {
      color: var(--text-muted);
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.13em;
      text-transform: uppercase;
    }

    .account-setting-field input {
      width: 100%;
      min-height: 48px;
      padding: 0 14px;
      border: 1px solid var(--border);
      background: var(--bg);
      color: var(--text);
    }

    @media (max-width: 860px) {
      .dashboard-stat-grid,
      .account-settings-grid {
        grid-template-columns: 1fr;
      }

      .account-selling-card {
        grid-template-columns: 1fr;
      }

      .account-selling-card img {
        width: 100%;
        height: 240px;
      }
    }
  `;

  document.head.appendChild(style);
}

function showToast(title, message, type = "info") {
  const toastStack = document.querySelector("[data-toast-stack]");
  if (!toastStack) return;

  const toast = document.createElement("article");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <p class="toast-title">${escapeHtml(title)}</p>
    <p class="toast-message">${escapeHtml(message)}</p>
  `;

  toastStack.appendChild(toast);

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

function redirectToLogin() {
  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.replace(`./login.html?redirect=${encodeURIComponent(currentPath)}`);
}

function requireAuthSession() {
  const token = apiClient.getAuthToken();
  const user = apiClient.getAuthUser();

  if (!token || !user) {
    apiClient.clearAuth();
    redirectToLogin();
    return null;
  }

  return user;
}

function getDisplayName(user) {
  return user?.fullName || user?.full_name || user?.name || user?.username || user?.email || "BrosGem Member";
}

function getMemberSubtitle(user) {
  if (user?.email) return `${user.email} • Thành viên đã xác thực`;
  return "Thành viên đã xác thực";
}

function getInitials(value) {
  const cleanValue = String(value || "BG").trim();
  const emailName = cleanValue.includes("@") ? cleanValue.split("@")[0] : cleanValue;
  const words = emailName.replace(/[._-]+/g, " ").split(/\s+/).filter(Boolean);

  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();

  return `${words[0]?.[0] || "B"}${words[1]?.[0] || "G"}`.toUpperCase();
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
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

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function setInput(selector, value) {
  const input = document.querySelector(selector);
  if (input) input.value = value;
}

function normalizeStatus(status) {
  return String(status || "").trim().toLowerCase().replace(/\s+/g, "_");
}

function getStatusLabel(status) {
  const map = {
    pending: "Đang chờ admin duyệt",
    rejected: "Không được thông qua",
    scheduled: "Đã lên lịch",
    active: "Đang mở đấu giá",
    closing: "Sắp đóng",
    ended: "Đã kết thúc",
    payment_pending: "Chờ thanh toán",
    completed: "Hoàn tất",
    cancelled: "Đã hủy",
  };

  return map[normalizeStatus(status)] || "Đang cập nhật";
}

function getStatusClass(status) {
  const key = normalizeStatus(status);

  if (key === "pending") return "is-pending";
  if (key === "active") return "is-active";
  if (key === "rejected") return "is-rejected";
  if (key === "cancelled") return "is-cancelled";

  return "";
}

function hydrateAccountUser(user) {
  const displayName = getDisplayName(user);

  setText("[data-member-avatar]", getInitials(displayName));
  setText("[data-member-name]", displayName);
  setText("[data-member-subtitle]", getMemberSubtitle(user));
  setText("[data-member-balance]", formatCurrency(user?.balance));

  setInput("[data-settings-name]", displayName);
  setInput("[data-settings-email]", user?.email || "");
  setInput("[data-settings-user-id]", user?.id ? String(user.id) : "");
}

function setActiveTab(tabName, shouldUpdateHash = true) {
  const safeTabName = TAB_COPY[tabName] ? tabName : "overview";
  const nextCopy = TAB_COPY[safeTabName];

  document.querySelectorAll("[data-dashboard-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.dashboardTab === safeTabName);
  });

  document.querySelectorAll("[data-dashboard-panel]").forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.dashboardPanel === safeTabName);
  });

  setText("[data-dashboard-title]", nextCopy.title);
  setText("[data-dashboard-subtitle]", nextCopy.subtitle);

  if (shouldUpdateHash) {
    window.history.replaceState(null, "", `#${safeTabName}`);
  }
}

function initDashboardTabs() {
  document.querySelectorAll("[data-dashboard-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      setActiveTab(button.dataset.dashboardTab);
    });
  });

  const initialTab = window.location.hash.replace("#", "") || "overview";
  setActiveTab(initialTab, false);

  window.addEventListener("hashchange", () => {
    const nextTab = window.location.hash.replace("#", "") || "overview";
    setActiveTab(nextTab, false);
  });
}

function getPanel(tabName) {
  return document.querySelector(`[data-dashboard-panel="${tabName}"]`);
}

function renderEmptyPanel(tabName, title, message) {
  const panel = getPanel(tabName);
  if (!panel) return;

  panel.innerHTML = `
    <article class="account-runtime-card">
      <div class="account-card-heading">
        <h3>${escapeHtml(title)}</h3>
      </div>

      <div class="account-empty-state">
        <span>◇</span>
        <p>${escapeHtml(message)}</p>
      </div>
    </article>
  `;
}

function renderSellingPanel() {
  const panel = getPanel("selling");
  if (!panel) return;

  if (state.myAuctions.length === 0) {
    panel.innerHTML = `
      <article class="account-runtime-card">
        <div class="account-card-heading">
          <h3>Yêu Cầu Bán Hàng</h3>
          <a href="./consign.html">Yêu Cầu Mới</a>
        </div>

        <div class="account-empty-state">
          <span>◇</span>
          <p>Bạn chưa gửi phiên đấu giá nào. Khi tạo yêu cầu mới, phiên sẽ xuất hiện tại đây với trạng thái chờ duyệt.</p>
        </div>
      </article>
    `;
    return;
  }

  panel.innerHTML = `
    <article class="account-runtime-card">
      <div class="account-card-heading">
        <h3>Yêu Cầu Bán Hàng</h3>
        <a href="./consign.html">Yêu Cầu Mới</a>
      </div>

      <div class="account-selling-grid">
        ${state.myAuctions
          .map(
            (auction) => `
              <article class="account-selling-card">
                <img
                  src="${escapeHtml(auction.imageUrl || FALLBACK_IMAGE)}"
                  alt="${escapeHtml(auction.title)}"
                  onerror="this.src='${FALLBACK_IMAGE}'"
                />

                <div>
                  <p class="eyebrow">${escapeHtml(auction.lot || `Lô #${auction.id}`)}</p>

                  <h4>${escapeHtml(auction.title)}</h4>

                  <span class="account-status-pill ${getStatusClass(auction.status)}">
                    ${escapeHtml(getStatusLabel(auction.status))}
                  </span>

                  <p>
                    ${
                      normalizeStatus(auction.status) === "pending"
                        ? "Phiên đang chờ admin xét duyệt. Sau khi được thông qua, phiên sẽ xuất hiện ở trang Đấu Giá Trực Tiếp."
                        : escapeHtml(auction.description || "Phiên đã được hệ thống ghi nhận.")
                    }
                  </p>

                  <div class="account-selling-meta">
                    <span>Giá: <strong>${formatCurrency(auction.currentPrice)}</strong></span>
                    <span>Cọc: <strong>${formatCurrency(auction.depositAmount)}</strong></span>
                    <span>Kết thúc: <strong>${formatDateTime(auction.endTime)}</strong></span>
                  </div>

                  <div style="margin-top: 18px;">
                    <a class="button button-outline" href="./product-detail.html?id=${escapeHtml(auction.id)}">
                      Xem phiên
                    </a>
                  </div>
                </div>
              </article>
            `,
          )
          .join("")}
      </div>
    </article>
  `;
}

function renderOverviewPanel() {
  const panel = getPanel("overview");
  if (!panel) return;

  const pendingCount = state.myAuctions.filter((auction) => normalizeStatus(auction.status) === "pending").length;
  const activeCount = state.myAuctions.filter((auction) => normalizeStatus(auction.status) === "active").length;

  panel.innerHTML = `
    <div class="dashboard-stat-grid">
      <article class="dashboard-stat-card">
        <span>Phiên Đã Tạo</span>
        <strong>${String(state.myAuctions.length).padStart(2, "0")}</strong>
        <p>Dữ liệu thật từ Backend</p>
      </article>

      <article class="dashboard-stat-card">
        <span>Chờ Duyệt</span>
        <strong>${String(pendingCount).padStart(2, "0")}</strong>
        <p>Đang đợi admin thông qua</p>
      </article>

      <article class="dashboard-stat-card">
        <span>Đang Mở</span>
        <strong>${String(activeCount).padStart(2, "0")}</strong>
        <p>Đã public ra trang đấu giá</p>
      </article>
    </div>
  `;
}

function renderSettingsPanel() {
  const panel = getPanel("settings");
  if (!panel) return;

  const user = state.user || {};

  panel.innerHTML = `
    <article class="account-runtime-card">
      <div class="account-card-heading">
        <h3>Cài Đặt Tài Khoản</h3>
      </div>

      <div class="account-settings-grid">
        <label class="account-setting-field">
          <span>Tên hiển thị</span>
          <input value="${escapeHtml(getDisplayName(user))}" readonly />
        </label>

        <label class="account-setting-field">
          <span>Email</span>
          <input value="${escapeHtml(user.email || "")}" readonly />
        </label>

        <label class="account-setting-field">
          <span>ID người dùng</span>
          <input value="${escapeHtml(user.id || "")}" readonly />
        </label>

        <label class="account-setting-field">
          <span>Vai trò</span>
          <input value="${escapeHtml(user.role || "user")}" readonly />
        </label>
      </div>
    </article>
  `;
}

async function loadMyAuctions() {
  try {
    const response = await apiClient.get("/auctions/mine", null, {
      auth: true,
      idempotency: false,
      redirectOnUnauthorized: false,
    });

    state.myAuctions = response?.data?.auctions || [];
  } catch (error) {
    state.myAuctions = [];
    showToast("Không thể tải phiên của bạn", error.message || "Kiểm tra API /api/auctions/mine.", "error");
  }

  renderOverviewPanel();
  renderSellingPanel();
}

function renderNonReadyPanels() {
  renderEmptyPanel("bids", "Lượt Giá Của Tôi", "Phần này sẽ nối API lịch sử bid ở scope tiếp theo. Hiện không còn dùng mock data.");
  renderEmptyPanel("watching", "Đang Theo Dõi", "Watchlist sẽ hiển thị khi API watchlist được nối vào Backend.");
  renderEmptyPanel("won", "Đấu Giá Đã Thắng", "Các phiên thắng sẽ xuất hiện sau khi Backend hoàn tất settlement/payment.");
  renderEmptyPanel("payments", "Thanh Toán", "Hóa đơn và đối soát sẽ được nối sau luồng checkout.");
  renderSettingsPanel();
}

function initLogout() {
  const logoutButtons = document.querySelectorAll("[data-logout-button], .dashboard-logout-button");

  logoutButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();

      apiClient.clearAuth();
      showToast("Đã đăng xuất", "Phiên đăng nhập của bạn đã được xoá.", "success");

      window.setTimeout(() => {
        window.location.href = "./login.html";
      }, 650);
    });
  });
}

function initAccountPage() {
  injectAccountRuntimeStyles();
  initTheme();

  const user = requireAuthSession();
  if (!user) return;

  state.user = user;

  initSiteHeader({
    hideAfter: 120,
    topRevealOffset: 12,
  });

  hydrateAccountUser(user);
  initDashboardTabs();
  initLogout();

  renderNonReadyPanels();
  loadMyAuctions();
}

document.addEventListener("DOMContentLoaded", initAccountPage);
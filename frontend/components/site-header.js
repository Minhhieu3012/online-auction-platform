import { initSiteHeader } from "../js/core/header.js";
import { toggleTheme } from "../js/core/theme.js";
import apiClient from "../js/core/api-client.js";

const HEADER_CONFIG = {
  brandName: "BrosGem",
  brandAriaLabel: "Trang chủ BrosGem",
};

const NOTIFICATION_STORAGE_KEY = "brosgem_runtime_notifications";
const MAX_NOTIFICATIONS = 20;

function normalizeBasePath(basePath) {
  return !basePath || basePath === "." ? "." : basePath.replace(/\/$/, "");
}

function isRootPath(basePath) {
  return normalizeBasePath(basePath) === ".";
}

function pageHref(basePath, pageFile) {
  const normalizedBasePath = normalizeBasePath(basePath);
  return isRootPath(normalizedBasePath) ? `./pages/${pageFile}` : `./${pageFile}`;
}

function homeHref(basePath) {
  const normalizedBasePath = normalizeBasePath(basePath);
  return isRootPath(normalizedBasePath) ? "./index.html" : `${normalizedBasePath}/index.html`;
}

function protocolHref(basePath) {
  const normalizedBasePath = normalizeBasePath(basePath);
  return isRootPath(normalizedBasePath) ? "#protocol" : `${normalizedBasePath}/index.html#protocol`;
}

function isAuthenticated() {
  return Boolean(apiClient.getAuthToken() && apiClient.getAuthUser());
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatRelativeTime(value) {
  if (!value) {
    return "Vừa xong";
  }

  const time = new Date(value).getTime();

  if (Number.isNaN(time)) {
    return "Vừa xong";
  }

  const diffMs = Math.max(0, Date.now() - time);
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "Vừa xong";
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} ngày trước`;
}

function loadRuntimeNotifications() {
  try {
    const rawValue = window.localStorage.getItem(NOTIFICATION_STORAGE_KEY);
    const parsed = rawValue ? JSON.parse(rawValue) : [];

    return Array.isArray(parsed) ? parsed.slice(0, MAX_NOTIFICATIONS) : [];
  } catch (error) {
    console.warn("[Header] Không thể đọc notification store:", error);
    return [];
  }
}

function saveRuntimeNotifications(notifications) {
  try {
    window.localStorage.setItem(
      NOTIFICATION_STORAGE_KEY,
      JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS)),
    );
  } catch (error) {
    console.warn("[Header] Không thể lưu notification store:", error);
  }
}

function getNotificationHref(basePath, notification = {}) {
  const normalizedBasePath = normalizeBasePath(basePath);

  if (notification.actionHref) {
    return notification.actionHref;
  }

  if (notification.auctionId || notification.auction_id) {
    const auctionId = notification.auctionId || notification.auction_id;
    return pageHref(normalizedBasePath, `product-detail.html?id=${encodeURIComponent(auctionId)}`);
  }

  if (notification.type === "fraud" || notification.lss_score || notification.lss) {
    return pageHref(normalizedBasePath, "admin.html#fraud");
  }

  return pageHref(normalizedBasePath, "notifications.html");
}

function createNotificationFromSocket(data = {}, basePath = ".") {
  const createdAt = data.createdAt || data.created_at || data.timestamp || new Date().toISOString();
  const riskScore = Number(data.lss_score || data.lss || data.risk_score || 0);
  const auctionId = data.auctionId || data.auction_id;

  let title = data.title || "Thông báo hệ thống";
  let message = data.message || "Bạn có một cập nhật mới từ hệ thống.";
  let type = data.type || "system";

  if (riskScore > 0) {
    type = "fraud";
    title = "Cảnh báo gian lận";
    message = `AI phát hiện tín hiệu rủi ro ${Math.round(riskScore * 100)}%${auctionId ? ` tại phiên #${auctionId}` : ""}.`;
  }

  if (data.paymentUrl || data.userId || data.user_id) {
    type = data.type || "payment";
    title = data.title || "Cập nhật phiên đấu giá";
    message = data.message || "Phiên đấu giá vừa có cập nhật quan trọng.";
  }

  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    title,
    message,
    createdAt,
    read: false,
    actionHref: getNotificationHref(basePath, data),
  };
}

function createHeaderTemplate({ basePath = ".", activePage = "" }) {
  const normalizedBasePath = normalizeBasePath(basePath);
  const authenticated = isAuthenticated();

  const homeUrl = homeHref(normalizedBasePath);
  const collectionsHref = pageHref(normalizedBasePath, "collections.html");
  const liveAuctionsHref = pageHref(normalizedBasePath, "live-auctions.html");
  const loginHref = pageHref(normalizedBasePath, "login.html");
  const accountHref = pageHref(normalizedBasePath, "account.html");
  const notificationsHref = pageHref(normalizedBasePath, "notifications.html");
  const adminHref = pageHref(normalizedBasePath, "admin.html");
  const publishHref = pageHref(normalizedBasePath, "publish-lot.html");
  const protocolUrl = protocolHref(normalizedBasePath);

  const actionHref = authenticated ? accountHref : loginHref;
  const actionText = authenticated ? "TÀI KHOẢN" : "ĐĂNG NHẬP";

  const authenticatedMenu = authenticated
    ? `
        <a class="home-settings-item home-settings-item-minimal" href="${notificationsHref}" title="Thông báo">
          <span class="home-settings-item-value">◇</span>
        </a>
        <a class="home-settings-item home-settings-item-minimal" href="${publishHref}" title="Đăng lô đấu giá">
          <span class="home-settings-item-value">▣</span>
        </a>
        <a class="home-settings-item home-settings-item-minimal" href="${adminHref}" title="Quản trị">
          <span class="home-settings-item-value">△</span>
        </a>
        <button class="home-settings-item home-settings-item-minimal" type="button" data-logout-btn title="Đăng xuất">
          <span class="home-settings-item-value">⎋</span>
        </button>
      `
    : `
        <a class="home-settings-item home-settings-item-minimal" href="${loginHref}" title="Đăng nhập">
          <span class="home-settings-item-value">◎</span>
        </a>
      `;

  return `
    <header class="site-header home-luxury-header" data-header data-header-base-path="${normalizedBasePath}">
      <a href="${homeUrl}" class="brand-mark" aria-label="${HEADER_CONFIG.brandAriaLabel}">
        ${HEADER_CONFIG.brandName}
      </a>

      <nav class="desktop-nav home-luxury-nav" aria-label="Điều hướng chính">
        <a href="${homeUrl}" class="nav-link ${activePage === "home" ? "is-active" : ""}">
          Trang Chủ
        </a>
        <a href="${collectionsHref}" class="nav-link ${activePage === "collections" ? "is-active" : ""}">
          Bộ Sưu Tập
        </a>
        <a href="${liveAuctionsHref}" class="nav-link ${activePage === "live-auctions" ? "is-active" : ""}">
          Đấu Giá Trực Tiếp
        </a>
        <a href="${protocolUrl}" class="nav-link">
          Giao Thức Tin Cậy
        </a>
      </nav>

      <div class="header-actions home-header-actions">
        <button
          class="home-search-trigger"
          type="button"
          data-auction-search-shortcut
          aria-label="Mở trang tìm kiếm đấu giá"
          title="Tìm kiếm đấu giá"
        >
          <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="5.5" stroke="currentColor" stroke-width="2" fill="none"></circle>
            <path d="M15 15L20 20" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
          </svg>
        </button>

        <div class="notification-wrapper">
          <button type="button" class="notification-bell" id="global-notification-bell" aria-label="Mở thông báo">
            🔔
            <span class="bell-badge" hidden></span>
          </button>

          <div class="notification-dropdown" id="global-notification-dropdown" hidden>
            <div class="notification-header">
              <h4>Thông báo</h4>
              <button type="button" class="mark-read-btn" id="mark-all-read-btn">
                Đã đọc tất cả
              </button>
            </div>

            <div class="notification-list" id="global-notification-list"></div>
          </div>
        </div>

        <a href="${actionHref}" class="button button-primary button-compact home-register-button" data-auth-btn>
          ${actionText}
        </a>

        <div class="home-settings">
          <button
            class="icon-button home-settings-trigger"
            type="button"
            data-home-settings-toggle
            aria-expanded="false"
            aria-label="Mở menu"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>

          <div class="home-settings-menu home-settings-menu-minimal" data-home-settings-menu hidden>
            <button class="home-settings-item home-settings-item-minimal" type="button" data-theme-toggle title="Đổi giao diện">
              <span class="home-settings-item-value" data-theme-icon>☾</span>
            </button>
            ${authenticatedMenu}
          </div>
        </div>
      </div>
    </header>
  `;
}

function renderNotificationList(basePath = ".") {
  const list = document.getElementById("global-notification-list");
  const badge = document.querySelector("#global-notification-bell .bell-badge");

  if (!list) {
    return;
  }

  const notifications = loadRuntimeNotifications();
  const unreadCount = notifications.filter((item) => !item.read).length;

  if (badge) {
    badge.hidden = unreadCount === 0;
  }

  if (notifications.length === 0) {
    list.innerHTML = `
      <div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 12px;">
        Chưa có thông báo real-time nào.
      </div>
    `;
    return;
  }

  list.innerHTML = notifications
    .map((notification) => {
      const href = notification.actionHref || pageHref(basePath, "notifications.html");

      return `
        <button
          type="button"
          class="notification-item ${notification.read ? "" : "unread"}"
          data-notification-id="${escapeHtml(notification.id)}"
          data-notification-href="${escapeHtml(href)}"
        >
          <p class="notif-title">${escapeHtml(notification.title)}</p>
          <p class="notif-message">${escapeHtml(notification.message)}</p>
          <p class="notif-time">${formatRelativeTime(notification.createdAt)}</p>
        </button>
      `;
    })
    .join("");
}

function addRuntimeNotification(notification, basePath = ".") {
  const notifications = loadRuntimeNotifications();

  const nextNotifications = [
    {
      ...notification,
      createdAt: notification.createdAt || new Date().toISOString(),
      read: false,
    },
    ...notifications,
  ].slice(0, MAX_NOTIFICATIONS);

  saveRuntimeNotifications(nextNotifications);
  renderNotificationList(basePath);

  const bell = document.getElementById("global-notification-bell");

  if (bell) {
    bell.classList.remove("shake-animation");
    void bell.offsetWidth;
    bell.classList.add("shake-animation");
  }
}

function bindHeaderActions(basePath = ".") {
  document.querySelectorAll("[data-auction-search-shortcut]").forEach((button) => {
    button.addEventListener("click", () => {
      window.location.href = pageHref(basePath, "live-auctions.html");
    });
  });

  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleTheme();
    });
  });

  document.querySelectorAll("[data-logout-btn]").forEach((button) => {
    button.addEventListener("click", () => {
      apiClient.clearAuth();
      window.location.replace(homeHref(basePath));
    });
  });

  const bell = document.getElementById("global-notification-bell");
  const dropdown = document.getElementById("global-notification-dropdown");
  const list = document.getElementById("global-notification-list");
  const markReadButton = document.getElementById("mark-all-read-btn");

  if (bell && dropdown) {
    bell.addEventListener("click", (event) => {
      event.stopPropagation();
      dropdown.hidden = !dropdown.hidden;
    });

    dropdown.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    document.addEventListener("click", () => {
      dropdown.hidden = true;
    });
  }

  if (markReadButton) {
    markReadButton.addEventListener("click", () => {
      const notifications = loadRuntimeNotifications().map((notification) => ({
        ...notification,
        read: true,
      }));

      saveRuntimeNotifications(notifications);
      renderNotificationList(basePath);
    });
  }

  if (list) {
    list.addEventListener("click", (event) => {
      const item = event.target.closest("[data-notification-id]");

      if (!item) {
        return;
      }

      const notificationId = item.dataset.notificationId;
      const notifications = loadRuntimeNotifications().map((notification) => {
        if (notification.id !== notificationId) {
          return notification;
        }

        return {
          ...notification,
          read: true,
        };
      });

      saveRuntimeNotifications(notifications);
      renderNotificationList(basePath);

      const href = item.dataset.notificationHref;
      if (href) {
        window.location.href = href;
      }
    });
  }

  document.addEventListener("click", (event) => {
    const logoutButton =
      event.target.closest("[data-logout-btn]") ||
      event.target.closest(".dashboard-logout-button") ||
      (event.target.closest("[data-auth-btn]") &&
        event.target.closest("[data-auth-btn]").textContent.trim().toUpperCase() === "ĐĂNG XUẤT");

    if (!logoutButton) {
      return;
    }

    event.preventDefault();
    apiClient.clearAuth();
    window.location.replace(homeHref(basePath));
  });
}

function bindSocketNotifications(basePath = ".") {
  if (!window.socketClient) {
    return;
  }

  window.socketClient.connect("global");

  window.socketClient.on("user_notification", (data) => {
    addRuntimeNotification(createNotificationFromSocket(data, basePath), basePath);
  });

  window.socketClient.on("fraud_detected", (data) => {
    addRuntimeNotification(createNotificationFromSocket({ ...data, type: "fraud" }, basePath), basePath);
  });

  window.socketClient.on("auction_winner", (data) => {
    addRuntimeNotification(
      createNotificationFromSocket(
        {
          ...data,
          type: "payment",
          title: "Kết quả phiên đấu giá",
          message: data.paymentUrl
            ? "Bạn có một phiên đấu giá cần hoàn tất thanh toán."
            : "Một phiên đấu giá vừa kết thúc.",
        },
        basePath,
      ),
      basePath,
    );
  });
}

function renderSiteHeaders() {
  let lastBasePath = ".";

  document.querySelectorAll("[data-site-header]").forEach((mountPoint) => {
    const basePath = mountPoint.dataset.basePath || ".";
    const activePage = mountPoint.dataset.activePage || "";

    lastBasePath = normalizeBasePath(basePath);

    mountPoint.outerHTML = createHeaderTemplate({
      basePath,
      activePage,
    });
  });

  initSiteHeader();
  bindHeaderActions(lastBasePath);
  renderNotificationList(lastBasePath);
  bindSocketNotifications(lastBasePath);
}

document.addEventListener("DOMContentLoaded", renderSiteHeaders);

export { renderSiteHeaders };
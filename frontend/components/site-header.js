import { initCommandPalette } from "../js/modules/command-palette.js";
import { initSiteHeader, closeSettingsMenus } from "../js/core/header.js";
import { initTheme, refreshThemeControls } from "../js/core/theme.js";
import apiClient from "../js/core/api-client.js";
import storage from "../js/core/storage.js";

const HEADER_CONFIG = {
  brandName: "BrosGem",
  brandAriaLabel: "Trang chủ BrosGem",
};

const NOTIFICATION_LIMIT = 6;

let isNotificationDropdownBound = false;

function normalizeBasePath(basePath) {
  return !basePath || basePath === "." ? "." : basePath.replace(/\/$/, "");
}

function getStoredToken() {
  return (
    storage.getRaw("jwt_token") ||
    storage.getRaw("token") ||
    localStorage.getItem("jwt_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("brosgem_token")
  );
}

function isAuthenticated() {
  const token = getStoredToken();
  return Boolean(token && token !== "undefined" && token !== "null" && token !== "");
}

function injectCommandPaletteStyles(basePath) {
  const normalizedBasePath = normalizeBasePath(basePath);
  const href =
    normalizedBasePath === "." ? "./css/command-palette.css" : `${normalizedBasePath}/css/command-palette.css`;

  if (document.querySelector('link[data-command-palette-style="true"]')) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.dataset.commandPaletteStyle = "true";
  document.head.appendChild(link);
}

function injectHeaderDropdownStyles() {
  if (document.querySelector('style[data-header-dropdown-style="true"]')) return;

  const style = document.createElement("style");
  style.dataset.headerDropdownStyle = "true";

  style.textContent = `
    .header-actions {
      position: relative;
    }

    .notification-shell,
    .home-settings {
      position: relative;
    }

    .notification-bell {
      position: relative;
      display: inline-grid;
      place-items: center;
      width: 42px;
      height: 42px;
      background: transparent;
      border: 0;
      color: var(--text-soft);
      font-size: 20px;
      transition:
        color var(--transition-fast),
        transform var(--transition-fast);
    }

    .notification-bell:hover {
      color: var(--primary);
      transform: translateY(-1px);
    }

    .bell-badge {
      display: none;
      position: absolute;
      top: 7px;
      right: 7px;
      width: 10px;
      height: 10px;
      background: var(--danger);
      border-radius: 999px;
      border: 2px solid var(--surface);
    }

    .notification-dropdown {
      position: absolute;
      top: calc(100% + 14px);
      right: -18px;
      z-index: 90;
      width: min(360px, calc(100vw - 28px));
      border: 1px solid var(--border);
      background:
        linear-gradient(135deg, rgba(197, 160, 89, 0.08), transparent 38%),
        var(--surface);
      box-shadow: var(--shadow-soft);
      backdrop-filter: blur(18px);
    }

    .notification-dropdown[hidden] {
      display: none !important;
    }

    .notification-dropdown::before {
      content: "";
      position: absolute;
      top: -7px;
      right: 28px;
      width: 12px;
      height: 12px;
      transform: rotate(45deg);
      border-left: 1px solid var(--border);
      border-top: 1px solid var(--border);
      background: var(--surface);
    }

    .notification-dropdown-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 16px 16px 12px;
      border-bottom: 1px solid var(--border);
    }

    .notification-dropdown-head strong {
      color: var(--text);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    .notification-dropdown-head a {
      color: var(--primary);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .notification-dropdown-list {
      max-height: 360px;
      overflow: auto;
      padding: 6px;
    }

    .notification-dropdown-item {
      display: grid;
      gap: 6px;
      padding: 12px;
      border: 1px solid transparent;
      color: var(--text-soft);
      transition:
        border-color var(--transition-fast),
        background-color var(--transition-fast),
        color var(--transition-fast);
    }

    .notification-dropdown-item:hover {
      border-color: var(--border);
      background: var(--surface-strong);
      color: var(--text);
    }

    .notification-dropdown-item.is-unread {
      border-color: rgba(197, 160, 89, 0.34);
      background: var(--primary-soft);
    }

    .notification-dropdown-item strong {
      color: var(--text);
      font-size: 13px;
      font-weight: 800;
      line-height: 1.35;
    }

    .notification-dropdown-item p {
      margin: 0;
      color: var(--text-soft);
      font-size: 12px;
      line-height: 1.5;
    }

    .notification-dropdown-item time {
      color: var(--text-muted);
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .notification-dropdown-state {
      display: grid;
      place-items: center;
      gap: 8px;
      min-height: 132px;
      padding: 20px;
      color: var(--text-muted);
      text-align: center;
      font-size: 12px;
      line-height: 1.5;
    }

    .home-settings-menu-minimal {
      min-width: auto;
      width: 70px;
      padding: 6px;
      display: grid;
      gap: 6px;
    }

    .home-settings-menu[hidden] {
      display: none !important;
    }

    .home-settings-icon-only {
      width: 56px;
      height: 46px;
      display: grid;
      place-items: center;
      padding: 0;
      font-size: 18px;
      line-height: 1;
    }

    .home-settings-icon-only span {
      margin: 0;
    }

    @media (max-width: 720px) {
      .notification-dropdown {
        right: -76px;
      }

      .notification-dropdown::before {
        right: 86px;
      }
    }
  `;

  document.head.appendChild(style);
}

function createHeaderTemplate({ basePath = ".", activePage = "" }) {
  const normalizedBasePath = normalizeBasePath(basePath);
  const isRoot = normalizedBasePath === ".";
  const authenticated = isAuthenticated();

  const homeHref = isRoot ? "./index.html" : `${normalizedBasePath}/index.html`;
  const collectionsHref = isRoot ? "./pages/collections.html" : "./collections.html";
  const liveAuctionsHref = isRoot ? "./pages/live-auctions.html" : "./live-auctions.html";
  const loginHref = isRoot ? "./pages/login.html" : "./login.html";
  const accountHref = isRoot ? "./pages/account.html" : "./account.html";
  const notificationsHref = isRoot ? "./pages/notifications.html" : "./notifications.html";
  const settingsHref = authenticated
    ? isRoot
      ? "./pages/account.html#settings"
      : "./account.html#settings"
    : loginHref;
  const protocolHref = isRoot ? "#protocol" : `${normalizedBasePath}/index.html#protocol`;

  const actionHref = authenticated ? accountHref : loginHref;
  const actionText = authenticated ? "TÀI KHOẢN" : "ĐĂNG NHẬP";

  return `
    <header class="site-header home-luxury-header" data-header>
      <a href="${homeHref}" class="brand-mark" aria-label="${HEADER_CONFIG.brandAriaLabel}">
        ${HEADER_CONFIG.brandName}
      </a>

      <nav class="desktop-nav home-luxury-nav" aria-label="Điều hướng chính">
        <a href="${homeHref}" class="nav-link ${activePage === "home" ? "is-active" : ""}">
          Trang Chủ
        </a>

        <a href="${collectionsHref}" class="nav-link ${activePage === "collections" ? "is-active" : ""}">
          Bộ Sưu Tập
        </a>

        <a href="${liveAuctionsHref}" class="nav-link ${activePage === "live-auctions" ? "is-active" : ""}">
          Đấu Giá Trực Tiếp
        </a>

        <a href="${protocolHref}" class="nav-link">
          Giao Thức Tin Cậy
        </a>
      </nav>

      <div class="header-actions home-header-actions">
        <button
          class="home-search-trigger"
          type="button"
          data-command-palette-open
          aria-label="Tìm kiếm"
          title="Tìm kiếm"
        >
          <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="5.5" stroke="currentColor" stroke-width="2" fill="none"></circle>
            <path d="M15 15L20 20" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
          </svg>
        </button>

        <div class="notification-shell">
          <button
            type="button"
            class="notification-bell"
            id="global-notification-bell"
            data-notification-toggle
            aria-label="Mở thông báo"
            aria-expanded="false"
            title="Thông báo"
          >
            <span aria-hidden="true">🔔</span>
            <span class="bell-badge" aria-hidden="true"></span>
          </button>

          <section
            class="notification-dropdown"
            data-notification-dropdown
            hidden
            aria-label="Thông báo gần đây"
          >
            <div class="notification-dropdown-head">
              <strong>Thông báo</strong>
              <a href="${notificationsHref}" data-open-full-notifications>Xem tất cả</a>
            </div>

            <div class="notification-dropdown-list" data-notification-list>
              <div class="notification-dropdown-state">
                <span>◇</span>
                <p>Bấm chuông để tải thông báo mới nhất.</p>
              </div>
            </div>
          </section>
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
            aria-label="Mở cài đặt"
            title="Cài đặt"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>

          <div class="home-settings-menu home-settings-menu-minimal" data-home-settings-menu hidden>
            <button
              class="home-settings-item home-settings-icon-only"
              type="button"
              data-theme-toggle
              aria-label="Đổi giao diện"
              title="Đổi giao diện"
            >
              <span data-theme-icon aria-hidden="true">☾</span>
            </button>

            <a
              class="home-settings-item home-settings-icon-only"
              href="${settingsHref}"
              aria-label="Cài đặt tài khoản"
              title="Cài đặt tài khoản"
              data-settings-link
            >
              <span aria-hidden="true">⚙</span>
            </a>
          </div>
        </div>
      </div>

      <button
        class="mobile-menu-button"
        type="button"
        data-mobile-menu-button
        aria-expanded="false"
        aria-label="Mở menu di động"
      >
        <span></span>
        <span></span>
        <span></span>
      </button>
    </header>

    <nav class="mobile-nav-panel" data-mobile-nav-panel aria-label="Điều hướng di động">
      <a href="${homeHref}" class="mobile-nav-link">Trang Chủ</a>
      <a href="${collectionsHref}" class="mobile-nav-link">Bộ Sưu Tập</a>
      <a href="${liveAuctionsHref}" class="mobile-nav-link">Đấu Giá Trực Tiếp</a>
      <a href="${protocolHref}" class="mobile-nav-link">Giao Thức Tin Cậy</a>
      <a href="${actionHref}" class="mobile-nav-link mobile-nav-cta">${actionText}</a>
    </nav>
  `;
}

function closeNotificationDropdown() {
  const dropdown = document.querySelector("[data-notification-dropdown]");
  const toggle = document.querySelector("[data-notification-toggle]");

  if (dropdown) {
    dropdown.hidden = true;
  }

  if (toggle) {
    toggle.setAttribute("aria-expanded", "false");
  }
}

function closeAllHeaderPopovers() {
  closeSettingsMenus();
  closeNotificationDropdown();
}

function formatNotificationTime(value) {
  if (!value) return "Vừa xong";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Vừa xong";

  const diffMs = Math.max(0, Date.now() - date.getTime());
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "Vừa xong";
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;

  return `${Math.floor(diffHours / 24)} ngày trước`;
}

function normalizeNotification(raw) {
  return {
    id: raw.id || raw.notificationId || `${Date.now()}-${Math.random()}`,
    title: raw.title || "Thông báo",
    message: raw.message || raw.content || "Bạn có một cập nhật mới.",
    isRead: Boolean(raw.isRead ?? raw.is_read),
    actionUrl: raw.actionUrl || raw.action_url || "",
    createdAt: raw.createdAt || raw.created_at || raw.time || null,
  };
}

function normalizeNotificationsResponse(response) {
  const candidates = [
    response?.data?.notifications,
    response?.data?.items,
    response?.notifications,
    response?.items,
    response?.data,
    response,
  ];

  const arrayValue = candidates.find((item) => Array.isArray(item));
  return arrayValue ? arrayValue.map(normalizeNotification) : [];
}

function normalizeActionUrl(url) {
  if (!url) return "";

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  if (url.startsWith("/pages/")) {
    return `.${url.replace("/pages", "")}`;
  }

  if (url.startsWith("/")) {
    return `.${url}`;
  }

  return url;
}

function renderNotificationState(message) {
  const list = document.querySelector("[data-notification-list]");
  if (!list) return;

  list.innerHTML = `
    <div class="notification-dropdown-state">
      <span>◇</span>
      <p>${message}</p>
    </div>
  `;
}

function renderNotifications(notifications) {
  const list = document.querySelector("[data-notification-list]");
  const badge = document.querySelector("#global-notification-bell .bell-badge");

  if (!list) return;

  if (notifications.length === 0) {
    if (badge) badge.style.display = "none";

    renderNotificationState("Chưa có thông báo mới.");
    return;
  }

  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  if (badge) {
    badge.style.display = unreadCount > 0 ? "block" : "none";
  }

  list.innerHTML = notifications
    .map((notification) => {
      const href = normalizeActionUrl(notification.actionUrl);

      const content = `
        <strong>${notification.title}</strong>
        <p>${notification.message}</p>
        <time>${formatNotificationTime(notification.createdAt)}</time>
      `;

      if (href) {
        return `
          <a
            class="notification-dropdown-item ${notification.isRead ? "" : "is-unread"}"
            href="${href}"
            data-notification-item="${notification.id}"
          >
            ${content}
          </a>
        `;
      }

      return `
        <article
          class="notification-dropdown-item ${notification.isRead ? "" : "is-unread"}"
          data-notification-item="${notification.id}"
        >
          ${content}
        </article>
      `;
    })
    .join("");
}

async function fetchHeaderNotifications() {
  const list = document.querySelector("[data-notification-list]");

  if (!list) return;

  if (!isAuthenticated()) {
    renderNotificationState("Bạn cần đăng nhập để xem thông báo.");
    return;
  }

  list.innerHTML = `
    <div class="notification-dropdown-state">
      <span>◇</span>
      <p>Đang tải thông báo...</p>
    </div>
  `;

  try {
    const response = await apiClient.get(
      "/notifications",
      {
        limit: NOTIFICATION_LIMIT,
      },
      {
        auth: true,
        idempotency: false,
        redirectOnUnauthorized: false,
      },
    );

    const notifications = normalizeNotificationsResponse(response).slice(0, NOTIFICATION_LIMIT);
    renderNotifications(notifications);
  } catch (error) {
    renderNotificationState("Chưa kết nối được API thông báo. Thử lại sau nhé.");
  }
}

function toggleNotificationDropdown() {
  const dropdown = document.querySelector("[data-notification-dropdown]");
  const toggle = document.querySelector("[data-notification-toggle]");

  if (!dropdown || !toggle) return;

  const shouldOpen = dropdown.hidden;

  closeSettingsMenus();

  dropdown.hidden = !shouldOpen;
  toggle.setAttribute("aria-expanded", String(shouldOpen));

  if (shouldOpen) {
    fetchHeaderNotifications();
  }
}

function bindNotificationDropdown() {
  if (isNotificationDropdownBound) return;

  isNotificationDropdownBound = true;

  document.addEventListener("click", (event) => {
    const notificationToggle = event.target.closest("[data-notification-toggle]");

    if (notificationToggle) {
      event.preventDefault();
      event.stopPropagation();
      toggleNotificationDropdown();
      return;
    }

    const clickedInsideNotification = event.target.closest(".notification-shell");
    const clickedInsideSettings = event.target.closest(".home-settings");

    if (!clickedInsideNotification && !clickedInsideSettings) {
      closeNotificationDropdown();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeNotificationDropdown();
    }
  });

  window.addEventListener("brosgem:close-header-menu", () => {
    closeAllHeaderPopovers();
  });
}

function renderSiteHeaders() {
  document.querySelectorAll("[data-site-header]").forEach((mountPoint) => {
    const basePath = mountPoint.dataset.basePath || ".";
    const activePage = mountPoint.dataset.activePage || "";

    injectCommandPaletteStyles(basePath);
    injectHeaderDropdownStyles();

    mountPoint.outerHTML = createHeaderTemplate({
      basePath,
      activePage,
    });
  });

  initTheme();
  refreshThemeControls();
  initSiteHeader();
  bindNotificationDropdown();

  if (typeof initCommandPalette === "function") {
    initCommandPalette();
  }

  if (window.socketClient) {
    window.socketClient.connect("global");

    window.socketClient.on("user_notification", () => {
      const bell = document.getElementById("global-notification-bell");
      const badge = bell?.querySelector(".bell-badge");

      if (bell && badge) {
        badge.style.display = "block";
        bell.classList.add("shake-animation");

        window.setTimeout(() => {
          bell.classList.remove("shake-animation");
        }, 1000);
      }

      const dropdown = document.querySelector("[data-notification-dropdown]");

      if (dropdown && !dropdown.hidden) {
        fetchHeaderNotifications();
      }
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", renderSiteHeaders);
} else {
  renderSiteHeaders();
}

export {
  renderSiteHeaders,
};
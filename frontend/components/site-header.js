import { initCommandPalette } from "../js/modules/command-palette.js";
import { initSiteHeader, closeHeaderPopovers, closeSettingsMenus } from "../js/core/header.js";
import { initTheme, refreshThemeControls } from "../js/core/theme.js";
import apiClient from "../js/core/api-client.js";
import storage from "../js/core/storage.js";

const HEADER_CONFIG = {
  brandName: "BrosGem",
  brandAriaLabel: "Trang chủ BrosGem",
};

const NOTIFICATION_LIMIT = 6;

let isNotificationDropdownBound = false;
let currentNotifications = [];
let isMarkingAllNotifications = false;

function normalizeBasePath(basePath) {
  return !basePath || basePath === "." ? "." : basePath.replace(/\/$/, "");
}

function joinPath(basePath, fileName) {
  const normalizedBasePath = normalizeBasePath(basePath);

  if (normalizedBasePath === ".") {
    return `./${fileName}`;
  }

  return `${normalizedBasePath}/${fileName}`;
}

function getStoredToken() {
  return (
    storage.getRaw("jwt_token") ||
    storage.getRaw("token") ||
    storage.getRaw("auth_token") ||
    localStorage.getItem("jwt_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("brosgem_token")
  );
}

function parseMaybeJson(value) {
  if (!value) return null;

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getStoredUser() {
  const apiUser = typeof apiClient.getAuthUser === "function" ? apiClient.getAuthUser() : null;

  if (apiUser) {
    return apiUser;
  }

  const candidates = [
    storage.get("auth_user"),
    storage.get("user_info"),
    storage.get("user"),
    storage.get("authUser"),
    storage.get("brosgem_user"),
    storage.getRaw("auth_user"),
    storage.getRaw("user_info"),
    storage.getRaw("user"),
    storage.getRaw("authUser"),
    storage.getRaw("brosgem_user"),
    localStorage.getItem("auth_user"),
    localStorage.getItem("user_info"),
    localStorage.getItem("user"),
    localStorage.getItem("authUser"),
    localStorage.getItem("brosgem_user"),
  ];

  for (const candidate of candidates) {
    const user = parseMaybeJson(candidate);

    if (user && typeof user === "object") {
      return user;
    }
  }

  return null;
}

function isAuthenticated() {
  const token = getStoredToken();
  return Boolean(token && token !== "undefined" && token !== "null" && token !== "");
}

function isAdminUser() {
  const user = getStoredUser();
  return String(user?.role || "").toLowerCase() === "admin";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const WINDOWS_1252_REVERSE_MAP = new Map([
  ["€", 0x80],
  ["‚", 0x82],
  ["ƒ", 0x83],
  ["„", 0x84],
  ["…", 0x85],
  ["†", 0x86],
  ["‡", 0x87],
  ["ˆ", 0x88],
  ["‰", 0x89],
  ["Š", 0x8a],
  ["‹", 0x8b],
  ["Œ", 0x8c],
  ["Ž", 0x8e],
  ["‘", 0x91],
  ["’", 0x92],
  ["“", 0x93],
  ["”", 0x94],
  ["•", 0x95],
  ["–", 0x96],
  ["—", 0x97],
  ["˜", 0x98],
  ["™", 0x99],
  ["š", 0x9a],
  ["›", 0x9b],
  ["œ", 0x9c],
  ["ž", 0x9e],
  ["Ÿ", 0x9f],
]);

function looksLikeMojibake(value) {
  return /Ã|Â|Ä|Å|Æ|áº|á»|â€|â€™|â€œ|â€|�/.test(String(value ?? ""));
}

function toWindows1252Bytes(text) {
  const bytes = [];

  for (const char of String(text ?? "")) {
    const code = char.charCodeAt(0);

    if (code <= 0xff) {
      bytes.push(code);
      continue;
    }

    if (WINDOWS_1252_REVERSE_MAP.has(char)) {
      bytes.push(WINDOWS_1252_REVERSE_MAP.get(char));
      continue;
    }

    return null;
  }

  return Uint8Array.from(bytes);
}

function decodeMojibake(value) {
  const text = String(value ?? "");

  if (!text || !looksLikeMojibake(text)) {
    return text;
  }

  const bytes = toWindows1252Bytes(text);

  if (!bytes) {
    return text;
  }

  try {
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    return decoded.includes("�") ? text : decoded;
  } catch {
    return text;
  }
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

function normalizeNotification(raw) {
  return {
    id: raw.id || raw.notificationId || `${Date.now()}-${Math.random()}`,
    title: decodeMojibake(raw.title || "Thông báo"),
    message: decodeMojibake(raw.message || raw.content || "Bạn có một cập nhật mới."),
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
    .site-header {
      transition:
        transform var(--transition-medium),
        background-color var(--transition-medium),
        border-color var(--transition-medium),
        box-shadow var(--transition-medium);
      will-change: transform;
    }

    .site-header.is-hidden {
      transform: translateY(calc(-1 * var(--header-height)));
    }

    .site-header.is-scrolled {
      box-shadow: 0 18px 50px rgba(0, 0, 0, 0.24);
    }

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
      cursor: pointer;
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
      background: var(--danger, #ef4444);
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

    .notification-dropdown[hidden],
    .home-settings-menu[hidden],
    .mobile-nav-panel[hidden] {
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

    .notification-dropdown-head strong,
    .notification-mark-all {
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .notification-dropdown-list {
      max-height: 360px;
      overflow: auto;
      padding: 6px;
    }

    .notification-dropdown-item {
      width: 100%;
      display: grid;
      gap: 6px;
      padding: 12px;
      border: 1px solid transparent;
      background: transparent;
      text-align: left;
      color: var(--text-soft);
      cursor: pointer;
      transition:
        border-color var(--transition-fast),
        background-color var(--transition-fast),
        color var(--transition-fast);
    }

    .notification-dropdown-item-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
    }

    .notification-unread-dot {
      flex: 0 0 auto;
      width: 8px;
      height: 8px;
      margin-top: 5px;
      border-radius: 999px;
      background: #ef4444;
      box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.18);
    }

    .notification-mark-all {
      padding: 0;
      border: 0;
      background: transparent;
      color: var(--primary);
      cursor: pointer;
    }

    .notification-mark-all[disabled] {
      opacity: 0.5;
      cursor: not-allowed;
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
      width: 70px;
      min-width: auto;
      padding: 6px;
      display: grid;
      gap: 6px;
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
  const adminUser = authenticated && isAdminUser();

  const homeHref = isRoot ? "./index.html" : `${normalizedBasePath}/index.html`;
  const collectionsHref = isRoot ? "./pages/collections.html" : "./collections.html";
  const liveAuctionsHref = isRoot ? "./pages/live-auctions.html" : "./live-auctions.html";
  const loginHref = isRoot ? "./pages/login.html" : "./login.html";
  const accountHref = isRoot ? "./pages/account.html" : "./account.html";
  const adminHref = isRoot ? "./pages/admin.html" : "./admin.html";
  const protocolHref = isRoot ? "#protocol" : `${normalizedBasePath}/index.html#protocol`;

  const settingsHref = authenticated
    ? adminUser
      ? adminHref
      : isRoot
        ? "./pages/account.html#settings"
        : "./account.html#settings"
    : loginHref;

  const logoutHref = loginHref;

  const actionHref = authenticated ? (adminUser ? adminHref : accountHref) : loginHref;
  const actionText = authenticated ? (adminUser ? "QUẢN TRỊ" : "TÀI KHOẢN") : "ĐĂNG NHẬP";
  const actionTargetAttrs = authenticated && adminUser ? 'target="_blank" rel="noopener noreferrer"' : "";

  return `
    <header class="site-header home-luxury-header" data-header>
      <a href="${homeHref}" class="brand-mark" aria-label="${HEADER_CONFIG.brandAriaLabel}">
        ${HEADER_CONFIG.brandName}
      </a>

      <nav class="desktop-nav home-luxury-nav" aria-label="Điều hướng chính">
        <a href="${homeHref}" class="nav-link ${activePage === "home" ? "is-active" : ""}">Trang Chủ</a>
        <a href="${collectionsHref}" class="nav-link ${activePage === "collections" ? "is-active" : ""}">Bộ Sưu Tập</a>
        <a href="${liveAuctionsHref}" class="nav-link ${activePage === "live-auctions" ? "is-active" : ""}">Đấu Giá Trực Tiếp</a>
        <a href="${protocolHref}" class="nav-link">Giao Thức Tin Cậy</a>
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

        <div class="notification-shell" data-notification-shell>
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

          <section class="notification-dropdown" data-notification-dropdown hidden aria-label="Thông báo gần đây">
            <div class="notification-dropdown-head">
              <strong>Thông báo</strong>
              <button type="button" class="notification-mark-all" data-mark-all-notifications-read>
                Đánh dấu đã đọc
              </button>
            </div>

            <div class="notification-dropdown-list" data-notification-list>
              <div class="notification-dropdown-state">
                <span>◇</span>
                <p>Bấm chuông để tải thông báo mới nhất.</p>
              </div>
            </div>
          </section>
        </div>

        <a href="${actionHref}" class="button button-primary button-compact home-register-button" data-auth-btn ${actionTargetAttrs}>
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
              aria-label="${adminUser ? "Mở trang quản trị" : "Cài đặt tài khoản"}"
              title="${adminUser ? "Mở trang quản trị" : "Cài đặt tài khoản"}"
              ${adminUser ? 'target="_blank" rel="noopener noreferrer"' : ""}
            >
              <span aria-hidden="true">⚙</span>
            </a>

            ${
              authenticated
                ? `
                  <button
                    class="home-settings-item home-settings-icon-only"
                    type="button"
                    data-logout-btn
                    data-logout-redirect="${logoutHref}"
                    aria-label="Đăng xuất"
                    title="Đăng xuất"
                  >
                    <span aria-hidden="true">⎋</span>
                  </button>
                `
                : ""
            }
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

    <nav class="mobile-nav-panel" data-mobile-nav-panel hidden aria-label="Điều hướng di động">
      <a href="${homeHref}" class="mobile-nav-link">Trang Chủ</a>
      <a href="${collectionsHref}" class="mobile-nav-link">Bộ Sưu Tập</a>
      <a href="${liveAuctionsHref}" class="mobile-nav-link">Đấu Giá Trực Tiếp</a>
      <a href="${protocolHref}" class="mobile-nav-link">Giao Thức Tin Cậy</a>
      <a href="${actionHref}" class="mobile-nav-link mobile-nav-cta" ${actionTargetAttrs}>${actionText}</a>
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

function renderNotificationState(message) {
  const list = document.querySelector("[data-notification-list]");

  if (!list) return;

  list.innerHTML = `
    <div class="notification-dropdown-state">
      <span>◇</span>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

function updateNotificationBadge(notifications = []) {
  const badge = document.querySelector("#global-notification-bell .bell-badge");

  if (!badge) return;

  const unreadCount = notifications.filter((notification) => !notification.isRead).length;
  badge.style.display = unreadCount > 0 ? "block" : "none";
}

function renderNotifications(notifications) {
  const list = document.querySelector("[data-notification-list]");

  if (!list) return;

  currentNotifications = notifications.slice(0, NOTIFICATION_LIMIT);
  updateNotificationBadge(currentNotifications);

  if (currentNotifications.length === 0) {
    renderNotificationState("Chưa có thông báo mới.");
    return;
  }

  list.innerHTML = currentNotifications
    .map(
      (notification) => `
        <button
          type="button"
          class="notification-dropdown-item ${notification.isRead ? "" : "is-unread"}"
          data-notification-id="${escapeHtml(notification.id)}"
        >
          <div class="notification-dropdown-item-head">
            <strong>${escapeHtml(notification.title)}</strong>
            ${notification.isRead ? "" : '<span class="notification-unread-dot" aria-label="Chưa đọc"></span>'}
          </div>
          <p>${escapeHtml(notification.message)}</p>
          <time>${formatNotificationTime(notification.createdAt)}</time>
        </button>
      `,
    )
    .join("");
}

async function markNotificationAsRead(notificationId) {
  const targetId = String(notificationId);
  const targetNotification = currentNotifications.find((notification) => String(notification.id) === targetId);

  if (!targetNotification || targetNotification.isRead) {
    return;
  }

  targetNotification.isRead = true;
  renderNotifications(currentNotifications);

  try {
    await apiClient.patch(
      `/notifications/${encodeURIComponent(targetNotification.id)}/read`,
      null,
      {
        auth: true,
        idempotency: false,
        redirectOnUnauthorized: false,
      },
    );
  } catch (error) {
    console.warn("[Header] Không thể cập nhật trạng thái đã đọc:", error);
  }
}

async function markAllNotificationsAsRead() {
  if (isMarkingAllNotifications || currentNotifications.length === 0) {
    return;
  }

  const hasUnread = currentNotifications.some((notification) => !notification.isRead);

  if (!hasUnread) {
    return;
  }

  isMarkingAllNotifications = true;
  currentNotifications = currentNotifications.map((notification) => ({
    ...notification,
    isRead: true,
  }));
  renderNotifications(currentNotifications);

  try {
    await apiClient.patch(
      "/notifications/read-all",
      null,
      {
        auth: true,
        idempotency: false,
        redirectOnUnauthorized: false,
      },
    );
  } catch (error) {
    console.warn("[Header] Không thể đánh dấu tất cả thông báo là đã đọc:", error);
  } finally {
    isMarkingAllNotifications = false;
  }
}

async function loadNotifications() {
  if (!isAuthenticated()) {
    currentNotifications = [];
    updateNotificationBadge([]);
    renderNotificationState("Đăng nhập để xem thông báo đấu giá.");
    return;
  }

  renderNotificationState("Đang tải thông báo...");

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

    renderNotifications(normalizeNotificationsResponse(response));
  } catch (error) {
    console.warn("[Header] Không thể tải thông báo:", error);
    currentNotifications = [];
    updateNotificationBadge([]);
    renderNotificationState("Chưa kết nối được API thông báo. Thử lại sau nhé.");
  }
}

function bindNotificationDropdown() {
  if (isNotificationDropdownBound) return;

  isNotificationDropdownBound = true;

  document.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-notification-toggle]");
    const dropdown = event.target.closest("[data-notification-dropdown]");
    const markAllButton = event.target.closest("[data-mark-all-notifications-read]");
    const notificationItem = event.target.closest("[data-notification-id]");

    if (toggle) {
      event.preventDefault();

      closeSettingsMenus?.();

      const targetDropdown = document.querySelector("[data-notification-dropdown]");
      const isOpening = targetDropdown?.hidden;

      if (targetDropdown) {
        targetDropdown.hidden = !targetDropdown.hidden;
      }

      toggle.setAttribute("aria-expanded", isOpening ? "true" : "false");

      if (isOpening) {
        loadNotifications();
      }

      return;
    }

    if (markAllButton) {
      event.preventDefault();
      markAllNotificationsAsRead();
      return;
    }

    if (notificationItem) {
      event.preventDefault();
      event.stopPropagation();
      markNotificationAsRead(notificationItem.dataset.notificationId);
      return;
    }

    if (!dropdown) {
      closeNotificationDropdown();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeNotificationDropdown();
    }
  });

  window.addEventListener(
    "scroll",
    () => {
      closeNotificationDropdown();
    },
    {
      passive: true,
    },
  );
}

function bindLogoutButtons() {
  document.querySelectorAll("[data-logout-btn]").forEach((button) => {
    button.addEventListener("click", () => {
      const redirectHref = button.dataset.logoutRedirect || "./login.html";

      apiClient.clearAuth();
      closeHeaderPopovers?.();
      closeSettingsMenus?.();
      closeNotificationDropdown();

      window.location.href = redirectHref;
    });
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
  refreshThemeControls?.();

  initSiteHeader({
    hideAfter: 120,
    topRevealOffset: 12,
  });

  initCommandPalette?.();
  bindNotificationDropdown();
  bindLogoutButtons();

  if (isAuthenticated()) {
    loadNotifications();
  }
}

document.addEventListener("DOMContentLoaded", renderSiteHeaders);

export {
  renderSiteHeaders,
  closeNotificationDropdown,
};
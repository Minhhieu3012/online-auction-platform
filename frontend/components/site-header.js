import { initCommandPalette } from "../js/modules/command-palette.js";
import { initSiteHeader } from "../js/core/header.js";
import storage from "../js/core/storage.js";
import apiClient from "../js/core/api-client.js";

const HEADER_CONFIG = {
  brandName: "BrosGem",
  brandAriaLabel: "Trang chủ BrosGem",
};

function normalizeBasePath(basePath) {
  return !basePath || basePath === "." ? "." : basePath.replace(/\/$/, "");
}

function isAuthenticated() {
  const token = storage.getRaw("jwt_token") || storage.getRaw("token") || localStorage.getItem("jwt_token");
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

function createHeaderTemplate({ basePath = ".", activePage = "" }) {
  const normalizedBasePath = normalizeBasePath(basePath);
  const isRoot = normalizedBasePath === ".";
  const authenticated = isAuthenticated();

  const homeHref = isRoot ? "./index.html" : `${normalizedBasePath}/index.html`;
  const collectionsHref = isRoot ? "./pages/collections.html" : "./collections.html";
  const liveAuctionsHref = isRoot ? "./pages/live-auctions.html" : "./live-auctions.html";
  const loginHref = isRoot ? "./pages/login.html" : "./login.html";
  const accountHref = isRoot ? "./pages/account.html" : "./account.html";
  const protocolHref = isRoot ? "#protocol" : `${normalizedBasePath}/index.html#protocol`;

  let actionHref = loginHref;
  let actionText = "ĐĂNG NHẬP";
  let logoutMenuHtml = "";

  if (authenticated) {
    actionHref = accountHref;
    actionText = "TÀI KHOẢN";

    logoutMenuHtml = `
            <button class="home-settings-item" type="button" data-logout-btn style="color: #ef4444;">
                <span data-theme-icon style="margin-right: 8px;">⎋</span> Đăng xuất
            </button>
        `;
  }

  // Khung Notification mới
  const notificationHtml = `
      <div class="notification-wrapper">
          <button type="button" class="notification-bell" id="global-notification-bell">
              🔔<span class="bell-badge" style="display: none;"></span>
          </button>
          <div class="notification-dropdown" id="global-notification-dropdown" hidden>
              <div class="notification-header">
                  <h4>Thông báo</h4>
                  <button type="button" class="mark-read-btn" id="mark-all-read-btn">Đã đọc tất cả</button>
              </div>
              <div class="notification-list" id="global-notification-list">
                  </div>
          </div>
      </div>
  `;

  return `
        <header class="site-header home-luxury-header" data-header>
            <a href="${homeHref}" class="brand-mark" aria-label="${HEADER_CONFIG.brandAriaLabel}">${HEADER_CONFIG.brandName}</a>
            <nav class="desktop-nav home-luxury-nav" aria-label="Primary navigation">
                <a href="${homeHref}" class="nav-link ${activePage === "home" ? "is-active" : ""}">Trang Chủ</a>
                <a href="${collectionsHref}" class="nav-link ${activePage === "collections" ? "is-active" : ""}">Bộ Sưu Tập</a>
                <a href="${liveAuctionsHref}" class="nav-link ${activePage === "live-auctions" ? "is-active" : ""}">Đấu Giá Trực Tiếp</a>
                <a href="${protocolHref}" class="nav-link">Giao Thức Tin Cậy</a>
            </nav>
            <div class="header-actions home-header-actions">
                <button class="home-search-trigger" type="button" data-command-palette-open aria-label="Tìm kiếm">
                    <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">
                        <circle cx="10.5" cy="10.5" r="5.5" stroke="currentColor" stroke-width="2" fill="none"></circle>
                        <path d="M15 15L20 20" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
                    </svg>
                </button>

                ${notificationHtml}

                <a href="${actionHref}" class="button button-primary button-compact home-register-button" data-auth-btn>
                    ${actionText}
                </a>
                <div class="home-settings">
                    <button class="icon-button home-settings-trigger" type="button" data-home-settings-toggle aria-expanded="false">
                        <span></span><span></span><span></span>
                    </button>
                    <div class="home-settings-menu home-settings-menu-minimal" data-home-settings-menu hidden>
                        <button class="home-settings-item" type="button" data-theme-toggle title="Đổi giao diện">
                            <span data-theme-icon>☾</span> Giao diện
                        </button>
                        ${logoutMenuHtml}
                    </div>
                </div>
            </div>
        </header>
    `;
}

// Dữ liệu Mock để test UI trước khi có API
let mockNotifications = [
  {
    id: 1,
    title: "Bạn đã bị vượt mặt!",
    message: "Có người vừa đặt giá $250 cho Đồng hồ Rolex Test.",
    time: "2 phút trước",
    read: false,
  },
  {
    id: 2,
    title: "Đấu giá thành công",
    message: "Chúc mừng! Bạn đã thắng Lot 007 với mức giá $150.",
    time: "1 ngày trước",
    read: true,
  },
];

function initNotificationCenter() {
  const bell = document.getElementById("global-notification-bell");
  const dropdown = document.getElementById("global-notification-dropdown");
  const notifList = document.getElementById("global-notification-list");
  const badge = bell?.querySelector(".bell-badge");
  const markReadBtn = document.getElementById("mark-all-read-btn");

  function renderNotifs() {
    if (!notifList) return;
    if (mockNotifications.length === 0) {
      notifList.innerHTML =
        '<div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 12px;">Không có thông báo nào</div>';
      return;
    }

    notifList.innerHTML = mockNotifications
      .map(
        (n) => `
        <button type="button" class="notification-item ${n.read ? "" : "unread"}" data-id="${n.id}">
            <p class="notif-title">${n.title}</p>
            <p class="notif-message">${n.message}</p>
            <p class="notif-time">${n.time}</p>
        </button>
    `,
      )
      .join("");

    const unreadCount = mockNotifications.filter((n) => !n.read).length;
    if (badge) badge.style.display = unreadCount > 0 ? "block" : "none";
  }

  if (bell && dropdown) {
    renderNotifs();

    // Toggle Menu
    bell.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdown.hidden = !dropdown.hidden;
    });

    // Bấm ra ngoài thì đóng Menu
    document.addEventListener("click", (e) => {
      if (!dropdown.contains(e.target) && !bell.contains(e.target)) {
        dropdown.hidden = true;
      }
    });

    // Nút Đánh dấu đã đọc
    if (markReadBtn) {
      markReadBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        mockNotifications.forEach((n) => (n.read = true));
        renderNotifs();
      });
    }

    // Click vào một thông báo để đọc
    notifList.addEventListener("click", (e) => {
      const item = e.target.closest(".notification-item");
      if (item) {
        const id = Number(item.dataset.id);
        const notif = mockNotifications.find((n) => n.id === id);
        if (notif) notif.read = true;
        renderNotifs();
      }
    });
  }

  // Kết nối Socket để lắng nghe thông báo Real-time
  if (window.socketClient) {
    window.socketClient.connect("global");
    window.socketClient.on("user_notification", (data) => {
      // Đẩy tin mới lên đầu mảng
      mockNotifications.unshift({
        id: Date.now(),
        title: data.title || "Thông báo hệ thống",
        message: data.message || "Bạn có một thông báo mới.",
        time: "Vừa xong",
        read: false,
      });
      renderNotifs();

      // Hiệu ứng rung chuông
      if (bell) {
        bell.classList.remove("shake-animation");
        void bell.offsetWidth; // Reset animation
        bell.classList.add("shake-animation");
      }
    });
  }
}

function renderSiteHeaders() {
  document.querySelectorAll("[data-site-header]").forEach((mountPoint) => {
    const basePath = mountPoint.dataset.basePath || ".";
    const activePage = mountPoint.dataset.activePage || "";
    injectCommandPaletteStyles(basePath);
    mountPoint.outerHTML = createHeaderTemplate({ basePath, activePage });
  });

  initSiteHeader();
  if (typeof initCommandPalette === "function") initCommandPalette();

  // Kích hoạt Trung tâm thông báo
  initNotificationCenter();
}

document.addEventListener("click", (e) => {
  const logoutBtn =
    e.target.closest("[data-logout-btn]") ||
    e.target.closest(".dashboard-logout-button") ||
    (e.target.closest("[data-auth-btn]") &&
      e.target.closest("[data-auth-btn]").textContent.trim().toUpperCase() === "ĐĂNG XUẤT");

  if (logoutBtn) {
    e.preventDefault();
    storage.remove("jwt_token");
    storage.remove("user_info");
    storage.remove("token");
    storage.remove("user");
    localStorage.removeItem("jwt_token");
    localStorage.removeItem("user_info");

    const basePath =
      document.querySelector("[data-header]")?.querySelector(".brand-mark")?.getAttribute("href") || "/index.html";
    window.location.replace(basePath);
  }
});

document.addEventListener("DOMContentLoaded", renderSiteHeaders);
export { renderSiteHeaders };

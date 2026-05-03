import { initCommandPalette } from "../js/modules/command-palette.js";
import apiClient from "../js/core/api-client.js";

const HEADER_CONFIG = {
    brandName: "BrosGem",
    brandAriaLabel: "BrosGem Home"
};

function normalizeBasePath(basePath) {
    if (!basePath || basePath === ".") {
        return ".";
    }
    return basePath.replace(/\/$/, "");
}

function isAuthenticated() {
    return Boolean(apiClient.getAuthToken() && apiClient.getAuthUser());
}

function injectCommandPaletteStyles(basePath) {
    const normalizedBasePath = normalizeBasePath(basePath);
    const isRoot = normalizedBasePath === ".";
    const href = isRoot ? "./css/command-palette.css" : `${normalizedBasePath}/css/command-palette.css`;

    const existingLink = document.querySelector('link[data-command-palette-style="true"]');
    if (existingLink) return;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.commandPaletteStyle = "true";
    document.head.appendChild(link);
}

function createHeaderTemplate({ basePath = ".", activePage = "", action = "login" }) {
    const normalizedBasePath = normalizeBasePath(basePath);
    const isRoot = normalizedBasePath === ".";
    const authenticated = isAuthenticated();

    const homeHref = isRoot ? "./index.html" : `${normalizedBasePath}/index.html`;
    const collectionsHref = isRoot ? "./pages/collections.html" : "./collections.html";
    const liveAuctionsHref = isRoot ? "./pages/live-auctions.html" : "./live-auctions.html";
    const loginHref = isRoot ? "./pages/login.html" : "./login.html";
    const accountHref = isRoot ? "./pages/account.html" : "./account.html";
    const protocolHref = isRoot ? "#protocol" : `${normalizedBasePath}/index.html#protocol`;

    // ==========================================
    // GIẢI QUYẾT CONFLICT: Hợp nhất logic Dev & Frontend
    // ==========================================
    let actionHref = loginHref;
    let actionText = "LOGIN";
    let actionI18n = 'data-i18n="nav.login"';

    if (action === "account") {
        actionHref = accountHref;
        actionText = "MY ACCOUNT";
        actionI18n = 'data-i18n="nav.account"';
    } else if (action === "logout" || authenticated) {
        actionHref = "#"; // Đặt # vì đã có Event Listener JS lo việc xóa localStorage
        actionText = "LOGOUT";
        actionI18n = 'data-i18n="nav.logout"';
    }

    return `
        <header class="site-header home-luxury-header" data-header>
            <a href="${homeHref}" class="brand-mark" aria-label="${HEADER_CONFIG.brandAriaLabel}">
                ${HEADER_CONFIG.brandName}
            </a>

            <nav class="desktop-nav home-luxury-nav" aria-label="Primary navigation">
                <a href="${homeHref}" class="nav-link ${activePage === "home" ? "is-active" : ""}">
                    Home
                </a>
                <a href="${collectionsHref}" class="nav-link ${activePage === "collections" ? "is-active" : ""}">
                    Collections
                </a>
                <a href="${liveAuctionsHref}" class="nav-link ${activePage === "live-auctions" ? "is-active" : ""}">
                    Live Auctions
                </a>
                <a href="${protocolHref}" class="nav-link">
                    Trust Protocol
                </a>
            </nav>

            <div class="header-actions home-header-actions">
                <button
                    class="home-search-trigger"
                    type="button"
                    data-command-palette-open
                    aria-label="Search"
                >
                    <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">
                        <circle cx="10.5" cy="10.5" r="5.5" stroke="currentColor" stroke-width="2" fill="none"></circle>
                        <path d="M15 15L20 20" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
                    </svg>
                </button>

                <a href="${actionHref}" class="button button-primary button-compact home-register-button" data-auth-btn ${actionI18n}>
                    ${actionText}
                </a>

                <div class="home-settings">
                    <button class="icon-button home-settings-trigger" type="button" data-home-settings-toggle>
                        <span></span><span></span><span></span>
                    </button>
                    <div class="home-settings-menu home-settings-menu-minimal" data-home-settings-menu hidden>
                        <button class="home-settings-item" type="button" data-theme-toggle>
                            <span data-theme-icon>☾</span>
                        </button>
                        <button class="home-settings-item" type="button" data-language-toggle>
                            <span>VI</span>
                        </button>
                    </div>
                </div>
            </div>
        </header>
    `;
}

function renderSiteHeaders() {
    const isLoggedIn = !!localStorage.getItem('jwt_token');

    document.querySelectorAll("[data-site-header]").forEach((mountPoint) => {
        const basePath = mountPoint.dataset.basePath || ".";
        const activePage = mountPoint.dataset.activePage || "";
        
        // Nếu trang có chỉ định action (như register ép hiện login), dùng nó. Nếu không, tự động theo trạng thái.
        let action = mountPoint.dataset.headerAction;
        if (!action) {
            action = isLoggedIn ? "logout" : "login";
        }

        injectCommandPaletteStyles(basePath);

        mountPoint.outerHTML = createHeaderTemplate({
            basePath,
            activePage,
            action
        });
    });

    // Gắn sự kiện Logout
    const authBtn = document.querySelector('[data-auth-btn]');
    if (authBtn && authBtn.textContent.trim().toUpperCase() === 'LOGOUT') {
        authBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('jwt_token');
            localStorage.removeItem('user_info');
            window.location.reload();
        });
    }

    // Khởi tạo Command Palette nếu hàm tồn tại
    if (typeof initCommandPalette === 'function') {
        initCommandPalette();
    }
}

document.addEventListener("DOMContentLoaded", renderSiteHeaders);

export { renderSiteHeaders };
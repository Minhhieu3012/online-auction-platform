// frontend/components/site-header.js
import { initCommandPalette } from "../js/modules/command-palette.js";
import { initSiteHeader } from "../js/core/header.js"; 
import storage from "../js/core/storage.js";

const HEADER_CONFIG = {
    brandName: "BrosGem",
    brandAriaLabel: "Trang chủ BrosGem"
};

function normalizeBasePath(basePath) {
    if (!basePath || basePath === ".") {
        return ".";
    }
    return basePath.replace(/\/$/, "");
}

function isAuthenticated() {
    const token = storage.get('jwt_token') || storage.get('token') || localStorage.getItem('jwt_token');
    return Boolean(token && token !== 'undefined' && token !== 'null' && token !== '');
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

    // ĐÃ ĐỔI LOGIC: Trỏ vào trang Tài Khoản thay vì đổi thành nút Đăng xuất
    if (authenticated) {
        actionHref = accountHref; 
        actionText = "TÀI KHOẢN";

        // Bổ sung nút đăng xuất vào menu Hamburger (Menu góc phải)
        logoutMenuHtml = `
            <button class="home-settings-item" type="button" data-logout-btn style="color: #ef4444;">
                <span data-theme-icon style="margin-right: 8px;">⎋</span> Đăng xuất
            </button>
        `;
    }

    return `
        <header class="site-header home-luxury-header" data-header>
            <a href="${homeHref}" class="brand-mark" aria-label="${HEADER_CONFIG.brandAriaLabel}">
                ${HEADER_CONFIG.brandName}
            </a>

            <nav class="desktop-nav home-luxury-nav" aria-label="Primary navigation">
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
                >
                    <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">
                        <circle cx="10.5" cy="10.5" r="5.5" stroke="currentColor" stroke-width="2" fill="none"></circle>
                        <path d="M15 15L20 20" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
                    </svg>
                </button>

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

function renderSiteHeaders() {
    document.querySelectorAll("[data-site-header]").forEach((mountPoint) => {
        const basePath = mountPoint.dataset.basePath || ".";
        const activePage = mountPoint.dataset.activePage || "";
        
        injectCommandPaletteStyles(basePath);

        mountPoint.outerHTML = createHeaderTemplate({
            basePath,
            activePage
        });
    });

    initSiteHeader();

    if (typeof initCommandPalette === 'function') {
        initCommandPalette();
    }
}

// =========================================================================
// SỬA LỖI KIẾN TRÚC: ĐƯA LOGIC ĐĂNG XUẤT RA GLOBAL (EVENT DELEGATION)
// Đảm bảo bắt được MỌI nút đăng xuất trên toàn bộ trang web (Header + Sidebar)
// =========================================================================
document.addEventListener("click", (e) => {
    // Tìm phần tử bị click xem có phải là nút Đăng xuất không (kể cả icon bên trong nút)
    const logoutBtn = e.target.closest('[data-logout-btn]') || 
                      e.target.closest('.dashboard-logout-button') ||
                      (e.target.closest('[data-auth-btn]') && e.target.closest('[data-auth-btn]').textContent.trim().toUpperCase() === 'ĐĂNG XUẤT');

    if (logoutBtn) {
        e.preventDefault();
        
        // Dọn dẹp LocalStorage
        storage.remove('jwt_token');
        storage.remove('user_info');
        storage.remove('token'); 
        storage.remove('user');
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('user_info');
        
        // Điều hướng an toàn về trang chủ
        const basePath = document.querySelector('[data-header]')?.querySelector('.brand-mark')?.getAttribute('href') || '/index.html';
        window.location.replace(basePath);
    }
});

document.addEventListener("DOMContentLoaded", renderSiteHeaders);

export { renderSiteHeaders };
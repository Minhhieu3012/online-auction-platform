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

function createHeaderTemplate({ basePath = ".", activePage = "", action = "register" }) {
    const normalizedBasePath = normalizeBasePath(basePath);
    const isRoot = normalizedBasePath === ".";

    const homeHref = isRoot ? "./index.html" : `${normalizedBasePath}/index.html`;
    const collectionsHref = isRoot ? "./pages/collections.html" : "./collections.html";
    const liveAuctionsHref = isRoot ? "./pages/live-auctions.html" : "./live-auctions.html";
    const registerHref = isRoot ? "./pages/register.html" : "./register.html";
    const accountHref = isRoot ? "./pages/account.html" : "./account.html";
    const protocolHref = isRoot ? "#protocol" : `${normalizedBasePath}/index.html#protocol`;

    const actionHref = action === "account" ? accountHref : registerHref;
    const actionText = action === "account" ? "My Account" : "Register";
    const actionI18n = action === "account" ? "" : 'data-i18n="nav.register"';

    return `
        <header class="site-header home-luxury-header" data-header>
            <a href="${homeHref}" class="brand-mark" aria-label="${HEADER_CONFIG.brandAriaLabel}">
                ${HEADER_CONFIG.brandName}
            </a>

            <nav class="desktop-nav home-luxury-nav" aria-label="Primary navigation">
                <a href="${homeHref}" class="nav-link ${activePage === "home" ? "is-active" : ""}" data-i18n="nav.home">
                    Home
                </a>

                <a href="${collectionsHref}" class="nav-link ${activePage === "collections" ? "is-active" : ""}" data-i18n="nav.collections">
                    Collections
                </a>

                <a href="${liveAuctionsHref}" class="nav-link ${activePage === "live-auctions" ? "is-active" : ""}" data-i18n="nav.liveAuctions">
                    Live Auctions
                </a>

                <a href="${protocolHref}" class="nav-link">
                    Trust Protocol
                </a>
            </nav>

            <div class="header-actions home-header-actions">
                <a href="${actionHref}" class="button button-primary button-compact home-register-button" ${actionI18n}>
                    ${actionText}
                </a>

                <div class="home-settings">
                    <button
                        class="icon-button home-settings-trigger"
                        type="button"
                        data-home-settings-toggle
                        aria-label="Open display settings"
                        aria-expanded="false"
                    >
                        <span></span>
                        <span></span>
                        <span></span>
                    </button>

                    <div class="home-settings-menu home-settings-menu-minimal" data-home-settings-menu hidden>
                        <button
                            class="home-settings-item home-settings-item-minimal"
                            type="button"
                            data-theme-toggle
                            aria-label="Toggle color mode"
                        >
                            <span class="home-settings-item-value" data-theme-icon>☾</span>
                        </button>

                        <button
                            class="home-settings-item home-settings-item-minimal"
                            type="button"
                            data-language-toggle
                            aria-label="Switch language"
                        >
                            <span class="home-settings-item-value" data-language-label>VI</span>
                        </button>
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
        const action = mountPoint.dataset.headerAction || "register";

        mountPoint.outerHTML = createHeaderTemplate({
            basePath,
            activePage,
            action
        });
    });
}

document.addEventListener("DOMContentLoaded", renderSiteHeaders);

export {
    renderSiteHeaders
};
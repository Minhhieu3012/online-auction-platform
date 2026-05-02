const FOOTER_CONFIG = {
    brandName: "BrosGem",
    year: "2026"
};

function normalizeBasePath(basePath) {
    if (!basePath || basePath === ".") {
        return ".";
    }

    return basePath.replace(/\/$/, "");
}

function createFooterTemplate({ basePath = "." }) {
    const normalizedBasePath = normalizeBasePath(basePath);
    const homeHref = normalizedBasePath === "." ? "./index.html" : `${normalizedBasePath}/index.html`;

    return `
        <footer class="site-footer">
            <div>
                <a href="${homeHref}" class="footer-brand" aria-label="${FOOTER_CONFIG.brandName} Home">
                    ${FOOTER_CONFIG.brandName}
                </a>
                <p>© ${FOOTER_CONFIG.year} ${FOOTER_CONFIG.brandName}. All rights reserved.</p>
            </div>

            <nav class="footer-links" aria-label="Footer navigation">
                <a href="#">Terms of Service</a>
                <a href="#">Privacy Policy</a>
                <a href="#">Shipping & Returns</a>
                <a href="#">Contact Us</a>
            </nav>
        </footer>
    `;
}

function renderSiteFooters() {
    document.querySelectorAll("[data-site-footer]").forEach((mountPoint) => {
        const basePath = mountPoint.dataset.basePath || ".";

        mountPoint.outerHTML = createFooterTemplate({
            basePath
        });
    });
}

document.addEventListener("DOMContentLoaded", renderSiteFooters);

export {
    renderSiteFooters
};
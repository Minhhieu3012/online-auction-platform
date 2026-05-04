// frontend/components/site-footer.js
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
                <a href="${homeHref}" class="footer-brand" aria-label="Trang chủ ${FOOTER_CONFIG.brandName}">
                    ${FOOTER_CONFIG.brandName}
                </a>
                <p>© ${FOOTER_CONFIG.year} ${FOOTER_CONFIG.brandName}. Đã đăng ký bản quyền.</p>
            </div>

            <nav class="footer-links" aria-label="Điều hướng chân trang">
                <a href="#">Điều khoản Dịch vụ</a>
                <a href="#">Chính sách Bảo mật</a>
                <a href="#">Giao hàng & Hoàn trả</a>
                <a href="#">Liên hệ</a>
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
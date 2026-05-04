// frontend/js/core/header.js
function initSettingsMenu() {
    const toggleButtons = Array.from(document.querySelectorAll("[data-home-settings-toggle]"));

    toggleButtons.forEach((toggleButton) => {
        // CHỐNG DOUBLE BINDING: Đảm bảo nút không bị gắn 2 sự kiện click cùng lúc
        if (toggleButton.dataset.menuInitialized === "true") return;
        toggleButton.dataset.menuInitialized = "true";

        const settingsRoot = toggleButton.closest(".home-settings");
        const settingsMenu = settingsRoot?.querySelector("[data-home-settings-menu]");

        if (!settingsMenu) {
            return;
        }

        const closeMenu = () => {
            settingsMenu.hidden = true;
            toggleButton.setAttribute("aria-expanded", "false");
        };

        const toggleMenu = (e) => {
            e.stopPropagation(); 
            // Đã sửa lỗi gọi sai tên biến menu -> settingsMenu
            const isHidden = settingsMenu.hidden;
            settingsMenu.hidden = !isHidden;
            toggleButton.setAttribute('aria-expanded', String(!isHidden));
        };

        toggleButton.addEventListener("click", toggleMenu);

        settingsMenu.addEventListener("click", (event) => {
            event.stopPropagation();
        });

        document.addEventListener("click", closeMenu);
        document.addEventListener("scroll", closeMenu, { passive: true });
    });
}

function initDiorStyleHeader(options = {}) {
    const header = document.querySelector("[data-header]");

    // CHỐNG DOUBLE BINDING: Ngăn scroll event bị nhân bản
    if (!header || header.dataset.scrollInitialized === "true") {
        return;
    }
    header.dataset.scrollInitialized = "true";

    const config = {
        hideAfter: options.hideAfter ?? 120,
        topRevealOffset: options.topRevealOffset ?? 12
    };

    let lastScrollY = window.scrollY;
    let ticking = false;

    header.style.transition = [
        "transform 320ms ease",
        "background-color 260ms ease",
        "border-color 260ms ease"
    ].join(", ");

    const showHeader = () => {
        header.style.transform = "translateY(0)";
        header.classList.remove("header-hidden");
    };

    const hideHeader = () => {
        header.style.transform = "translateY(-100%)";
        header.classList.add("header-hidden");
    };

    const updateHeaderState = () => {
        const currentScrollY = window.scrollY;
        const isScrollingDown = currentScrollY > lastScrollY;
        const isPastHidePoint = currentScrollY > config.hideAfter;
        const isNearTop = currentScrollY <= config.topRevealOffset;

        header.classList.toggle("is-scrolled", currentScrollY > config.topRevealOffset);

        if (isNearTop) {
            showHeader();
            lastScrollY = currentScrollY;
            ticking = false;
            return;
        }

        if (isScrollingDown && isPastHidePoint) {
            hideHeader();
        } else {
            showHeader();
        }

        lastScrollY = currentScrollY;
        ticking = false;
    };

    const requestHeaderUpdate = () => {
        if (ticking) {
            return;
        }

        ticking = true;
        window.requestAnimationFrame(updateHeaderState);
    };

    updateHeaderState();
    window.addEventListener("scroll", requestHeaderUpdate, { passive: true });
}

function initSiteHeader(options = {}) {
    initSettingsMenu();
    initDiorStyleHeader(options);
}

export {
    initSettingsMenu,
    initDiorStyleHeader,
    initSiteHeader
};
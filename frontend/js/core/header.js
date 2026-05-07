// frontend/js/core/header.js

let isHeaderBound = false;
let isScrollBound = false;
let scrollRafId = null;
let lastScrollY = 0;

function closeSettingsMenus() {
  document.querySelectorAll("[data-home-settings-menu]").forEach((menu) => {
    menu.hidden = true;
  });

  document.querySelectorAll("[data-home-settings-toggle]").forEach((button) => {
    button.setAttribute("aria-expanded", "false");
  });
}

function closeMobileMenu() {
  const mobilePanel = document.querySelector("[data-mobile-nav-panel]");
  const mobileButton = document.querySelector("[data-mobile-menu-button]");

  if (mobilePanel) {
    mobilePanel.classList.remove("is-open");
    mobilePanel.hidden = true;
  }

  if (mobileButton) {
    mobileButton.setAttribute("aria-expanded", "false");
  }

  document.body.classList.remove("is-menu-open");
}

function closeHeaderPopovers() {
  closeSettingsMenus();
  closeMobileMenu();

  window.dispatchEvent(
    new CustomEvent("brosgem:close-header-popovers"),
  );
}

function toggleSettingsMenu(button) {
  const settingsRoot = button.closest(".home-settings");
  const menu = settingsRoot?.querySelector("[data-home-settings-menu]");

  if (!menu) return;

  const shouldOpen = menu.hidden;

  closeHeaderPopovers();

  menu.hidden = !shouldOpen;
  button.setAttribute("aria-expanded", String(shouldOpen));
}

function toggleMobileMenu(button) {
  const mobilePanel = document.querySelector("[data-mobile-nav-panel]");

  if (!mobilePanel) return;

  const shouldOpen = mobilePanel.hidden || !mobilePanel.classList.contains("is-open");

  closeHeaderPopovers();

  mobilePanel.hidden = !shouldOpen;
  mobilePanel.classList.toggle("is-open", shouldOpen);
  button.setAttribute("aria-expanded", String(shouldOpen));
  document.body.classList.toggle("is-menu-open", shouldOpen);
}

function revealHeader(header) {
  header.classList.remove("is-hidden");
}

function hideHeader(header) {
  header.classList.add("is-hidden");
}

function updateHeaderOnScroll(options = {}) {
  const header = document.querySelector("[data-header]");
  if (!header) return;

  const hideAfter = Number(options.hideAfter || 120);
  const topRevealOffset = Number(options.topRevealOffset || 12);
  const currentScrollY = Math.max(window.scrollY || 0, 0);
  const isScrollingDown = currentScrollY > lastScrollY;
  const isNearTop = currentScrollY <= topRevealOffset;

  header.classList.toggle("is-scrolled", currentScrollY > topRevealOffset);

  if (isNearTop) {
    revealHeader(header);
  } else if (isScrollingDown && currentScrollY > hideAfter) {
    hideHeader(header);
  } else if (!isScrollingDown) {
    revealHeader(header);
  }

  if (Math.abs(currentScrollY - lastScrollY) > 4) {
    closeHeaderPopovers();
  }

  lastScrollY = currentScrollY;
}

function initHeaderScrollBehavior(options = {}) {
  const header = document.querySelector("[data-header]");
  if (!header) return;

  lastScrollY = Math.max(window.scrollY || 0, 0);
  updateHeaderOnScroll(options);

  if (isScrollBound) return;

  isScrollBound = true;

  window.addEventListener(
    "scroll",
    () => {
      if (scrollRafId) {
        window.cancelAnimationFrame(scrollRafId);
      }

      scrollRafId = window.requestAnimationFrame(() => {
        updateHeaderOnScroll(options);
      });
    },
    {
      passive: true,
    },
  );
}

function bindHeaderEvents() {
  if (isHeaderBound) return;

  isHeaderBound = true;

  document.addEventListener("click", (event) => {
    const settingsToggle = event.target.closest("[data-home-settings-toggle]");

    if (settingsToggle) {
      event.preventDefault();
      event.stopPropagation();
      toggleSettingsMenu(settingsToggle);
      return;
    }

    const mobileToggle = event.target.closest("[data-mobile-menu-button]");

    if (mobileToggle) {
      event.preventDefault();
      event.stopPropagation();
      toggleMobileMenu(mobileToggle);
      return;
    }

    const clickedInsideHeaderPopover =
      event.target.closest(".home-settings") ||
      event.target.closest("[data-mobile-nav-panel]") ||
      event.target.closest("[data-notification-shell]");

    if (!clickedInsideHeaderPopover) {
      closeHeaderPopovers();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;

    closeHeaderPopovers();
  });

  window.addEventListener("brosgem:close-header-menu", () => {
    closeHeaderPopovers();
  });

  window.addEventListener("resize", () => {
    closeHeaderPopovers();
  });
}

function initSiteHeader(options = {}) {
  bindHeaderEvents();

  initHeaderScrollBehavior({
    hideAfter: options.hideAfter ?? 120,
    topRevealOffset: options.topRevealOffset ?? 12,
  });
}

export {
  initSiteHeader,
  closeSettingsMenus,
  closeMobileMenu,
  closeHeaderPopovers,
};
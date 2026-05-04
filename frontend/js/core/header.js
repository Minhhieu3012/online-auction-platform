// frontend/js/core/header.js

let isHeaderBound = false;

function closeSettingsMenus() {
  document.querySelectorAll("[data-home-settings-menu]").forEach((menu) => {
    menu.hidden = true;
  });

  document.querySelectorAll("[data-home-settings-toggle]").forEach((button) => {
    button.setAttribute("aria-expanded", "false");
  });
}

function toggleSettingsMenu(button) {
  const settingsRoot = button.closest(".home-settings");
  const menu = settingsRoot?.querySelector("[data-home-settings-menu]");

  if (!menu) return;

  const shouldOpen = menu.hidden;

  closeSettingsMenus();

  menu.hidden = !shouldOpen;
  button.setAttribute("aria-expanded", String(shouldOpen));
}

function closeMobileMenu() {
  const mobilePanel = document.querySelector("[data-mobile-nav-panel]");
  const mobileButton = document.querySelector("[data-mobile-menu-button]");

  if (mobilePanel) {
    mobilePanel.classList.remove("is-open");
  }

  if (mobileButton) {
    mobileButton.setAttribute("aria-expanded", "false");
  }

  document.body.classList.remove("is-menu-open");
}

function toggleMobileMenu(button) {
  const mobilePanel = document.querySelector("[data-mobile-nav-panel]");

  if (!mobilePanel) return;

  const shouldOpen = !mobilePanel.classList.contains("is-open");

  mobilePanel.classList.toggle("is-open", shouldOpen);
  button.setAttribute("aria-expanded", String(shouldOpen));
  document.body.classList.toggle("is-menu-open", shouldOpen);

  if (shouldOpen) {
    closeSettingsMenus();
  }
}

function initHeaderScrollBehavior(options = {}) {
  const header = document.querySelector("[data-header]");
  if (!header) return;

  const hideAfter = Number(options.hideAfter || 120);
  const topRevealOffset = Number(options.topRevealOffset || 12);

  let lastScrollY = window.scrollY;

  window.addEventListener(
    "scroll",
    () => {
      const currentScrollY = window.scrollY;
      const isScrollingDown = currentScrollY > lastScrollY;
      const isNearTop = currentScrollY <= topRevealOffset;

      header.classList.toggle("is-hidden", isScrollingDown && currentScrollY > hideAfter);
      header.classList.toggle("is-scrolled", currentScrollY > topRevealOffset);

      if (isNearTop) {
        header.classList.remove("is-hidden");
      }

      lastScrollY = currentScrollY;
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

    const clickedInsideSettings = event.target.closest(".home-settings");

    if (!clickedInsideSettings) {
      closeSettingsMenus();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;

    closeSettingsMenus();
    closeMobileMenu();
  });

  window.addEventListener("brosgem:close-header-menu", () => {
    closeSettingsMenus();
  });
}

function initSiteHeader(options = {}) {
  bindHeaderEvents();
  initHeaderScrollBehavior(options);
}

export {
  initSiteHeader,
  closeSettingsMenus,
  closeMobileMenu,
};
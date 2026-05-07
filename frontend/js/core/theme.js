// frontend/js/core/theme.js

const THEME_STORAGE_KEY = "brosgem_theme";
const VALID_THEMES = new Set(["dark", "light"]);
const DEFAULT_THEME = "dark";

let isThemeListenerBound = false;

function normalizeTheme(theme) {
  const value = String(theme || "").trim().toLowerCase();
  return VALID_THEMES.has(value) ? value : DEFAULT_THEME;
}

function getStoredTheme() {
  const value = localStorage.getItem(THEME_STORAGE_KEY);
  return VALID_THEMES.has(value) ? value : null;
}

function getCurrentTheme() {
  return normalizeTheme(
    document.documentElement.getAttribute("data-theme") ||
      document.documentElement.dataset.theme ||
      getStoredTheme() ||
      DEFAULT_THEME,
  );
}

function updateThemeControls(theme) {
  const isDark = theme === "dark";
  const nextThemeLabel = isDark ? "sáng" : "tối";

  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    button.setAttribute("aria-pressed", String(theme === "light"));
    button.setAttribute("aria-label", `Chuyển sang giao diện ${nextThemeLabel}`);
    button.setAttribute("title", `Chuyển sang giao diện ${nextThemeLabel}`);
  });

  document.querySelectorAll("[data-theme-icon]").forEach((icon) => {
    icon.textContent = isDark ? "☾" : "☀";
  });
}

function setTheme(theme, options = {}) {
  const nextTheme = normalizeTheme(theme);
  const shouldPersist = options.persist !== false;

  document.documentElement.setAttribute("data-theme", nextTheme);
  document.documentElement.dataset.theme = nextTheme;
  document.documentElement.style.colorScheme = nextTheme;

  if (document.body) {
    document.body.setAttribute("data-theme", nextTheme);
    document.body.dataset.theme = nextTheme;
  }

  document.documentElement.classList.toggle("theme-dark", nextTheme === "dark");
  document.documentElement.classList.toggle("theme-light", nextTheme === "light");

  if (shouldPersist) {
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  }

  updateThemeControls(nextTheme);

  window.dispatchEvent(
    new CustomEvent("brosgem:themechange", {
      detail: {
        theme: nextTheme,
      },
    }),
  );

  return nextTheme;
}

function toggleTheme() {
  const currentTheme = getCurrentTheme();
  const nextTheme = currentTheme === "dark" ? "light" : "dark";

  return setTheme(nextTheme, {
    persist: true,
  });
}

function bindThemeToggle() {
  if (isThemeListenerBound) return;

  isThemeListenerBound = true;

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-theme-toggle]");

    if (!button) return;

    event.preventDefault();
    event.stopPropagation();

    toggleTheme();

    window.dispatchEvent(
      new CustomEvent("brosgem:close-header-menu"),
    );
  });
}

function initTheme(options = {}) {
  const savedTheme = getStoredTheme();
  const htmlTheme = document.documentElement.getAttribute("data-theme");
  const initialTheme = normalizeTheme(savedTheme || htmlTheme || options.defaultTheme || DEFAULT_THEME);

  setTheme(initialTheme, {
    persist: Boolean(savedTheme),
  });

  bindThemeToggle();

  return initialTheme;
}

function refreshThemeControls() {
  updateThemeControls(getCurrentTheme());
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
  });
} else {
  initTheme();
}

export {
  initTheme,
  setTheme,
  getCurrentTheme,
  toggleTheme,
  refreshThemeControls,
};
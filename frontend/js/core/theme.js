import CONFIG from "./config.js";
import storage from "./storage.js";

const VALID_THEMES = ["dark", "light"];

function getSystemTheme() {
    const prefersLight = window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: light)").matches;

    return prefersLight ? "light" : "dark";
}

function normalizeTheme(theme) {
    if (VALID_THEMES.includes(theme)) {
        return theme;
    }

    return CONFIG.DEFAULT_THEME || getSystemTheme();
}

function updateThemeIcon(theme) {
    const icon = document.querySelector("[data-theme-icon]");

    if (!icon) {
        return;
    }

    icon.textContent = theme === "dark" ? "☾" : "☼";
}

function applyTheme(theme) {
    const normalizedTheme = normalizeTheme(theme);

    document.documentElement.setAttribute("data-theme", normalizedTheme);
    storage.set(CONFIG.THEME_STORAGE_KEY, normalizedTheme);
    updateThemeIcon(normalizedTheme);

    return normalizedTheme;
}

function getStoredTheme() {
    return storage.get(CONFIG.THEME_STORAGE_KEY, CONFIG.DEFAULT_THEME);
}

function getCurrentTheme() {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    return normalizeTheme(currentTheme);
}

function toggleTheme() {
    const currentTheme = getCurrentTheme();
    const nextTheme = currentTheme === "dark" ? "light" : "dark";

    return applyTheme(nextTheme);
}

function bindThemeToggle() {
    const toggleButton = document.querySelector("[data-theme-toggle]");

    if (!toggleButton) {
        return;
    }

    toggleButton.addEventListener("click", () => {
        toggleTheme();
    });
}

function initTheme() {
    const storedTheme = getStoredTheme();
    applyTheme(storedTheme);
    bindThemeToggle();
}

export {
    initTheme,
    applyTheme,
    toggleTheme,
    getCurrentTheme
};
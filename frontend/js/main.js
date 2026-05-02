import { initTheme } from "./core/theme.js";
import { initI18n } from "./core/i18n.js";
import { initSiteHeader } from "./core/header.js";

function formatCountdownParts(distanceMs) {
    const totalSeconds = Math.max(0, Math.floor(distanceMs / 1000));

    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) {
        return `${days}d ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function initCountdowns() {
    const countdownElements = Array.from(document.querySelectorAll("[data-countdown]"));

    if (countdownElements.length === 0) {
        return;
    }

    const updateCountdowns = () => {
        const now = Date.now();

        countdownElements.forEach((element) => {
            const targetDate = new Date(element.dataset.countdown).getTime();

            if (Number.isNaN(targetDate)) {
                return;
            }

            const distance = targetDate - now;
            element.textContent = formatCountdownParts(distance);
        });
    };

    updateCountdowns();
    window.setInterval(updateCountdowns, 1000);
}

function initHomePage() {
    initTheme();
    initI18n();

    initSiteHeader({
        hideAfter: 120,
        topRevealOffset: 12
    });

    initCountdowns();
}

document.addEventListener("DOMContentLoaded", initHomePage);
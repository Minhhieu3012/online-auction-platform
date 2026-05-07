// frontend/js/modules/page-shell.js
import { initTheme } from "../core/theme.js";
import { initSiteHeader } from "../core/header.js";

function initPageShell() {
    initTheme();

    initSiteHeader({
        hideAfter: 120,
        topRevealOffset: 12
    });
}

document.addEventListener("DOMContentLoaded", initPageShell);
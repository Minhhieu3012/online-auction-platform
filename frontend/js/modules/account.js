import { initTheme } from "../core/theme.js";
import { initI18n } from "../core/i18n.js";
import { initSiteHeader } from "../core/header.js";

const TAB_COPY = {
    overview: {
        title: "Overview",
        subtitle: "Monitor your bidding activity, watchlist, selling requests, and payment status in one place."
    },
    bids: {
        title: "My Bids",
        subtitle: "Track active positions, outbid lots, and upcoming auction actions."
    },
    watching: {
        title: "Watching",
        subtitle: "Review saved lots and assets you may want to bid on later."
    },
    won: {
        title: "Won Auctions",
        subtitle: "Completed wins and post-auction settlement records will appear here."
    },
    selling: {
        title: "Selling",
        subtitle: "Prepare asset submissions and monitor selling request verification."
    },
    payments: {
        title: "Payments",
        subtitle: "Follow invoices, settlement status, buyer premium, and transaction records."
    },
    settings: {
        title: "Settings",
        subtitle: "Manage profile details and communication preferences."
    }
};

function showToast(title, message) {
    const toastStack = document.querySelector("[data-toast-stack]");

    if (!toastStack) {
        return;
    }

    const toast = document.createElement("article");

    toast.className = "toast";
    toast.innerHTML = `
        <p class="toast-title">${title}</p>
        <p class="toast-message">${message}</p>
    `;

    toastStack.appendChild(toast);

    window.setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(-6px)";
    }, 3200);

    window.setTimeout(() => {
        toast.remove();
    }, 3800);
}

function setActiveTab(tabName) {
    const nextCopy = TAB_COPY[tabName] || TAB_COPY.overview;

    document.querySelectorAll("[data-dashboard-tab]").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.dashboardTab === tabName);
    });

    document.querySelectorAll("[data-dashboard-panel]").forEach((panel) => {
        panel.classList.toggle("is-active", panel.dataset.dashboardPanel === tabName);
    });

    const titleElement = document.querySelector("[data-dashboard-title]");
    const subtitleElement = document.querySelector("[data-dashboard-subtitle]");

    if (titleElement) {
        titleElement.textContent = nextCopy.title;
    }

    if (subtitleElement) {
        subtitleElement.textContent = nextCopy.subtitle;
    }

    window.history.replaceState(null, "", `#${tabName}`);
}

function initDashboardTabs() {
    document.querySelectorAll("[data-dashboard-tab]").forEach((button) => {
        button.addEventListener("click", () => {
            setActiveTab(button.dataset.dashboardTab);
        });
    });

    const initialTab = window.location.hash.replace("#", "") || "overview";

    if (TAB_COPY[initialTab]) {
        setActiveTab(initialTab);
    }
}

function initDashboardToastButtons() {
    document.querySelectorAll("[data-dashboard-toast]").forEach((button) => {
        button.addEventListener("click", () => {
            showToast("Dashboard Mock", button.dataset.dashboardToast);
        });
    });
}

function initAccountPage() {
    initTheme();
    initI18n();

    initSiteHeader({
        hideAfter: 120,
        topRevealOffset: 12
    });

    initDashboardTabs();
    initDashboardToastButtons();
}

document.addEventListener("DOMContentLoaded", initAccountPage);
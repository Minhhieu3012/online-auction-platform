import { initTheme } from "../core/theme.js";
import { initI18n } from "../core/i18n.js";
import { initSiteHeader } from "../core/header.js";
import apiClient from "../core/api-client.js";

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

function redirectToLogin() {
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    window.location.replace(`./login.html?redirect=${encodeURIComponent(currentPath)}`);
}

function requireAuthSession() {
    const token = apiClient.getAuthToken();
    const user = apiClient.getAuthUser();

    if (!token || !user) {
        apiClient.clearAuth();
        redirectToLogin();
        return null;
    }

    return user;
}

function getDisplayName(user) {
    return user?.fullName
        || user?.full_name
        || user?.name
        || user?.username
        || user?.email
        || "BrosGem Member";
}

function getMemberSubtitle(user) {
    if (user?.email) {
        return `${user.email} • Verified Member`;
    }

    return "Verified Member";
}

function getInitials(value) {
    const cleanValue = String(value || "BG").trim();

    if (!cleanValue) {
        return "BG";
    }

    const emailName = cleanValue.includes("@") ? cleanValue.split("@")[0] : cleanValue;
    const words = emailName
        .replace(/[._-]+/g, " ")
        .split(/\s+/)
        .filter(Boolean);

    if (words.length === 1) {
        return words[0].slice(0, 2).toUpperCase();
    }

    return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function formatCurrency(value) {
    const numberValue = Number(value || 0);

    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0
    }).format(numberValue);
}

function setText(selector, value) {
    const element = document.querySelector(selector);

    if (element) {
        element.textContent = value;
    }
}

function setInput(selector, value) {
    const input = document.querySelector(selector);

    if (input) {
        input.value = value;
    }
}

function hydrateAccountUser(user) {
    const displayName = getDisplayName(user);
    const subtitle = getMemberSubtitle(user);

    setText("[data-member-avatar]", getInitials(displayName));
    setText("[data-member-name]", displayName);
    setText("[data-member-subtitle]", subtitle);
    setText("[data-member-balance]", formatCurrency(user?.balance));

    setInput("[data-settings-name]", displayName);
    setInput("[data-settings-email]", user?.email || "");
    setInput("[data-settings-user-id]", user?.id ? String(user.id) : "");
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
            showToast("Dashboard", button.dataset.dashboardToast);
        });
    });
}

function initLogout() {
    const logoutButton = document.querySelector("[data-logout-button]");

    if (!logoutButton) {
        return;
    }

    logoutButton.addEventListener("click", () => {
        apiClient.clearAuth();
        showToast("Signed Out", "Your session has been cleared.");

        window.setTimeout(() => {
            window.location.href = "./login.html";
        }, 650);
    });
}

function initAccountPage() {
    initTheme();
    initI18n();

    const user = requireAuthSession();

    if (!user) {
        return;
    }

    initSiteHeader({
        hideAfter: 120,
        topRevealOffset: 12
    });

    hydrateAccountUser(user);
    initDashboardTabs();
    initDashboardToastButtons();
    initLogout();
}

document.addEventListener("DOMContentLoaded", initAccountPage);
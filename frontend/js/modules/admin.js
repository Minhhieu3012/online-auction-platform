import { initTheme } from "../core/theme.js";
import { initI18n } from "../core/i18n.js";
import { initSiteHeader } from "../core/header.js";

const TAB_COPY = {
    overview: {
        title: "Overview",
        subtitle: "Monitor verification requests, fraud signals, settlements, and user access from one control layer."
    },
    verification: {
        title: "Verification Queue",
        subtitle: "Review seller-submitted assets before they become auction listings."
    },
    fraud: {
        title: "Fraud Alerts",
        subtitle: "Inspect risk signals from bidding behavior, IP affinity, account age, and unusual increments."
    },
    settlements: {
        title: "Settlements",
        subtitle: "Track post-auction payment status, buyer records, and transaction actions."
    },
    users: {
        title: "Users",
        subtitle: "Review member access, verification state, account capability, and risk profile."
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

    document.querySelectorAll("[data-admin-tab]").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.adminTab === tabName);
    });

    document.querySelectorAll("[data-admin-panel]").forEach((panel) => {
        panel.classList.toggle("is-active", panel.dataset.adminPanel === tabName);
    });

    const titleElement = document.querySelector("[data-admin-title]");
    const subtitleElement = document.querySelector("[data-admin-subtitle]");

    if (titleElement) {
        titleElement.textContent = nextCopy.title;
    }

    if (subtitleElement) {
        subtitleElement.textContent = nextCopy.subtitle;
    }

    window.history.replaceState(null, "", `#${tabName}`);
}

function updatePendingCount() {
    const pendingCards = Array.from(document.querySelectorAll("[data-review-card]"))
        .filter((card) => !card.classList.contains("is-approved") && !card.classList.contains("is-declined"));

    const pendingCountElements = document.querySelectorAll("[data-pending-count], [data-verification-count]");

    pendingCountElements.forEach((element) => {
        if (element.hasAttribute("data-verification-count")) {
            element.textContent = `${pendingCards.length} pending`;
        } else {
            element.textContent = String(pendingCards.length).padStart(2, "0");
        }
    });
}

function handleReviewAction(button) {
    const action = button.dataset.reviewAction;
    const card = button.closest("[data-review-card]");
    const status = card?.querySelector("[data-review-status]");

    if (!card || !status) {
        return;
    }

    card.classList.remove("is-approved", "is-declined");

    if (action === "approve") {
        card.classList.add("is-approved");
        status.textContent = "Approved";

        showToast("Request Approved", "Asset request approved as UI mock. It can move to auction configuration next.");
    }

    if (action === "decline") {
        card.classList.add("is-declined");
        status.textContent = "Declined";

        showToast("Request Declined", "Asset request declined as UI mock. Seller feedback can connect later.");
    }

    updatePendingCount();
}

function initAdminTabs() {
    document.querySelectorAll("[data-admin-tab]").forEach((button) => {
        button.addEventListener("click", () => {
            setActiveTab(button.dataset.adminTab);
        });
    });

    document.querySelectorAll("[data-admin-jump]").forEach((button) => {
        button.addEventListener("click", () => {
            setActiveTab(button.dataset.adminJump);
        });
    });

    const initialTab = window.location.hash.replace("#", "") || "overview";

    if (TAB_COPY[initialTab]) {
        setActiveTab(initialTab);
    }
}

function initReviewActions() {
    document.querySelectorAll("[data-review-action]").forEach((button) => {
        button.addEventListener("click", () => {
            handleReviewAction(button);
        });
    });

    updatePendingCount();
}

function initToastButtons() {
    document.querySelectorAll("[data-admin-toast]").forEach((button) => {
        button.addEventListener("click", () => {
            showToast("Admin Mock", button.dataset.adminToast);
        });
    });
}

function initAdminPage() {
    initTheme();
    initI18n();

    initSiteHeader({
        hideAfter: 120,
        topRevealOffset: 12
    });

    initAdminTabs();
    initReviewActions();
    initToastButtons();
}

document.addEventListener("DOMContentLoaded", initAdminPage);
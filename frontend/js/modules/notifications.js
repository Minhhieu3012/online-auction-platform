import { initTheme } from "../core/theme.js";
import { initI18n } from "../core/i18n.js";
import { initSiteHeader } from "../core/header.js";

const FEED_TITLES = {
    all: "All Notifications",
    bidding: "Bidding Alerts",
    selling: "Selling Updates",
    payments: "Payment Events",
    security: "Security Signals"
};

const CATEGORY_ICONS = {
    bidding: "◷",
    selling: "▣",
    payments: "▤",
    security: "△"
};

const PRIORITY_CLASS = {
    high: "priority-high",
    medium: "priority-medium",
    low: "priority-low"
};

let notifications = [
    {
        id: "ntf-001",
        category: "bidding",
        title: "You have been outbid",
        message: "Your previous bid on The Midnight Chronograph is no longer leading. Raise your bid before the auction closes.",
        time: "2 minutes ago",
        priority: "high",
        reference: "Lot #842",
        actionLabel: "Raise Bid",
        actionHref: "./product-detail.html?id=842",
        read: false
    },
    {
        id: "ntf-002",
        category: "payments",
        title: "Payment settlement pending",
        message: "Invoice #BG-8822 is ready for checkout. Complete payment to move the asset into transfer processing.",
        time: "18 minutes ago",
        priority: "high",
        reference: "Invoice #BG-8822",
        actionLabel: "Go to Checkout",
        actionHref: "./checkout.html",
        read: false
    },
    {
        id: "ntf-003",
        category: "selling",
        title: "Selling request approved",
        message: "Your Diamond Tennis Bracelet submission was approved for auction configuration review.",
        time: "1 hour ago",
        priority: "medium",
        reference: "Request #BG-RQ-1024",
        actionLabel: "View Selling",
        actionHref: "./account.html#selling",
        read: false
    },
    {
        id: "ntf-004",
        category: "selling",
        title: "Specialist requested more media",
        message: "Please upload additional movement and certificate photos for Private Estate Timepiece.",
        time: "3 hours ago",
        priority: "medium",
        reference: "Request #BG-RQ-1026",
        actionLabel: "Open Consign",
        actionHref: "./consign.html",
        read: true
    },
    {
        id: "ntf-005",
        category: "bidding",
        title: "Auction ending soon",
        message: "Patek Philippe Ref. 2499 is entering the final window. Soft-close rules may extend the auction.",
        time: "5 hours ago",
        priority: "medium",
        reference: "Lot #402",
        actionLabel: "View Lot",
        actionHref: "./product-detail.html?id=402",
        read: true
    },
    {
        id: "ntf-006",
        category: "security",
        title: "New sign-in detected",
        message: "A new sign-in to your BrosGem account was detected from a recently used browser.",
        time: "Yesterday",
        priority: "low",
        reference: "Account Security",
        actionLabel: "Open Settings",
        actionHref: "./account.html#settings",
        read: true
    },
    {
        id: "ntf-007",
        category: "security",
        title: "Admin fraud alert escalated",
        message: "Critical risk pattern detected for User #8291 with high-frequency bidding and IP affinity.",
        time: "Yesterday",
        priority: "high",
        reference: "Alert #FR-8291",
        actionLabel: "Open Admin",
        actionHref: "./admin.html#fraud",
        read: false
    },
    {
        id: "ntf-008",
        category: "payments",
        title: "Settlement receipt available",
        message: "Receipt for Art Deco Vase settlement is available in your payment records.",
        time: "2 days ago",
        priority: "low",
        reference: "Transaction #BG-8821",
        actionLabel: "View Payments",
        actionHref: "./account.html#payments",
        read: true
    }
];

const state = {
    filter: "all",
    unreadOnly: false,
    selectedId: "ntf-001"
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

function getFilteredNotifications() {
    return notifications.filter((item) => {
        const matchesFilter = state.filter === "all" || item.category === state.filter;
        const matchesUnread = !state.unreadOnly || !item.read;

        return matchesFilter && matchesUnread;
    });
}

function updateCounts() {
    const unreadCount = notifications.filter((item) => !item.read).length;

    const counts = {
        all: notifications.length,
        bidding: notifications.filter((item) => item.category === "bidding").length,
        selling: notifications.filter((item) => item.category === "selling").length,
        payments: notifications.filter((item) => item.category === "payments").length,
        security: notifications.filter((item) => item.category === "security").length
    };

    const countAll = document.querySelector("[data-count-all]");
    const countBidding = document.querySelector("[data-count-bidding]");
    const countSelling = document.querySelector("[data-count-selling]");
    const countPayments = document.querySelector("[data-count-payments]");
    const countSecurity = document.querySelector("[data-count-security]");
    const unreadCountElement = document.querySelector("[data-unread-count]");

    if (countAll) {
        countAll.textContent = counts.all;
    }

    if (countBidding) {
        countBidding.textContent = counts.bidding;
    }

    if (countSelling) {
        countSelling.textContent = counts.selling;
    }

    if (countPayments) {
        countPayments.textContent = counts.payments;
    }

    if (countSecurity) {
        countSecurity.textContent = counts.security;
    }

    if (unreadCountElement) {
        unreadCountElement.textContent = unreadCount;
    }
}

function createNotificationItem(item) {
    const priorityClass = PRIORITY_CLASS[item.priority] || "priority-low";
    const icon = CATEGORY_ICONS[item.category] || "◇";

    return `
        <article
            class="notification-item ${item.read ? "" : "is-unread"} ${state.selectedId === item.id ? "is-selected" : ""}"
            data-notification-id="${item.id}"
        >
            <span class="notification-icon">${icon}</span>

            <div class="notification-content">
                <p>${item.category}</p>
                <h3>${item.title}</h3>
                <span>${item.message}</span>
            </div>

            <div class="notification-meta">
                <time>${item.time}</time>
                <span class="notification-priority ${priorityClass}">${item.priority}</span>
                <button class="notification-read-button" type="button" data-toggle-read="${item.id}">
                    ${item.read ? "Mark Unread" : "Mark Read"}
                </button>
            </div>
        </article>
    `;
}

function renderList() {
    const list = document.querySelector("[data-notifications-list]");
    const empty = document.querySelector("[data-notifications-empty]");
    const visibleCount = document.querySelector("[data-visible-count]");
    const feedTitle = document.querySelector("[data-feed-title]");

    if (!list) {
        return;
    }

    const filteredItems = getFilteredNotifications();

    list.innerHTML = filteredItems.map(createNotificationItem).join("");

    if (empty) {
        empty.hidden = filteredItems.length > 0;
    }

    if (visibleCount) {
        visibleCount.textContent = `${filteredItems.length} visible`;
    }

    if (feedTitle) {
        feedTitle.textContent = FEED_TITLES[state.filter] || FEED_TITLES.all;
    }

    document.querySelectorAll("[data-notification-id]").forEach((itemElement) => {
        itemElement.addEventListener("click", (event) => {
            if (event.target.closest("[data-toggle-read]")) {
                return;
            }

            state.selectedId = itemElement.dataset.notificationId;
            renderDetail();
            renderList();
        });
    });

    document.querySelectorAll("[data-toggle-read]").forEach((button) => {
        button.addEventListener("click", () => {
            toggleRead(button.dataset.toggleRead);
        });
    });

    updateCounts();
}

function renderTabs() {
    document.querySelectorAll("[data-notification-filter]").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.notificationFilter === state.filter);
    });
}

function renderDetail() {
    const selectedItem = notifications.find((item) => item.id === state.selectedId) || getFilteredNotifications()[0];

    if (!selectedItem) {
        return;
    }

    state.selectedId = selectedItem.id;

    const statusElement = document.querySelector("[data-detail-status]");
    const iconElement = document.querySelector("[data-detail-icon]");
    const categoryElement = document.querySelector("[data-detail-category]");
    const titleElement = document.querySelector("[data-detail-title]");
    const timeElement = document.querySelector("[data-detail-time]");
    const messageElement = document.querySelector("[data-detail-message]");
    const referenceElement = document.querySelector("[data-detail-reference]");
    const priorityElement = document.querySelector("[data-detail-priority]");
    const actionElement = document.querySelector("[data-detail-action]");

    if (statusElement) {
        statusElement.textContent = selectedItem.read ? "Read" : "Unread";
    }

    if (iconElement) {
        iconElement.textContent = CATEGORY_ICONS[selectedItem.category] || "◇";
    }

    if (categoryElement) {
        categoryElement.textContent = selectedItem.category;
    }

    if (titleElement) {
        titleElement.textContent = selectedItem.title;
    }

    if (timeElement) {
        timeElement.textContent = selectedItem.time;
    }

    if (messageElement) {
        messageElement.textContent = selectedItem.message;
    }

    if (referenceElement) {
        referenceElement.textContent = selectedItem.reference;
    }

    if (priorityElement) {
        priorityElement.textContent = selectedItem.priority;
    }

    if (actionElement) {
        actionElement.textContent = selectedItem.actionLabel;
        actionElement.href = selectedItem.actionHref;
    }
}

function renderNotifications() {
    renderTabs();
    renderList();
    renderDetail();
}

function toggleRead(id) {
    notifications = notifications.map((item) => {
        if (item.id !== id) {
            return item;
        }

        return {
            ...item,
            read: !item.read
        };
    });

    renderNotifications();
}

function markAllRead() {
    notifications = notifications.map((item) => ({
        ...item,
        read: true
    }));

    showToast("Inbox Updated", "All notifications marked as read.");
    renderNotifications();
}

function clearRead() {
    const readCount = notifications.filter((item) => item.read).length;

    notifications = notifications.filter((item) => !item.read);

    if (!notifications.find((item) => item.id === state.selectedId)) {
        state.selectedId = notifications[0]?.id || "";
    }

    showToast("Read Cleared", `${readCount} read notification(s) removed from this mock inbox.`);
    renderNotifications();
}

function bindEvents() {
    document.querySelectorAll("[data-notification-filter]").forEach((button) => {
        button.addEventListener("click", () => {
            state.filter = button.dataset.notificationFilter || "all";
            const firstItem = getFilteredNotifications()[0];

            if (firstItem) {
                state.selectedId = firstItem.id;
            }

            renderNotifications();
        });
    });

    const unreadOnlyInput = document.querySelector("[data-unread-only]");

    if (unreadOnlyInput) {
        unreadOnlyInput.addEventListener("change", () => {
            state.unreadOnly = unreadOnlyInput.checked;
            const firstItem = getFilteredNotifications()[0];

            if (firstItem) {
                state.selectedId = firstItem.id;
            }

            renderNotifications();
        });
    }

    const markAllReadButton = document.querySelector("[data-mark-all-read]");

    if (markAllReadButton) {
        markAllReadButton.addEventListener("click", markAllRead);
    }

    const clearReadButton = document.querySelector("[data-clear-read]");

    if (clearReadButton) {
        clearReadButton.addEventListener("click", clearRead);
    }
}

function initNotificationsPage() {
    initTheme();
    initI18n();

    initSiteHeader({
        hideAfter: 120,
        topRevealOffset: 12
    });

    bindEvents();
    renderNotifications();
}

document.addEventListener("DOMContentLoaded", initNotificationsPage);
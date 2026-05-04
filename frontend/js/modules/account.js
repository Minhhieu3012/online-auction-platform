import { initTheme } from "../core/theme.js";
import { initSiteHeader } from "../core/header.js";
import apiClient from "../core/api-client.js";

const TAB_COPY = {
    overview: {
        title: "Tổng Quan",
        subtitle: "Theo dõi hoạt động trả giá, danh mục quan tâm, yêu cầu bán và trạng thái thanh toán của bạn ở một nơi duy nhất."
    },
    bids: {
        title: "Lượt Giá Của Tôi",
        subtitle: "Theo dõi các phiên bạn đang tham gia, vị thế dẫn đầu, lượt bị vượt giá và hành động tiếp theo."
    },
    watching: {
        title: "Đang Theo Dõi",
        subtitle: "Xem lại các lô bạn quan tâm và muốn quay lại đấu giá sau."
    },
    won: {
        title: "Đấu Giá Đã Thắng",
        subtitle: "Các phiên bạn thắng và trạng thái thanh toán sau đấu giá sẽ xuất hiện tại đây."
    },
    selling: {
        title: "Bán Hàng",
        subtitle: "Theo dõi các tài sản bạn đã gửi lên, trạng thái chờ duyệt và các phiên đang mở."
    },
    payments: {
        title: "Thanh Toán",
        subtitle: "Theo dõi hóa đơn, trạng thái đối soát và các khoản thanh toán cần hoàn tất."
    },
    settings: {
        title: "Cài Đặt",
        subtitle: "Xem thông tin hồ sơ, email, ID người dùng và tùy chọn thông báo."
    }
};

function showToast(title, message, type = "info") {
    const toastStack = document.querySelector("[data-toast-stack]");

    if (!toastStack) {
        return;
    }

    const toast = document.createElement("article");
    toast.className = `toast toast-${type}`;
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
    return (
        user?.fullName ||
        user?.full_name ||
        user?.name ||
        user?.username ||
        user?.email ||
        "BrosGem Member"
    );
}

function getMemberSubtitle(user) {
    if (user?.email) {
        return `${user.email} • Thành viên đã xác thực`;
    }

    return "Thành viên đã xác thực";
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

function setActiveTab(tabName, shouldUpdateHash = true) {
    const safeTabName = TAB_COPY[tabName] ? tabName : "overview";
    const nextCopy = TAB_COPY[safeTabName];

    document.querySelectorAll("[data-dashboard-tab]").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.dashboardTab === safeTabName);
    });

    document.querySelectorAll("[data-dashboard-panel]").forEach((panel) => {
        panel.classList.toggle("is-active", panel.dataset.dashboardPanel === safeTabName);
    });

    setText("[data-dashboard-title]", nextCopy.title);
    setText("[data-dashboard-subtitle]", nextCopy.subtitle);

    if (shouldUpdateHash) {
        window.history.replaceState(null, "", `#${safeTabName}`);
    }
}

function initDashboardTabs() {
    const tabButtons = document.querySelectorAll("[data-dashboard-tab]");

    tabButtons.forEach((button) => {
        button.addEventListener("click", () => {
            setActiveTab(button.dataset.dashboardTab);
        });
    });

    const initialTab = window.location.hash.replace("#", "") || "overview";
    setActiveTab(initialTab, false);

    window.addEventListener("hashchange", () => {
        const nextTab = window.location.hash.replace("#", "") || "overview";
        setActiveTab(nextTab, false);
    });
}

function initDashboardToastButtons() {
    document.querySelectorAll("[data-dashboard-toast]").forEach((button) => {
        button.addEventListener("click", () => {
            showToast("Bảng điều khiển", button.dataset.dashboardToast || "Tính năng đang được cập nhật.");
        });
    });
}

function initLogout() {
    const logoutButtons = document.querySelectorAll(
        "[data-logout-button], .dashboard-logout-button, [data-auth-btn]"
    );

    logoutButtons.forEach((button) => {
        const text = button.textContent.trim().toUpperCase();
        const isLogoutButton =
            button.matches("[data-logout-button]") ||
            button.matches(".dashboard-logout-button") ||
            text === "ĐĂNG XUẤT";

        if (!isLogoutButton) {
            return;
        }

        button.addEventListener("click", (event) => {
            event.preventDefault();

            apiClient.clearAuth();
            showToast("Đã đăng xuất", "Phiên đăng nhập của bạn đã được xoá.", "success");

            window.setTimeout(() => {
                window.location.href = "./login.html";
            }, 650);
        });
    });
}

async function loadMySellingAuctions(user) {
    if (!user?.id || typeof apiClient.get !== "function") {
        return;
    }

    try {
        const response = await apiClient.get("/auctions/mine", null, {
            auth: true,
            idempotency: false,
            redirectOnUnauthorized: false
        });

        const auctions = response?.data?.auctions || [];

        const sellingCountCard = Array.from(document.querySelectorAll(".dashboard-stat-card")).find((card) => {
            return card.textContent.includes("Yêu Cầu Bán Hàng");
        });

        if (sellingCountCard) {
            const strong = sellingCountCard.querySelector("strong");
            const copy = sellingCountCard.querySelector("p");

            if (strong) {
                strong.textContent = String(auctions.length).padStart(2, "0");
            }

            if (copy) {
                const pendingCount = auctions.filter((auction) => {
                    return String(auction.status || "").toLowerCase() === "scheduled";
                }).length;

                copy.textContent = `${pendingCount} phiên đang chờ admin duyệt`;
            }
        }
    } catch (error) {
        console.warn("[Account] Chưa tải được danh sách phiên của user:", error);
    }
}

function initAccountPage() {
    initTheme();

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
    loadMySellingAuctions(user);
}

document.addEventListener("DOMContentLoaded", initAccountPage);
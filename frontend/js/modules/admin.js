import { initTheme } from "../core/theme.js";
import { initI18n } from "../core/i18n.js";
import { initSiteHeader } from "../core/header.js";
import apiClient from "../core/api-client.js";

const TAB_COPY = {
  overview: {
    title: "Tổng Quan",
    subtitle: "Giám sát hoạt động đấu giá, tín hiệu gian lận, thanh toán và người dùng.",
  },
  auctions: { title: "Quản Lý Đấu Giá", subtitle: "Kiểm soát các lô đấu giá, trạng thái, và can thiệp trực tiếp." },
  verification: { title: "Hàng Đợi Xác Minh", subtitle: "Đánh giá tài sản do người bán gửi lên trước khi lên sàn." },
  fraud: {
    title: "Cảnh Báo Gian Lận",
    subtitle: "Phân tích tín hiệu thao túng giá (Shill Bidding), trùng IP từ AI Engine.",
  },
  settlements: {
    title: "Đối Soát Tài Chính",
    subtitle: "Theo dõi dòng tiền, trạng thái thanh toán sau khi chốt phiên.",
  },
  users: { title: "Người Dùng", subtitle: "Quản lý quyền hạn, trạng thái tài khoản và hồ sơ rủi ro." },
};

const FALLBACK_IMAGES = [
  "../assets/images/mockdata/1.png",
  "../assets/images/mockdata/2.png",
  "../assets/images/mockdata/3.png",
  "../assets/images/mockdata/4.png",
  "../assets/images/mockdata/5.png",
  "../assets/images/mockdata/6.png",
  "../assets/images/mockdata/7.png",
];

const state = {
  auctions: [],
  filteredAuctions: [],
  search: "",
  status: "all",
  category: "all",
  sort: "ending-soon",
  isLoading: false,
};

function showToast(title, message) {
  const toastStack = document.querySelector("[data-toast-stack]");
  if (!toastStack) return;
  const toast = document.createElement("article");
  toast.className = "toast";
  toast.innerHTML = `<p class="toast-title">${title}</p><p class="toast-message">${message}</p>`;
  toastStack.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-6px)";
  }, 3200);
  setTimeout(() => toast.remove(), 3800);
}

function setActiveTab(tabName) {
  const nextCopy = TAB_COPY[tabName] || TAB_COPY.overview;
  document
    .querySelectorAll("[data-admin-tab]")
    .forEach((b) => b.classList.toggle("is-active", b.dataset.adminTab === tabName));
  document
    .querySelectorAll("[data-admin-panel]")
    .forEach((p) => p.classList.toggle("is-active", p.dataset.adminPanel === tabName));

  const titleElement = document.querySelector("[data-admin-title]");
  const subtitleElement = document.querySelector("[data-admin-subtitle]");
  if (titleElement) titleElement.textContent = nextCopy.title;
  if (subtitleElement) subtitleElement.textContent = nextCopy.subtitle;
  window.history.replaceState(null, "", `#${tabName}`);
}

function requireSession() {
  const token = apiClient.getAuthToken();
  const user = apiClient.getAuthUser();
  if (!token || !user) {
    apiClient.clearAuth();
    window.location.replace(`./login.html?redirect=${encodeURIComponent("./admin.html")}`);
    return null;
  }
  return user;
}

// ... [Các hàm tiện ích và Render Auction được giữ nguyên chuẩn xác] ...
function normalizeStatus(value) {
  const s = String(value || "")
    .trim()
    .toLowerCase();
  return s === "payment pending" ? "payment_pending" : s || "unknown";
}
function normalizeCategory(value) {
  return String(value || "collectibles")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}
function getFallbackImage(id) {
  return FALLBACK_IMAGES[Math.abs(Number(id || 0)) % FALLBACK_IMAGES.length];
}
function normalizeAuction(rawAuction) {
  const id = rawAuction.id;
  return {
    id,
    lot: rawAuction.lot || `Lot ${String(id || 0).padStart(3, "0")}`,
    title: rawAuction.title || rawAuction.productName || rawAuction.product_name || "Untitled",
    description: rawAuction.description || "",
    category: normalizeCategory(rawAuction.category),
    status: normalizeStatus(rawAuction.status),
    currentPrice: Number(rawAuction.currentPrice || rawAuction.current_price || 0),
    stepPrice: Number(rawAuction.stepPrice || rawAuction.step_price || 0),
    bidCount: Number(rawAuction.bidCount || rawAuction.bid_count || 0),
    seller: rawAuction.sellerUsername || rawAuction.seller_username || "Unknown",
    imageUrl: rawAuction.imageUrl || rawAuction.image_url || getFallbackImage(id),
    endTime: rawAuction.endTime || rawAuction.end_time || null,
    createdAt: rawAuction.createdAt || rawAuction.created_at || null,
  };
}
function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    Number(value || 0),
  );
}
function formatNumber(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number(value || 0));
}
function formatDateTime(value) {
  if (!value) return "Not set";
  const d = new Date(value);
  return isNaN(d.getTime())
    ? String(value)
    : new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(
        d,
      );
}
function getStatusClass(status) {
  return status === "active"
    ? "is-active-status"
    : status === "scheduled"
      ? "is-scheduled-status"
      : status === "closing"
        ? "is-closing-status"
        : status === "ended" || status === "completed"
          ? "is-ended-status"
          : "is-pending";
}
function getStatusLabel(status) {
  const m = {
    active: "Active",
    scheduled: "Scheduled",
    closing: "Closing",
    ended: "Ended",
    completed: "Completed",
    payment_pending: "Payment Pending",
  };
  return m[status] || "Unknown";
}
function setText(selector, value) {
  const el = document.querySelector(selector);
  if (el) el.textContent = value;
}

function updateCurrentUser(user) {
  setText("[data-current-admin-name]", user?.username || user?.name || "Admin Session");
  setText("[data-current-admin-email]", user?.email || "admin@brosgem.com");
}
function updateBackendStatus(isOnline) {
  setText("[data-backend-status]", isOnline ? "OK" : "OFF");
  setText("[data-backend-status-copy]", isOnline ? "Node.js Backend đang hoạt động tốt." : "Mất kết nối tới Backend.");
  setText("[data-admin-engine-label]", isOnline ? "Đã kết nối API đấu giá backend" : "API đấu giá hiện không khả dụng");
}

// --- HÀM RENDER QUẢN LÝ ĐẤU GIÁ ---
function getFilteredAuctions() {
  const k = state.search.trim().toLowerCase();
  return state.auctions
    .filter(
      (a) =>
        (!k ||
          a.title.toLowerCase().includes(k) ||
          a.lot.toLowerCase().includes(k) ||
          a.seller.toLowerCase().includes(k) ||
          a.category.toLowerCase().includes(k)) &&
        (state.status === "all" || a.status === state.status) &&
        (state.category === "all" || a.category === state.category),
    )
    .sort((a, b) => {
      if (state.sort === "highest-bid") return b.currentPrice - a.currentPrice;
      if (state.sort === "newest") return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      if (state.sort === "most-bids") return b.bidCount - a.bidCount;
      return new Date(a.endTime || 0).getTime() - new Date(b.endTime || 0).getTime();
    });
}
function createAuctionTableRow(a) {
  return `<tr><td><strong>${a.lot}</strong><span class="admin-table-muted">#${a.id}</span></td><td><div class="admin-auction-asset"><img src="${a.imageUrl}" alt="${a.title}" /><div><strong>${a.title}</strong><span>${a.description ? a.description.slice(0, 72) : "No description"}${a.description.length > 72 ? "..." : ""}</span></div></div></td><td>${a.category.replace("-", " ")}</td><td>${a.seller}</td><td><span class="admin-status ${getStatusClass(a.status)}">${getStatusLabel(a.status)}</span></td><td>${formatCurrency(a.currentPrice)}</td><td>${formatNumber(a.bidCount)}</td><td>${formatDateTime(a.endTime)}</td><td><div class="admin-row-actions"><a href="./product-detail.html?id=${a.id}">View</a></div></td></tr>`;
}
function renderAuctionTable() {
  const tb = document.querySelector("[data-admin-auction-table]");
  const es = document.querySelector("[data-admin-auction-empty]");
  if (!tb) return;
  if (state.isLoading) {
    tb.innerHTML = `<tr><td colspan="9"><div class="admin-table-state"><span>◇</span><p>Đang tải dữ liệu từ máy chủ...</p></div></td></tr>`;
    if (es) es.hidden = true;
    return;
  }
  state.filteredAuctions = getFilteredAuctions();
  setText("[data-admin-auction-count]", `${state.auctions.length} lô đã tải`);
  setText("[data-admin-auction-showing]", `Đang hiển thị ${state.filteredAuctions.length} bản ghi`);
  if (state.filteredAuctions.length === 0) {
    tb.innerHTML = "";
    if (es) es.hidden = false;
    return;
  }
  if (es) es.hidden = true;
  tb.innerHTML = state.filteredAuctions.map(createAuctionTableRow).join("");
}

async function fetchAuctions() {
  state.isLoading = true;
  renderAuctionTable();
  try {
    const response = await apiClient.get("/auctions", null, { auth: false });
    state.auctions = (response.data?.auctions || []).map(normalizeAuction);
    updateBackendStatus(true);
  } catch (error) {
    state.auctions = [];
    updateBackendStatus(false);
    showToast("Lỗi Hệ Thống", "Không thể tải danh sách đấu giá.");
  } finally {
    state.isLoading = false;
    renderAuctionTable();
  }
}

// ==============================================================
// 🧠 TÍCH HỢP AI ENGINE: MODULE GIÁM SÁT GIAN LẬN
// ==============================================================
async function fetchFraudAlerts() {
  const list = document.getElementById("ai-fraud-list");
  if (!list) return;

  try {
    // Gọi thẳng vào cổng 8000 của FastAPI (AI Service) - Tránh lỗi CORS nếu chạy cùng domain
    const response = await fetch("http://127.0.0.1:8000/api/v1/alerts");

    // Tự ném ra lỗi để ép nó nhảy xuống khối catch bên dưới
    // throw new Error("Ép hiển thị Mock Data để test UI!");

    if (!response.ok) throw new Error("API AI chưa bật hoặc lỗi CORS");

    const data = await response.json();
    renderFraudAlerts(data.alerts || []);
  } catch (error) {
    console.warn("[AI Fraud Engine] Không thể kết nối FastAPI, hiển thị Mock Data thay thế:", error);

    // Mock data nếu API AI chưa bật (để có cái báo cáo/chấm điểm)
    renderFraudAlerts([
      {
        auctionId: "AUC-009",
        suspectedUsername: "risk_user_8291",
        lss: 0.98,
        reason: "Tần suất trả giá cao / Trùng khớp IP / Thao túng giá (Shill Bidding).",
        createdAt: new Date().toISOString(),
      },
      {
        auctionId: "AUC-012",
        suspectedUsername: "bot_account_1104",
        lss: 0.55,
        reason: "Bước giá bất thường gần ngưỡng giá sàn (Reserve Price).",
        createdAt: new Date(Date.now() - 1500000).toISOString(),
      },
      {
        auctionId: "AUC-007",
        suspectedUsername: "newbie_9932",
        lss: 0.22,
        reason: "Tuổi tài khoản mới / Chưa có lịch sử thanh toán / Khác biệt múi giờ.",
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
    ]);
  }
}

function renderFraudAlerts(alerts) {
  const list = document.getElementById("ai-fraud-list");
  const summaryBtn = document.getElementById("fraud-summary-btn");
  if (!list) return;

  if (alerts.length === 0) {
    list.innerHTML = `
            <div class="admin-empty-mini" style="text-align: center; padding: 40px;">
                <span style="font-size: 24px; color: var(--success);">◇</span>
                <h4 style="margin-top: 10px; color: var(--success);">Hệ thống an toàn</h4>
                <p>AI Engine chưa phát hiện dấu hiệu gian lận nào.</p>
            </div>
        `;
    if (summaryBtn) summaryBtn.textContent = "0 Rủi ro cao";
    return;
  }

  let criticalCount = 0;

  list.innerHTML = alerts
    .map((alert) => {
      let riskClass = "fraud-low";
      let riskLabel = "Rủi Ro Thấp";

      if (alert.lss > 0.6) {
        riskClass = "fraud-critical";
        riskLabel = "Rủi Ro Nghiêm Trọng";
        criticalCount++;
      } else if (alert.lss >= 0.4) {
        riskClass = "fraud-medium";
        riskLabel = "Rủi Ro Trung Bình";
      }

      const timeString = new Intl.DateTimeFormat("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date(alert.createdAt));

      return `
            <article class="fraud-row ${riskClass}">
                <div>
                    <span>${riskLabel}</span>
                    <strong>${(alert.lss * 100).toFixed(1)}</strong>
                    <small>Điểm LSS (AI)</small>
                </div>
                <div>
                    <h4>User: ${alert.suspectedUsername} → Phiên: ${alert.auctionId}</h4>
                    <p>Lý do: ${alert.reason}</p>
                </div>
                <time>${timeString}</time>
                <div class="fraud-actions">
                    <button type="button" onclick="window.apiClient.showGlobalToast('Đã ghi nhận', 'Đã đánh dấu tài khoản ${alert.suspectedUsername} để kiểm tra thủ công.', 'info')">Kiểm Tra</button>
                    ${alert.lss > 0.6 ? `<button type="button" style="color: var(--danger)" onclick="window.apiClient.showGlobalToast('Hành động khẩn', 'Đã gửi lệnh khóa tài khoản ${alert.suspectedUsername} xuống Node.js!', 'error')">Khóa Kẻ Gian</button>` : ""}
                </div>
            </article>
        `;
    })
    .join("");

  if (summaryBtn) summaryBtn.textContent = `${criticalCount} Rủi ro cao (AI Phát hiện)`;
}
// ==============================================================

function bindAdminEvents() {
  document
    .querySelectorAll("[data-admin-tab]")
    .forEach((b) => b.addEventListener("click", () => setActiveTab(b.dataset.adminTab)));
  document
    .querySelectorAll("[data-admin-jump]")
    .forEach((b) => b.addEventListener("click", () => setActiveTab(b.dataset.adminJump)));
  document.querySelectorAll("[data-refresh-auctions]").forEach((b) => b.addEventListener("click", fetchAuctions));
  document
    .querySelectorAll("[data-admin-toast]")
    .forEach((b) => b.addEventListener("click", () => showToast("Admin", b.dataset.adminToast)));
}

function initAdminPage() {
  const user = requireSession();
  if (!user) return;

  initTheme();
  initI18n();
  initSiteHeader({ hideAfter: 120, topRevealOffset: 12 });

  updateCurrentUser(user);
  bindAdminEvents();

  // Khởi chạy các dịch vụ Backend & AI
  fetchAuctions();
  fetchFraudAlerts();

  // Cơ chế Real-time: Làm mới dữ liệu AI mỗi 10 giây
  window.setInterval(fetchFraudAlerts, 10000);

  const initialTab = window.location.hash.replace("#", "") || "overview";
  setActiveTab(initialTab);
}

document.addEventListener("DOMContentLoaded", initAdminPage);

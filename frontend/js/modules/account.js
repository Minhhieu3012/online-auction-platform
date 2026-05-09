import { initTheme } from "../core/theme.js";
import { initSiteHeader } from "../core/header.js";
import apiClient from "../core/api-client.js";

const FALLBACK_IMAGE = "../assets/images/mockdata/1.png";

const TAB_COPY = {
  overview: {
    title: "Tổng Quan",
    subtitle:
      "Theo dõi hoạt động trả giá, danh mục quan tâm, yêu cầu bán và trạng thái thanh toán của bạn ở một nơi duy nhất.",
  },
  bids: {
    title: "Lượt Giá Của Tôi",
    subtitle: "Theo dõi các phiên bạn đang tham gia, vị thế dẫn đầu, lượt bị vượt giá và hành động tiếp theo.",
  },
  watching: {
    title: "Đang Theo Dõi",
    subtitle: "Xem lại các lô bạn quan tâm và muốn quay lại đấu giá sau.",
  },
  won: {
    title: "Đấu Giá Đã Thắng",
    subtitle: "Các phiên bạn thắng và trạng thái thanh toán sau đấu giá sẽ xuất hiện tại đây.",
  },
  publish: {
    title: "Đăng Bán",
    subtitle: "Tạo lô đấu giá mới, tải hình ảnh, nhập giá và gửi vào hàng chờ admin duyệt.",
  },
  selling: {
    title: "Bán Hàng",
    subtitle: "Theo dõi các tài sản bạn đã gửi lên, trạng thái chờ duyệt và các phiên đang mở.",
  },
  payments: {
    title: "Thanh Toán",
    subtitle: "Theo dõi hóa đơn, trạng thái đối soát và các khoản thanh toán cần hoàn tất.",
  },
  settings: {
    title: "Cài Đặt",
    subtitle: "Xem thông tin hồ sơ, email, ID người dùng và tùy chọn thông báo.",
  },
};

const state = {
  user: null,
  myAuctions: [],
  publishFiles: [],
  publishPreviewUrls: [],
  publishPreviewBase64: [],
  publishCurrentImageIndex: 0,
};

const MAX_PUBLISH_IMAGES = 3;
const ALLOWED_PUBLISH_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const DEFAULT_PUBLISH_PREVIEW_IMAGE = "../assets/images/logo.png";

function injectAccountRuntimeStyles() {
  if (document.querySelector('style[data-account-runtime-style="true"]')) return;

  const style = document.createElement("style");
  style.dataset.accountRuntimeStyle = "true";
  style.textContent = `
    .dashboard-card,
    .account-runtime-card {
      border: 1px solid var(--border);
      background:
        linear-gradient(135deg, rgba(197, 160, 89, 0.045), transparent 34%),
        var(--surface);
      padding: clamp(24px, 3vw, 34px);
      box-shadow: var(--shadow-card, none);
    }

    .dashboard-card-heading,
    .account-card-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      margin-bottom: 24px;
    }

    .dashboard-card-heading h3,
    .account-card-heading h3 {
      margin: 0;
      color: var(--text);
      font-size: 16px;
      font-weight: 900;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }

    .dashboard-card-heading a,
    .account-card-heading a {
      color: var(--primary);
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .account-empty-state {
      display: grid;
      place-items: center;
      gap: 14px;
      min-height: 220px;
      border: 1px dashed var(--border);
      color: var(--text-muted);
      text-align: center;
      padding: 28px;
    }

    .account-empty-state span {
      color: var(--primary);
      font-size: 22px;
    }

    .account-empty-state p {
      max-width: 620px;
      margin: 0;
      color: var(--text-soft);
      line-height: 1.7;
    }

    .dashboard-stat-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 18px;
    }

    .dashboard-stat-card {
      border: 1px solid var(--border);
      background: var(--surface);
      padding: 26px;
    }

    .dashboard-stat-card span {
      display: block;
      margin-bottom: 22px;
      color: var(--text-muted);
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }

    .dashboard-stat-card strong {
      display: block;
      color: var(--text);
      font-size: clamp(36px, 5vw, 52px);
      font-weight: 400;
      line-height: 1;
    }

    .dashboard-stat-card p {
      margin: 14px 0 0;
      color: var(--text-muted);
      line-height: 1.5;
    }

    .account-selling-grid {
      display: grid;
      gap: 18px;
    }

    .account-selling-card {
      display: grid;
      grid-template-columns: 180px 1fr;
      gap: 22px;
      padding: 18px;
      border: 1px solid var(--border);
      background: var(--bg);
    }

    .account-selling-card img {
      width: 180px;
      height: 140px;
      object-fit: cover;
      background: var(--surface-muted);
      border: 1px solid var(--border);
    }

    .account-selling-card h4 {
      margin: 0 0 10px;
      color: var(--text);
      font-size: 22px;
      line-height: 1.25;
    }

    .account-selling-card p {
      color: var(--text-soft);
      line-height: 1.65;
    }

    .account-selling-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 14px 22px;
      margin-top: 12px;
      color: var(--text-muted);
      font-size: 13px;
    }

    .account-selling-meta strong {
      color: var(--text);
    }

    .account-status-pill {
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      padding: 4px 10px;
      border: 1px solid var(--border);
      color: var(--primary);
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .account-status-pill.is-pending {
      border-color: rgba(197, 160, 89, 0.62);
      background: var(--primary-soft);
      color: var(--primary);
    }

    .account-status-pill.is-active {
      border-color: rgba(64, 201, 139, 0.5);
      color: var(--success);
    }

    .account-status-pill.is-rejected,
    .account-status-pill.is-cancelled {
      border-color: rgba(255, 120, 120, 0.55);
      color: #ff8f8f;
    }

    .account-settings-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
    }

    .account-setting-field {
      display: grid;
      gap: 8px;
    }

    .account-setting-field span {
      color: var(--text-muted);
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.13em;
      text-transform: uppercase;
    }

    .account-setting-field input {
      width: 100%;
      min-height: 48px;
      padding: 0 14px;
      border: 1px solid var(--border);
      background: var(--bg);
      color: var(--text);
    }



    .account-selling-shell {
      display: grid;
      gap: 22px;
    }

    .account-publish-form-card {
      border: 1px solid var(--border);
      background:
        linear-gradient(145deg, rgba(197, 160, 89, 0.06), transparent 42%),
        var(--surface);
      padding: clamp(20px, 3vw, 30px);
    }

    .account-publish-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(280px, 340px);
      gap: 22px;
      align-items: start;
    }

    .account-publish-form {
      display: grid;
      gap: 18px;
    }

    .account-publish-section {
      border: 1px solid var(--border);
      background: color-mix(in srgb, var(--surface) 84%, transparent);
      padding: 18px;
    }

    .account-publish-section-heading {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      margin-bottom: 16px;
    }

    .account-publish-section-heading span {
      width: 22px;
      height: 22px;
      display: grid;
      place-items: center;
      border: 1px solid var(--primary);
      color: var(--primary);
      font-size: 10px;
      font-weight: 900;
    }

    .account-publish-section-heading h4 {
      margin: 0;
      color: var(--text);
      font-size: 13px;
      font-weight: 900;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    .account-publish-section-heading p {
      margin: 5px 0 0;
      color: var(--text-muted);
      font-size: 12px;
      line-height: 1.55;
    }

    .account-publish-grid-2,
    .account-publish-grid-3,
    .account-publish-grid-4 {
      display: grid;
      gap: 12px;
    }

    .account-publish-grid-2 {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .account-publish-grid-3 {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .account-publish-grid-4 {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .account-publish-field {
      display: grid;
      gap: 8px;
    }

    .account-publish-field span {
      color: var(--text);
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    .account-publish-field input,
    .account-publish-field select,
    .account-publish-field textarea {
      width: 100%;
      border: 1px solid var(--border);
      background: color-mix(in srgb, var(--surface) 68%, #000);
      color: var(--text);
      padding: 12px 13px;
      outline: none;
      font: inherit;
      font-size: 13px;
    }

    .account-publish-field textarea {
      min-height: 108px;
      resize: vertical;
    }

    .account-publish-field input:focus,
    .account-publish-field select:focus,
    .account-publish-field textarea:focus {
      border-color: var(--primary);
    }

    .account-publish-field small {
      min-height: 14px;
      color: var(--danger, #ff8f8f);
      font-size: 11px;
    }

    .account-publish-image-uploader {
      padding: 14px !important;
      border: 1px dashed var(--border-strong, var(--border)) !important;
      background: color-mix(in srgb, var(--surface) 55%, transparent) !important;
      color: var(--text-soft) !important;
      cursor: pointer;
    }

    .account-publish-image-preview-list {
      display: flex;
      gap: 10px;
      margin-top: 10px;
      flex-wrap: wrap;
    }

    .account-publish-thumb-preview {
      width: 64px;
      height: 64px;
      padding: 0;
      border-radius: 4px;
      overflow: hidden;
      cursor: pointer;
      border: 1px solid var(--border);
      background: transparent;
    }

    .account-publish-thumb-preview.is-active {
      border: 2px solid var(--primary);
    }

    .account-publish-thumb-preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .account-publish-rule-grid {
      display: grid;
      gap: 12px;
      margin-top: 14px;
    }

    .account-publish-toggle {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 12px;
      align-items: start;
      border: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.025);
      padding: 13px;
      color: var(--text-soft);
      cursor: pointer;
    }

    .account-publish-toggle input {
      margin-top: 3px;
      accent-color: var(--primary);
    }

    .account-publish-toggle strong {
      display: block;
      color: var(--text);
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .account-publish-toggle p {
      margin: 5px 0 0;
      color: var(--text-muted);
      font-size: 12px;
      line-height: 1.45;
    }

    .account-publish-actions {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px;
    }

    .account-publish-preview-card {
      position: sticky;
      top: 96px;
      border: 1px solid var(--border);
      background: var(--surface);
      overflow: hidden;
    }

    .account-publish-preview-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 14px;
      border-bottom: 1px solid var(--border);
    }

    .account-publish-preview-heading h4 {
      margin: 0;
      color: var(--primary);
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    .account-publish-preview-heading span {
      border: 1px solid var(--primary);
      color: var(--primary);
      padding: 4px 8px;
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .account-publish-preview-media {
      position: relative;
      min-height: 260px;
      background: color-mix(in srgb, var(--surface) 80%, #000);
    }

    .account-publish-preview-media img {
      width: 100%;
      height: 260px;
      object-fit: cover;
      display: block;
      filter: var(--image-filter);
    }

    .account-publish-preview-chip {
      position: absolute;
      top: 12px;
      right: 12px;
      border: 1px solid var(--primary);
      background: rgba(0, 0, 0, 0.68);
      color: var(--primary);
      padding: 6px 9px;
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .account-publish-preview-nav {
      position: absolute;
      top: 50%;
      width: 34px;
      height: 34px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      background: rgba(0, 0, 0, 0.58);
      color: var(--text);
      cursor: pointer;
      display: none;
      transform: translateY(-50%);
    }

    .account-publish-preview-nav:hover {
      border-color: var(--primary);
      color: var(--primary);
    }

    .account-publish-preview-nav[data-account-publish-prev] {
      left: 10px;
    }

    .account-publish-preview-nav[data-account-publish-next] {
      right: 10px;
    }

    .account-publish-preview-counter {
      position: absolute;
      right: 10px;
      bottom: 10px;
      display: none;
      padding: 5px 9px;
      border: 1px solid rgba(255, 255, 255, 0.16);
      background: rgba(0, 0, 0, 0.68);
      color: var(--primary);
      font-size: 10px;
      font-weight: 900;
    }

    .account-publish-preview-body {
      padding: 18px;
    }

    .account-publish-preview-body p {
      color: var(--text-muted);
      font-size: 12px;
      line-height: 1.6;
    }

    .account-publish-preview-body h4 {
      margin: 8px 0 10px;
      color: var(--text);
      font-size: 22px;
      line-height: 1.15;
      text-transform: uppercase;
    }

    .account-publish-preview-meta {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      color: var(--text-muted);
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .account-publish-preview-price-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin-top: 14px;
    }

    .account-publish-preview-price-grid div,
    .account-publish-preview-countdown {
      border: 1px solid var(--border);
      padding: 11px;
      background: rgba(255, 255, 255, 0.025);
    }

    .account-publish-preview-price-grid span,
    .account-publish-preview-countdown span {
      display: block;
      color: var(--text-muted);
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .account-publish-preview-price-grid strong,
    .account-publish-preview-countdown strong {
      display: block;
      margin-top: 6px;
      color: var(--primary);
      font-size: 13px;
    }

    .account-publish-preview-countdown {
      margin-top: 10px;
    }

    @media (max-width: 860px) {
      .dashboard-stat-grid,
      .account-settings-grid {
        grid-template-columns: 1fr;
      }

      .account-selling-card {
        grid-template-columns: 1fr;
      }

      .account-selling-card img {
        width: 100%;
        height: 240px;
      }
    }
  `;

  document.head.appendChild(style);
}

function showToast(title, message, type = "info") {
  const toastStack = document.querySelector("[data-toast-stack]");
  if (!toastStack) return;

  const toast = document.createElement("article");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <p class="toast-title">${escapeHtml(title)}</p>
    <p class="toast-message">${escapeHtml(message)}</p>
  `;

  toastStack.appendChild(toast);

  window.setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-6px)";
  }, 3200);

  window.setTimeout(() => toast.remove(), 3800);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
  return user?.fullName || user?.full_name || user?.name || user?.username || user?.email || "BrosGem Member";
}

function getMemberSubtitle(user) {
  if (user?.email) return `${user.email} • Thành viên đã xác thực`;
  return "Thành viên đã xác thực";
}

function getInitials(value) {
  const cleanValue = String(value || "BG").trim();
  const emailName = cleanValue.includes("@") ? cleanValue.split("@")[0] : cleanValue;
  const words = emailName
    .replace(/[._-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();

  return `${words[0]?.[0] || "B"}${words[1]?.[0] || "G"}`.toUpperCase();
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDateTime(value) {
  if (!value) return "Chưa đặt";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Không rõ";

  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function setInput(selector, value) {
  const input = document.querySelector(selector);
  if (input) input.value = value;
}

function normalizeStatus(status) {
  return String(status || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function getStatusLabel(status) {
  const map = {
    pending: "Đang chờ admin duyệt",
    rejected: "Không được thông qua",
    scheduled: "Đã lên lịch",
    active: "Đang mở đấu giá",
    closing: "Sắp đóng",
    ended: "Đã kết thúc",
    payment_pending: "Chờ thanh toán",
    completed: "Hoàn tất",
    cancelled: "Đã hủy",
  };

  return map[normalizeStatus(status)] || "Đang cập nhật";
}

function getStatusClass(status) {
  const key = normalizeStatus(status);

  if (key === "pending") return "is-pending";
  if (key === "active") return "is-active";
  if (key === "rejected") return "is-rejected";
  if (key === "cancelled") return "is-cancelled";

  return "";
}

function hydrateAccountUser(user) {
  const displayName = getDisplayName(user);

  setText("[data-member-avatar]", getInitials(displayName));
  setText("[data-member-name]", displayName);
  setText("[data-member-subtitle]", getMemberSubtitle(user));
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
  document.querySelectorAll("[data-dashboard-tab]").forEach((button) => {
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

function getPanel(tabName) {
  return document.querySelector(`[data-dashboard-panel="${tabName}"]`);
}

function renderEmptyPanel(tabName, title, message) {
  const panel = getPanel(tabName);
  if (!panel) return;

  panel.innerHTML = `
    <article class="account-runtime-card">
      <div class="account-card-heading">
        <h3>${escapeHtml(title)}</h3>
      </div>

      <div class="account-empty-state">
        <span>◇</span>
        <p>${escapeHtml(message)}</p>
      </div>
    </article>
  `;
}

function resetPublishState() {
  state.publishPreviewUrls.forEach((url) => {
    if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
  });

  state.publishFiles = [];
  state.publishPreviewUrls = [];
  state.publishPreviewBase64 = [];
  state.publishCurrentImageIndex = 0;
}

function getAccountPublishValue(selector) {
  return document.querySelector(selector)?.value.trim() || "";
}

function setAccountPublishText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function setAccountPublishFieldError(input, message) {
  const field = input?.closest(".account-publish-field");
  const errorElement = field?.querySelector("[data-account-publish-error]");

  if (!field || !errorElement) return;

  field.classList.toggle("has-error", Boolean(message));
  errorElement.textContent = message || "";
}

function setAccountPublishBusy(form, isBusy) {
  form.querySelectorAll("button, input, select, textarea").forEach((control) => {
    control.disabled = isBusy;
  });

  const submitButton = form.querySelector('[type="submit"]');
  if (!submitButton) return;

  if (isBusy) {
    submitButton.dataset.originalText = submitButton.textContent.trim();
    submitButton.textContent = "Đang gửi duyệt...";
    return;
  }

  submitButton.textContent = submitButton.dataset.originalText || "Gửi duyệt phiên";
}

function fileToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (event) => resolve(String(event.target?.result || ""));
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

function getAccountPublishDurationParts() {
  const hours = Number(getAccountPublishValue("[data-account-dur-hours]") || 0);
  const minutes = Number(getAccountPublishValue("[data-account-dur-minutes]") || 0);
  const seconds = Number(getAccountPublishValue("[data-account-dur-seconds]") || 0);
  const totalSeconds = hours * 3600 + minutes * 60 + seconds;

  return {
    hours,
    minutes,
    seconds,
    totalSeconds,
    totalMinutes: totalSeconds > 0 ? Math.max(1, Math.ceil(totalSeconds / 60)) : 0,
  };
}

function formatAccountPublishDurationLabel() {
  const duration = getAccountPublishDurationParts();
  const parts = [];

  if (duration.hours > 0) parts.push(`${duration.hours} giờ`);
  if (duration.minutes > 0) parts.push(`${duration.minutes} phút`);
  if (duration.seconds > 0) parts.push(`${duration.seconds} giây`);

  return parts.length > 0 ? parts.join(" ") : "Chưa thiết lập";
}

function getAccountPublishStartDateTime() {
  const date = getAccountPublishValue("[data-account-start-date]");
  const time = getAccountPublishValue("[data-account-start-time]");

  if (!date || !time) return null;

  const result = new Date(`${date}T${time}:00`);
  return Number.isNaN(result.getTime()) ? null : result;
}

function renderAccountPublishThumbnails() {
  const container = document.querySelector("[data-account-publish-thumbs]");
  if (!container) return;

  container.innerHTML = "";

  state.publishPreviewUrls.forEach((url, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `account-publish-thumb-preview${index === state.publishCurrentImageIndex ? " is-active" : ""}`;
    button.innerHTML = `<img src="${url}" alt="Ảnh lô hàng ${index + 1}" />`;
    button.addEventListener("click", () => {
      state.publishCurrentImageIndex = index;
      updateAccountPublishPreviewImage();
      renderAccountPublishThumbnails();
    });
    container.appendChild(button);
  });
}

function updateAccountPublishPreviewImage() {
  const image = document.querySelector("[data-account-publish-preview-image]");
  const prevButton = document.querySelector("[data-account-publish-prev]");
  const nextButton = document.querySelector("[data-account-publish-next]");
  const counter = document.querySelector("[data-account-publish-counter]");

  if (!image) return;

  if (state.publishPreviewUrls.length > 0) {
    if (state.publishCurrentImageIndex >= state.publishPreviewUrls.length) {
      state.publishCurrentImageIndex = state.publishPreviewUrls.length - 1;
    }

    if (state.publishCurrentImageIndex < 0) {
      state.publishCurrentImageIndex = 0;
    }

    image.src = state.publishPreviewUrls[state.publishCurrentImageIndex];
  } else {
    image.src = DEFAULT_PUBLISH_PREVIEW_IMAGE;
  }

  const shouldShowNav = state.publishPreviewUrls.length > 1;

  if (prevButton) prevButton.style.display = shouldShowNav ? "block" : "none";
  if (nextButton) nextButton.style.display = shouldShowNav ? "block" : "none";

  if (counter) {
    counter.style.display = shouldShowNav ? "block" : "none";
    counter.textContent = `${state.publishCurrentImageIndex + 1} / ${state.publishPreviewUrls.length}`;
  }
}

async function handleAccountPublishImageUpload(event) {
  const input = event.currentTarget;
  const files = Array.from(input.files || []);
  const validFiles = files.filter((file) => ALLOWED_PUBLISH_IMAGE_TYPES.includes(file.type));

  setAccountPublishFieldError(input, "");

  if (validFiles.length !== files.length) {
    setAccountPublishFieldError(input, "Có file bị loại vì không phải ảnh JPG/PNG/WebP.");
  }

  const combinedFiles = [...state.publishFiles, ...validFiles];

  if (combinedFiles.length > MAX_PUBLISH_IMAGES) {
    setAccountPublishFieldError(input, `Chỉ giữ tối đa ${MAX_PUBLISH_IMAGES} ảnh đầu tiên.`);
  }

  resetPublishState();

  state.publishFiles = combinedFiles.slice(0, MAX_PUBLISH_IMAGES);
  state.publishPreviewUrls = state.publishFiles.map((file) => URL.createObjectURL(file));
  state.publishPreviewBase64 = await Promise.all(state.publishFiles.map(fileToBase64));
  state.publishCurrentImageIndex = 0;

  input.value = "";

  renderAccountPublishThumbnails();
  updateAccountPublishPreview();
}

function updateAccountPublishPreview() {
  setAccountPublishText("[data-account-preview-lot]", "CHỜ HỆ THỐNG CẤP MÃ");
  setAccountPublishText(
    "[data-account-preview-title]",
    getAccountPublishValue("[data-account-lot-title]") || "Chưa có tiêu đề",
  );
  setAccountPublishText(
    "[data-account-preview-category]",
    getAccountPublishValue("[data-account-lot-category]") || "Chưa phân loại",
  );
  setAccountPublishText("[data-account-preview-specialist]", "BrosGem Verification");
  setAccountPublishText(
    "[data-account-preview-description]",
    getAccountPublishValue("[data-account-lot-description]") || "Mô tả công khai sẽ hiện ở đây.",
  );
  setAccountPublishText(
    "[data-account-preview-estimate]",
    `${formatCurrency(getAccountPublishValue("[data-account-estimate-low]"))} - ${formatCurrency(getAccountPublishValue("[data-account-estimate-high]"))}`,
  );
  setAccountPublishText(
    "[data-account-preview-starting]",
    formatCurrency(getAccountPublishValue("[data-account-starting-bid]")),
  );
  setAccountPublishText(
    "[data-account-preview-reserve]",
    formatCurrency(getAccountPublishValue("[data-account-reserve-price]")),
  );
  setAccountPublishText(
    "[data-account-preview-increment]",
    formatCurrency(getAccountPublishValue("[data-account-bid-increment]")),
  );
  setAccountPublishText("[data-account-preview-window]", formatAccountPublishDurationLabel());
  updateAccountPublishPreviewImage();
}

function validateAccountPublishRequired(input, message) {
  if (!input || !input.value.trim()) {
    setAccountPublishFieldError(input, message);
    return false;
  }

  setAccountPublishFieldError(input, "");
  return true;
}

function validateAccountPublishNumber(input, message) {
  const value = Number(input?.value);

  if (!input || !input.value.trim() || !Number.isFinite(value) || value <= 0) {
    setAccountPublishFieldError(input, message);
    return false;
  }

  setAccountPublishFieldError(input, "");
  return true;
}

function validateAccountPublishOptionalNonNegative(input, message) {
  if (!input || !input.value.trim()) return true;

  const value = Number(input.value);

  if (!Number.isFinite(value) || value < 0) {
    setAccountPublishFieldError(input, message);
    return false;
  }

  setAccountPublishFieldError(input, "");
  return true;
}

function validateAccountPublishForm() {
  let isValid = true;

  const requiredFields = [
    ["[data-account-lot-title]", "Nhập tiêu đề."],
    ["[data-account-lot-category]", "Chọn danh mục."],
    ["[data-account-lot-description]", "Nhập mô tả."],
    ["[data-account-start-date]", "Chọn ngày bắt đầu."],
    ["[data-account-start-time]", "Chọn giờ bắt đầu."],
  ];

  requiredFields.forEach(([selector, message]) => {
    if (!validateAccountPublishRequired(document.querySelector(selector), message)) isValid = false;
  });

  if (!validateAccountPublishNumber(document.querySelector("[data-account-starting-bid]"), "Nhập giá khởi điểm."))
    isValid = false;
  if (!validateAccountPublishNumber(document.querySelector("[data-account-reserve-price]"), "Nhập giá sàn."))
    isValid = false;
  if (!validateAccountPublishNumber(document.querySelector("[data-account-bid-increment]"), "Nhập bước giá."))
    isValid = false;
  if (!validateAccountPublishNumber(document.querySelector("[data-account-estimate-low]"), "Nhập ước tính thấp."))
    isValid = false;
  if (!validateAccountPublishNumber(document.querySelector("[data-account-estimate-high]"), "Nhập ước tính cao."))
    isValid = false;

  if (
    !validateAccountPublishOptionalNonNegative(
      document.querySelector("[data-account-dur-hours]"),
      "Số giờ không hợp lệ.",
    )
  )
    isValid = false;
  if (
    !validateAccountPublishOptionalNonNegative(
      document.querySelector("[data-account-dur-minutes]"),
      "Số phút không hợp lệ.",
    )
  )
    isValid = false;
  if (
    !validateAccountPublishOptionalNonNegative(
      document.querySelector("[data-account-dur-seconds]"),
      "Số giây không hợp lệ.",
    )
  )
    isValid = false;

  if (getAccountPublishDurationParts().totalSeconds <= 0) {
    setAccountPublishFieldError(document.querySelector("[data-account-dur-hours]"), "Nhập thời lượng phiên > 0.");
    isValid = false;
  }

  const imageInput = document.querySelector("[data-account-lot-images]");
  if (state.publishFiles.length === 0) {
    setAccountPublishFieldError(imageInput, "Vui lòng upload ít nhất 1 ảnh sản phẩm.");
    isValid = false;
  } else {
    setAccountPublishFieldError(imageInput, "");
  }

  return isValid;
}

function buildAccountPublishJsonPayload() {
  const duration = getAccountPublishDurationParts();
  const startDateTime = getAccountPublishStartDateTime();
  const imageUrl = state.publishPreviewBase64[0] || DEFAULT_PUBLISH_PREVIEW_IMAGE;

  return {
    productName: getAccountPublishValue("[data-account-lot-title]"),
    description: getAccountPublishValue("[data-account-lot-description]"),
    category: getAccountPublishValue("[data-account-lot-category]"),
    imageUrl,
    images: state.publishPreviewBase64.length > 0 ? state.publishPreviewBase64 : [imageUrl],
    startingPrice: Number(getAccountPublishValue("[data-account-starting-bid]")),
    reservePrice: Number(getAccountPublishValue("[data-account-reserve-price]")),
    stepPrice: Number(getAccountPublishValue("[data-account-bid-increment]")),
    estimateLow: Number(getAccountPublishValue("[data-account-estimate-low]")),
    estimateHigh: Number(getAccountPublishValue("[data-account-estimate-high]")),
    durationMinutes: duration.totalMinutes,
    startTime: startDateTime ? startDateTime.toISOString() : undefined,
    status: "Pending",
  };
}

function buildAccountPublishFormData() {
  const duration = getAccountPublishDurationParts();
  const startDateTime = getAccountPublishStartDateTime();
  const formData = new FormData();

  formData.append("productName", getAccountPublishValue("[data-account-lot-title]"));
  formData.append("description", getAccountPublishValue("[data-account-lot-description]"));
  formData.append("category", getAccountPublishValue("[data-account-lot-category]"));
  formData.append("startingPrice", String(Number(getAccountPublishValue("[data-account-starting-bid]"))));
  formData.append("reservePrice", String(Number(getAccountPublishValue("[data-account-reserve-price]"))));
  formData.append("stepPrice", String(Number(getAccountPublishValue("[data-account-bid-increment]"))));
  formData.append("estimateLow", String(Number(getAccountPublishValue("[data-account-estimate-low]"))));
  formData.append("estimateHigh", String(Number(getAccountPublishValue("[data-account-estimate-high]"))));
  formData.append("durationMinutes", String(duration.totalMinutes));
  formData.append("status", "Pending");

  if (startDateTime) formData.append("startTime", startDateTime.toISOString());

  state.publishFiles.forEach((file) => formData.append("images", file));

  return formData;
}

function shouldFallbackAccountPublishToJson(error) {
  const message = String(error?.message || "").toLowerCase();
  const code = String(error?.errorCode || "").toUpperCase();

  return (
    error?.status === 400 ||
    code === "ERR_INVALID_INPUT" ||
    message.includes("invalid input") ||
    message.includes("vui lòng nhập đủ")
  );
}

async function handleAccountPublishSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;

  if (!validateAccountPublishForm()) {
    showToast("Chưa thể gửi duyệt", "Vui lòng hoàn thiện các trường bắt buộc trong form đăng bán.", "error");
    return;
  }

  setAccountPublishBusy(form, true);

  try {
    let response;

    try {
      response = await apiClient.request("/auctions", {
        method: "POST",
        body: buildAccountPublishFormData(),
        auth: true,
        idempotency: true,
      });
    } catch (error) {
      if (!shouldFallbackAccountPublishToJson(error)) throw error;
      response = await apiClient.post("/auctions", buildAccountPublishJsonPayload(), {
        auth: true,
        idempotency: true,
      });
    }

    const auctionId = response?.data?.auctionId;
    showToast("Đã gửi duyệt", `Phiên ${auctionId ? `#${auctionId} ` : ""}đã được đưa vào hàng chờ admin.`, "success");

    form.reset();
    resetPublishState();
    renderAccountPublishThumbnails();
    updateAccountPublishPreview();
    await loadMyAuctions();
    setActiveTab("selling");
  } catch (error) {
    console.error("[Account Publish] API Error:", error);
    showToast("Gửi duyệt thất bại", error.message || "Không thể tạo phiên đấu giá. Kiểm tra backend/API.", "error");
  } finally {
    setAccountPublishBusy(form, false);
  }
}

function bindAccountPublishForm() {
  const form = document.querySelector("[data-account-publish-form]");
  if (!form) return;

  form.addEventListener("submit", handleAccountPublishSubmit);

  form.querySelectorAll("input, select, textarea").forEach((input) => {
    input.addEventListener("input", updateAccountPublishPreview);
    input.addEventListener("change", updateAccountPublishPreview);
  });

  const imageInput = form.querySelector("[data-account-lot-images]");
  if (imageInput) imageInput.addEventListener("change", handleAccountPublishImageUpload);

  const clearButton = form.querySelector("[data-account-publish-clear]");
  if (clearButton) {
    clearButton.addEventListener("click", () => {
      form.reset();
      resetPublishState();
      renderAccountPublishThumbnails();
      updateAccountPublishPreview();
      showToast("Đã làm mới form", "Bạn có thể nhập lại thông tin lô hàng từ đầu.", "success");
    });
  }

  const prevButton = document.querySelector("[data-account-publish-prev]");
  const nextButton = document.querySelector("[data-account-publish-next]");

  if (prevButton) {
    prevButton.addEventListener("click", () => {
      if (state.publishPreviewUrls.length <= 1) return;
      state.publishCurrentImageIndex =
        state.publishCurrentImageIndex === 0 ? state.publishPreviewUrls.length - 1 : state.publishCurrentImageIndex - 1;
      updateAccountPublishPreviewImage();
      renderAccountPublishThumbnails();
    });
  }

  if (nextButton) {
    nextButton.addEventListener("click", () => {
      if (state.publishPreviewUrls.length <= 1) return;
      state.publishCurrentImageIndex =
        state.publishCurrentImageIndex + 1 >= state.publishPreviewUrls.length ? 0 : state.publishCurrentImageIndex + 1;
      updateAccountPublishPreviewImage();
      renderAccountPublishThumbnails();
    });
  }

  updateAccountPublishPreview();
}

function renderPublishPanel() {
  const panel = getPanel("publish");
  if (!panel) return;

  panel.innerHTML = `
    <div class="account-selling-shell">
      <article class="account-publish-form-card">
        <div class="account-card-heading">
          <div>
            <h3>Đăng Bán Tài Sản</h3>
            <p style="margin: 8px 0 0; color: var(--text-muted); line-height: 1.6;">
              Tạo lô đấu giá ngay trong tài khoản. Phiên sẽ vào trạng thái chờ duyệt trước khi public.
            </p>
          </div>
          <span class="account-status-pill">Tạo trực tiếp</span>
        </div>

        <div class="account-publish-layout">
          <form class="account-publish-form" data-account-publish-form novalidate>
            <section class="account-publish-section">
              <div class="account-publish-section-heading">
                <span>01</span>
                <div>
                  <h4>Định Danh Lô Hàng</h4>
                  <p>Nhập thông tin công khai của tài sản.</p>
                </div>
              </div>

              <label class="account-publish-field">
                <span>Tiêu đề công khai</span>
                <input type="text" placeholder="VD: Đồng hồ Rolex Submariner..." data-account-lot-title required />
                <small data-account-publish-error></small>
              </label>

              <label class="account-publish-field">
                <span>Hình ảnh sản phẩm, tối đa 3 hình</span>
                <input class="account-publish-image-uploader" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple data-account-lot-images />
                <div class="account-publish-image-preview-list" data-account-publish-thumbs></div>
                <small data-account-publish-error></small>
              </label>

              <label class="account-publish-field">
                <span>Danh mục</span>
                <select data-account-lot-category required>
                  <option value="">Chọn danh mục sản phẩm</option>
                  <option value="Jewelry">Trang sức (Jewelry)</option>
                  <option value="Horology">Đồng hồ (Horology)</option>
                  <option value="Fine Art">Nghệ thuật (Fine Art)</option>
                  <option value="Automotive">Ô tô (Automotive)</option>
                  <option value="Collectibles">Đồ sưu tầm (Collectibles)</option>
                </select>
                <small data-account-publish-error></small>
              </label>

              <label class="account-publish-field">
                <span>Mô tả công khai</span>
                <textarea placeholder="Mô tả chi tiết tình trạng, nguồn gốc tài sản..." data-account-lot-description required></textarea>
                <small data-account-publish-error></small>
              </label>
            </section>

            <section class="account-publish-section">
              <div class="account-publish-section-heading">
                <span>02</span>
                <div>
                  <h4>Định Giá Đấu Giá</h4>
                  <p>Thiết lập giá khởi điểm, giá sàn, bước giá.</p>
                </div>
              </div>

              <div class="account-publish-grid-4">
                <label class="account-publish-field">
                  <span>Giá khởi điểm ($)</span>
                  <input type="number" min="1" step="1" placeholder="42000" data-account-starting-bid required />
                  <small data-account-publish-error></small>
                </label>

                <label class="account-publish-field">
                  <span>Giá sàn ($)</span>
                  <input type="number" min="1" step="1" placeholder="60000" data-account-reserve-price required />
                  <small data-account-publish-error></small>
                </label>

                <label class="account-publish-field">
                  <span>Bước giá ($)</span>
                  <input type="number" min="1" step="1" placeholder="2000" data-account-bid-increment required />
                  <small data-account-publish-error></small>
                </label>

                <label class="account-publish-field">
                  <span>Phí người mua %</span>
                  <input type="number" min="0" step="0.1" placeholder="12.5" data-account-buyer-premium />
                  <small data-account-publish-error></small>
                </label>
              </div>

              <div class="account-publish-grid-2" style="margin-top: 12px;">
                <label class="account-publish-field">
                  <span>Ước tính thấp ($)</span>
                  <input type="number" min="1" step="1" placeholder="68000" data-account-estimate-low required />
                  <small data-account-publish-error></small>
                </label>

                <label class="account-publish-field">
                  <span>Ước tính cao ($)</span>
                  <input type="number" min="1" step="1" placeholder="92000" data-account-estimate-high required />
                  <small data-account-publish-error></small>
                </label>
              </div>
            </section>

            <section class="account-publish-section">
              <div class="account-publish-section-heading">
                <span>03</span>
                <div>
                  <h4>Thời Gian Đấu Giá</h4>
                  <p>Người dùng tự chọn thời gian và quy tắc phiên.</p>
                </div>
              </div>

              <div class="account-publish-grid-2">
                <label class="account-publish-field">
                  <span>Ngày bắt đầu</span>
                  <input type="date" data-account-start-date required />
                  <small data-account-publish-error></small>
                </label>

                <label class="account-publish-field">
                  <span>Giờ bắt đầu</span>
                  <input type="time" data-account-start-time required />
                  <small data-account-publish-error></small>
                </label>
              </div>

              <div class="account-publish-grid-3" style="margin-top: 12px;">
                <label class="account-publish-field">
                  <span>Thời lượng, giờ</span>
                  <input type="number" min="0" step="1" placeholder="Nhập số giờ" data-account-dur-hours required />
                  <small data-account-publish-error></small>
                </label>

                <label class="account-publish-field">
                  <span>Phút</span>
                  <input type="number" min="0" max="59" step="1" placeholder="Nhập số phút" data-account-dur-minutes />
                  <small data-account-publish-error></small>
                </label>

                <label class="account-publish-field">
                  <span>Giây</span>
                  <input type="number" min="0" max="59" step="1" placeholder="Nhập số giây" data-account-dur-seconds />
                  <small data-account-publish-error></small>
                </label>
              </div>

              <div class="account-publish-rule-grid">
                <label class="account-publish-toggle">
                  <input type="checkbox" data-account-soft-close />
                  <div>
                    <strong>Chống bắn tỉa</strong>
                    <p>Tự động gia hạn thêm thời gian nếu có bid phút cuối.</p>
                  </div>
                </label>

                <label class="account-publish-toggle">
                  <input type="checkbox" data-account-proxy-enabled />
                  <div>
                    <strong>Đặt giá hộ</strong>
                    <p>Tự động đấu giá thay người dùng tới hạn mức.</p>
                  </div>
                </label>
              </div>
            </section>

            <div class="account-publish-actions">
              <button type="button" class="button button-outline" data-account-publish-clear>Làm mới</button>
              <button type="submit" class="button button-primary">Gửi duyệt phiên</button>
            </div>
          </form>

          <aside class="account-publish-preview-card">
            <div class="account-publish-preview-heading">
              <h4>Bản xem trước</h4>
              <span>Chờ duyệt</span>
            </div>

            <div class="account-publish-preview-media">
              <img src="${DEFAULT_PUBLISH_PREVIEW_IMAGE}" alt="Bản xem trước lô hàng" data-account-publish-preview-image />
              <button type="button" class="account-publish-preview-nav" data-account-publish-prev aria-label="Ảnh trước">‹</button>
              <button type="button" class="account-publish-preview-nav" data-account-publish-next aria-label="Ảnh tiếp theo">›</button>
              <span class="account-publish-preview-counter" data-account-publish-counter>1 / 1</span>
            </div>

            <div class="account-publish-preview-body">
              <p data-account-preview-lot>CHỜ HỆ THỐNG CẤP MÃ</p>
              <h4 data-account-preview-title>Chưa có tiêu đề</h4>

              <div class="account-publish-preview-meta">
                <span data-account-preview-category>Chưa phân loại</span>
                <span data-account-preview-specialist>BrosGem Verification</span>
              </div>

              <p data-account-preview-description>Mô tả công khai sẽ hiện ở đây.</p>

              <div class="account-publish-preview-price-grid">
                <div><span>Ước tính</span><strong data-account-preview-estimate>$0 - $0</strong></div>
                <div><span>Khởi điểm</span><strong data-account-preview-starting>$0</strong></div>
                <div><span>Giá sàn</span><strong data-account-preview-reserve>$0</strong></div>
                <div><span>Bước giá</span><strong data-account-preview-increment>$0</strong></div>
              </div>

              <div class="account-publish-preview-countdown">
                <span>Thời lượng phiên</span>
                <strong data-account-preview-window>Chưa thiết lập</strong>
              </div>
            </div>
          </aside>
        </div>
      </article>
    </div>
  `;

  bindAccountPublishForm();
}

function renderSellingPanel() {
  const panel = getPanel("selling");
  if (!panel) return;

  const auctionListHtml =
    state.myAuctions.length === 0
      ? `
      <div class="account-empty-state">
        <span>◇</span>
        <p>Bạn chưa gửi phiên đấu giá nào. Hãy mở tab Đăng Bán để tạo lô mới, sau đó phiên sẽ xuất hiện tại đây với trạng thái chờ duyệt.</p>
      </div>
    `
      : `
      <div class="account-selling-grid">
        ${state.myAuctions
          .map(
            (auction) => `
              <article class="account-selling-card">
                <img
                  src="${escapeHtml(auction.imageUrl || FALLBACK_IMAGE)}"
                  alt="${escapeHtml(auction.title)}"
                  onerror="this.src='${FALLBACK_IMAGE}'"
                />

                <div>
                  <p class="eyebrow">${escapeHtml(auction.lot || `Lô #${auction.id}`)}</p>
                  <h4>${escapeHtml(auction.title)}</h4>

                  <span class="account-status-pill ${getStatusClass(auction.status)}">
                    ${escapeHtml(getStatusLabel(auction.status))}
                  </span>

                  <p>
                    ${
                      normalizeStatus(auction.status) === "pending"
                        ? "Phiên đang chờ admin xét duyệt. Sau khi được thông qua, phiên sẽ xuất hiện ở trang Đấu Giá Trực Tiếp."
                        : escapeHtml(auction.description || "Phiên đã được hệ thống ghi nhận.")
                    }
                  </p>

                  <div class="account-selling-meta">
                    <span>Giá: <strong>${formatCurrency(auction.currentPrice)}</strong></span>
                    <span>Cọc: <strong>${formatCurrency(auction.depositAmount)}</strong></span>
                    <span>Kết thúc: <strong>${formatDateTime(auction.endTime)}</strong></span>
                  </div>

                  <div style="margin-top: 18px;">
                    <a class="button button-outline" href="./product-detail.html?id=${escapeHtml(auction.id)}">
                      Xem phiên
                    </a>
                  </div>
                </div>
              </article>
            `,
          )
          .join("")}
      </div>
    `;

  panel.innerHTML = `
    <div class="account-selling-shell">
      <article class="account-runtime-card">
        <div class="account-card-heading">
          <h3>Các Phiên Bạn Đã Gửi</h3>
          <span class="account-status-pill">${state.myAuctions.length} phiên</span>
        </div>

        ${auctionListHtml}
      </article>
    </div>
  `;

  bindAccountPublishForm();
}

function renderOverviewPanel() {
  const panel = getPanel("overview");
  if (!panel) return;

  const pendingCount = state.myAuctions.filter((auction) => normalizeStatus(auction.status) === "pending").length;
  const activeCount = state.myAuctions.filter((auction) => normalizeStatus(auction.status) === "active").length;

  panel.innerHTML = `
    <div class="dashboard-stat-grid">
      <article class="dashboard-stat-card">
        <span>Phiên Đã Tạo</span>
        <strong>${String(state.myAuctions.length).padStart(2, "0")}</strong>
        <p>Dữ liệu thật từ Backend</p>
      </article>

      <article class="dashboard-stat-card">
        <span>Chờ Duyệt</span>
        <strong>${String(pendingCount).padStart(2, "0")}</strong>
        <p>Đang đợi admin thông qua</p>
      </article>

      <article class="dashboard-stat-card">
        <span>Đang Mở</span>
        <strong>${String(activeCount).padStart(2, "0")}</strong>
        <p>Đã public ra trang đấu giá</p>
      </article>
    </div>
  `;
}

function renderSettingsPanel() {
  const panel = getPanel("settings");
  if (!panel) return;

  const user = state.user || {};

  panel.innerHTML = `
    <article class="account-runtime-card">
      <div class="account-card-heading">
        <h3>Cài Đặt Tài Khoản</h3>
      </div>

      <div class="account-settings-grid">
        <label class="account-setting-field">
          <span>Tên hiển thị</span>
          <input value="${escapeHtml(getDisplayName(user))}" readonly />
        </label>

        <label class="account-setting-field">
          <span>Email</span>
          <input value="${escapeHtml(user.email || "")}" readonly />
        </label>

        <label class="account-setting-field">
          <span>ID người dùng</span>
          <input value="${escapeHtml(user.id || "")}" readonly />
        </label>

        <label class="account-setting-field">
          <span>Vai trò</span>
          <input value="${escapeHtml(user.role || "user")}" readonly />
        </label>
      </div>
    </article>
  `;
}

async function loadMyAuctions() {
  try {
    const response = await apiClient.get("/auctions/mine", null, {
      auth: true,
      idempotency: false,
      redirectOnUnauthorized: false,
    });

    state.myAuctions = response?.data?.auctions || [];
  } catch (error) {
    state.myAuctions = [];
    showToast("Không thể tải phiên của bạn", error.message || "Kiểm tra API /api/auctions/mine.", "error");
  }

  renderOverviewPanel();
  renderSellingPanel();
}

async function loadAndRenderBidsPanel() {
  const panel = getPanel("bids");
  if (!panel) return;

  panel.innerHTML = `
    <article class="account-runtime-card">
      <div class="account-card-heading"><h3>Lượt Giá Của Tôi</h3></div>
      <div class="account-empty-state"><span>◇</span><p>Đang tải...</p></div>
    </article>
  `;

  try {
    const res = await apiClient.get("/transactions", null, {
      auth: true,
      redirectOnUnauthorized: false,
    });

    const allTx = res?.data?.transactions || [];
    const bidTypes = ["AUCTION_DEPOSIT", "WIN_FULL_PAYMENT", "WIN_REMAINING_PAYMENT"];
    const bidTx = allTx.filter((tx) => bidTypes.includes(tx.type));

    if (bidTx.length === 0) {
      panel.innerHTML = `
        <article class="account-runtime-card">
          <div class="account-card-heading"><h3>Lượt Giá Của Tôi</h3></div>
          <div class="account-empty-state">
            <span>◇</span>
            <p>Bạn chưa tham gia đặt giá phiên nào. Hãy khám phá các phiên đang mở!</p>
          </div>
        </article>
      `;
      return;
    }

    const rowsHtml = bidTx
      .map((tx) => {
        const statusClass =
          tx.status === "SUCCESS" ? "is-active" : tx.status === "FAILED" ? "is-rejected" : "is-pending";

        return `
        <tr>
          <td style="padding: 12px 14px; border-bottom: 1px solid var(--border); color: var(--text-muted); font-size: 12px;">
            ${escapeHtml(formatDateTime(tx.createdAt))}
          </td>
          <td style="padding: 12px 14px; border-bottom: 1px solid var(--border); color: var(--text);">
            ${
              tx.auctionId
                ? `<a href="./auction-detail.html?id=${escapeHtml(String(tx.auctionId))}" style="color: var(--primary);">
                   ${escapeHtml(tx.auctionTitle || `Phiên #${tx.auctionId}`)}
                 </a>`
                : "—"
            }
          </td>
          <td style="padding: 12px 14px; border-bottom: 1px solid var(--border); color: var(--text-muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em;">
            ${escapeHtml(tx.typeLabel || tx.type)}
          </td>
          <td style="padding: 12px 14px; border-bottom: 1px solid var(--border); color: var(--primary); font-weight: 700;">
            ${formatCurrency(tx.amount)}
          </td>
          <td style="padding: 12px 14px; border-bottom: 1px solid var(--border);">
            <span class="account-status-pill ${statusClass}">
              ${escapeHtml(tx.statusLabel || tx.status)}
            </span>
          </td>
        </tr>
      `;
      })
      .join("");

    panel.innerHTML = `
      <article class="account-runtime-card">
        <div class="account-card-heading">
          <h3>Lượt Giá Của Tôi</h3>
          <span class="account-status-pill">${bidTx.length} giao dịch</span>
        </div>
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="border-bottom: 1px solid var(--border);">
                <th style="padding: 10px 14px; text-align: left; color: var(--text-muted); font-size: 10px; font-weight: 900; letter-spacing: 0.14em; text-transform: uppercase;">Thời gian</th>
                <th style="padding: 10px 14px; text-align: left; color: var(--text-muted); font-size: 10px; font-weight: 900; letter-spacing: 0.14em; text-transform: uppercase;">Phiên đấu giá</th>
                <th style="padding: 10px 14px; text-align: left; color: var(--text-muted); font-size: 10px; font-weight: 900; letter-spacing: 0.14em; text-transform: uppercase;">Loại</th>
                <th style="padding: 10px 14px; text-align: left; color: var(--text-muted); font-size: 10px; font-weight: 900; letter-spacing: 0.14em; text-transform: uppercase;">Số tiền</th>
                <th style="padding: 10px 14px; text-align: left; color: var(--text-muted); font-size: 10px; font-weight: 900; letter-spacing: 0.14em; text-transform: uppercase;">Trạng thái</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      </article>
    `;
  } catch (error) {
    panel.innerHTML = `
      <article class="account-runtime-card">
        <div class="account-card-heading"><h3>Lượt Giá Của Tôi</h3></div>
        <div class="account-empty-state">
          <span>◇</span>
          <p>Không thể tải dữ liệu: ${escapeHtml(error.message)}</p>
        </div>
      </article>
    `;
  }
}

// ─── WATCHING PANEL ─────────────────────────────────────────────────────────
async function loadAndRenderWatchingPanel() {
  const panel = getPanel("watching");
  if (!panel) return;

  panel.innerHTML = `
    <article class="account-runtime-card">
      <div class="account-card-heading"><h3>Đang Theo Dõi</h3></div>
      <div class="account-empty-state"><span>◇</span><p>Đang tải...</p></div>
    </article>
  `;

  try {
    const res = await apiClient.get("/watchlist", null, {
      auth: true,
      redirectOnUnauthorized: false,
    });

    const auctions = res?.data?.auctions || [];

    if (auctions.length === 0) {
      panel.innerHTML = `
        <article class="account-runtime-card">
          <div class="account-card-heading"><h3>Đang Theo Dõi</h3></div>
          <div class="account-empty-state">
            <span>◇</span>
            <p>Bạn chưa theo dõi phiên nào. Thêm phiên vào watchlist từ trang đấu giá để xem tại đây.</p>
          </div>
        </article>
      `;
      return;
    }

    const cardsHtml = auctions
      .map((a) => {
        const isEnded = a.isEnded;
        const statusClass = isEnded ? "" : "is-active";
        const statusText = isEnded ? "Đã kết thúc" : "Đang mở";

        return `
          <article class="account-selling-card">
            <img
              src="${escapeHtml(a.imageUrl || FALLBACK_IMAGE)}"
              alt="${escapeHtml(a.title)}"
              onerror="this.src='${FALLBACK_IMAGE}'"
            />
            <div>
              <p class="eyebrow">${escapeHtml(a.lot || `Lô #${a.auctionId}`)}</p>
              <h4>${escapeHtml(a.title)}</h4>
              <span class="account-status-pill ${statusClass}">${escapeHtml(statusText)}</span>
              <div class="account-selling-meta" style="margin-top: 12px;">
                <span>Giá hiện tại: <strong>${formatCurrency(a.currentPrice)}</strong></span>
                <span>Lượt bid: <strong>${a.bidCount}</strong></span>
                <span>Kết thúc: <strong>${formatDateTime(a.endTime)}</strong></span>
              </div>
              <div style="margin-top: 14px; display: flex; gap: 10px; align-items: center;">
                <a class="button button-outline" href="./auction-detail.html?id=${escapeHtml(String(a.auctionId))}">
                  Xem phiên
                </a>
                <button
                  class="button button-outline"
                  style="border-color: rgba(255,120,120,0.5); color: #ff8f8f;"
                  onclick="removeFromWatchlistInline(${Number(a.auctionId)}, this)"
                >
                  Bỏ theo dõi
                </button>
              </div>
            </div>
          </article>
        `;
      })
      .join("");

    panel.innerHTML = `
      <div class="account-selling-shell">
        <article class="account-runtime-card">
          <div class="account-card-heading">
            <h3>Đang Theo Dõi</h3>
            <span class="account-status-pill">${auctions.length} phiên</span>
          </div>
          <div class="account-selling-grid">${cardsHtml}</div>
        </article>
      </div>
    `;
  } catch (error) {
    panel.innerHTML = `
      <article class="account-runtime-card">
        <div class="account-card-heading"><h3>Đang Theo Dõi</h3></div>
        <div class="account-empty-state">
          <span>◇</span>
          <p>Không thể tải danh sách theo dõi: ${escapeHtml(error.message)}</p>
        </div>
      </article>
    `;
  }
}

// Inline handler cho nút "Bỏ theo dõi" — expose ra window để onclick dùng được
window.removeFromWatchlistInline = async function (auctionId, button) {
  button.disabled = true;
  button.textContent = "Đang xóa...";
  try {
    await apiClient.delete(`/watchlist/${auctionId}`, { auth: true });
    showToast("Đã bỏ theo dõi", `Đã xóa phiên #${auctionId} khỏi watchlist.`, "success");
    await loadAndRenderWatchingPanel();
  } catch (error) {
    showToast("Lỗi", error.message, "error");
    button.disabled = false;
    button.textContent = "Bỏ theo dõi";
  }
};

async function loadAndRenderPaymentsPanel() {
  const panel = getPanel("payments");
  if (!panel) return;

  panel.innerHTML = `
    <article class="account-runtime-card">
      <div class="account-card-heading"><h3>Thanh Toán</h3></div>
      <div class="account-empty-state"><span>◇</span><p>Đang tải...</p></div>
    </article>
  `;

  try {
    const res = await apiClient.get("/transactions", null, {
      auth: true,
      redirectOnUnauthorized: false,
    });

    const allTx = res?.data?.transactions || [];

    // Tất cả giao dịch tiền (trừ adjustment nội bộ)
    const ignoredTypes = ["ADMIN_ADJUSTMENT"];
    const payments = allTx.filter((tx) => !ignoredTypes.includes(tx.type));

    if (payments.length === 0) {
      panel.innerHTML = `
        <article class="account-runtime-card">
          <div class="account-card-heading"><h3>Thanh Toán</h3></div>
          <div class="account-empty-state">
            <span>◇</span>
            <p>Chưa có giao dịch nào. Lịch sử đặt cọc, hoàn tiền và thanh toán thắng sẽ xuất hiện tại đây.</p>
          </div>
        </article>
      `;
      return;
    }

    // Tổng tiền ra (deposit + win payment) đã SUCCESS
    const outTypes = ["AUCTION_DEPOSIT", "WIN_FULL_PAYMENT", "WIN_REMAINING_PAYMENT"];
    const totalOut = payments
      .filter((tx) => tx.status === "SUCCESS" && outTypes.includes(tx.type))
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

    const rowsHtml = payments
      .map((tx) => {
        const isOut = outTypes.includes(tx.type);
        const amountColor = isOut ? "var(--primary)" : "rgba(64, 201, 139, 0.9)";
        const amountPrefix = isOut ? "−" : "+";

        const statusClass =
          tx.status === "SUCCESS" ? "is-active" : tx.status === "FAILED" ? "is-rejected" : "is-pending";

        return `
        <tr>
          <td style="padding: 12px 14px; border-bottom: 1px solid var(--border); color: var(--text-muted); font-size: 12px;">
            ${escapeHtml(formatDateTime(tx.createdAt))}
          </td>
          <td style="padding: 12px 14px; border-bottom: 1px solid var(--border); color: var(--text);">
            ${
              tx.auctionId
                ? `<a href="./auction-detail.html?id=${escapeHtml(String(tx.auctionId))}" style="color: var(--primary);">
                   ${escapeHtml(tx.auctionTitle || `Phiên #${tx.auctionId}`)}
                 </a>`
                : "—"
            }
          </td>
          <td style="padding: 12px 14px; border-bottom: 1px solid var(--border); color: var(--text-muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em;">
            ${escapeHtml(tx.typeLabel || tx.type)}
          </td>
          <td style="padding: 12px 14px; border-bottom: 1px solid var(--border); font-weight: 700; color: ${amountColor};">
            ${amountPrefix}${formatCurrency(tx.amount)}
          </td>
          <td style="padding: 12px 14px; border-bottom: 1px solid var(--border);">
            <span class="account-status-pill ${statusClass}">
              ${escapeHtml(tx.statusLabel || tx.status)}
            </span>
          </td>
        </tr>
      `;
      })
      .join("");

    panel.innerHTML = `
      <article class="account-runtime-card">
        <div class="account-card-heading">
          <h3>Thanh Toán</h3>
          <span class="account-status-pill is-active">Đã chi: ${formatCurrency(totalOut)}</span>
        </div>
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="border-bottom: 1px solid var(--border);">
                <th style="padding: 10px 14px; text-align: left; color: var(--text-muted); font-size: 10px; font-weight: 900; letter-spacing: 0.14em; text-transform: uppercase;">Thời gian</th>
                <th style="padding: 10px 14px; text-align: left; color: var(--text-muted); font-size: 10px; font-weight: 900; letter-spacing: 0.14em; text-transform: uppercase;">Phiên đấu giá</th>
                <th style="padding: 10px 14px; text-align: left; color: var(--text-muted); font-size: 10px; font-weight: 900; letter-spacing: 0.14em; text-transform: uppercase;">Loại giao dịch</th>
                <th style="padding: 10px 14px; text-align: left; color: var(--text-muted); font-size: 10px; font-weight: 900; letter-spacing: 0.14em; text-transform: uppercase;">Số tiền</th>
                <th style="padding: 10px 14px; text-align: left; color: var(--text-muted); font-size: 10px; font-weight: 900; letter-spacing: 0.14em; text-transform: uppercase;">Trạng thái</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      </article>
    `;
  } catch (error) {
    panel.innerHTML = `
      <article class="account-runtime-card">
        <div class="account-card-heading"><h3>Thanh Toán</h3></div>
        <div class="account-empty-state">
          <span>◇</span>
          <p>Không thể tải lịch sử thanh toán: ${escapeHtml(error.message)}</p>
        </div>
      </article>
    `;
  }
}

function renderNonReadyPanels() {
  renderPublishPanel();
  loadAndRenderBidsPanel(); // ← thay renderEmptyPanel
  loadAndRenderWatchingPanel(); // ← thay renderEmptyPanel
  loadAndRenderWonAuctions();
  loadAndRenderPaymentsPanel(); // ← thay renderEmptyPanel
  renderSettingsPanel();
}

function initLogout() {
  const logoutButtons = document.querySelectorAll("[data-logout-button], .dashboard-logout-button");

  logoutButtons.forEach((button) => {
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

async function loadAndRenderWonAuctions() {
  const panel = getPanel("won");
  if (!panel) return;

  panel.innerHTML = `
    <article class="account-runtime-card">
      <div class="account-card-heading"><h3>Đấu Giá Đã Thắng</h3></div>
      <div class="account-empty-state"><span>◇</span><p>Đang tải...</p></div>
    </article>
  `;

  try {
    const res = await apiClient.get("/auctions/won", null, { auth: true, redirectOnUnauthorized: false });
    const auctions = res?.data?.auctions || [];

    if (auctions.length === 0) {
      panel.innerHTML = `
        <article class="account-runtime-card">
          <div class="account-card-heading"><h3>Đấu Giá Đã Thắng</h3></div>
          <div class="account-empty-state">
            <span>◇</span>
            <p>Bạn chưa thắng phiên đấu giá nào.</p>
          </div>
        </article>
      `;
      return;
    }

    const cardsHtml = auctions
      .map((a) => {
        const isPaid = a.settlementStatus === "PAID";
        const isPending = a.settlementStatus === "PENDING";

        const statusBadge = isPaid
          ? `<span class="account-status-pill is-active">✓ Đã thanh toán</span>`
          : isPending
            ? `<span class="account-status-pill is-pending">⏳ Chờ thanh toán</span>`
            : `<span class="account-status-pill">Đang xử lý</span>`;

        const paymentInfo = isPaid
          ? `<p style="color: var(--text-muted); font-size: 13px;">Thanh toán lúc: ${formatDateTime(a.paidAt)}</p>`
          : isPending
            ? `
          <p>Còn cần thanh toán: <strong>${formatCurrency(a.remainingAmount)}</strong></p>
          <a class="button button-primary" href="./auction-detail.html?id=${escapeHtml(String(a.id))}" style="display:inline-block; margin-top:10px;">
            Thanh Toán Ngay
          </a>
        `
            : "";

        return `
        <article class="account-selling-card">
          <img
            src="${escapeHtml(a.imageUrl || FALLBACK_IMAGE)}"
            alt="${escapeHtml(a.title)}"
            onerror="this.src='${FALLBACK_IMAGE}'"
          />
          <div>
            <p class="eyebrow">${escapeHtml(a.lot)}</p>
            <h4>${escapeHtml(a.title)}</h4>
            ${statusBadge}
            <div class="account-selling-meta" style="margin-top: 12px;">
              <span>Giá chốt: <strong>${formatCurrency(a.finalPrice)}</strong></span>
              <span>Kết thúc: <strong>${formatDateTime(a.endTime)}</strong></span>
            </div>
            <div style="margin-top: 10px;">${paymentInfo}</div>
          </div>
        </article>
      `;
      })
      .join("");

    panel.innerHTML = `
      <div class="account-selling-shell">
        <article class="account-runtime-card">
          <div class="account-card-heading">
            <h3>Đấu Giá Đã Thắng</h3>
            <span class="account-status-pill">${auctions.length} phiên</span>
          </div>
          <div class="account-selling-grid">${cardsHtml}</div>
        </article>
      </div>
    `;
  } catch (error) {
    panel.innerHTML = `
      <article class="account-runtime-card">
        <div class="account-card-heading"><h3>Đấu Giá Đã Thắng</h3></div>
        <div class="account-empty-state"><span>◇</span><p>Không thể tải dữ liệu: ${escapeHtml(error.message)}</p></div>
      </article>
    `;
  }
}

function bindSocketEvents() {
  if (!window.socketClient) return;

  // Connect vào global room + room riêng của user
  window.socketClient.connect("global");

  const userId = state.user?.id;
  if (userId) {
    window.socketClient.socket?.emit("join_auction", { auctionId: `user_${userId}` });
  }

  // Khi admin duyệt/từ chối → reload lại danh sách phiên
  window.socketClient.on("auction_approved", (data) => {
    if (data?.sellerId === state.user?.id || !data?.sellerId) {
      loadMyAuctions();
    }
  });

  window.socketClient.on("auction_rejected", (data) => {
    if (data?.sellerId === state.user?.id || !data?.sellerId) {
      loadMyAuctions();
    }
  });

  window.socketClient.on("user_notification", (data) => {
    if (data?.type === "AUCTION_APPROVED" || data?.type === "AUCTION_REJECTED") {
      const isApproved = data.type === "AUCTION_APPROVED";
      showToast(
        isApproved ? "Phiên đã được duyệt! 🎉" : "Phiên chưa được duyệt",
        data.message || "",
        isApproved ? "success" : "error",
      );
      loadMyAuctions();
    }
  });
}

function initAccountPage() {
  injectAccountRuntimeStyles();
  initTheme();

  const user = requireAuthSession();
  if (!user) return;

  state.user = user;

  initSiteHeader({
    hideAfter: 120,
    topRevealOffset: 12,
  });

  hydrateAccountUser(user);
  initDashboardTabs();
  initLogout();

  renderNonReadyPanels();
  loadMyAuctions();
  bindSocketEvents();
}

document.addEventListener("DOMContentLoaded", initAccountPage);

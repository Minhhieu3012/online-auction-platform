// frontend/js/main.js
import { initTheme } from "./core/theme.js";
import { initSiteHeader } from "./core/header.js";
import apiClient from "./core/api-client.js";
import "./core/socket-client.js";

const API_ORIGIN = window.BROSGEM_API_ORIGIN || "http://localhost:3000";

const PLACEHOLDER_IMAGE = `data:image/svg+xml;utf8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="900" height="700" viewBox="0 0 900 700">
    <rect width="900" height="700" fill="#151516"/>
    <rect x="42" y="42" width="816" height="616" fill="none" stroke="#c5a059" stroke-opacity=".5"/>
    <text x="450" y="330" text-anchor="middle" fill="#c5a059" font-family="Arial, sans-serif" font-size="34" font-weight="700" letter-spacing="7">BROSGEM</text>
    <text x="450" y="380" text-anchor="middle" fill="#aeb6c2" font-family="Arial, sans-serif" font-size="18" letter-spacing="4">DATABASE IMAGE</text>
  </svg>
`)}`;

let featuredAuctions = [];
let featuredCountdownTimer = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getRawValue(object, keys, fallback = null) {
  for (const key of keys) {
    if (object && object[key] !== undefined && object[key] !== null) {
      return object[key];
    }
  }

  return fallback;
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeStatus(status) {
  return String(status || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function parseTimeMs(value) {
  if (!value) return 0;

  if (typeof value === "number") {
    return value;
  }

  const text = String(value).trim();

  if (/^\d+$/.test(text)) {
    return Number(text);
  }

  const parsed = new Date(text).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatCountdownParts(distanceMs) {
  const totalSeconds = Math.max(0, Math.floor(distanceMs / 1000));

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatCountdown(endTime) {
  const endTimeMs = parseTimeMs(endTime);

  if (!endTimeMs) {
    return "Đang cập nhật";
  }

  const distance = endTimeMs - Date.now();

  if (distance <= 0) {
    return "Đã kết thúc";
  }

  return formatCountdownParts(distance);
}

function getStatusLabel(status) {
  const map = {
    active: "Đang Diễn Ra",
    closing: "Sắp Đóng",
    scheduled: "Đã Lên Lịch",
    ended: "Đã Kết Thúc",
    payment_pending: "Chờ Thanh Toán",
    completed: "Hoàn Tất",
    cancelled: "Đã Hủy",
  };

  return map[normalizeStatus(status)] || "Đang Cập Nhật";
}

function getStatusClass(status) {
  const normalized = normalizeStatus(status);

  if (normalized === "closing") return "status-closing";
  if (normalized === "scheduled") return "status-scheduled";
  if (normalized === "ended") return "status-ended";
  if (normalized === "completed") return "status-completed";

  return "status-active";
}

function resolveImageUrl(value) {
  const raw = String(value || "").trim();

  if (!raw) {
    return PLACEHOLDER_IMAGE;
  }

  if (raw.startsWith("data:") || raw.startsWith("blob:")) {
    return raw;
  }

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  if (raw.startsWith("/uploads/")) {
    return `${API_ORIGIN}${raw}`;
  }

  if (raw.startsWith("uploads/")) {
    return `${API_ORIGIN}/${raw}`;
  }

  if (raw.startsWith("./") || raw.startsWith("../") || raw.startsWith("/")) {
    return raw;
  }

  return `./${raw.replace(/^\/+/, "")}`;
}

function getAuctionsFromPayload(payload) {
  const candidates = [
    payload?.data?.auctions,
    payload?.data?.items,
    payload?.data?.results,
    payload?.data,
    payload?.auctions,
    payload?.items,
    payload,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
}

function normalizeAuction(rawAuction = {}) {
  const id = toNumber(getRawValue(rawAuction, ["id", "auction_id", "auctionId"]), 0);
  const status = getRawValue(rawAuction, ["status"], "Active");
  const currentPrice = toNumber(getRawValue(rawAuction, ["currentPrice", "current_price", "price"], 0), 0);
  const imageUrl = getRawValue(rawAuction, ["imageUrl", "image_url", "productImage", "product_image"], null);
  const rawBids = getRawValue(rawAuction, ["bidHistory", "bid_history", "bids"], []);
  const bidCount = toNumber(getRawValue(rawAuction, ["bidCount", "bid_count", "bidsCount"], Array.isArray(rawBids) ? rawBids.length : 0), 0);
  const endTime = getRawValue(rawAuction, ["endTime", "end_time", "endsAt", "ends_at"], null);

  return {
    id,
    lot: getRawValue(rawAuction, ["lot"], `Lô #${String(id).padStart(3, "0")}`),
    title: getRawValue(rawAuction, ["title", "product_name", "productName", "name"], "Vật phẩm đấu giá"),
    description: getRawValue(rawAuction, ["description", "product_description"], "Đang cập nhật mô tả tài sản từ database."),
    status,
    currentPrice,
    bidCount,
    endTime,
    imageUrl: resolveImageUrl(imageUrl),
  };
}

function renderFeaturedLoading() {
  const grid = document.querySelector("[data-featured-auctions]");

  if (!grid) return;

  grid.innerHTML = `
    <article class="auction-card" style="min-height: 320px; display: grid; place-items: center;">
      <div style="text-align: center; padding: 32px;">
        <span style="color: var(--primary); font-size: 28px;">◇</span>
        <p style="margin-top: 12px; color: var(--text-muted); font-weight: 800; letter-spacing: .14em; text-transform: uppercase;">
          Đang tải phiên đấu giá thật từ database...
        </p>
      </div>
    </article>
  `;
}

function renderFeaturedEmpty() {
  const grid = document.querySelector("[data-featured-auctions]");

  if (!grid) return;

  grid.innerHTML = `
    <article class="auction-card" style="grid-column: 1 / -1; min-height: 320px; display: grid; place-items: center; border: 1px dashed var(--border);">
      <div style="text-align: center; max-width: 620px; padding: 38px;">
        <span style="color: var(--primary); font-size: 30px;">◇</span>
        <h3 style="margin-top: 16px; color: var(--text); text-transform: uppercase; letter-spacing: .08em;">
          Chưa có phiên đấu giá đang mở
        </h3>
        <p style="margin-top: 10px; color: var(--text-muted); line-height: 1.7;">
          Khi admin duyệt phiên đấu giá từ database, các lô đang mở sẽ tự động xuất hiện tại đây.
        </p>
        <a href="./pages/live-auctions.html" class="button button-outline" style="margin-top: 22px;">
          Kiểm Tra Trang Đấu Giá
        </a>
      </div>
    </article>
  `;
}

function renderFeaturedError(message) {
  const grid = document.querySelector("[data-featured-auctions]");

  if (!grid) return;

  grid.innerHTML = `
    <article class="auction-card" style="grid-column: 1 / -1; min-height: 320px; display: grid; place-items: center; border: 1px solid rgba(225,96,96,.5);">
      <div style="text-align: center; max-width: 620px; padding: 38px;">
        <span style="color: #ff8f8f; font-size: 30px;">!</span>
        <h3 style="margin-top: 16px; color: var(--text); text-transform: uppercase; letter-spacing: .08em;">
          Không thể tải dữ liệu đấu giá
        </h3>
        <p style="margin-top: 10px; color: var(--text-muted); line-height: 1.7;">
          ${escapeHtml(message || "Kiểm tra backend API /api/auctions.")}
        </p>
        <button type="button" class="button button-outline" data-retry-featured style="margin-top: 22px;">
          Thử Lại
        </button>
      </div>
    </article>
  `;

  grid.querySelector("[data-retry-featured]")?.addEventListener("click", loadFeaturedAuctions);
}

function renderFeaturedCard(auction) {
  return `
    <article class="auction-card" data-featured-auction-id="${escapeHtml(auction.id)}">
      <a href="./pages/auction-detail.html?id=${encodeURIComponent(auction.id)}" style="color: inherit; text-decoration: none;">
        <div class="auction-card-media">
          <img
            src="${escapeHtml(auction.imageUrl)}"
            alt="${escapeHtml(auction.title)}"
            loading="lazy"
            data-real-auction-image
          />
          <span class="status-badge ${getStatusClass(auction.status)}">${getStatusLabel(auction.status)}</span>
        </div>

        <div class="auction-card-body">
          <div class="auction-card-meta">
            <span>${escapeHtml(auction.lot)}</span>
            <span>${auction.bidCount} lượt giá</span>
          </div>

          <h3>${escapeHtml(auction.title)}</h3>
          <p>${escapeHtml(auction.description)}</p>

          <div class="auction-card-divider"></div>

          <div class="auction-card-bottom">
            <div>
              <span class="field-label">Giá Hiện Tại</span>
              <strong>${formatMoney(auction.currentPrice)}</strong>
            </div>
            <div>
              <span class="field-label">Kết Thúc Trong</span>
              <strong data-featured-countdown="${escapeHtml(auction.id)}">${formatCountdown(auction.endTime)}</strong>
            </div>
          </div>
        </div>
      </a>
    </article>
  `;
}

function attachImageFallbacks(root = document) {
  root.querySelectorAll("[data-real-auction-image]").forEach((image) => {
    image.addEventListener(
      "error",
      () => {
        image.src = PLACEHOLDER_IMAGE;
      },
      { once: true },
    );
  });
}

function renderFeaturedAuctions() {
  const grid = document.querySelector("[data-featured-auctions]");

  if (!grid) return;

  const visibleAuctions = featuredAuctions
    .filter((auction) => ["active", "closing"].includes(normalizeStatus(auction.status)))
    .sort((left, right) => parseTimeMs(left.endTime) - parseTimeMs(right.endTime))
    .slice(0, 3);

  if (visibleAuctions.length === 0) {
    renderFeaturedEmpty();
    return;
  }

  grid.innerHTML = visibleAuctions.map(renderFeaturedCard).join("");
  attachImageFallbacks(grid);
  refreshFeaturedCountdowns();
}

function refreshFeaturedCountdowns() {
  document.querySelectorAll("[data-featured-countdown]").forEach((element) => {
    const auctionId = Number(element.dataset.featuredCountdown);
    const auction = featuredAuctions.find((item) => Number(item.id) === auctionId);

    if (!auction) return;

    element.textContent = formatCountdown(auction.endTime);
  });
}

async function loadFeaturedAuctions() {
  renderFeaturedLoading();

  try {
    const response = await apiClient.get(
      "/auctions",
      {
        status: "active",
      },
      {
        auth: false,
        redirectOnUnauthorized: false,
        idempotency: false,
      },
    );

    featuredAuctions = getAuctionsFromPayload(response)
      .map(normalizeAuction)
      .filter((auction) => auction.id > 0);

    renderFeaturedAuctions();
  } catch (error) {
    featuredAuctions = [];
    renderFeaturedError(error.message || "Backend chưa trả dữ liệu đấu giá.");
  }
}

function startFeaturedCountdownTicker() {
  if (featuredCountdownTimer) {
    window.clearInterval(featuredCountdownTimer);
  }

  featuredCountdownTimer = window.setInterval(refreshFeaturedCountdowns, 1000);
}

function bindFeaturedSocketEvents() {
  if (!window.socketClient) return;

  window.socketClient.connect("global");

  window.socketClient.on("new_bid", loadFeaturedAuctions);
  window.socketClient.on("auction_winner", loadFeaturedAuctions);
  window.socketClient.on("auction_finalized", loadFeaturedAuctions);
  window.socketClient.on("auction_extended", loadFeaturedAuctions);
}

function injectPaymentSuccessStyles() {
  if (document.querySelector("[data-payment-success-style]")) {
    return;
  }

  const style = document.createElement("style");
  style.dataset.paymentSuccessStyle = "";

  style.textContent = `
    .payment-success-backdrop {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: grid;
      place-items: center;
      padding: 24px;
      background:
        radial-gradient(circle at 50% 30%, rgba(197, 160, 89, 0.22), transparent 32%),
        rgba(0, 0, 0, 0.72);
      backdrop-filter: blur(14px);
      animation: paymentSuccessFadeIn 180ms ease-out both;
    }

    .payment-success-dialog {
      width: min(520px, 100%);
      border: 1px solid var(--border-strong);
      background:
        linear-gradient(135deg, rgba(197, 160, 89, 0.12), transparent 24%, rgba(104, 201, 138, 0.1)),
        var(--surface);
      box-shadow: 0 28px 110px rgba(0, 0, 0, 0.58);
      padding: clamp(28px, 5vw, 46px);
      text-align: center;
      color: var(--text);
      animation: paymentSuccessLift 240ms ease-out both;
    }

    .payment-success-icon {
      width: 58px;
      height: 58px;
      display: grid;
      place-items: center;
      margin: 0 auto 22px;
      border: 1px solid rgba(104, 201, 138, 0.72);
      color: var(--success);
      background: rgba(104, 201, 138, 0.12);
      font-size: 28px;
      font-weight: 900;
    }

    .payment-success-eyebrow {
      margin: 0 0 12px;
      color: var(--primary);
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.22em;
      text-transform: uppercase;
    }

    .payment-success-title {
      margin: 0;
      color: var(--success);
      font-size: clamp(22px, 3vw, 32px);
      line-height: 1.18;
      font-weight: 800;
      letter-spacing: -0.035em;
      text-transform: uppercase;
    }

    .payment-success-message {
      margin: 18px auto 0;
      max-width: 420px;
      color: var(--text-soft);
      font-size: 14px;
      line-height: 1.75;
    }

    .payment-success-meta {
      margin: 22px 0 0;
      padding: 14px 16px;
      border: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.035);
      color: var(--text-muted);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .payment-success-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 28px;
    }

    .payment-success-close {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }

    @keyframes paymentSuccessFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes paymentSuccessLift {
      from {
        opacity: 0;
        transform: translateY(14px) scale(0.98);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    @media (max-width: 560px) {
      .payment-success-actions {
        grid-template-columns: 1fr;
      }
    }
  `;

  document.head.appendChild(style);
}

function cleanPaymentQueryParams() {
  const url = new URL(window.location.href);

  url.searchParams.delete("payment");
  url.searchParams.delete("auction_id");
  url.searchParams.delete("auctionId");
  url.searchParams.delete("source");

  const nextSearch = url.searchParams.toString();
  const cleanUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ""}${url.hash || ""}`;

  window.history.replaceState({}, document.title, cleanUrl);
}

function showPaymentSuccessDialog({ auctionId = null } = {}) {
  injectPaymentSuccessStyles();

  const backdrop = document.createElement("div");
  backdrop.className = "payment-success-backdrop";
  backdrop.setAttribute("role", "presentation");

  backdrop.innerHTML = `
    <section class="payment-success-dialog" role="dialog" aria-modal="true" aria-labelledby="payment-success-title">
      <div class="payment-success-icon" aria-hidden="true">✓</div>
      <p class="payment-success-eyebrow">Thanh toán hoàn tất</p>
      <h2 class="payment-success-title" id="payment-success-title">
        Khách hàng đã đấu giá và thanh toán thành công
      </h2>
      <p class="payment-success-message">
        Giao dịch của bạn đã được ghi nhận. BrosGem sẽ tiếp tục xử lý trạng thái phiên đấu giá và thông tin bàn giao theo quy trình hệ thống.
      </p>
      ${
        auctionId
          ? `<div class="payment-success-meta">Mã phiên đấu giá: #${String(auctionId).padStart(3, "0")}</div>`
          : ""
      }
      <div class="payment-success-actions">
        <a class="button button-primary" href="./pages/live-auctions.html">Xem phiên khác</a>
        <button type="button" class="button button-outline" data-payment-success-dismiss>Ở lại trang chủ</button>
      </div>
      <button type="button" class="payment-success-close" data-payment-success-dismiss>Đóng thông báo</button>
    </section>
  `;

  document.body.appendChild(backdrop);
  document.body.classList.add("is-menu-open");

  const closeDialog = () => {
    backdrop.remove();
    document.body.classList.remove("is-menu-open");
    window.removeEventListener("keydown", handleEscape);
  };

  const handleEscape = (event) => {
    if (event.key === "Escape") {
      closeDialog();
    }
  };

  backdrop.querySelectorAll("[data-payment-success-dismiss]").forEach((button) => {
    button.addEventListener("click", closeDialog);
  });

  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) {
      closeDialog();
    }
  });

  window.addEventListener("keydown", handleEscape);
}

function initPaymentReturnNotice() {
  const params = new URLSearchParams(window.location.search);
  const paymentStatus = String(params.get("payment") || "").toLowerCase();

  if (paymentStatus !== "success") {
    return;
  }

  const auctionId = params.get("auction_id") || params.get("auctionId");

  cleanPaymentQueryParams();
  window.setTimeout(() => {
    showPaymentSuccessDialog({ auctionId });
  }, 250);
}

function initHomePage() {
  initTheme();

  initSiteHeader({
    hideAfter: 120,
    topRevealOffset: 12,
  });

  initPaymentReturnNotice();
  loadFeaturedAuctions();
  startFeaturedCountdownTicker();
  bindFeaturedSocketEvents();
}

document.addEventListener("DOMContentLoaded", initHomePage);
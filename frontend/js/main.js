// frontend/js/main.js
import { initTheme } from "./core/theme.js";
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

  initCountdowns();
  initPaymentReturnNotice();
}

document.addEventListener("DOMContentLoaded", initHomePage);
import { initTheme } from "../core/theme.js";
import { initI18n } from "../core/i18n.js";
import { initSiteHeader } from "../core/header.js";

function formatCurrency(value) {
    const number = Number(value);

    if (!Number.isFinite(number) || number <= 0) {
        return "$0";
    }

    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0
    }).format(number);
}

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

function setFieldError(input, message) {
    const field = input.closest(".publish-field");
    const errorElement = field?.querySelector("[data-field-error]");

    if (!field || !errorElement) {
        return;
    }

    field.classList.toggle("has-error", Boolean(message));
    errorElement.textContent = message || "";
}

function getValue(selector) {
    return document.querySelector(selector)?.value.trim() || "";
}

function setText(selector, value) {
    const element = document.querySelector(selector);

    if (element) {
        element.textContent = value;
    }
}

function updateDefaultStartDate() {
    const startDateInput = document.querySelector("[data-start-date]");

    if (!startDateInput || startDateInput.value) {
        return;
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    startDateInput.value = tomorrow.toISOString().split("T")[0];
}

function updatePreview() {
    const lotNumber = getValue("[data-lot-number]") || "BG-LOT-2048";
    const status = getValue("[data-lot-status]") || "Scheduled";
    const title = getValue("[data-lot-title]") || "Untitled Lot";
    const category = getValue("[data-lot-category]") || "Category pending";
    const specialist = getValue("[data-lot-specialist]") || "Specialist pending";
    const description = getValue("[data-lot-description]") || "Public description will appear here.";
    const startingBid = getValue("[data-starting-bid]");
    const reservePrice = getValue("[data-reserve-price]");
    const bidIncrement = getValue("[data-bid-increment]");
    const estimateLow = getValue("[data-estimate-low]");
    const estimateHigh = getValue("[data-estimate-high]");
    const duration = getValue("[data-duration]") || "48";

    setText("[data-preview-lot-number]", lotNumber);
    setText("[data-preview-status]", status);
    setText("[data-preview-chip]", status);
    setText("[data-preview-title]", title);
    setText("[data-preview-category]", category);
    setText("[data-preview-specialist]", specialist);
    setText("[data-preview-description]", description);
    setText("[data-preview-estimate]", `${formatCurrency(estimateLow)} - ${formatCurrency(estimateHigh)}`);
    setText("[data-preview-starting]", formatCurrency(startingBid));
    setText("[data-preview-reserve]", formatCurrency(reservePrice));
    setText("[data-preview-increment]", formatCurrency(bidIncrement));

    const durationLabel = Number(duration) >= 120
        ? `${Number(duration) / 24} Days`
        : `${duration} Hours`;

    setText("[data-preview-window]", durationLabel);

    updateReadiness();
}

function validateRequired(input, message) {
    if (!input.value.trim()) {
        setFieldError(input, message);
        return false;
    }

    setFieldError(input, "");
    return true;
}

function validateNumber(input, message) {
    const value = Number(input.value);

    if (!input.value.trim() || !Number.isFinite(value) || value <= 0) {
        setFieldError(input, message);
        return false;
    }

    setFieldError(input, "");
    return true;
}

function validatePricing() {
    let isValid = true;

    const startingBidInput = document.querySelector("[data-starting-bid]");
    const reservePriceInput = document.querySelector("[data-reserve-price]");
    const bidIncrementInput = document.querySelector("[data-bid-increment]");
    const buyerPremiumInput = document.querySelector("[data-buyer-premium]");
    const estimateLowInput = document.querySelector("[data-estimate-low]");
    const estimateHighInput = document.querySelector("[data-estimate-high]");

    if (!validateNumber(startingBidInput, "Starting bid is required.")) {
        isValid = false;
    }

    if (!validateNumber(reservePriceInput, "Reserve price is required.")) {
        isValid = false;
    }

    if (!validateNumber(bidIncrementInput, "Bid increment is required.")) {
        isValid = false;
    }

    if (!validateNumber(buyerPremiumInput, "Buyer premium is required.")) {
        isValid = false;
    }

    if (!validateNumber(estimateLowInput, "Estimate low is required.")) {
        isValid = false;
    }

    if (!validateNumber(estimateHighInput, "Estimate high is required.")) {
        isValid = false;
    }

    const estimateLow = Number(estimateLowInput.value);
    const estimateHigh = Number(estimateHighInput.value);
    const startingBid = Number(startingBidInput.value);
    const reservePrice = Number(reservePriceInput.value);

    if (Number.isFinite(estimateLow) && Number.isFinite(estimateHigh) && estimateHigh <= estimateLow) {
        setFieldError(estimateHighInput, "Estimate high must be greater than estimate low.");
        isValid = false;
    }

    if (Number.isFinite(startingBid) && Number.isFinite(reservePrice) && reservePrice < startingBid) {
        setFieldError(reservePriceInput, "Reserve should be equal to or greater than starting bid.");
        isValid = false;
    }

    return isValid;
}

function validateForm() {
    let isValid = true;

    const requiredSelectors = [
        ["[data-lot-number]", "Lot number is required."],
        ["[data-lot-status]", "Publishing status is required."],
        ["[data-lot-title]", "Lot title is required."],
        ["[data-lot-category]", "Category is required."],
        ["[data-lot-specialist]", "Specialist is required."],
        ["[data-lot-description]", "Description is required."],
        ["[data-start-date]", "Start date is required."],
        ["[data-start-time]", "Start time is required."],
        ["[data-duration]", "Duration is required."]
    ];

    requiredSelectors.forEach(([selector, message]) => {
        const input = document.querySelector(selector);

        if (!input) {
            return;
        }

        if (!validateRequired(input, message)) {
            isValid = false;
        }
    });

    if (!validatePricing()) {
        isValid = false;
    }

    const reviewChecks = Array.from(document.querySelectorAll("[data-review-check]"));
    const reviewError = document.querySelector("[data-review-error]");
    const allChecked = reviewChecks.every((input) => input.checked);

    if (!allChecked) {
        if (reviewError) {
            reviewError.textContent = "All final review confirmations are required before publishing.";
        }

        isValid = false;
    } else if (reviewError) {
        reviewError.textContent = "";
    }

    return isValid;
}

function updateReadiness() {
    const requiredInputs = [
        "[data-lot-number]",
        "[data-lot-status]",
        "[data-lot-title]",
        "[data-lot-category]",
        "[data-lot-specialist]",
        "[data-lot-description]",
        "[data-starting-bid]",
        "[data-reserve-price]",
        "[data-bid-increment]",
        "[data-buyer-premium]",
        "[data-estimate-low]",
        "[data-estimate-high]",
        "[data-start-date]",
        "[data-start-time]",
        "[data-duration]"
    ];

    const filledCount = requiredInputs.filter((selector) => {
        const element = document.querySelector(selector);
        return element && element.value.trim();
    }).length;

    const reviewChecks = Array.from(document.querySelectorAll("[data-review-check]"));
    const checkedCount = reviewChecks.filter((input) => input.checked).length;

    const total = requiredInputs.length + reviewChecks.length;
    const current = filledCount + checkedCount;
    const percentage = Math.round((current / total) * 100);

    const bar = document.querySelector("[data-readiness-bar]");
    const label = document.querySelector("[data-readiness-label]");

    if (bar) {
        bar.style.width = `${percentage}%`;
    }

    if (label) {
        if (percentage === 100) {
            label.textContent = "Ready to publish.";
        } else {
            label.textContent = `${percentage}% complete. Finish required fields and review checks.`;
        }
    }
}

function handleSubmit(event) {
    event.preventDefault();

    if (!validateForm()) {
        showToast("Publish Blocked", "Please complete all required configuration and review checks.");
        updateReadiness();
        return;
    }

    showToast("Lot Published", "Auction lot mock has been published. Redirecting to Live Auctions.");

    window.setTimeout(() => {
        window.location.href = "./live-auctions.html";
    }, 950);
}

function bindPreviewEvents() {
    const watchedSelectors = [
        "[data-lot-number]",
        "[data-lot-status]",
        "[data-lot-title]",
        "[data-lot-category]",
        "[data-lot-specialist]",
        "[data-lot-description]",
        "[data-starting-bid]",
        "[data-reserve-price]",
        "[data-bid-increment]",
        "[data-buyer-premium]",
        "[data-estimate-low]",
        "[data-estimate-high]",
        "[data-duration]",
        "[data-start-date]",
        "[data-start-time]"
    ];

    watchedSelectors.forEach((selector) => {
        const input = document.querySelector(selector);

        if (!input) {
            return;
        }

        input.addEventListener("input", updatePreview);
        input.addEventListener("change", updatePreview);
    });

    document.querySelectorAll("[data-review-check]").forEach((input) => {
        input.addEventListener("change", updateReadiness);
    });
}

function bindActions() {
    const form = document.querySelector("[data-publish-form]");
    const saveDraftButton = document.querySelector("[data-save-publish-draft]");
    const previewButton = document.querySelector("[data-preview-publish]");

    if (form) {
        form.addEventListener("submit", handleSubmit);
    }

    if (saveDraftButton) {
        saveDraftButton.addEventListener("click", () => {
            showToast("Draft Saved", "Auction configuration draft saved as UI mock.");
        });
    }

    if (previewButton) {
        previewButton.addEventListener("click", () => {
            updatePreview();
            showToast("Preview Updated", "Auction preview has been refreshed.");
        });
    }
}

function initPublishLotPage() {
    initTheme();
    initI18n();

    initSiteHeader({
        hideAfter: 120,
        topRevealOffset: 12
    });

    updateDefaultStartDate();
    bindPreviewEvents();
    bindActions();
    updatePreview();
}

document.addEventListener("DOMContentLoaded", initPublishLotPage);
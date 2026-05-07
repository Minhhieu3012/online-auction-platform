import { initTheme } from "../core/theme.js";
import { initI18n } from "../core/i18n.js";
import { initSiteHeader } from "../core/header.js";

const INVOICE = {
    hammerPrice: 285000,
    buyerPremiumRate: 0.125,
    processingFee: 1250
};

const DELIVERY_COSTS = {
    insured: 2400,
    vault: 950,
    pickup: 0
};

function formatCurrency(value) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0
    }).format(value);
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

function getSelectedDelivery() {
    const selectedInput = document.querySelector("[data-delivery-input]:checked");
    return selectedInput?.value || "insured";
}

function calculateSummary() {
    const delivery = getSelectedDelivery();
    const shipping = DELIVERY_COSTS[delivery] || 0;
    const buyerPremium = INVOICE.hammerPrice * INVOICE.buyerPremiumRate;
    const total = INVOICE.hammerPrice + buyerPremium + shipping + INVOICE.processingFee;

    return {
        shipping,
        buyerPremium,
        total
    };
}

function setText(selector, value) {
    const element = document.querySelector(selector);

    if (element) {
        element.textContent = value;
    }
}

function updateSummary() {
    const summary = calculateSummary();

    setText("[data-hammer-price-label]", formatCurrency(INVOICE.hammerPrice));
    setText("[data-summary-hammer]", formatCurrency(INVOICE.hammerPrice));
    setText("[data-summary-premium]", formatCurrency(summary.buyerPremium));
    setText("[data-summary-shipping]", formatCurrency(summary.shipping));
    setText("[data-summary-processing]", formatCurrency(INVOICE.processingFee));
    setText("[data-summary-total]", formatCurrency(summary.total));
    setText("[data-premium-rate-label]", `${INVOICE.buyerPremiumRate * 100}%`);
}

function updateSelectableCards(groupSelector, inputSelector) {
    document.querySelectorAll(groupSelector).forEach((card) => {
        const input = card.querySelector(inputSelector);
        card.classList.toggle("is-selected", Boolean(input?.checked));
    });
}

function bindSelectableCards() {
    document.querySelectorAll("[data-delivery-input]").forEach((input) => {
        input.addEventListener("change", () => {
            updateSelectableCards("[data-delivery-option]", "[data-delivery-input]");
            updateSummary();
        });
    });

    document.querySelectorAll("[data-payment-input]").forEach((input) => {
        input.addEventListener("change", () => {
            updateSelectableCards("[data-payment-method]", "[data-payment-input]");
        });
    });

    updateSelectableCards("[data-delivery-option]", "[data-delivery-input]");
    updateSelectableCards("[data-payment-method]", "[data-payment-input]");
}

function setFieldError(input, message) {
    const field = input.closest(".checkout-field");
    const errorElement = field?.querySelector("[data-field-error]");

    if (!field || !errorElement) {
        return;
    }

    field.classList.toggle("has-error", Boolean(message));
    errorElement.textContent = message || "";
}

function isEmailValid(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validateRequired(input, message) {
    if (!input.value.trim()) {
        setFieldError(input, message);
        return false;
    }

    setFieldError(input, "");
    return true;
}

function validateCheckoutForm(form) {
    let isValid = true;

    const nameInput = form.querySelector("[data-billing-name]");
    const emailInput = form.querySelector("[data-billing-email]");
    const phoneInput = form.querySelector("[data-billing-phone]");
    const countryInput = form.querySelector("[data-billing-country]");
    const addressInput = form.querySelector("[data-billing-address]");
    const confirmInput = form.querySelector("[data-payment-confirm]");
    const confirmError = form.querySelector("[data-confirm-error]");

    if (!validateRequired(nameInput, "Full name is required.")) {
        isValid = false;
    }

    if (!emailInput.value.trim()) {
        setFieldError(emailInput, "Email is required.");
        isValid = false;
    } else if (!isEmailValid(emailInput.value.trim())) {
        setFieldError(emailInput, "Please enter a valid email.");
        isValid = false;
    } else {
        setFieldError(emailInput, "");
    }

    if (!validateRequired(phoneInput, "Phone is required.")) {
        isValid = false;
    }

    if (!validateRequired(countryInput, "Country is required.")) {
        isValid = false;
    }

    if (!validateRequired(addressInput, "Billing address is required.")) {
        isValid = false;
    }

    if (!confirmInput.checked) {
        confirmError.textContent = "You must confirm the settlement terms before payment.";
        isValid = false;
    } else {
        confirmError.textContent = "";
    }

    return isValid;
}

function completePayment() {
    const status = document.querySelector("[data-payment-status]");
    const successCard = document.querySelector("[data-success-card]");
    const payButton = document.querySelector("[data-pay-button]");
    const paymentTimeline = document.querySelector("[data-timeline-payment]");
    const verificationTimeline = document.querySelector("[data-timeline-verification]");

    if (status) {
        status.textContent = "Paid";
    }

    if (successCard) {
        successCard.hidden = false;
    }

    if (payButton) {
        payButton.textContent = "Paid";
        payButton.disabled = true;
        payButton.style.opacity = "0.72";
    }

    paymentTimeline?.classList.remove("is-current");
    paymentTimeline?.classList.add("is-complete");
    verificationTimeline?.classList.add("is-current");

    showToast("Payment Confirmed", "Settlement mock completed. The invoice moved to funds verification.");
}

function handleSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;

    if (!validateCheckoutForm(form)) {
        showToast("Payment Blocked", "Please complete billing details and settlement confirmation.");
        return;
    }

    completePayment();
}

function bindActions() {
    const form = document.querySelector("[data-checkout-form]");
    const invoiceButton = document.querySelector("[data-download-invoice]");

    if (form) {
        form.addEventListener("submit", handleSubmit);
    }

    if (invoiceButton) {
        invoiceButton.addEventListener("click", () => {
            showToast("Invoice Prepared", "Invoice PDF export is mocked for now.");
        });
    }
}

function initCheckoutPage() {
    initTheme();
    initI18n();

    initSiteHeader({
        hideAfter: 120,
        topRevealOffset: 12
    });

    bindSelectableCards();
    bindActions();
    updateSummary();
}

document.addEventListener("DOMContentLoaded", initCheckoutPage);

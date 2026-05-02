import { initTheme } from "../core/theme.js";
import { initI18n } from "../core/i18n.js";
import { initSiteHeader } from "../core/header.js";

const state = {
    step: "email",
    email: "",
    resetCode: "BG-2048"
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

function setFieldError(input, message) {
    const field = input.closest(".forgot-field");
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

function setStep(nextStep) {
    state.step = nextStep;

    document.querySelectorAll("[data-forgot-step]").forEach((stepElement) => {
        stepElement.classList.toggle("is-active", stepElement.dataset.forgotStep === nextStep);
    });

    const description = document.querySelector("[data-step-description]");

    if (!description) {
        return;
    }

    if (nextStep === "email") {
        description.textContent = "Enter your account email. We will send a secure reset instruction.";
    }

    if (nextStep === "reset") {
        description.textContent = `Reset instructions were prepared for ${state.email}. Enter your new password below.`;
    }

    if (nextStep === "success") {
        description.textContent = "Your password has been reset successfully in this frontend mock flow.";
    }
}

function validateEmailStep() {
    const emailInput = document.querySelector("[data-recovery-email]");

    if (!emailInput) {
        return false;
    }

    const email = emailInput.value.trim();

    if (!email) {
        setFieldError(emailInput, "Email is required.");
        return false;
    }

    if (!isEmailValid(email)) {
        setFieldError(emailInput, "Please enter a valid email.");
        return false;
    }

    setFieldError(emailInput, "");
    state.email = email;

    return true;
}

function getPasswordStrength(password) {
    let score = 0;

    if (password.length >= 8) {
        score += 1;
    }

    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) {
        score += 1;
    }

    if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) {
        score += 1;
    }

    if (score <= 1) {
        return "weak";
    }

    if (score === 2) {
        return "medium";
    }

    return "strong";
}

function updatePasswordStrength() {
    const passwordInput = document.querySelector("[data-new-password]");
    const strengthElement = document.querySelector("[data-password-strength]");

    if (!passwordInput || !strengthElement) {
        return;
    }

    const password = passwordInput.value;

    if (!password) {
        strengthElement.removeAttribute("data-strength");
        return;
    }

    strengthElement.dataset.strength = getPasswordStrength(password);
}

function validateResetStep() {
    const passwordInput = document.querySelector("[data-new-password]");
    const confirmPasswordInput = document.querySelector("[data-confirm-new-password]");

    if (!passwordInput || !confirmPasswordInput) {
        return false;
    }

    const password = passwordInput.value.trim();
    const confirmPassword = confirmPasswordInput.value.trim();
    let isValid = true;

    if (!password) {
        setFieldError(passwordInput, "New password is required.");
        isValid = false;
    } else if (password.length < 8) {
        setFieldError(passwordInput, "Password must be at least 8 characters.");
        isValid = false;
    } else {
        setFieldError(passwordInput, "");
    }

    if (!confirmPassword) {
        setFieldError(confirmPasswordInput, "Please confirm your new password.");
        isValid = false;
    } else if (password !== confirmPassword) {
        setFieldError(confirmPasswordInput, "Passwords do not match.");
        isValid = false;
    } else {
        setFieldError(confirmPasswordInput, "");
    }

    return isValid;
}

function handleSubmit(event) {
    event.preventDefault();

    if (state.step === "email") {
        if (!validateEmailStep()) {
            showToast("Recovery Blocked", "Please enter a valid account email.");
            return;
        }

        const resetCodeElement = document.querySelector("[data-reset-code]");

        if (resetCodeElement) {
            resetCodeElement.textContent = state.resetCode;
        }

        showToast("Reset Link Sent", "Mock reset instruction has been prepared.");
        setStep("reset");
        return;
    }

    if (state.step === "reset") {
        if (!validateResetStep()) {
            showToast("Reset Blocked", "Please check your new password fields.");
            return;
        }

        showToast("Password Updated", "Your password has been reset in this frontend mock.");
        setStep("success");
    }
}

function bindPasswordToggles() {
    document.querySelectorAll("[data-password-toggle]").forEach((button) => {
        button.addEventListener("click", () => {
            const targetId = button.dataset.passwordTarget;
            const input = document.getElementById(targetId);

            if (!input) {
                return;
            }

            const shouldShow = input.type === "password";
            input.type = shouldShow ? "text" : "password";
            button.textContent = shouldShow ? "HIDE" : "SHOW";
            button.setAttribute("aria-label", shouldShow ? "Hide password" : "Show password");
        });
    });
}

function bindEvents() {
    const form = document.querySelector("[data-forgot-form]");
    const passwordInput = document.querySelector("[data-new-password]");

    if (form) {
        form.addEventListener("submit", handleSubmit);
    }

    if (passwordInput) {
        passwordInput.addEventListener("input", updatePasswordStrength);
    }

    bindPasswordToggles();
}

function initForgotPasswordPage() {
    initTheme();
    initI18n();

    initSiteHeader({
        hideAfter: 120,
        topRevealOffset: 12
    });

    bindEvents();
    setStep("email");
}

document.addEventListener("DOMContentLoaded", initForgotPasswordPage);
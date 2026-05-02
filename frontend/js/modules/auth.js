import { initTheme } from "../core/theme.js";
import { initI18n } from "../core/i18n.js";
import { initSiteHeader } from "../core/header.js";

function getToastStack() {
    return document.querySelector("[data-toast-stack]");
}

function showToast(title, message) {
    const toastStack = getToastStack();

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

function redirectToAccount() {
    window.setTimeout(() => {
        window.location.href = "./account.html";
    }, 900);
}

function setFieldError(input, message) {
    const field = input.closest(".auth-field");
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

    return Math.min(score, 3);
}

function updatePasswordStrength() {
    const passwordInput = document.querySelector("[data-auth-password]");
    const strengthElement = document.querySelector("[data-password-strength]");

    if (!passwordInput || !strengthElement) {
        return;
    }

    const strength = getPasswordStrength(passwordInput.value);
    strengthElement.dataset.strength = String(strength);
}

function validateLoginForm(form) {
    let isValid = true;

    const emailInput = form.querySelector("[data-auth-email]");
    const passwordInput = form.querySelector("[data-auth-password]");

    if (!emailInput.value.trim()) {
        setFieldError(emailInput, "Email is required.");
        isValid = false;
    } else if (!isEmailValid(emailInput.value.trim())) {
        setFieldError(emailInput, "Please enter a valid email address.");
        isValid = false;
    } else {
        setFieldError(emailInput, "");
    }

    if (!passwordInput.value.trim()) {
        setFieldError(passwordInput, "Password is required.");
        isValid = false;
    } else {
        setFieldError(passwordInput, "");
    }

    return isValid;
}

function validateRegisterForm(form) {
    let isValid = true;

    const nameInput = form.querySelector("[data-auth-name]");
    const usernameInput = form.querySelector("[data-auth-username]");
    const emailInput = form.querySelector("[data-auth-email]");
    const passwordInput = form.querySelector("[data-auth-password]");
    const confirmPasswordInput = form.querySelector("[data-auth-confirm-password]");
    const termsInput = form.querySelector("[data-auth-terms]");
    const termsError = form.querySelector("[data-terms-error]");

    if (!nameInput.value.trim()) {
        setFieldError(nameInput, "Full name is required.");
        isValid = false;
    } else {
        setFieldError(nameInput, "");
    }

    if (!usernameInput.value.trim()) {
        setFieldError(usernameInput, "Username is required.");
        isValid = false;
    } else {
        setFieldError(usernameInput, "");
    }

    if (!emailInput.value.trim()) {
        setFieldError(emailInput, "Email is required.");
        isValid = false;
    } else if (!isEmailValid(emailInput.value.trim())) {
        setFieldError(emailInput, "Please enter a valid email address.");
        isValid = false;
    } else {
        setFieldError(emailInput, "");
    }

    if (!passwordInput.value.trim()) {
        setFieldError(passwordInput, "Password is required.");
        isValid = false;
    } else if (getPasswordStrength(passwordInput.value) < 2) {
        setFieldError(passwordInput, "Use at least 8 characters with mixed letters or numbers.");
        isValid = false;
    } else {
        setFieldError(passwordInput, "");
    }

    if (!confirmPasswordInput.value.trim()) {
        setFieldError(confirmPasswordInput, "Please confirm your password.");
        isValid = false;
    } else if (confirmPasswordInput.value !== passwordInput.value) {
        setFieldError(confirmPasswordInput, "Passwords do not match.");
        isValid = false;
    } else {
        setFieldError(confirmPasswordInput, "");
    }

    if (!termsInput.checked) {
        termsError.textContent = "You must agree before creating an account.";
        isValid = false;
    } else {
        termsError.textContent = "";
    }

    return isValid;
}

function handleAuthSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const mode = form.dataset.authMode;

    if (mode === "login") {
        if (!validateLoginForm(form)) {
            showToast("Check your information", "Some sign-in fields need attention.");
            return;
        }

        showToast("Signed in successfully", "Redirecting to your member dashboard.");
        redirectToAccount();
        return;
    }

    if (!validateRegisterForm(form)) {
        showToast("Registration incomplete", "Please review the highlighted fields.");
        return;
    }

    showToast(
        "Account created",
        "Unified member account mock created. Redirecting to dashboard."
    );

    redirectToAccount();
}

function initPasswordToggles() {
    document.querySelectorAll("[data-password-toggle]").forEach((button) => {
        button.addEventListener("click", () => {
            const targetId = button.dataset.passwordTarget;
            const input = document.getElementById(targetId);

            if (!input) {
                return;
            }

            const isHidden = input.type === "password";
            input.type = isHidden ? "text" : "password";

            button.textContent = isHidden ? "HIDE" : "SHOW";
            button.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
        });
    });
}

function initDemoButtons() {
    document.querySelectorAll("[data-fill-demo]").forEach((button) => {
        button.addEventListener("click", () => {
            const emailInput = document.querySelector("[data-auth-email]");
            const passwordInput = document.querySelector("[data-auth-password]");

            if (emailInput) {
                emailInput.value = button.dataset.email || "";
                setFieldError(emailInput, "");
            }

            if (passwordInput) {
                passwordInput.value = button.dataset.password || "";
                setFieldError(passwordInput, "");
            }

            showToast("Demo filled", "Credentials are ready for mock sign-in.");
        });
    });
}

function bindAuthEvents() {
    const form = document.querySelector("[data-auth-form]");
    const passwordInput = document.querySelector("[data-auth-password]");

    if (form) {
        form.addEventListener("submit", handleAuthSubmit);
    }

    if (passwordInput) {
        passwordInput.addEventListener("input", updatePasswordStrength);
        updatePasswordStrength();
    }

    initPasswordToggles();
    initDemoButtons();
}

function initAuthPage() {
    initTheme();
    initI18n();

    initSiteHeader({
        hideAfter: 120,
        topRevealOffset: 12
    });

    bindAuthEvents();
}

document.addEventListener("DOMContentLoaded", initAuthPage);
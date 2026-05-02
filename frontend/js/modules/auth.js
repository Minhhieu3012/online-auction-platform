import { initTheme } from "../core/theme.js";
import { initI18n } from "../core/i18n.js";
import { initSiteHeader } from "../core/header.js";

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

function validateEmail(input) {
    const email = input.value.trim();

    if (!email) {
        setFieldError(input, "Email is required.");
        return false;
    }

    if (!isEmailValid(email)) {
        setFieldError(input, "Please enter a valid email.");
        return false;
    }

    setFieldError(input, "");
    return true;
}

function validateRequired(input, message) {
    if (!input.value.trim()) {
        setFieldError(input, message);
        return false;
    }

    setFieldError(input, "");
    return true;
}

function validatePassword(input) {
    const password = input.value.trim();

    if (!password) {
        setFieldError(input, "Password is required.");
        return false;
    }

    if (password.length < 6) {
        setFieldError(input, "Password must be at least 6 characters.");
        return false;
    }

    setFieldError(input, "");
    return true;
}

function validateRegisterPassword(passwordInput, confirmPasswordInput) {
    const password = passwordInput.value.trim();
    const confirmPassword = confirmPasswordInput.value.trim();
    let isValid = true;

    if (!password) {
        setFieldError(passwordInput, "Password is required.");
        isValid = false;
    } else if (password.length < 8) {
        setFieldError(passwordInput, "Password must be at least 8 characters.");
        isValid = false;
    } else {
        setFieldError(passwordInput, "");
    }

    if (!confirmPassword) {
        setFieldError(confirmPasswordInput, "Please confirm your password.");
        isValid = false;
    } else if (password !== confirmPassword) {
        setFieldError(confirmPasswordInput, "Passwords do not match.");
        isValid = false;
    } else {
        setFieldError(confirmPasswordInput, "");
    }

    return isValid;
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
    const passwordInput = document.querySelector("[data-auth-password]");
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

function validateLoginForm(form) {
    const emailInput = form.querySelector("[data-auth-email]");
    const passwordInput = form.querySelector("[data-auth-password]");

    let isValid = true;

    if (!validateEmail(emailInput)) {
        isValid = false;
    }

    if (!validatePassword(passwordInput)) {
        isValid = false;
    }

    return isValid;
}

function validateRegisterForm(form) {
    const nameInput = form.querySelector("[data-auth-name]");
    const usernameInput = form.querySelector("[data-auth-username]");
    const emailInput = form.querySelector("[data-auth-email]");
    const passwordInput = form.querySelector("[data-auth-password]");
    const confirmPasswordInput = form.querySelector("[data-auth-confirm-password]");
    const termsInput = form.querySelector("[data-auth-terms]");
    const termsError = form.querySelector("[data-terms-error]");

    let isValid = true;

    if (!validateRequired(nameInput, "Full name is required.")) {
        isValid = false;
    }

    if (!validateRequired(usernameInput, "Username is required.")) {
        isValid = false;
    }

    if (!validateEmail(emailInput)) {
        isValid = false;
    }

    if (!validateRegisterPassword(passwordInput, confirmPasswordInput)) {
        isValid = false;
    }

    if (!termsInput.checked) {
        if (termsError) {
            termsError.textContent = "You must agree to continue.";
        }

        isValid = false;
    } else if (termsError) {
        termsError.textContent = "";
    }

    return isValid;
}

function handleLoginSubmit(form) {
    if (!validateLoginForm(form)) {
        showToast("Sign In Blocked", "Please check your email and password.");
        return;
    }

    showToast("Signed In", "Welcome back to your unified BrosGem member dashboard.");

    window.setTimeout(() => {
        window.location.href = "./account.html";
    }, 750);
}

function handleRegisterSubmit(form) {
    if (!validateRegisterForm(form)) {
        showToast("Registration Blocked", "Please complete all required fields.");
        return;
    }

    showToast("Account Created", "Your unified member account is ready for bidding and selling workflows.");

    window.setTimeout(() => {
        window.location.href = "./account.html";
    }, 750);
}

function bindAuthForms() {
    document.querySelectorAll("[data-auth-form]").forEach((form) => {
        form.addEventListener("submit", (event) => {
            event.preventDefault();

            const mode = form.dataset.authMode;

            if (mode === "login") {
                handleLoginSubmit(form);
                return;
            }

            if (mode === "register") {
                handleRegisterSubmit(form);
            }
        });
    });
}

function bindDemoFillButtons() {
    document.querySelectorAll("[data-fill-demo]").forEach((button) => {
        button.addEventListener("click", () => {
            const form = button.closest("[data-auth-form]");
            const emailInput = form?.querySelector("[data-auth-email]");
            const passwordInput = form?.querySelector("[data-auth-password]");

            if (emailInput) {
                emailInput.value = button.dataset.email || "member@brosgem.com";
                setFieldError(emailInput, "");
            }

            if (passwordInput) {
                passwordInput.value = button.dataset.password || "Member@123";
                setFieldError(passwordInput, "");
            }

            updatePasswordStrength();

            showToast("Demo Filled", "Unified member credentials have been filled.");
        });
    });
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

function bindPasswordStrength() {
    const passwordInput = document.querySelector("[data-auth-password]");

    if (!passwordInput) {
        return;
    }

    passwordInput.addEventListener("input", updatePasswordStrength);
}

function initAuthPage() {
    initTheme();
    initI18n();

    initSiteHeader({
        hideAfter: 120,
        topRevealOffset: 12
    });

    bindAuthForms();
    bindDemoFillButtons();
    bindPasswordToggles();
    bindPasswordStrength();
}

document.addEventListener("DOMContentLoaded", initAuthPage);
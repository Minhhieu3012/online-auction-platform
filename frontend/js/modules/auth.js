/**
 * Auth Module: Xử lý Đăng nhập & Xác thực
 * Đã sửa lỗi Endpoint 404 bằng cách đồng bộ lại đường dẫn API[cite: 3, 5]
 */

import { initTheme } from "../core/theme.js";
import { initI18n } from "../core/i18n.js";
import { initSiteHeader } from "../core/header.js";

function getToastStack() {
    return document.querySelector("[data-toast-stack]");
}

function showToast(title, message) {
    const toastStack = getToastStack();
    if (!toastStack) return;

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

    if (!field || !errorElement) return;

    field.classList.toggle("has-error", Boolean(message));
    errorElement.textContent = message || "";
}

function isEmailValid(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getPasswordStrength(password) {
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
    if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 1;
    return Math.min(score, 3);
}

function updatePasswordStrength() {
    const passwordInput = document.querySelector("[data-auth-password]");
    const strengthElement = document.querySelector("[data-password-strength]");

    if (!passwordInput || !strengthElement) return;

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

async function handleAuthSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const mode = form.dataset.authMode;
    const submitButton = form.querySelector('button[type="submit"]');

    if (mode === "login") {
        if (!validateLoginForm(form)) {
            showToast("Check your information", "Some sign-in fields need attention.");
            return;
        }

        const email = form.querySelector("[data-auth-email]").value.trim();
        const password = form.querySelector("[data-auth-password]").value;

        if (submitButton) {
            submitButton.disabled = true;
            var originalText = submitButton.textContent;
            submitButton.textContent = "Verifying...";
        }

        try {
            /**
             * FIX 404: Đổi từ '/v1/auth/login' thành '/auth/login' để khớp với Backend[cite: 3, 5]
             */
            const response = await window.apiClient.post('/auth/login', { email, password });

            if (response.success && response.token) {
                localStorage.setItem('jwt_token', response.token);
                if (response.user) {
                    localStorage.setItem('user_info', JSON.stringify(response.user));
                }

                showToast("Signed in successfully", "Redirecting to your member dashboard.");
                window.setTimeout(() => {
                    window.location.href = './product-detail.html?id=842';
                }, 1000);
            }
        } catch (error) {
            console.error('[Auth Error]:', error);
            // Hiển thị thông báo lỗi chi tiết từ Backend nếu có[cite: 3, 5]
            showToast("Sign-in failed", error.message || "Please check your credentials.");
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = originalText;
            }
        }
        return;
    }
}

function initPasswordToggles() {
    document.querySelectorAll("[data-password-toggle]").forEach((button) => {
        button.addEventListener("click", () => {
            const targetId = button.dataset.passwordTarget;
            const input = document.getElementById(targetId);
            if (!input) return;

            const isHidden = input.type === "password";
            input.type = isHidden ? "text" : "password";
            button.textContent = isHidden ? "HIDE" : "SHOW";
        });
    });
}

function initDemoButtons() {
    document.querySelectorAll("[data-fill-demo]").forEach((button) => {
        button.addEventListener("click", () => {
            const emailInput = document.querySelector("[data-auth-email]");
            const passwordInput = document.querySelector("[data-auth-password]");

            if (emailInput) emailInput.value = button.dataset.email || "";
            if (passwordInput) passwordInput.value = button.dataset.password || "";
            showToast("Demo filled", "Credentials are ready for sign-in.");
        });
    });
}

function bindAuthEvents() {
    const form = document.querySelector("[data-auth-form]");
    const passwordInput = document.querySelector("[data-auth-password]");

    if (form) form.addEventListener("submit", handleAuthSubmit);
    if (passwordInput) passwordInput.addEventListener("input", updatePasswordStrength);

    initPasswordToggles();
    initDemoButtons();
}

function initAuthPage() {
    initTheme();
    initI18n();
    initSiteHeader({ hideAfter: 120, topRevealOffset: 12 });
    bindAuthEvents();
}

document.addEventListener("DOMContentLoaded", initAuthPage);
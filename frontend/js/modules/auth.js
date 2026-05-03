/**
 * Auth Module: Xử lý Đăng nhập & Đăng ký
 * Đã hợp nhất: Giao diện & Validation của Frontend + Chuyển hướng trang chủ của Dev
 */

import { initTheme } from "../core/theme.js";
import { initI18n } from "../core/i18n.js";
import { initSiteHeader } from "../core/header.js";
import apiClient from "../core/api-client.js";

// --- HELPERS & UI FEEDBACK ---
function showToast(title, message) {
    const toastStack = document.querySelector("[data-toast-stack]");

    if (!toastStack) return;

    const toast = document.createElement("article");
    toast.className = "toast";
    toast.innerHTML = `<p class="toast-title">${title}</p><p class="toast-message">${message}</p>`;
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
    const field = input?.closest(".auth-field");
    const errorElement = field?.querySelector("[data-field-error]");

    if (!field || !errorElement) return;

    field.classList.toggle("has-error", Boolean(message));
    errorElement.textContent = message || "";
}

function setFormBusy(form, isBusy) {
    const submitButton = form.querySelector("[type='submit']");
    const controls = form.querySelectorAll("button, input, select, textarea");

    controls.forEach((control) => {
        control.disabled = isBusy;
    });

    if (!submitButton) return;

    if (isBusy) {
        submitButton.dataset.originalText = submitButton.textContent.trim();
        submitButton.textContent = "Processing...";
        return;
    }

    submitButton.textContent = submitButton.dataset.originalText || submitButton.textContent;
}

function getApiErrorMessage(error, fallbackMessage) {
    return error?.message || fallbackMessage;
}

// --- VALIDATION RULES ---
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

// --- PASSWORD STRENGTH ---
function getPasswordStrength(password) {
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
    if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 1;

    if (score <= 1) return "weak";
    if (score === 2) return "medium";
    return "strong";
}

function updatePasswordStrength() {
    const passwordInput = document.querySelector("[data-auth-password]");
    const strengthElement = document.querySelector("[data-password-strength]");

    if (!passwordInput || !strengthElement) return;

    const password = passwordInput.value;
    if (!password) {
        strengthElement.removeAttribute("data-strength");
        return;
    }

    strengthElement.dataset.strength = getPasswordStrength(password);
}

// --- FORM HANDLERS ---
function validateLoginForm(form) {
    const emailInput = form.querySelector("[data-auth-email]");
    const passwordInput = form.querySelector("[data-auth-password]");
    let isValid = true;

    if (!validateEmail(emailInput)) isValid = false;
    if (!validatePassword(passwordInput)) isValid = false;

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

    if (!validateRequired(nameInput, "Full name is required.")) isValid = false;
    if (!validateRequired(usernameInput, "Username is required.")) isValid = false;
    if (!validateEmail(emailInput)) isValid = false;
    if (!validateRegisterPassword(passwordInput, confirmPasswordInput)) isValid = false;

    if (!termsInput.checked) {
        if (termsError) termsError.textContent = "You must agree to continue.";
        isValid = false;
    } else if (termsError) {
        termsError.textContent = "";
    }

    return isValid;
}

async function handleLoginSubmit(form) {
    if (!validateLoginForm(form)) {
        showToast("Sign In Blocked", "Please check your email and password.");
        return;
    }

    const email = form.querySelector("[data-auth-email]").value.trim();
    const password = form.querySelector("[data-auth-password]").value.trim();

    setFormBusy(form, true);

    try {
        const response = await apiClient.post(
            "/auth/login",
            { email, password },
            { auth: false }
        );

        // Lấy dữ liệu từ cấu trúc của Backend thật
        const resultData = response.data || {};
        const token = response.token || resultData.token;
        const user = response.user || resultData.user;

        if (!token) {
            throw new Error("Backend did not return token.");
        }

        apiClient.setAuthToken(token);
        if (user) apiClient.setAuthUser(user);

        showToast("Signed In", response.message || "Welcome back to BrosGem.");

        // FIX CONFLICT: Sử dụng định tuyến trang chủ của nhánh Dev
        window.setTimeout(() => {
            window.location.href = "../index.html";
        }, 750);
    } catch (error) {
        showToast("Sign In Failed", getApiErrorMessage(error, "Email or password is incorrect."));
    } finally {
        setFormBusy(form, false);
    }
}

async function handleRegisterSubmit(form) {
    if (!validateRegisterForm(form)) {
        showToast("Registration Blocked", "Please complete all required fields.");
        return;
    }

    const fullName = form.querySelector("[data-auth-name]").value.trim();
    const username = form.querySelector("[data-auth-username]").value.trim();
    const email = form.querySelector("[data-auth-email]").value.trim();
    const password = form.querySelector("[data-auth-password]").value.trim();

    setFormBusy(form, true);

    try {
        // Gọi API đăng ký
        await apiClient.post(
            "/auth/register",
            { full_name: fullName, username, email, password },
            { auth: false }
        );

        // Đăng ký xong tự động đăng nhập (UX tốt từ nhánh Frontend)
        const loginResponse = await apiClient.post(
            "/auth/login",
            { email, password },
            { auth: false }
        );

        const resultData = loginResponse.data || {};
        const token = loginResponse.token || resultData.token;
        const user = loginResponse.user || resultData.user;

        if (!token) {
            throw new Error("Account created, but backend did not return login token.");
        }

        apiClient.setAuthToken(token);
        if (user) apiClient.setAuthUser(user);

        showToast("Account Created", "Your unified member account is ready.");

        // FIX CONFLICT: Chuyển hướng về trang chủ thay vì account
        window.setTimeout(() => {
            window.location.href = "../index.html";
        }, 850);
    } catch (error) {
        showToast("Registration Failed", getApiErrorMessage(error, "Cannot create account right now."));
    } finally {
        setFormBusy(form, false);
    }
}

// --- BINDING EVENTS ---
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
            showToast("Demo Filled", "Credentials have been filled. Make sure this user exists in your database.");
        });
    });
}

function bindPasswordToggles() {
    document.querySelectorAll("[data-password-toggle]").forEach((button) => {
        button.addEventListener("click", () => {
            const targetId = button.dataset.passwordTarget;
            const input = document.getElementById(targetId);

            if (!input) return;

            const shouldShow = input.type === "password";
            input.type = shouldShow ? "text" : "password";
            button.textContent = shouldShow ? "HIDE" : "SHOW";
            button.setAttribute("aria-label", shouldShow ? "Hide password" : "Show password");
        });
    });
}

function bindPasswordStrength() {
    const passwordInput = document.querySelector("[data-auth-password]");
    if (!passwordInput) return;

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
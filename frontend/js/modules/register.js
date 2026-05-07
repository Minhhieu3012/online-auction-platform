/**
 * Auth Module: Xử lý Đăng ký tài khoản
 * Kết hợp logic giao diện register.html và hệ thống apiClient[cite: 3, 5]
 */

import { initTheme } from "../core/theme.js";
import { initI18n } from "../core/i18n.js";
import { initSiteHeader } from "../core/header.js";

// --- HELPERS (Dùng chung bộ giao diện với Login) ---

function showToast(title, message) {
    const toastStack = document.querySelector("[data-toast-stack]");
    if (!toastStack) return;

    const toast = document.createElement("article");
    toast.className = "toast";
    toast.innerHTML = `
        <p class="toast-title">${title}</p>
        <p class="toast-message">${message}</p>
    `;
    toastStack.appendChild(toast);
    window.setTimeout(() => { toast.style.opacity = "0"; toast.remove(); }, 3800);
}

function setFieldError(input, message) {
    const field = input.closest(".auth-field");
    const errorElement = field?.querySelector("[data-field-error]");
    if (field && errorElement) {
        field.classList.toggle("has-error", Boolean(message));
        errorElement.textContent = message || "";
    }
}

// --- LOGIC ĐĂNG KÝ ---

async function handleRegisterSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const submitButton = form.querySelector('button[type="submit"]');

    // 1. Thu thập dữ liệu từ các trường
    const nameInput = form.querySelector("[data-auth-name]");
    const emailInput = form.querySelector("[data-auth-email]");
    const passwordInput = form.querySelector("[data-auth-password]");

    const payload = {
        full_name: nameInput.value.trim(),
        email: emailInput.value.trim(),
        password: passwordInput.value
    };

    // 2. Validation cơ bản
    if (!payload.full_name || !payload.email || !payload.password) {
        showToast("Registration incomplete", "Please fill in all required fields.");
        return;
    }

    if (submitButton) {
        submitButton.disabled = true;
        var originalText = submitButton.textContent;
        submitButton.textContent = "Creating Account...";
    }

    try {
        /**
         * 3. Gọi API Đăng ký[cite: 3]
         * Đường dẫn thường là /auth/register hoặc /users/register tùy Backend
         */
        const response = await window.apiClient.post('/auth/register', payload);

        if (response.success) {
            // 4. TỰ ĐỘNG ĐĂNG NHẬP SAU KHI ĐĂNG KÝ[cite: 3, 5]
            if (response.token) {
                localStorage.setItem('jwt_token', response.token);
                if (response.user) {
                    localStorage.setItem('user_info', JSON.stringify(response.user));
                }
            }

            showToast("Account Created!", "Welcome to BrosGem. Redirecting to auction...");
            
            window.setTimeout(() => {
                window.location.href = './product-detail.html?id=842';
            }, 1500);
        }
    } catch (error) {
        console.error('[Register Error]:', error);
        showToast("Registration failed", error.message || "An error occurred during sign up.");
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalText;
        }
    }
}

// --- KHỞI TẠO ---

function initRegisterPage() {
    initTheme();
    initI18n();
    initSiteHeader({ hideAfter: 120, topRevealOffset: 12 });

    const form = document.querySelector("[data-auth-form]");
    if (form) {
        form.addEventListener("submit", handleRegisterSubmit);
    }
}

document.addEventListener("DOMContentLoaded", initRegisterPage);
/**
 * Auth Module: Xử lý Đăng nhập & Đăng ký
 * Chuyển hướng về trang chủ index.html sau khi thành công
 */

import { initTheme } from "../core/theme.js";
import { initI18n } from "../core/i18n.js";
import { initSiteHeader } from "../core/header.js";

console.log("[Auth] Module đang khởi tạo...");

// --- HELPERS ---
function showToast(title, message) {
    const toastStack = document.querySelector("[data-toast-stack]");
    if (!toastStack) return;
    const toast = document.createElement("article");
    toast.className = "toast";
    toast.innerHTML = `<p class="toast-title">${title}</p><p class="toast-message">${message}</p>`;
    toastStack.appendChild(toast);
    window.setTimeout(() => { toast.style.opacity = "0"; toast.remove(); }, 3800);
}

// --- SUBMISSION ---[cite: 5]
async function handleAuthSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const mode = form.dataset.authMode;
    const submitButton = form.querySelector('button[type="submit"]');

    if (submitButton) {
        submitButton.disabled = true;
        submitButton.dataset.originalText = submitButton.textContent;
        submitButton.textContent = "Xác thực...";
    }

    try {
        if (mode === "login") {
            const email = form.querySelector("[data-auth-email]").value.trim();
            const password = form.querySelector("[data-auth-password]").value;

            const response = await window.apiClient.post('/auth/login', { email, password });

            const resultData = response.data || {};
            const token = response.token || resultData.token;

            if (response.success && token) {
                // 1. Lưu Token và thông tin vào LocalStorage[cite: 5]
                localStorage.setItem('jwt_token', token);
                if (resultData.user) {
                    localStorage.setItem('user_info', JSON.stringify(resultData.user));
                }
                
                showToast("Thành công", "Đang chuyển hướng về trang chủ...");
                
                // 2. Chuyển hướng về index.html[cite: 5]
                window.setTimeout(() => { 
                    window.location.href = '../index.html'; 
                }, 1000);
            } else {
                throw { message: response.message || "Email hoặc mật khẩu không đúng." };
            }
        } 
        else if (mode === "register") {
            const payload = {
                full_name: form.querySelector("[data-auth-name]").value.trim(),
                username: form.querySelector("[data-auth-username]").value.trim(),
                email: form.querySelector("[data-auth-email]").value.trim(),
                password: form.querySelector("[data-auth-password]").value
            };
            const response = await window.apiClient.post('/auth/register', payload);
            if (response.success) {
                showToast("Thành công", "Đã tạo tài khoản. Vui lòng đăng nhập.");
                window.setTimeout(() => { window.location.href = './login.html'; }, 1500);
            }
        }
    } catch (error) {
        console.error('[Auth Error]:', error);
        showToast("Thất bại", error.message || "Lỗi hệ thống.");
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = submitButton.dataset.originalText || "Sign In";
        }
    }
}

function bindEvents() {
    const form = document.querySelector("[data-auth-form]");
    if (form) form.addEventListener("submit", handleAuthSubmit);

    document.querySelectorAll("[data-password-toggle]").forEach(btn => {
        btn.addEventListener("click", () => {
            const input = document.getElementById(btn.dataset.passwordTarget);
            if (input) {
                const isHidden = input.type === "password";
                input.type = isHidden ? "text" : "password";
                btn.textContent = isHidden ? "HIDE" : "SHOW";
            }
        });
    });

    document.querySelectorAll("[data-fill-demo]").forEach(btn => {
        btn.addEventListener("click", () => {
            const email = document.querySelector("[data-auth-email]");
            const pass = document.querySelector("[data-auth-password]");
            if (email) email.value = btn.dataset.email || "";
            if (pass) pass.value = btn.dataset.password || "";
        });
    });
}

initTheme();
initI18n();
initSiteHeader({ hideAfter: 120, topRevealOffset: 12 });
bindEvents();
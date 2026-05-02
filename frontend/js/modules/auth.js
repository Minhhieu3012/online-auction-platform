/**
 * Auth Module: Xử lý Đăng nhập & Đăng ký
 * Đã sửa lỗi truy cập cấu trúc Data từ Backend
 */

import { initTheme } from "../core/theme.js";
import { initI18n } from "../core/i18n.js";
import { initSiteHeader } from "../core/header.js";

console.log("[Auth] Hệ thống đã sẵn sàng.");

function showToast(title, message) {
    const toastStack = document.querySelector("[data-toast-stack]");
    if (!toastStack) return;
    const toast = document.createElement("article");
    toast.className = "toast";
    toast.innerHTML = `<p class="toast-title">${title}</p><p class="toast-message">${message}</p>`;
    toastStack.appendChild(toast);
    window.setTimeout(() => { toast.style.opacity = "0"; toast.remove(); }, 3800);
}

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

            // SỬA LỖI TẠI ĐÂY: Kiểm tra trong response.data
            const resultData = response.data || {};
            const token = response.token || resultData.token;

            if (response.success && token) {
                // Lưu token và thông tin người dùng
                localStorage.setItem('jwt_token', token);
                if (resultData.user) {
                    localStorage.setItem('user_info', JSON.stringify(resultData.user));
                }
                
                showToast("Thành công", "Đang chuyển hướng vào hệ thống...");
                
                // Chuyển trang sau 1 giây
                window.setTimeout(() => { 
                    window.location.href = './product-detail.html?id=842'; 
                }, 1000);
            } else {
                throw { message: response.message || "Không nhận được mã xác thực từ server." };
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
        showToast("Thất bại", error.message || "Lỗi kết nối.");
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
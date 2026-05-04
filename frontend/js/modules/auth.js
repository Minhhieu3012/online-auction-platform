// frontend/js/modules/auth.js
/**
 * Auth Module: Xử lý Đăng nhập & Đăng ký
 * Đã hợp nhất: Giao diện & Validation của Frontend + Chuyển hướng trang chủ của Dev
 */

import { initTheme } from "../core/theme.js";
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
        submitButton.textContent = "Đang xử lý...";
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
        setFieldError(input, "Vui lòng nhập Email.");
        return false;
    }
    if (!isEmailValid(email)) {
        setFieldError(input, "Email không hợp lệ.");
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
        setFieldError(input, "Vui lòng nhập Mật khẩu.");
        return false;
    }
    if (password.length < 6) {
        setFieldError(input, "Mật khẩu phải có ít nhất 6 ký tự.");
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
        setFieldError(passwordInput, "Vui lòng nhập Mật khẩu.");
        isValid = false;
    } else if (password.length < 8) {
        setFieldError(passwordInput, "Mật khẩu phải có ít nhất 8 ký tự.");
        isValid = false;
    } else {
        setFieldError(passwordInput, "");
    }

    if (!confirmPassword) {
        setFieldError(confirmPasswordInput, "Vui lòng xác nhận mật khẩu.");
        isValid = false;
    } else if (password !== confirmPassword) {
        setFieldError(confirmPasswordInput, "Mật khẩu không khớp.");
        isValid = false;
    } else {
        setFieldError(confirmPasswordInput, "");
    }

    return isValid;
}

// --- PASSWORD STRENGTH (ĐÃ FIX LỖI) ---
function getPasswordStrength(password) {
    let score = 0;
    
    // Quy tắc check độ mạnh tiêu chuẩn thị trường
    if (password.length >= 6) score += 1;
    if (password.length >= 10) score += 1;
    if (/[a-z]/.test(password)) score += 1; // Có chữ thường
    if (/[A-Z]/.test(password)) score += 1; // Có chữ hoa
    if (/\d/.test(password)) score += 1;    // Có số
    if (/[^A-Za-z0-9]/.test(password)) score += 1; // Có ký tự đặc biệt

    if (score <= 2 || password.length < 6) {
        return { level: "weak", color: "#ef4444", text: "Yếu" };
    }
    if (score <= 4) {
        return { level: "medium", color: "#f59e0b", text: "Trung bình" };
    }
    return { level: "strong", color: "#10b981", text: "Mạnh" };
}

function updatePasswordStrength(event) {
    // 1. Xác định chính xác input đang được gõ thay vì querySelector tĩnh
    const passwordInput = event ? event.target : document.querySelector("[data-auth-password]");
    if (!passwordInput) return;

    // 2. Tìm container độ mạnh nằm TRONG CÙNG một form để tránh nhầm lẫn (ví dụ: login vs register)
    const form = passwordInput.closest("form");
    if (!form) return;

    const strengthContainer = form.querySelector("[data-password-strength]");
    if (!strengthContainer) return;

    const spans = strengthContainer.querySelectorAll("span");
    const textEl = strengthContainer.querySelector("small");
    const password = passwordInput.value;

    if (!password) {
        strengthContainer.removeAttribute("data-strength");
        spans.forEach(span => span.style.backgroundColor = ""); // Trả về màu CSS mặc định
        if (textEl) {
            textEl.textContent = "Độ mạnh mật khẩu";
            textEl.style.color = "";
        }
        return;
    }

    const strength = getPasswordStrength(password);
    strengthContainer.dataset.strength = strength.level;

    // 3. Ép màu sắc trực tiếp lên thanh bar (Bypass lỗi thiếu CSS)
    spans.forEach((span, index) => {
        span.style.transition = "background-color 0.3s ease";
        let shouldColor = false;

        if (strength.level === "weak" && index === 0) shouldColor = true;
        if (strength.level === "medium" && index <= 1) shouldColor = true;
        if (strength.level === "strong" && index <= 2) shouldColor = true;

        // Nếu thoả mãn điều kiện thì tô màu, nếu không thì trả về rỗng để CSS lo phần màu nền "trống"
        span.style.backgroundColor = shouldColor ? strength.color : ""; 
    });

    if (textEl) {
        textEl.textContent = `Độ mạnh: ${strength.text}`;
        textEl.style.color = strength.color;
    }
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

    if (!validateRequired(nameInput, "Vui lòng nhập Họ và tên.")) isValid = false;
    if (!validateRequired(usernameInput, "Vui lòng nhập Tên đăng nhập.")) isValid = false;
    if (!validateEmail(emailInput)) isValid = false;
    if (!validateRegisterPassword(passwordInput, confirmPasswordInput)) isValid = false;

    if (!termsInput.checked) {
        if (termsError) termsError.textContent = "Bạn phải đồng ý với điều khoản.";
        isValid = false;
    } else if (termsError) {
        termsError.textContent = "";
    }

    return isValid;
}

async function handleLoginSubmit(form) {
    if (!validateLoginForm(form)) {
        showToast("Lỗi Đăng Nhập", "Vui lòng kiểm tra lại email và mật khẩu.");
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

        const resultData = response.data || {};
        const token = response.token || resultData.token;
        const user = response.user || resultData.user;

        if (!token) {
            throw new Error("Máy chủ không trả về token.");
        }

        apiClient.setAuthToken(token);
        if (user) apiClient.setAuthUser(user);

        showToast("Đăng Nhập Thành Công", response.message || "Chào mừng trở lại BrosGem.");

        window.setTimeout(() => {
            window.location.href = "../index.html";
        }, 750);
    } catch (error) {
        showToast("Đăng Nhập Thất Bại", getApiErrorMessage(error, "Email hoặc mật khẩu không chính xác."));
    } finally {
        setFormBusy(form, false);
    }
}

async function handleRegisterSubmit(form) {
    if (!validateRegisterForm(form)) {
        showToast("Lỗi Đăng Ký", "Vui lòng điền đầy đủ các trường bắt buộc.");
        return;
    }

    const fullName = form.querySelector("[data-auth-name]").value.trim();
    const username = form.querySelector("[data-auth-username]").value.trim();
    const email = form.querySelector("[data-auth-email]").value.trim();
    const password = form.querySelector("[data-auth-password]").value.trim();

    setFormBusy(form, true);

    try {
        await apiClient.post(
            "/auth/register",
            { full_name: fullName, username, email, password },
            { auth: false }
        );

        const loginResponse = await apiClient.post(
            "/auth/login",
            { email, password },
            { auth: false }
        );

        const resultData = loginResponse.data || {};
        const token = loginResponse.token || resultData.token;
        const user = loginResponse.user || resultData.user;

        if (!token) {
            throw new Error("Tạo tài khoản thành công nhưng không lấy được token đăng nhập.");
        }

        apiClient.setAuthToken(token);
        if (user) apiClient.setAuthUser(user);

        showToast("Tạo Tài Khoản Thành Công", "Tài khoản thành viên đã sẵn sàng.");

        window.setTimeout(() => {
            window.location.href = "../index.html";
        }, 850);
    } catch (error) {
        showToast("Đăng Ký Thất Bại", getApiErrorMessage(error, "Không thể tạo tài khoản lúc này."));
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
                
                // Kích hoạt sự kiện input giả lập để thanh độ mạnh nhảy màu ngay khi bấm Demo Fill
                passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
            }

            showToast("Đã điền dữ liệu mẫu", "Vui lòng kiểm tra chắc chắn user này có trong Database.");
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
            button.textContent = shouldShow ? "ẨN" : "HIỆN";
            button.setAttribute("aria-label", shouldShow ? "Ẩn mật khẩu" : "Hiện mật khẩu");
        });
    });
}

function bindPasswordStrength() {
    // FIX BUG: Phải lặp qua tất cả các field nhập pass (kể cả forgot-password) để gắn sự kiện
    const passwordInputs = document.querySelectorAll("[data-auth-password], [data-new-password]");
    passwordInputs.forEach(input => {
        input.addEventListener("input", updatePasswordStrength);
    });
}

function initAuthPage() {
    initTheme();

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
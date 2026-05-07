import { initTheme } from "../core/theme.js";
import { initSiteHeader } from "../core/header.js";
import apiClient from "../core/api-client.js";

function showToast(title, message, type = "info") {
  const toastStack = document.querySelector("[data-toast-stack]");

  if (!toastStack) return;

  const toast = document.createElement("article");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <p class="toast-title">${title}</p>
    <p class="toast-message">${message}</p>
  `;

  toastStack.appendChild(toast);

  window.setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-6px)";
  }, 3200);

  window.setTimeout(() => toast.remove(), 3800);
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

function isEmailValid(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validateEmail(input) {
  const email = input?.value.trim() || "";

  if (!email) {
    setFieldError(input, "Vui lòng nhập email.");
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
  if (!input?.value.trim()) {
    setFieldError(input, message);
    return false;
  }

  setFieldError(input, "");
  return true;
}

function validatePassword(input, minLength = 8) {
  const password = input?.value.trim() || "";

  if (!password) {
    setFieldError(input, "Vui lòng nhập mật khẩu.");
    return false;
  }

  if (password.length < minLength) {
    setFieldError(input, `Mật khẩu phải có ít nhất ${minLength} ký tự.`);
    return false;
  }

  setFieldError(input, "");
  return true;
}

function validateRegisterPassword(passwordInput, confirmPasswordInput) {
  const password = passwordInput?.value.trim() || "";
  const confirmPassword = confirmPasswordInput?.value.trim() || "";

  let isValid = true;

  if (!validatePassword(passwordInput, 8)) {
    isValid = false;
  }

  if (!confirmPassword) {
    setFieldError(confirmPasswordInput, "Vui lòng xác nhận mật khẩu.");
    isValid = false;
  } else if (password !== confirmPassword) {
    setFieldError(confirmPasswordInput, "Mật khẩu xác nhận không khớp.");
    isValid = false;
  } else {
    setFieldError(confirmPasswordInput, "");
  }

  return isValid;
}

function getPasswordStrength(password) {
  let score = 0;

  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 2 || password.length < 8) {
    return { level: "weak", color: "#ef4444", text: "Yếu" };
  }

  if (score <= 4) {
    return { level: "medium", color: "#f59e0b", text: "Trung bình" };
  }

  return { level: "strong", color: "#10b981", text: "Mạnh" };
}

function updatePasswordStrength(event) {
  const passwordInput = event?.target;
  if (!passwordInput) return;

  const form = passwordInput.closest("form");
  const strengthContainer = form?.querySelector("[data-password-strength]");

  if (!strengthContainer) return;

  const spans = strengthContainer.querySelectorAll("span");
  const textElement = strengthContainer.querySelector("small");
  const strength = getPasswordStrength(passwordInput.value || "");

  if (!passwordInput.value) {
    strengthContainer.removeAttribute("data-strength");
    spans.forEach((span) => {
      span.style.backgroundColor = "";
    });

    if (textElement) {
      textElement.textContent = "Độ mạnh mật khẩu";
      textElement.style.color = "";
    }

    return;
  }

  strengthContainer.dataset.strength = strength.level;

  spans.forEach((span, index) => {
    let shouldColor = false;

    if (strength.level === "weak" && index === 0) shouldColor = true;
    if (strength.level === "medium" && index <= 1) shouldColor = true;
    if (strength.level === "strong" && index <= 2) shouldColor = true;

    span.style.transition = "background-color 0.3s ease";
    span.style.backgroundColor = shouldColor ? strength.color : "";
  });

  if (textElement) {
    textElement.textContent = `Độ mạnh: ${strength.text}`;
    textElement.style.color = strength.color;
  }
}

function validateLoginForm(form) {
  const emailInput = form.querySelector("[data-auth-email]");
  const passwordInput = form.querySelector("[data-auth-password]");

  let isValid = true;

  if (!validateEmail(emailInput)) isValid = false;
  if (!validatePassword(passwordInput, 8)) isValid = false;

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

  if (!validateRequired(nameInput, "Vui lòng nhập họ và tên.")) isValid = false;
  if (!validateRequired(usernameInput, "Vui lòng nhập tên đăng nhập.")) isValid = false;
  if (!validateEmail(emailInput)) isValid = false;
  if (!validateRegisterPassword(passwordInput, confirmPasswordInput)) isValid = false;

  if (!termsInput?.checked) {
    if (termsError) termsError.textContent = "Bạn cần đồng ý với điều khoản để tiếp tục.";
    isValid = false;
  } else if (termsError) {
    termsError.textContent = "";
  }

  return isValid;
}

function getRedirectTarget(defaultTarget = "../index.html") {
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get("redirect");

  if (!redirect) return defaultTarget;

  try {
    const decoded = decodeURIComponent(redirect);

    if (decoded.startsWith("http://") || decoded.startsWith("https://")) {
      return defaultTarget;
    }

    return decoded;
  } catch {
    return defaultTarget;
  }
}

function getDefaultTargetForUser(user) {
  if (user?.role === "admin") {
    return "./admin.html";
  }

  return "../index.html";
}

async function persistSessionFromResponse(response) {
  const data = response?.data || {};
  const token = response?.token || data.token;
  const user = response?.user || data.user;

  if (!token || !user) {
    throw new Error("Máy chủ không trả về token hoặc thông tin người dùng.");
  }

  apiClient.setAuthToken(token);
  apiClient.setAuthUser(user);

  return user;
}

async function handleLoginSubmit(form) {
  if (!validateLoginForm(form)) {
    showToast("Không thể đăng nhập", "Vui lòng kiểm tra lại email và mật khẩu.", "error");
    return;
  }

  const email = form.querySelector("[data-auth-email]").value.trim();
  const password = form.querySelector("[data-auth-password]").value.trim();

  setFormBusy(form, true);

  try {
    const response = await apiClient.post(
      "/auth/login",
      { email, password },
      {
        auth: false,
        redirectOnUnauthorized: false,
      },
    );

    const user = await persistSessionFromResponse(response);

    showToast("Đăng nhập thành công", response.message || "Chào mừng bạn quay lại BrosGem.", "success");

    window.setTimeout(() => {
      window.location.href = getRedirectTarget(getDefaultTargetForUser(user));
    }, 650);
  } catch (error) {
    showToast("Đăng nhập thất bại", getApiErrorMessage(error, "Email hoặc mật khẩu không chính xác."), "error");
  } finally {
    setFormBusy(form, false);
  }
}

async function handleRegisterSubmit(form) {
  if (!validateRegisterForm(form)) {
    showToast("Không thể đăng ký", "Vui lòng điền đầy đủ các trường bắt buộc.", "error");
    return;
  }

  const username = form.querySelector("[data-auth-username]").value.trim();
  const email = form.querySelector("[data-auth-email]").value.trim();
  const password = form.querySelector("[data-auth-password]").value.trim();

  setFormBusy(form, true);

  try {
    const response = await apiClient.post(
      "/auth/register",
      {
        username,
        email,
        password,
      },
      {
        auth: false,
        redirectOnUnauthorized: false,
      },
    );

    const user = await persistSessionFromResponse(response);

    showToast("Tạo tài khoản thành công", "Tài khoản thành viên đã sẵn sàng.", "success");

    window.setTimeout(() => {
      window.location.href = getRedirectTarget(getDefaultTargetForUser(user));
    }, 750);
  } catch (error) {
    showToast("Đăng ký thất bại", getApiErrorMessage(error, "Không thể tạo tài khoản lúc này."), "error");
  } finally {
    setFormBusy(form, false);
  }
}

function bindAuthForms() {
  document.querySelectorAll("[data-auth-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();

      if (form.dataset.authMode === "login") {
        handleLoginSubmit(form);
        return;
      }

      if (form.dataset.authMode === "register") {
        handleRegisterSubmit(form);
      }
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
  document.querySelectorAll("[data-auth-password], [data-new-password]").forEach((input) => {
    input.addEventListener("input", updatePasswordStrength);
  });
}

function initAuthPage() {
  initTheme();

  initSiteHeader({
    hideAfter: 120,
    topRevealOffset: 12,
  });

  bindAuthForms();
  bindPasswordToggles();
  bindPasswordStrength();
}

document.addEventListener("DOMContentLoaded", initAuthPage);

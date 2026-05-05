import { initTheme } from "../core/theme.js";
import { initI18n } from "../core/i18n.js";
import { initSiteHeader } from "../core/header.js";
import apiClient from "../core/api-client.js";

// Khởi tạo mảng lưu File thật để gửi lên Server
window.uploadedFiles = [];
// Khởi tạo mảng Base64 chỉ để hiển thị Thumbnail nhanh trên giao diện
window.previewImages = [];

const CATEGORY_IMAGE_MAP = {
  Jewelry: "../assets/images/mockdata/4.png",
  Horology: "../assets/images/mockdata/1.png",
  "Fine Art": "../assets/images/mockdata/2.png",
  Automotive: "../assets/images/mockdata/3.png",
  Collectibles: "../assets/images/mockdata/5.png",
};

function formatCurrency(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    number,
  );
}

function showToast(title, message) {
  const toastStack = document.querySelector("[data-toast-stack]");
  if (!toastStack) return;
  const toast = document.createElement("article");
  toast.className = "toast";
  toast.innerHTML = `<p class="toast-title">${title}</p><p class="toast-message">${message}</p>`;
  toastStack.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-6px)";
  }, 3200);
  setTimeout(() => toast.remove(), 3800);
}

function setFieldError(input, message) {
  const field = input?.closest(".publish-field");
  const errorElement = field?.querySelector("[data-field-error]");
  if (!field || !errorElement) return;
  field.classList.toggle("has-error", Boolean(message));
  errorElement.textContent = message || "";
}

function setFormBusy(form, isBusy) {
  const controls = form.querySelectorAll("button, input, select, textarea");
  const submitButton = form.querySelector("[type='submit']");
  controls.forEach((c) => (c.disabled = isBusy));
  if (!submitButton) return;
  if (isBusy) {
    submitButton.dataset.originalText = submitButton.textContent.trim();
    submitButton.textContent = "Đang xử lý...";
    return;
  }
  submitButton.textContent = submitButton.dataset.originalText || "Xuất Bản Lên Sàn";
}

function requireLogin() {
  const token = apiClient.getAuthToken();
  const user = apiClient.getAuthUser();
  if (!token || !user) {
    showToast("Yêu cầu đăng nhập", "Bạn cần đăng nhập để tạo phiên đấu giá.");
    setTimeout(() => {
      window.location.href = "./login.html?redirect=publish-lot";
    }, 700);
    return false;
  }
  return true;
}

function getValue(selector) {
  return document.querySelector(selector)?.value.trim() || "";
}
function setText(selector, value) {
  const el = document.querySelector(selector);
  if (el) el.textContent = value;
}

function getSelectedCategoryImage() {
  const category = getValue("[data-lot-category]") || "Collectibles";
  return CATEGORY_IMAGE_MAP[category] || CATEGORY_IMAGE_MAP.Collectibles;
}

function normalizeBackendStatus(status) {
  return ["Active", "Scheduled"].includes(status) ? status : "Scheduled";
}

function updateDefaultStartDate() {
  const startDateInput = document.querySelector("[data-start-date]");
  if (!startDateInput || startDateInput.value) return;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  startDateInput.value = tomorrow.toISOString().split("T")[0];
}

function updatePreviewImage() {
  const previewImage = document.querySelector(".auction-preview-media img");
  if (previewImage) {
    if (window.previewImages.length > 0) {
      previewImage.src = window.previewImages[0];
    } else {
      previewImage.src = getSelectedCategoryImage();
    }
  }
}

// Xử lý sự kiện tải ảnh lên
function handleImageUpload(event) {
  const files = Array.from(event.target.files);
  const input = event.target;
  const container = document.getElementById("imagePreviewContainer");

  setFieldError(input, "");

  const validFiles = files.filter((f) => f.type === "image/jpeg" || f.type === "image/jpg");
  if (validFiles.length !== files.length) {
    setFieldError(input, "Có file bị loại bỏ vì không phải JPG/JPEG.");
  }

  const filesToProcess = validFiles.slice(0, 3);
  if (validFiles.length > 3) {
    setFieldError(input, "Chỉ lấy tối đa 3 hình đầu tiên.");
  }

  // Lưu File thật để Submit
  window.uploadedFiles = filesToProcess;
  window.previewImages = [];
  if (container) container.innerHTML = "";

  // Sinh thumbnail xem trước
  filesToProcess.forEach((file, index) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Str = e.target.result;
      window.previewImages.push(base64Str);

      if (container) {
        const img = document.createElement("img");
        img.src = base64Str;
        img.style.width = "72px";
        img.style.height = "72px";
        img.style.objectFit = "cover";
        img.style.borderRadius = "6px";
        img.style.border = index === 0 ? "2px solid var(--primary)" : "1px solid var(--border)";
        container.appendChild(img);
      }

      if (index === 0) updatePreviewImage();
      updateReadiness();
    };
    reader.readAsDataURL(file);
  });
}

function updatePreview() {
  setText("[data-preview-lot-number]", getValue("[data-lot-number]") || "BG-LOT-2048");
  setText("[data-preview-status]", getValue("[data-lot-status]") || "Scheduled");
  setText("[data-preview-chip]", getValue("[data-lot-status]") || "Scheduled");
  setText("[data-preview-title]", getValue("[data-lot-title]") || "Chưa có tiêu đề");
  setText("[data-preview-category]", getValue("[data-lot-category]") || "Chưa phân loại");
  setText("[data-preview-specialist]", getValue("[data-lot-specialist]") || "Chưa phân công");
  setText("[data-preview-description]", getValue("[data-lot-description]") || "Mô tả công khai sẽ hiện ở đây.");
  setText(
    "[data-preview-estimate]",
    `${formatCurrency(getValue("[data-estimate-low]"))} - ${formatCurrency(getValue("[data-estimate-high]"))}`,
  );
  setText("[data-preview-starting]", formatCurrency(getValue("[data-starting-bid]")));
  setText("[data-preview-reserve]", formatCurrency(getValue("[data-reserve-price]")));
  setText("[data-preview-increment]", formatCurrency(getValue("[data-bid-increment]")));

  const duration = getValue("[data-duration]") || "48";
  setText("[data-preview-window]", Number(duration) >= 120 ? `${Number(duration) / 24} Ngày` : `${duration} Giờ`);

  updatePreviewImage();
  updateReadiness();
}

function validateRequired(input, message) {
  if (!input.value.trim()) {
    setFieldError(input, message);
    return false;
  }
  setFieldError(input, "");
  return true;
}

function validateNumber(input, message) {
  const value = Number(input.value);
  if (!input.value.trim() || !Number.isFinite(value) || value <= 0) {
    setFieldError(input, message);
    return false;
  }
  setFieldError(input, "");
  return true;
}

function validatePricing() {
  let isValid = true;
  if (!validateNumber(document.querySelector("[data-starting-bid]"), "Nhập giá khởi điểm.")) isValid = false;
  if (!validateNumber(document.querySelector("[data-reserve-price]"), "Nhập giá sàn.")) isValid = false;
  if (!validateNumber(document.querySelector("[data-bid-increment]"), "Nhập bước giá.")) isValid = false;
  if (!validateNumber(document.querySelector("[data-estimate-low]"), "Nhập ước tính thấp.")) isValid = false;
  if (!validateNumber(document.querySelector("[data-estimate-high]"), "Nhập ước tính cao.")) isValid = false;
  return isValid;
}

function validateForm() {
  let isValid = true;
  const requiredSelectors = [
    ["[data-lot-number]", "Vui lòng nhập mã lô."],
    ["[data-lot-status]", "Chọn trạng thái."],
    ["[data-lot-title]", "Nhập tiêu đề."],
    ["[data-lot-category]", "Chọn danh mục."],
    ["[data-lot-specialist]", "Chọn chuyên gia."],
    ["[data-lot-description]", "Nhập mô tả."],
    ["[data-start-date]", "Chọn ngày."],
    ["[data-start-time]", "Chọn giờ."],
    ["[data-duration]", "Chọn thời lượng."],
  ];
  requiredSelectors.forEach(([s, msg]) => {
    const el = document.querySelector(s);
    if (el && !validateRequired(el, msg)) isValid = false;
  });
  if (!validatePricing()) isValid = false;

  const reviewChecks = Array.from(document.querySelectorAll("[data-review-check]"));
  const reviewError = document.querySelector("[data-review-error]");
  if (!reviewChecks.every((i) => i.checked)) {
    if (reviewError) reviewError.textContent = "Bạn phải tick xác nhận toàn bộ 3 điều kiện cuối cùng.";
    isValid = false;
  } else if (reviewError) reviewError.textContent = "";

  return isValid;
}

function updateReadiness() {
  const requiredInputs = [
    "[data-lot-title]",
    "[data-lot-description]",
    "[data-starting-bid]",
    "[data-reserve-price]",
    "[data-start-date]",
  ];
  const filledCount = requiredInputs.filter((s) => {
    const el = document.querySelector(s);
    return el && el.value.trim();
  }).length;
  const checkedCount = Array.from(document.querySelectorAll("[data-review-check]")).filter((i) => i.checked).length;
  const percentage = Math.round(((filledCount + checkedCount) / (requiredInputs.length + 3)) * 100);
  const bar = document.querySelector("[data-readiness-bar]");
  const label = document.querySelector("[data-readiness-label]");
  if (bar) bar.style.width = `${percentage}%`;
  if (label) label.textContent = percentage === 100 ? "Đã sẵn sàng xuất bản." : `Đã hoàn thành ${percentage}%.`;
}

function buildAuctionPayload(finalImageUrl) {
  const durationHours = Number(getValue("[data-duration]") || 48);
  const durationMinutes = Math.max(1, durationHours * 60);
  const category = getValue("[data-lot-category]") || "Collectibles";

  return {
    productName: getValue("[data-lot-title]"),
    description: getValue("[data-lot-description]"),
    category,
    imageUrl: finalImageUrl,
    startingPrice: Number(getValue("[data-starting-bid]")),
    stepPrice: Number(getValue("[data-bid-increment]")),
    durationMinutes,
    status: normalizeBackendStatus(getValue("[data-lot-status]")),
  };
}

async function handleSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!requireLogin() || !validateForm()) {
    showToast("Từ Chối Xuất Bản", "Vui lòng hoàn thiện tất cả các trường dữ liệu và xác nhận.");
    updateReadiness();
    return;
  }

  setFormBusy(form, true);

  // Lấy ảnh Base64 từ mảng preview (đã được nén lúc chọn ảnh)
  let finalImageUrl =
    window.previewImages && window.previewImages.length > 0 ? window.previewImages[0] : getSelectedCategoryImage();

  const payload = buildAuctionPayload(finalImageUrl);

  try {
    const response = await apiClient.post("/auctions", payload);
    showToast("Đã Gửi Duyệt", "Lô hàng đã được đưa vào Hàng đợi. Chờ Admin phê duyệt!");

    // Chuyển hướng thẳng sang trang Admin Tab Xác minh
    setTimeout(() => {
      window.location.href = "./admin.html#verification";
    }, 1500);
  } catch (error) {
    console.error("[Publish Lot] API Error:", error);
    showToast("Thất Bại", error.message || "Lỗi hệ thống. Hãy kiểm tra Backend.");
  } finally {
    setFormBusy(form, false);
  }
}

function bindPreviewEvents() {
  [
    "[data-lot-title]",
    "[data-lot-category]",
    "[data-lot-description]",
    "[data-starting-bid]",
    "[data-reserve-price]",
    "[data-bid-increment]",
  ].forEach((s) => {
    const input = document.querySelector(s);
    if (input) {
      input.addEventListener("input", updatePreview);
      input.addEventListener("change", updatePreview);
    }
  });
  document.querySelectorAll("[data-review-check]").forEach((i) => i.addEventListener("change", updateReadiness));

  const imageInput = document.querySelector("[data-lot-images]");
  if (imageInput) imageInput.addEventListener("change", handleImageUpload);
}

function initPublishLotPage() {
  initTheme();
  initI18n();
  initSiteHeader({ hideAfter: 120, topRevealOffset: 12 });
  requireLogin();
  updateDefaultStartDate();
  bindPreviewEvents();

  const form = document.querySelector("[data-publish-form]");
  if (form) form.addEventListener("submit", handleSubmit);

  updatePreview();
}

document.addEventListener("DOMContentLoaded", initPublishLotPage);

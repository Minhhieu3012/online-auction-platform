import { initTheme } from "../core/theme.js";
import { initSiteHeader } from "../core/header.js";
import apiClient from "../core/api-client.js";

window.uploadedFiles = [];
window.previewImages = [];

const CATEGORY_IMAGE_MAP = {
  Jewelry: "../assets/images/mockdata/4.png",
  Horology: "../assets/images/mockdata/1.png",
  "Fine Art": "../assets/images/mockdata/2.png",
  Automotive: "../assets/images/mockdata/3.png",
  Collectibles: "../assets/images/mockdata/5.png",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatCurrency(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "$0";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(number);
}

function showToast(title, message, type = "info") {
  const toastStack = document.querySelector("[data-toast-stack]");

  if (!toastStack) return;

  const toast = document.createElement("article");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <p class="toast-title">${escapeHtml(title)}</p>
    <p class="toast-message">${escapeHtml(message)}</p>
  `;

  toastStack.appendChild(toast);

  window.setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-6px)";
  }, 3200);

  window.setTimeout(() => toast.remove(), 3800);
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

  controls.forEach((control) => {
    control.disabled = isBusy;
  });

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
    showToast("Yêu cầu đăng nhập", "Bạn cần đăng nhập để tạo phiên đấu giá.", "warning");

    window.setTimeout(() => {
      window.location.href = "./login.html?redirect=publish-lot";
    }, 700);

    return false;
  }

  return true;
}

function getCurrentUser() {
  return apiClient.getAuthUser() || null;
}

function getValue(selector) {
  return document.querySelector(selector)?.value.trim() || "";
}

function setText(selector, value) {
  const element = document.querySelector(selector);

  if (element) {
    element.textContent = value;
  }
}

function getSelectedCategoryImage() {
  const category = getValue("[data-lot-category]") || "Collectibles";
  return CATEGORY_IMAGE_MAP[category] || CATEGORY_IMAGE_MAP.Collectibles;
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

  if (!previewImage) return;

  if (window.previewImages.length > 0) {
    previewImage.src = window.previewImages[0];
    return;
  }

  previewImage.src = getSelectedCategoryImage();
}

function handleImageUpload(event) {
  const files = Array.from(event.target.files || []);
  const input = event.target;
  const container = document.getElementById("imagePreviewContainer");

  setFieldError(input, "");

  const validFiles = files.filter((file) => {
    return ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type);
  });

  if (validFiles.length !== files.length) {
    setFieldError(input, "Có file bị loại vì không phải ảnh JPG/PNG/WebP.");
  }

  const filesToProcess = validFiles.slice(0, 3);

  if (validFiles.length > 3) {
    setFieldError(input, "Chỉ lấy tối đa 3 hình đầu tiên.");
  }

  window.uploadedFiles = filesToProcess;
  window.previewImages = [];

  if (container) {
    container.innerHTML = "";
  }

  if (filesToProcess.length === 0) {
    updatePreviewImage();
    updateReadiness();
    return;
  }

  filesToProcess.forEach((file, index) => {
    const reader = new FileReader();

    reader.onload = (readerEvent) => {
      const base64Value = readerEvent.target.result;
      window.previewImages[index] = base64Value;

      if (container) {
        const image = document.createElement("img");
        image.src = base64Value;
        image.alt = `Ảnh lô hàng ${index + 1}`;
        image.style.width = "72px";
        image.style.height = "72px";
        image.style.objectFit = "cover";
        image.style.borderRadius = "6px";
        image.style.border = index === 0 ? "2px solid var(--primary)" : "1px solid var(--border)";
        container.appendChild(image);
      }

      if (index === 0) {
        updatePreviewImage();
      }

      updateReadiness();
    };

    reader.readAsDataURL(file);
  });
}

function updatePreview() {
  setText("[data-preview-lot-number]", getValue("[data-lot-number]") || "BG-LOT-2048");
  setText("[data-preview-status]", getValue("[data-lot-status]") || "Chờ Duyệt");
  setText("[data-preview-chip]", getValue("[data-lot-status]") || "Pending");
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

  const duration = Number(getValue("[data-duration]") || 48);
  setText("[data-preview-window]", duration >= 120 ? `${duration / 24} Ngày` : `${duration} Giờ`);

  updatePreviewImage();
  updateReadiness();
}

function validateRequired(input, message) {
  if (!input || !input.value.trim()) {
    setFieldError(input, message);
    return false;
  }

  setFieldError(input, "");
  return true;
}

function validateNumber(input, message) {
  const value = Number(input?.value);

  if (!input || !input.value.trim() || !Number.isFinite(value) || value <= 0) {
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

  requiredSelectors.forEach(([selector, message]) => {
    const element = document.querySelector(selector);

    if (element && !validateRequired(element, message)) {
      isValid = false;
    }
  });

  if (!validatePricing()) {
    isValid = false;
  }

  const reviewChecks = Array.from(document.querySelectorAll("[data-review-check]"));
  const reviewError = document.querySelector("[data-review-error]");

  if (!reviewChecks.every((input) => input.checked)) {
    if (reviewError) {
      reviewError.textContent = "Bạn phải tick xác nhận toàn bộ điều kiện cuối cùng.";
    }

    isValid = false;
  } else if (reviewError) {
    reviewError.textContent = "";
  }

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

  const filledCount = requiredInputs.filter((selector) => {
    const element = document.querySelector(selector);
    return element && element.value.trim();
  }).length;

  const checkedCount = Array.from(document.querySelectorAll("[data-review-check]")).filter((input) => {
    return input.checked;
  }).length;

  const percentage = Math.round(((filledCount + checkedCount) / (requiredInputs.length + 3)) * 100);
  const bar = document.querySelector("[data-readiness-bar]");
  const label = document.querySelector("[data-readiness-label]");

  if (bar) {
    bar.style.width = `${percentage}%`;
  }

  if (label) {
    label.textContent = percentage === 100 ? "Đã sẵn sàng gửi duyệt." : `Đã hoàn thành ${percentage}%.`;
  }
}

function buildStartDateTime() {
  const date = getValue("[data-start-date]");
  const time = getValue("[data-start-time]") || "09:00";

  if (!date) return null;

  const result = new Date(`${date}T${time}:00`);

  return Number.isNaN(result.getTime()) ? null : result;
}

function buildAuctionPayload(finalImageUrl) {
  const durationHours = Number(getValue("[data-duration]") || 48);
  const durationMinutes = Math.max(1, durationHours * 60);
  const category = getValue("[data-lot-category]") || "Collectibles";
  const startDateTime = buildStartDateTime();

  const user = getCurrentUser();
  const isAdmin = String(user?.role || "").toLowerCase() === "admin";

  return {
    productName: getValue("[data-lot-title]"),
    description: getValue("[data-lot-description]"),
    category,
    imageUrl: finalImageUrl,
    startingPrice: Number(getValue("[data-starting-bid]")),
    stepPrice: Number(getValue("[data-bid-increment]")),
    durationMinutes,
    startTime: startDateTime ? startDateTime.toISOString() : undefined,
    status: isAdmin ? getValue("[data-lot-status]") || "Scheduled" : "Pending",
  };
}

async function handleSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;

  if (!requireLogin() || !validateForm()) {
    showToast("Từ chối gửi duyệt", "Vui lòng hoàn thiện tất cả trường dữ liệu và xác nhận.", "error");
    updateReadiness();
    return;
  }

  setFormBusy(form, true);

  const finalImageUrl =
    window.previewImages && window.previewImages.length > 0 ? window.previewImages[0] : getSelectedCategoryImage();

  const payload = buildAuctionPayload(finalImageUrl);
  const user = getCurrentUser();
  const isAdmin = String(user?.role || "").toLowerCase() === "admin";

  try {
    const response = await apiClient.post("/auctions", payload, {
      auth: true,
      idempotency: true,
    });

    const auctionId = response?.data?.auctionId;

    showToast(
      isAdmin ? "Đã tạo phiên" : "Đã gửi duyệt",
      isAdmin
        ? "Phiên đấu giá đã được tạo theo quyền admin."
        : "Lô hàng đã được đưa vào hàng đợi. Chờ admin phê duyệt.",
      "success",
    );

    window.setTimeout(() => {
      if (isAdmin) {
        window.location.href = auctionId ? `./admin.html#auctions` : "./admin.html#verification";
        return;
      }

      window.location.href = "./account.html#selling";
    }, 1200);
  } catch (error) {
    console.error("[Publish Lot] API Error:", error);
    showToast("Thất bại", error.message || "Lỗi hệ thống. Hãy kiểm tra Backend.", "error");
  } finally {
    setFormBusy(form, false);
  }
}

function bindPreviewEvents() {
  [
    "[data-lot-number]",
    "[data-lot-status]",
    "[data-lot-title]",
    "[data-lot-category]",
    "[data-lot-specialist]",
    "[data-lot-description]",
    "[data-starting-bid]",
    "[data-reserve-price]",
    "[data-bid-increment]",
    "[data-estimate-low]",
    "[data-estimate-high]",
    "[data-duration]",
    "[data-start-date]",
    "[data-start-time]",
  ].forEach((selector) => {
    const input = document.querySelector(selector);

    if (!input) return;

    input.addEventListener("input", updatePreview);
    input.addEventListener("change", updatePreview);
  });

  document.querySelectorAll("[data-review-check]").forEach((input) => {
    input.addEventListener("change", updateReadiness);
  });

  const imageInput = document.querySelector("[data-lot-images]");

  if (imageInput) {
    imageInput.addEventListener("change", handleImageUpload);
  }

  const saveDraftButton = document.querySelector("[data-save-publish-draft]");

  if (saveDraftButton) {
    saveDraftButton.addEventListener("click", () => {
      showToast("Đã lưu tạm", "Bản nháp hiện được giữ trên form trình duyệt.", "success");
    });
  }

  const previewButton = document.querySelector("[data-preview-publish]");

  if (previewButton) {
    previewButton.addEventListener("click", () => {
      updatePreview();
      showToast("Đã cập nhật xem trước", "Khung preview đã được làm mới.", "success");
    });
  }
}

function initPublishLotPage() {
  initTheme();

  initSiteHeader({
    hideAfter: 120,
    topRevealOffset: 12,
  });

  requireLogin();
  updateDefaultStartDate();
  bindPreviewEvents();

  const form = document.querySelector("[data-publish-form]");

  if (form) {
    form.addEventListener("submit", handleSubmit);
  }

  updatePreview();
  updateReadiness();
}

document.addEventListener("DOMContentLoaded", initPublishLotPage);
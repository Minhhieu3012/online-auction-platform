import { initTheme } from "../core/theme.js";
import { initSiteHeader } from "../core/header.js";
import apiClient from "../core/api-client.js";

const MAX_IMAGES = 3;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const DEFAULT_PREVIEW_IMAGE = "../assets/images/logo.png";

const state = {
  uploadedFiles: [],
  previewUrls: [],
  previewBase64: [],
  currentPreviewIndex: 0,
};

window.uploadedFiles = state.uploadedFiles;
window.previewImages = state.previewBase64;

function syncLegacyGlobals() {
  window.uploadedFiles = state.uploadedFiles;
  window.previewImages = state.previewBase64;
}

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

function getCheckedText(selector) {
  const checked = document.querySelector(`${selector} option:checked`);
  return checked?.textContent?.trim() || "";
}

function setText(selector, value) {
  const element = document.querySelector(selector);

  if (element) {
    element.textContent = value;
  }
}

function getSelectedCategoryImage() {
  return DEFAULT_PREVIEW_IMAGE;
}

function updateDefaultStartDate() {
  return;
}

function revokeOldPreviews() {
  state.previewUrls.forEach((url) => {
    if (url && url.startsWith("blob:")) {
      URL.revokeObjectURL(url);
    }
  });

  state.previewUrls = [];
}

function fileToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      resolve(String(event.target?.result || ""));
    };

    reader.onerror = () => {
      resolve("");
    };

    reader.readAsDataURL(file);
  });
}

function getMainPreviewImageElement() {
  return (
    document.getElementById("mainPreviewImage") ||
    document.querySelector("[data-main-preview-image]") ||
    document.querySelector(".auction-preview-media img")
  );
}

function getPreviewPlaceholderElement() {
  return document.getElementById("emptyImagePlaceholder") || document.querySelector("[data-preview-image-placeholder]");
}

function getPrevButtonElement() {
  return document.getElementById("prevImageBtn") || document.querySelector("[data-preview-prev]");
}

function getNextButtonElement() {
  return document.getElementById("nextImageBtn") || document.querySelector("[data-preview-next]");
}

function getCounterElement() {
  return document.getElementById("imageCounter") || document.querySelector("[data-image-counter]");
}

function renderThumbnailPreviews() {
  const container = document.getElementById("imagePreviewContainer");

  if (!container) return;

  container.innerHTML = "";

  state.previewUrls.forEach((url, index) => {
    const wrapper = document.createElement("button");
    wrapper.type = "button";
    wrapper.className = "publish-thumb-preview";
    wrapper.style.width = "72px";
    wrapper.style.height = "72px";
    wrapper.style.padding = "0";
    wrapper.style.borderRadius = "6px";
    wrapper.style.overflow = "hidden";
    wrapper.style.cursor = "pointer";
    wrapper.style.position = "relative";
    wrapper.style.border = index === state.currentPreviewIndex ? "2px solid var(--primary)" : "1px solid var(--border)";
    wrapper.style.background = "transparent";

    const image = document.createElement("img");
    image.src = url;
    image.alt = `Ảnh lô hàng ${index + 1}`;
    image.style.width = "100%";
    image.style.height = "100%";
    image.style.objectFit = "cover";

    const badge = document.createElement("span");
    badge.textContent = String(index + 1);
    badge.style.position = "absolute";
    badge.style.top = "4px";
    badge.style.left = "4px";
    badge.style.padding = "2px 5px";
    badge.style.borderRadius = "3px";
    badge.style.background = "rgba(0, 0, 0, 0.72)";
    badge.style.color = "var(--primary)";
    badge.style.fontSize = "10px";
    badge.style.fontWeight = "900";

    wrapper.appendChild(image);
    wrapper.appendChild(badge);

    wrapper.addEventListener("click", () => {
      state.currentPreviewIndex = index;
      updatePreviewImage();
      renderThumbnailPreviews();
    });

    container.appendChild(wrapper);
  });
}

function updatePreviewImage() {
  const previewImage = getMainPreviewImageElement();
  const placeholder = getPreviewPlaceholderElement();
  const prevButton = getPrevButtonElement();
  const nextButton = getNextButtonElement();
  const counter = getCounterElement();

  if (!previewImage && !placeholder) return;

  if (state.uploadedFiles.length > 0 && state.previewUrls.length > 0) {
    if (state.currentPreviewIndex >= state.previewUrls.length) {
      state.currentPreviewIndex = state.previewUrls.length - 1;
    }

    if (state.currentPreviewIndex < 0) {
      state.currentPreviewIndex = 0;
    }

    const currentUrl = state.previewUrls[state.currentPreviewIndex];

    if (previewImage) {
      previewImage.src = currentUrl;
      previewImage.style.display = "block";
    }

    if (placeholder) {
      placeholder.style.display = "none";
    }

    if (prevButton) {
      prevButton.style.display = state.previewUrls.length > 1 ? "block" : "none";
    }

    if (nextButton) {
      nextButton.style.display = state.previewUrls.length > 1 ? "block" : "none";
    }

    if (counter) {
      counter.style.display = state.previewUrls.length > 1 ? "block" : "none";
      counter.textContent = `${state.currentPreviewIndex + 1} / ${state.previewUrls.length}`;
    }

    return;
  }

  if (previewImage) {
    previewImage.src = getSelectedCategoryImage();
    previewImage.style.display = "block";
  }

  if (placeholder) {
    placeholder.style.display = "none";
  }

  if (prevButton) {
    prevButton.style.display = "none";
  }

  if (nextButton) {
    nextButton.style.display = "none";
  }

  if (counter) {
    counter.style.display = "none";
  }
}

async function handleImageUpload(event) {
  const files = Array.from(event.target.files || []);
  const input = event.target;

  setFieldError(input, "");

  const validFiles = files.filter((file) => ALLOWED_IMAGE_TYPES.includes(file.type));

  if (validFiles.length !== files.length) {
    setFieldError(input, "Có file bị loại vì không phải ảnh JPG/PNG/WebP.");
  }

  const combinedFiles = [...state.uploadedFiles, ...validFiles];

  if (combinedFiles.length > MAX_IMAGES) {
    setFieldError(input, `Chỉ giữ tối đa ${MAX_IMAGES} ảnh đầu tiên.`);
  }

  revokeOldPreviews();

  state.uploadedFiles = combinedFiles.slice(0, MAX_IMAGES);
  state.previewUrls = state.uploadedFiles.map((file) => URL.createObjectURL(file));
  state.previewBase64 = await Promise.all(state.uploadedFiles.map(fileToBase64));
  state.currentPreviewIndex = 0;

  syncLegacyGlobals();

  input.value = "";

  renderThumbnailPreviews();
  updatePreviewImage();
  updateReadiness();
}

function getDurationParts() {
  const oldDuration = Number(getValue("[data-duration]") || 0);
  const hours = Number(getValue("[data-dur-hours]") || 0);
  const minutes = Number(getValue("[data-dur-minutes]") || 0);
  const seconds = Number(getValue("[data-dur-seconds]") || 0);

  if (hours > 0 || minutes > 0 || seconds > 0) {
    return {
      hours,
      minutes,
      seconds,
      totalMinutes: Math.max(1, Math.ceil((hours * 3600 + minutes * 60 + seconds) / 60)),
      totalSeconds: hours * 3600 + minutes * 60 + seconds,
      source: "granular",
    };
  }

  if (oldDuration > 0) {
    return {
      hours: oldDuration,
      minutes: 0,
      seconds: 0,
      totalMinutes: Math.max(1, oldDuration * 60),
      totalSeconds: oldDuration * 3600,
      source: "duration",
    };
  }

  return {
    hours: 0,
    minutes: 0,
    seconds: 0,
    totalMinutes: 0,
    totalSeconds: 0,
    source: "empty",
  };
}

function formatDurationLabel() {
  const duration = getDurationParts();

  if (duration.source === "empty") {
    return "Chưa thiết lập";
  }

  if (duration.source === "duration") {
    return duration.hours >= 120 ? `${duration.hours / 24} Ngày` : `${duration.hours} Giờ`;
  }

  const parts = [];

  if (duration.hours > 0) parts.push(`${duration.hours} giờ`);
  if (duration.minutes > 0) parts.push(`${duration.minutes} phút`);
  if (duration.seconds > 0) parts.push(`${duration.seconds} giây`);

  return parts.length > 0 ? parts.join(" ") : "Chưa thiết lập";
}

function updatePreview() {
  setText("[data-preview-lot-number]", getValue("[data-lot-number]") || "BG-LOT-2048");
  setText("[data-preview-status]", getValue("[data-lot-status]") || "Chờ Duyệt");
  setText("[data-preview-chip]", getValue("[data-lot-status]") || "Pending");
  setText("[data-preview-title]", getValue("[data-lot-title]") || "Chưa có tiêu đề");
  setText("[data-preview-category]", getCheckedText("[data-lot-category]") || getValue("[data-lot-category]") || "Chưa phân loại");
  setText("[data-preview-specialist]", getValue("[data-lot-specialist]") || "BrosGem Verification");
  setText("[data-preview-description]", getValue("[data-lot-description]") || "Mô tả công khai sẽ hiện ở đây.");

  setText(
    "[data-preview-estimate]",
    `${formatCurrency(getValue("[data-estimate-low]"))} - ${formatCurrency(getValue("[data-estimate-high]"))}`,
  );

  setText("[data-preview-starting]", formatCurrency(getValue("[data-starting-bid]")));
  setText("[data-preview-reserve]", formatCurrency(getValue("[data-reserve-price]")));
  setText("[data-preview-increment]", formatCurrency(getValue("[data-bid-increment]")));
  setText("[data-preview-window]", formatDurationLabel());

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

function validateOptionalNonNegativeNumber(input, message) {
  if (!input || !input.value.trim()) {
    return true;
  }

  const value = Number(input.value);

  if (!Number.isFinite(value) || value < 0) {
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

function validateDuration() {
  const durationInput = document.querySelector("[data-duration]");
  const hoursInput = document.querySelector("[data-dur-hours]");
  const minutesInput = document.querySelector("[data-dur-minutes]");
  const secondsInput = document.querySelector("[data-dur-seconds]");

  if (durationInput && !hoursInput && !minutesInput && !secondsInput) {
    return validateNumber(durationInput, "Chọn thời lượng.");
  }

  let isValid = true;

  if (!validateOptionalNonNegativeNumber(hoursInput, "Số giờ không hợp lệ.")) isValid = false;
  if (!validateOptionalNonNegativeNumber(minutesInput, "Số phút không hợp lệ.")) isValid = false;
  if (!validateOptionalNonNegativeNumber(secondsInput, "Số giây không hợp lệ.")) isValid = false;

  const duration = getDurationParts();

  if (duration.totalSeconds <= 0) {
    if (hoursInput) {
      setFieldError(hoursInput, "Nhập thời gian > 0.");
    }

    isValid = false;
  }

  return isValid;
}

function validateImages() {
  const imageInput = document.querySelector("[data-lot-images]");

  if (!imageInput) return true;

  if (state.uploadedFiles.length === 0) {
    setFieldError(imageInput, "Vui lòng upload ít nhất 1 ảnh JPG/PNG/WebP.");
    return false;
  }

  setFieldError(imageInput, "");
  return true;
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

  if (!validateDuration()) {
    isValid = false;
  }

  if (!validateImages()) {
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
    "[data-bid-increment]",
    "[data-start-date]",
    "[data-start-time]",
  ];

  const filledCount = requiredInputs.filter((selector) => {
    const element = document.querySelector(selector);
    return element && element.value.trim();
  }).length;

  const hasImages = state.uploadedFiles.length > 0 ? 1 : 0;
  const checkedCount = Array.from(document.querySelectorAll("[data-review-check]")).filter((input) => {
    return input.checked;
  }).length;

  const total = requiredInputs.length + 1 + 3;
  const percentage = Math.min(100, Math.round(((filledCount + hasImages + checkedCount) / total) * 100));

  const bar = document.querySelector("[data-readiness-bar]");
  const label = document.querySelector("[data-readiness-label]");

  if (bar) {
    bar.style.width = `${percentage}%`;
  }

  if (label) {
    label.textContent = percentage === 100 ? "Sẵn sàng xuất bản." : `Hoàn thành ${percentage}%.`;
  }
}

function buildStartDateTime() {
  const date = getValue("[data-start-date]");
  const time = getValue("[data-start-time]");

  if (!date || !time) return null;

  const result = new Date(`${date}T${time}:00`);

  return Number.isNaN(result.getTime()) ? null : result;
}

function getAuctionStatusForSubmit() {
  const user = getCurrentUser();
  const isAdmin = String(user?.role || "").toLowerCase() === "admin";

  if (!isAdmin) {
    return "Pending";
  }

  return getValue("[data-lot-status]") || "Scheduled";
}

function buildAuctionJsonPayload() {
  const duration = getDurationParts();
  const category = getValue("[data-lot-category]") || "Collectibles";
  const startDateTime = buildStartDateTime();
  const imageUrl = state.previewBase64[0] || getSelectedCategoryImage();

  return {
    productName: getValue("[data-lot-title]"),
    description: getValue("[data-lot-description]"),
    category,
    imageUrl,
    images: state.previewBase64.length > 0 ? state.previewBase64 : [imageUrl],
    startingPrice: Number(getValue("[data-starting-bid]")),
    reservePrice: Number(getValue("[data-reserve-price]")),
    stepPrice: Number(getValue("[data-bid-increment]")),
    estimateLow: Number(getValue("[data-estimate-low]")),
    estimateHigh: Number(getValue("[data-estimate-high]")),
    durationMinutes: duration.totalMinutes,
    startTime: startDateTime ? startDateTime.toISOString() : undefined,
    status: getAuctionStatusForSubmit(),
  };
}

function buildAuctionFormData() {
  const duration = getDurationParts();
  const category = getValue("[data-lot-category]") || "Collectibles";
  const startDateTime = buildStartDateTime();

  const formData = new FormData();

  formData.append("productName", getValue("[data-lot-title]"));
  formData.append("description", getValue("[data-lot-description]"));
  formData.append("category", category);
  formData.append("startingPrice", String(Number(getValue("[data-starting-bid]"))));
  formData.append("reservePrice", String(Number(getValue("[data-reserve-price]"))));
  formData.append("stepPrice", String(Number(getValue("[data-bid-increment]"))));
  formData.append("estimateLow", String(Number(getValue("[data-estimate-low]"))));
  formData.append("estimateHigh", String(Number(getValue("[data-estimate-high]"))));
  formData.append("durationMinutes", String(duration.totalMinutes));
  formData.append("status", getAuctionStatusForSubmit());

  if (startDateTime) {
    formData.append("startTime", startDateTime.toISOString());
  }

  state.uploadedFiles.forEach((file) => {
    formData.append("images", file);
  });

  return formData;
}

async function submitAuctionJson() {
  const payload = buildAuctionJsonPayload();

  return apiClient.post("/auctions", payload, {
    auth: true,
    idempotency: true,
  });
}

async function submitAuctionMultipart() {
  const formData = buildAuctionFormData();

  return apiClient.request("/auctions", {
    method: "POST",
    body: formData,
    auth: true,
    idempotency: true,
  });
}

function shouldFallbackToJson(error) {
  const message = String(error?.message || "").toLowerCase();
  const code = String(error?.errorCode || "").toUpperCase();

  return (
    error?.status === 400 ||
    code === "ERR_INVALID_INPUT" ||
    message.includes("vui lòng nhập đủ") ||
    message.includes("invalid input")
  );
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

  const user = getCurrentUser();
  const isAdmin = String(user?.role || "").toLowerCase() === "admin";

  try {
    let response;

    if (state.uploadedFiles.length > 0) {
      try {
        response = await submitAuctionMultipart();
      } catch (error) {
        if (!shouldFallbackToJson(error)) {
          throw error;
        }

        console.warn("[Publish Lot] Multipart không khả dụng, fallback sang JSON.", error);
        response = await submitAuctionJson();
      }
    } else {
      response = await submitAuctionJson();
    }

    const auctionId = response?.data?.auctionId;

    showToast(
      isAdmin ? "Đã tạo phiên" : "Đã gửi duyệt",
      isAdmin
        ? `Phiên #${auctionId || ""} đã được tạo theo quyền admin.`
        : `Phiên #${auctionId || ""} đã được gửi vào hàng đợi. Chờ admin phê duyệt.`,
      "success",
    );

    revokeOldPreviews();

    window.setTimeout(() => {
      if (isAdmin) {
        window.location.href = "./admin.html#auctions";
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
    "[data-dur-hours]",
    "[data-dur-minutes]",
    "[data-dur-seconds]",
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

  const prevButton = getPrevButtonElement();
  const nextButton = getNextButtonElement();

  if (prevButton) {
    prevButton.addEventListener("click", () => {
      if (state.uploadedFiles.length <= 1) return;
      state.currentPreviewIndex =
        state.currentPreviewIndex === 0 ? state.uploadedFiles.length - 1 : state.currentPreviewIndex - 1;
      updatePreviewImage();
      renderThumbnailPreviews();
    });
  }

  if (nextButton) {
    nextButton.addEventListener("click", () => {
      if (state.uploadedFiles.length <= 1) return;
      state.currentPreviewIndex =
        state.currentPreviewIndex + 1 >= state.uploadedFiles.length ? 0 : state.currentPreviewIndex + 1;
      updatePreviewImage();
      renderThumbnailPreviews();
    });
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

function setDefaultDuration() {
  return;
}

function initPublishLotPage() {
  initTheme();

  initSiteHeader({
    hideAfter: 120,
    topRevealOffset: 12,
  });

  requireLogin();
  updateDefaultStartDate();
  setDefaultDuration();
  bindPreviewEvents();

  const form = document.querySelector("[data-publish-form]");

  if (form) {
    form.addEventListener("submit", handleSubmit);
  }

  updatePreview();
  updateReadiness();

  window.addEventListener("beforeunload", revokeOldPreviews);
}

document.addEventListener("DOMContentLoaded", initPublishLotPage);
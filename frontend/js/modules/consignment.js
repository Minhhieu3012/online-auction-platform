import { initTheme } from "../core/theme.js";
import { initSiteHeader } from "../core/header.js";
import apiClient from "../core/api-client.js";

const FALLBACK_CATEGORY_IMAGES = {
  Jewelry: "../assets/images/mockdata/4.png",
  Horology: "../assets/images/mockdata/1.png",
  "Fine Art": "../assets/images/mockdata/2.png",
  Automotive: "../assets/images/mockdata/3.png",
  Collectibles: "../assets/images/mockdata/5.png",
};

const WINDOW_DURATION_MINUTES = {
  "Within 2 weeks": 14 * 24 * 60,
  "Within 1 month": 30 * 24 * 60,
  "Next premium event": 7 * 24 * 60,
  Flexible: 7 * 24 * 60,
};

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

  window.setTimeout(() => {
    toast.remove();
  }, 3800);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function getInput(selector) {
  return document.querySelector(selector);
}

function getValue(selector) {
  return getInput(selector)?.value.trim() || "";
}

function getNumber(selector) {
  return Number(getValue(selector) || 0);
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function setFieldError(input, message) {
  const field = input?.closest(".consign-field");
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
    submitButton.textContent = "Đang gửi duyệt...";
    return;
  }

  submitButton.textContent = submitButton.dataset.originalText || "Gửi Duyệt";
}

function requireLogin() {
  const token = apiClient.getAuthToken();
  const user = apiClient.getAuthUser();

  if (!token || !user) {
    showToast("Yêu cầu đăng nhập", "Vui lòng đăng nhập trước khi gửi tài sản đấu giá.", "warning");

    window.setTimeout(() => {
      const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      window.location.href = `./login.html?redirect=${encodeURIComponent(currentUrl)}`;
    }, 800);

    return false;
  }

  return true;
}

function validateRequired(selector, message) {
  const input = getInput(selector);

  if (!input) return true;

  if (!input.value.trim()) {
    setFieldError(input, message);
    return false;
  }

  setFieldError(input, "");
  return true;
}

function validateNumber(selector, message) {
  const input = getInput(selector);
  const value = Number(input?.value || 0);

  if (!input || !input.value.trim() || !Number.isFinite(value) || value <= 0) {
    setFieldError(input, message);
    return false;
  }

  setFieldError(input, "");
  return true;
}

function validateForm() {
  let isValid = true;

  const requiredFields = [
    ["[data-consign-title]", "Vui lòng nhập tên tài sản."],
    ["[data-consign-category]", "Vui lòng chọn danh mục."],
    ["[data-consign-origin]", "Vui lòng nhập nguồn gốc tài sản."],
    ["[data-consign-condition]", "Vui lòng chọn tình trạng tài sản."],
    ["[data-consign-description]", "Vui lòng nhập mô tả tài sản."],
    ["[data-consign-window]", "Vui lòng chọn thời gian đấu giá dự kiến."],
    ["[data-consign-contact]", "Vui lòng chọn cách liên hệ."],
  ];

  requiredFields.forEach(([selector, message]) => {
    if (!validateRequired(selector, message)) isValid = false;
  });

  const numberFields = [
    ["[data-consign-estimate-low]", "Ước tính thấp phải lớn hơn 0."],
    ["[data-consign-estimate-high]", "Ước tính cao phải lớn hơn 0."],
    ["[data-consign-reserve]", "Giá khởi điểm/giá sàn phải lớn hơn 0."],
  ];

  numberFields.forEach(([selector, message]) => {
    if (!validateNumber(selector, message)) isValid = false;
  });

  const estimateLow = getNumber("[data-consign-estimate-low]");
  const estimateHigh = getNumber("[data-consign-estimate-high]");
  const reservePrice = getNumber("[data-consign-reserve]");

  if (estimateHigh <= estimateLow) {
    setFieldError(getInput("[data-consign-estimate-high]"), "Ước tính cao phải lớn hơn ước tính thấp.");
    isValid = false;
  }

  if (reservePrice > estimateHigh) {
    setFieldError(getInput("[data-consign-reserve]"), "Giá sàn không nên lớn hơn ước tính cao.");
    isValid = false;
  }

  const confirmInput = getInput("[data-consign-confirm]");
  const confirmError = document.querySelector("[data-confirm-error]");

  if (!confirmInput?.checked) {
    if (confirmError) {
      confirmError.textContent = "Bạn cần xác nhận thông tin trước khi gửi duyệt.";
    }

    isValid = false;
  } else if (confirmError) {
    confirmError.textContent = "";
  }

  return isValid;
}

function getPreviewImage() {
  const previewImage = document.querySelector("[data-preview-image]");
  const uploadedPreview = document.querySelector("[data-upload-preview] img");

  if (uploadedPreview?.src) {
    return uploadedPreview.src;
  }

  if (previewImage?.src && !previewImage.src.includes("mockdata")) {
    return previewImage.src;
  }

  const category = getValue("[data-consign-category]") || "Collectibles";
  return FALLBACK_CATEGORY_IMAGES[category] || FALLBACK_CATEGORY_IMAGES.Collectibles;
}

function getStepPrice(estimateLow, estimateHigh) {
  const diff = estimateHigh - estimateLow;

  if (!Number.isFinite(diff) || diff <= 0) {
    return 100;
  }

  return Math.max(100, Math.round(diff / 20));
}

function buildAuctionPayload() {
  const title = getValue("[data-consign-title]");
  const category = getValue("[data-consign-category]") || "Collectibles";
  const origin = getValue("[data-consign-origin]");
  const condition = getValue("[data-consign-condition]");
  const description = getValue("[data-consign-description]");
  const estimateLow = getNumber("[data-consign-estimate-low]");
  const estimateHigh = getNumber("[data-consign-estimate-high]");
  const reservePrice = getNumber("[data-consign-reserve]");
  const windowLabel = getValue("[data-consign-window]") || "Flexible";
  const contactPreference = getValue("[data-consign-contact]") || "Email";
  const durationMinutes = WINDOW_DURATION_MINUTES[windowLabel] || WINDOW_DURATION_MINUTES.Flexible;

  return {
    productName: title,
    category,
    imageUrl: getPreviewImage(),
    startingPrice: reservePrice || estimateLow,
    stepPrice: getStepPrice(estimateLow, estimateHigh),
    durationMinutes,
    status: "Scheduled",
    description: [
      description,
      "",
      `Nguồn gốc: ${origin}`,
      `Tình trạng: ${condition}`,
      `Khoảng ước tính: ${formatCurrency(estimateLow)} - ${formatCurrency(estimateHigh)}`,
      `Khung đấu giá mong muốn: ${windowLabel}`,
      `Ưu tiên liên hệ: ${contactPreference}`,
    ].join("\n"),
  };
}

function saveDraftLocally() {
  const draft = {
    title: getValue("[data-consign-title]"),
    category: getValue("[data-consign-category]"),
    origin: getValue("[data-consign-origin]"),
    condition: getValue("[data-consign-condition]"),
    description: getValue("[data-consign-description]"),
    estimateLow: getValue("[data-consign-estimate-low]"),
    estimateHigh: getValue("[data-consign-estimate-high]"),
    reservePrice: getValue("[data-consign-reserve]"),
    window: getValue("[data-consign-window]"),
    contact: getValue("[data-consign-contact]"),
    updatedAt: new Date().toISOString(),
  };

  window.localStorage.setItem("brosgem_consign_draft", JSON.stringify(draft));
  showToast("Đã lưu bản nháp", "Bản nháp đã được lưu trên trình duyệt hiện tại.", "success");
}

function restoreDraft() {
  try {
    const rawDraft = window.localStorage.getItem("brosgem_consign_draft");
    if (!rawDraft) return;

    const draft = JSON.parse(rawDraft);

    const mapping = [
      ["[data-consign-title]", draft.title],
      ["[data-consign-category]", draft.category],
      ["[data-consign-origin]", draft.origin],
      ["[data-consign-condition]", draft.condition],
      ["[data-consign-description]", draft.description],
      ["[data-consign-estimate-low]", draft.estimateLow],
      ["[data-consign-estimate-high]", draft.estimateHigh],
      ["[data-consign-reserve]", draft.reservePrice],
      ["[data-consign-window]", draft.window],
      ["[data-consign-contact]", draft.contact],
    ];

    mapping.forEach(([selector, value]) => {
      const input = getInput(selector);
      if (input && value) input.value = value;
    });
  } catch (error) {
    console.warn("[Consign] Không thể khôi phục bản nháp:", error);
  }
}

function updatePreview() {
  const title = getValue("[data-consign-title]") || "Tài sản chưa đặt tên";
  const category = getValue("[data-consign-category]") || "Chưa chọn danh mục";
  const condition = getValue("[data-consign-condition]") || "Chưa chọn tình trạng";
  const description = getValue("[data-consign-description]") || "Mô tả tài sản sẽ hiển thị tại đây.";
  const estimateLow = getNumber("[data-consign-estimate-low]");
  const estimateHigh = getNumber("[data-consign-estimate-high]");
  const reservePrice = getNumber("[data-consign-reserve]");
  const previewImage = getInput("[data-preview-image]");

  setText("[data-preview-lot]", "Chờ admin duyệt");
  setText("[data-preview-title]", title);
  setText("[data-preview-category]", category);
  setText("[data-preview-condition]", condition);
  setText("[data-preview-description]", description);
  setText("[data-preview-estimate]", `${formatCurrency(estimateLow)} - ${formatCurrency(estimateHigh)}`);
  setText("[data-preview-reserve]", formatCurrency(reservePrice));

  if (previewImage) {
    previewImage.src = getPreviewImage();
  }
}

function renderUploadPreviews(files) {
  const previewGrid = document.querySelector("[data-upload-preview]");

  if (!previewGrid) return;

  previewGrid.innerHTML = "";

  Array.from(files || [])
    .slice(0, 4)
    .forEach((file) => {
      const imageUrl = URL.createObjectURL(file);
      const item = document.createElement("article");

      item.className = "upload-preview-item";
      item.innerHTML = `
        <img src="${imageUrl}" alt="${file.name}" />
        <span>${file.name}</span>
      `;

      previewGrid.appendChild(item);
    });

  updatePreview();
}

async function handleSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;

  if (!requireLogin()) return;

  if (!validateForm()) {
    showToast("Chưa thể gửi duyệt", "Vui lòng kiểm tra lại các trường bắt buộc.", "warning");
    return;
  }

  const payload = buildAuctionPayload();

  setFormBusy(form, true);

  try {
    const response = await apiClient.post("/auctions", payload);

    showToast(
      "Đã gửi admin duyệt",
      response.message || "Tài sản đã được tạo thành phiên đấu giá chờ duyệt.",
      "success",
    );

    window.localStorage.removeItem("brosgem_consign_draft");

    window.setTimeout(() => {
      window.location.href = "./account.html#selling";
    }, 900);
  } catch (error) {
    console.error("[Consign Submit Error]:", error);
    showToast("Gửi duyệt thất bại", error.message || "Không thể gửi tài sản lên backend.", "error");
  } finally {
    setFormBusy(form, false);
  }
}

function bindEvents() {
  const form = document.querySelector("[data-consign-form]");
  const saveDraftButton = document.querySelector("[data-save-draft]");
  const fileInput = document.querySelector("[data-consign-images]");

  if (form) {
    form.addEventListener("submit", handleSubmit);
  }

  if (saveDraftButton) {
    saveDraftButton.addEventListener("click", saveDraftLocally);
  }

  if (fileInput) {
    fileInput.addEventListener("change", () => {
      renderUploadPreviews(fileInput.files);
    });
  }

  document
    .querySelectorAll(
      [
        "[data-consign-title]",
        "[data-consign-category]",
        "[data-consign-origin]",
        "[data-consign-condition]",
        "[data-consign-description]",
        "[data-consign-estimate-low]",
        "[data-consign-estimate-high]",
        "[data-consign-reserve]",
        "[data-consign-window]",
        "[data-consign-contact]",
      ].join(","),
    )
    .forEach((input) => {
      input.addEventListener("input", updatePreview);
      input.addEventListener("change", updatePreview);
    });
}

function initConsignPage() {
  initTheme();

  initSiteHeader({
    hideAfter: 120,
    topRevealOffset: 12,
  });

  requireLogin();
  restoreDraft();
  bindEvents();
  updatePreview();
}

document.addEventListener("DOMContentLoaded", initConsignPage);
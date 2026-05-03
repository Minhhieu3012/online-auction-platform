import { initTheme } from "../core/theme.js";
import { initI18n } from "../core/i18n.js";
import { initSiteHeader } from "../core/header.js";

const DEFAULT_PREVIEW_IMAGE = "../assets/images/mockdata/4.png";

function formatCurrency(value) {
    const number = Number(value);

    if (!Number.isFinite(number) || number <= 0) {
        return "$0";
    }

    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0
    }).format(number);
}

function getToastStack() {
    return document.querySelector("[data-toast-stack]");
}

function showToast(title, message) {
    const toastStack = getToastStack();

    if (!toastStack) {
        return;
    }

    const toast = document.createElement("article");
    toast.className = "toast";
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

function setFieldError(input, message) {
    const field = input.closest(".consign-field");
    const errorElement = field?.querySelector("[data-field-error]");

    if (!field || !errorElement) {
        return;
    }

    field.classList.toggle("has-error", Boolean(message));
    errorElement.textContent = message || "";
}

function getFieldValue(selector) {
    return document.querySelector(selector)?.value.trim() || "";
}

function updatePreview() {
    const title = getFieldValue("[data-consign-title]");
    const category = getFieldValue("[data-consign-category]");
    const condition = getFieldValue("[data-consign-condition]");
    const description = getFieldValue("[data-consign-description]");
    const estimateLow = getFieldValue("[data-consign-estimate-low]");
    const estimateHigh = getFieldValue("[data-consign-estimate-high]");
    const reserve = getFieldValue("[data-consign-reserve]");

    const previewTitle = document.querySelector("[data-preview-title]");
    const previewCategory = document.querySelector("[data-preview-category]");
    const previewCondition = document.querySelector("[data-preview-condition]");
    const previewDescription = document.querySelector("[data-preview-description]");
    const previewEstimate = document.querySelector("[data-preview-estimate]");
    const previewReserve = document.querySelector("[data-preview-reserve]");

    if (previewTitle) {
        previewTitle.textContent = title || "Untitled Asset";
    }

    if (previewCategory) {
        previewCategory.textContent = category || "Category pending";
    }

    if (previewCondition) {
        previewCondition.textContent = condition || "Condition pending";
    }

    if (previewDescription) {
        previewDescription.textContent = description || "Your asset description will appear here as you type.";
    }

    if (previewEstimate) {
        previewEstimate.textContent = `${formatCurrency(estimateLow)} - ${formatCurrency(estimateHigh)}`;
    }

    if (previewReserve) {
        previewReserve.textContent = formatCurrency(reserve);
    }
}

function validateRequiredInput(input, message) {
    if (!input.value.trim()) {
        setFieldError(input, message);
        return false;
    }

    setFieldError(input, "");
    return true;
}

function validateNumberInput(input, message) {
    const value = Number(input.value);

    if (!input.value.trim() || !Number.isFinite(value) || value <= 0) {
        setFieldError(input, message);
        return false;
    }

    setFieldError(input, "");
    return true;
}

function validateEstimateRange(lowInput, highInput) {
    const low = Number(lowInput.value);
    const high = Number(highInput.value);

    if (!validateNumberInput(lowInput, "Estimate low is required.")) {
        return false;
    }

    if (!validateNumberInput(highInput, "Estimate high is required.")) {
        return false;
    }

    if (high <= low) {
        setFieldError(highInput, "Estimate high must be greater than estimate low.");
        return false;
    }

    setFieldError(highInput, "");
    return true;
}

function validateConsignForm(form) {
    let isValid = true;

    const titleInput = form.querySelector("[data-consign-title]");
    const categoryInput = form.querySelector("[data-consign-category]");
    const originInput = form.querySelector("[data-consign-origin]");
    const conditionInput = form.querySelector("[data-consign-condition]");
    const descriptionInput = form.querySelector("[data-consign-description]");
    const estimateLowInput = form.querySelector("[data-consign-estimate-low]");
    const estimateHighInput = form.querySelector("[data-consign-estimate-high]");
    const reserveInput = form.querySelector("[data-consign-reserve]");
    const windowInput = form.querySelector("[data-consign-window]");
    const contactInput = form.querySelector("[data-consign-contact]");
    const confirmInput = form.querySelector("[data-consign-confirm]");
    const confirmError = form.querySelector("[data-confirm-error]");

    if (!validateRequiredInput(titleInput, "Asset title is required.")) {
        isValid = false;
    }

    if (!validateRequiredInput(categoryInput, "Category is required.")) {
        isValid = false;
    }

    if (!validateRequiredInput(originInput, "Provenance is required.")) {
        isValid = false;
    }

    if (!validateRequiredInput(conditionInput, "Condition is required.")) {
        isValid = false;
    }

    if (!validateRequiredInput(descriptionInput, "Description is required.")) {
        isValid = false;
    }

    if (!validateEstimateRange(estimateLowInput, estimateHighInput)) {
        isValid = false;
    }

    if (!validateNumberInput(reserveInput, "Reserve price is required.")) {
        isValid = false;
    }

    if (!validateRequiredInput(windowInput, "Auction window is required.")) {
        isValid = false;
    }

    if (!validateRequiredInput(contactInput, "Contact preference is required.")) {
        isValid = false;
    }

    if (!confirmInput.checked) {
        confirmError.textContent = "You must confirm before submitting.";
        isValid = false;
    } else {
        confirmError.textContent = "";
    }

    return isValid;
}

function handleFormSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;

    if (!validateConsignForm(form)) {
        showToast("Review Required", "Please complete the highlighted fields before submitting.");
        return;
    }

    showToast("Request Submitted", "Your selling request mock has been submitted for review.");

    window.setTimeout(() => {
        window.location.href = "./account.html#selling";
    }, 950);
}

function handleSaveDraft() {
    showToast("Draft Saved", "Your selling request draft has been saved locally as UI mock.");
}

function renderImagePreview(files) {
    const previewGrid = document.querySelector("[data-upload-preview]");
    const previewImage = document.querySelector("[data-preview-image]");

    if (!previewGrid) {
        return;
    }

    const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));

    previewGrid.innerHTML = "";

    if (!imageFiles.length) {
        if (previewImage) {
            previewImage.src = DEFAULT_PREVIEW_IMAGE;
        }

        return;
    }

    imageFiles.slice(0, 8).forEach((file, index) => {
        const url = URL.createObjectURL(file);

        const item = document.createElement("div");
        item.className = "upload-preview-item";
        item.innerHTML = `
            <img src="${url}" alt="Uploaded asset image ${index + 1}" />
            <span>${index === 0 ? "Cover" : `Image ${index + 1}`}</span>
        `;

        previewGrid.appendChild(item);

        if (index === 0 && previewImage) {
            previewImage.src = url;
        }
    });
}

function initUploadZone() {
    const uploadZone = document.querySelector("[data-upload-zone]");
    const imageInput = document.querySelector("[data-consign-images]");

    if (!uploadZone || !imageInput) {
        return;
    }

    imageInput.addEventListener("change", () => {
        renderImagePreview(imageInput.files);
    });

    uploadZone.addEventListener("dragover", (event) => {
        event.preventDefault();
        uploadZone.classList.add("is-dragging");
    });

    uploadZone.addEventListener("dragleave", () => {
        uploadZone.classList.remove("is-dragging");
    });

    uploadZone.addEventListener("drop", (event) => {
        event.preventDefault();
        uploadZone.classList.remove("is-dragging");

        const files = event.dataTransfer?.files;

        if (files?.length) {
            imageInput.files = files;
            renderImagePreview(files);
        }
    });
}

function bindPreviewFields() {
    const previewSelectors = [
        "[data-consign-title]",
        "[data-consign-category]",
        "[data-consign-condition]",
        "[data-consign-description]",
        "[data-consign-estimate-low]",
        "[data-consign-estimate-high]",
        "[data-consign-reserve]"
    ];

    previewSelectors.forEach((selector) => {
        const input = document.querySelector(selector);

        if (!input) {
            return;
        }

        input.addEventListener("input", updatePreview);
        input.addEventListener("change", updatePreview);
    });

    updatePreview();
}

function bindFormEvents() {
    const form = document.querySelector("[data-consign-form]");
    const saveDraftButton = document.querySelector("[data-save-draft]");

    if (form) {
        form.addEventListener("submit", handleFormSubmit);
    }

    if (saveDraftButton) {
        saveDraftButton.addEventListener("click", handleSaveDraft);
    }
}

function initConsignmentPage() {
    initTheme();
    initI18n();

    initSiteHeader({
        hideAfter: 120,
        topRevealOffset: 12
    });

    bindPreviewFields();
    initUploadZone();
    bindFormEvents();
}

document.addEventListener("DOMContentLoaded", initConsignmentPage);
import CONFIG from "./config.js";
import storage from "./storage.js";

class ApiError extends Error {
    constructor({
        message = "Hệ thống đang gián đoạn, vui lòng thử lại.",
        status = 0,
        errorCode = "UNKNOWN_ERROR",
        data = null,
        endpoint = "",
        method = "GET"
    } = {}) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.errorCode = errorCode;
        this.data = data;
        this.endpoint = endpoint;
        this.method = method;
    }
}

function generateRequestId() {
    if (window.crypto?.randomUUID) {
        return window.crypto.randomUUID();
    }

    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
        const random = (Math.random() * 16) | 0;
        const value = char === "x" ? random : (random & 0x3) | 0x8;
        return value.toString(16);
    });
}

function normalizeEndpoint(endpoint) {
    if (!endpoint) {
        return "/";
    }

    return endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
}

function buildUrl(endpoint, query = null) {
    const baseUrl = (CONFIG?.API?.BASE_URL || "http://localhost:3000/api").replace(/\/$/, "");
    const normalizedEndpoint = normalizeEndpoint(endpoint);
    const url = new URL(`${baseUrl}${normalizedEndpoint}`);

    if (query && typeof query === "object") {
        Object.entries(query).forEach(([key, value]) => {
            if (value === undefined || value === null || value === "") {
                return;
            }

            if (Array.isArray(value)) {
                value.forEach((item) => {
                    url.searchParams.append(key, item);
                });
                return;
            }

            url.searchParams.set(key, value);
        });
    }

    return url.toString();
}

function getPageLoginHref() {
    const isInsidePages = window.location.pathname.includes("/pages/");
    return isInsidePages ? "./login.html" : "./pages/login.html";
}

function redirectToLogin(reason = "session=expired") {
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const loginHref = getPageLoginHref();
    window.location.href = `${loginHref}?${reason}&redirect=${encodeURIComponent(currentUrl)}`;
}

function getAuthToken() {
    const primaryToken = storage.getRaw(CONFIG.AUTH_TOKEN_KEY);

    if (primaryToken && primaryToken !== "undefined" && primaryToken !== "null") {
        return primaryToken;
    }

    for (const key of CONFIG.LEGACY_AUTH_TOKEN_KEYS || []) {
        const token = storage.getRaw(key);

        if (token && token !== "undefined" && token !== "null") {
            return token;
        }
    }

    return null;
}

function setAuthToken(token) {
    if (!token) {
        clearAuthToken();
        return;
    }

    storage.setRaw(CONFIG.AUTH_TOKEN_KEY, token);
    storage.setRaw("jwt_token", token);
}

function clearAuthToken() {
    storage.remove(CONFIG.AUTH_TOKEN_KEY);
    storage.remove("jwt_token");
    storage.remove("token");
    storage.remove("auth_token");
}

function getAuthUser() {
    const primaryUser = storage.get(CONFIG.AUTH_USER_KEY, null);

    if (primaryUser) {
        return primaryUser;
    }

    for (const key of CONFIG.LEGACY_AUTH_USER_KEYS || []) {
        const user = storage.get(key, null);

        if (user) {
            return user;
        }
    }

    return null;
}

function setAuthUser(user) {
    if (!user) {
        clearAuthUser();
        return;
    }

    storage.set(CONFIG.AUTH_USER_KEY, user);
    storage.set("user_info", user);
}

function clearAuthUser() {
    storage.remove(CONFIG.AUTH_USER_KEY);
    storage.remove("user_info");
    storage.remove("user");
    storage.remove("auth_user");
}

function clearAuth() {
    clearAuthToken();
    clearAuthUser();
}

function createTimeoutController(timeoutMs) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
        controller.abort();
    }, timeoutMs);

    return { controller, timeoutId };
}

async function parseResponseBody(response) {
    const contentType = response.headers.get("content-type") || "";

    if (response.status === 204) {
        return null;
    }

    if (contentType.includes("application/json")) {
        return response.json();
    }

    const text = await response.text();

    return {
        success: response.ok,
        message: text
    };
}

function showGlobalToast(title, message, type = "error") {
    let toastStack = document.querySelector("[data-toast-stack]") || document.querySelector(".toast-stack");

    if (!toastStack) {
        toastStack = document.createElement("div");
        toastStack.className = "toast-stack";
        toastStack.dataset.toastStack = "";
        document.body.appendChild(toastStack);
    }

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

const apiClient = {
    async request(endpoint, options = {}) {
        const {
            method = "GET",
            body = null,
            query = null,
            headers = {},
            auth = true,
            timeoutMs = CONFIG?.API?.TIMEOUT_MS || 12000,
            idempotency = true,
            redirectOnUnauthorized = true
        } = options;

        const upperMethod = method.toUpperCase();
        const url = buildUrl(endpoint, query);
        const { controller, timeoutId } = createTimeoutController(timeoutMs);

        const requestHeaders = {
            Accept: "application/json",
            ...headers
        };

        if (body !== null && body !== undefined && !(body instanceof FormData)) {
            requestHeaders["Content-Type"] = "application/json";
        }

        if (idempotency && ["POST", "PUT", "PATCH", "DELETE"].includes(upperMethod)) {
            requestHeaders["x-request-id"] = generateRequestId();
        }

        const token = getAuthToken();

        if (auth && token) {
            requestHeaders.Authorization = `Bearer ${token}`;
        }

        const fetchConfig = {
            method: upperMethod,
            headers: requestHeaders,
            signal: controller.signal
        };

        if (body !== null && body !== undefined) {
            fetchConfig.body = body instanceof FormData ? body : JSON.stringify(body);
        }

        try {
            const response = await fetch(url, fetchConfig);
            const payload = await parseResponseBody(response);

            if (!response.ok || payload?.success === false) {
                const errorCode = payload?.error_code || payload?.errorCode || payload?.code || "API_ERROR";
                const message = payload?.message || "Hệ thống đang gián đoạn, vui lòng thử lại.";

                if (response.status === 401 && redirectOnUnauthorized && !endpoint.includes("/auth/login")) {
                    clearAuth();
                    redirectToLogin("session=expired");
                }

                if (response.status === 403) {
                    showGlobalToast("Từ chối truy cập", message || "Bạn không có quyền thực hiện thao tác này.", "error");
                }

                throw new ApiError({
                    status: response.status,
                    errorCode,
                    message,
                    data: payload?.data || null,
                    endpoint,
                    method: upperMethod
                });
            }

            return payload;
        } catch (error) {
            if (error.name === "AbortError") {
                throw new ApiError({
                    status: 408,
                    errorCode: "REQUEST_TIMEOUT",
                    message: "Yêu cầu vượt quá thời gian chờ. Vui lòng thử lại.",
                    endpoint,
                    method: upperMethod
                });
            }

            if (error instanceof ApiError) {
                throw error;
            }

            throw new ApiError({
                status: 0,
                errorCode: "NETWORK_ERROR",
                message: "Không thể kết nối đến máy chủ. Hãy kiểm tra backend, mạng hoặc CORS.",
                data: error,
                endpoint,
                method: upperMethod
            });
        } finally {
            window.clearTimeout(timeoutId);
        }
    },

    get(endpoint, query = null, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: "GET",
            query
        });
    },

    post(endpoint, body = null, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: "POST",
            body
        });
    },

    put(endpoint, body = null, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: "PUT",
            body
        });
    },

    patch(endpoint, body = null, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: "PATCH",
            body
        });
    },

    delete(endpoint, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: "DELETE"
        });
    },

    health() {
        return this.get("/health", null, {
            auth: false,
            idempotency: false
        });
    },

    getAuthToken,
    setAuthToken,
    getAuthUser,
    setAuthUser,
    clearAuth,
    showGlobalToast,
    redirectToLogin
};

window.apiClient = apiClient;

export { ApiError, apiClient };
export default apiClient;
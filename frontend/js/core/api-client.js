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
        const random = Math.random() * 16 | 0;
        const value = char === "x" ? random : (random & 0x3 | 0x8);

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
    const baseUrl = CONFIG.API.BASE_URL.replace(/\/$/, "");
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

function getAuthToken() {
    return storage.getRaw(CONFIG.AUTH_TOKEN_KEY)
        || storage.get("jwt_token")
        || window.localStorage.getItem("jwt_token")
        || null;
}

function setAuthToken(token) {
    if (!token) {
        storage.remove(CONFIG.AUTH_TOKEN_KEY);
        window.localStorage.removeItem("jwt_token");
        return;
    }

    storage.setRaw(CONFIG.AUTH_TOKEN_KEY, token);
    window.localStorage.setItem("jwt_token", token);
}

function getAuthUser() {
    return storage.get(CONFIG.AUTH_USER_KEY, null);
}

function setAuthUser(user) {
    if (!user) {
        storage.remove(CONFIG.AUTH_USER_KEY);
        return;
    }

    storage.set(CONFIG.AUTH_USER_KEY, user);
}

function clearAuth() {
    storage.remove(CONFIG.AUTH_TOKEN_KEY);
    storage.remove(CONFIG.AUTH_USER_KEY);
    window.localStorage.removeItem("jwt_token");
}

function createTimeoutController(timeoutMs) {
    const controller = new AbortController();

    const timeoutId = window.setTimeout(() => {
        controller.abort();
    }, timeoutMs);

    return {
        controller,
        timeoutId
    };
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

const apiClient = {
    async request(endpoint, options = {}) {
        const {
            method = "GET",
            body = null,
            query = null,
            headers = {},
            auth = true,
            timeoutMs = CONFIG.API.TIMEOUT_MS,
            idempotency = true
        } = options;

        const upperMethod = method.toUpperCase();
        const url = buildUrl(endpoint, query);
        const { controller, timeoutId } = createTimeoutController(timeoutMs);

        const requestHeaders = {
            Accept: "application/json",
            ...headers
        };

        const shouldAttachJsonContentType = body !== null
            && body !== undefined
            && !(body instanceof FormData);

        if (shouldAttachJsonContentType) {
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
                throw new ApiError({
                    status: response.status,
                    errorCode: payload?.error_code || payload?.errorCode || "API_ERROR",
                    message: payload?.message || "Request failed.",
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
                    message: "Request quá thời gian chờ. Vui lòng thử lại.",
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
                message: "Không thể kết nối đến backend. Kiểm tra server hoặc CORS.",
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

    async health() {
        return this.get("/health", null, {
            auth: false,
            idempotency: false
        });
    },

    getAuthToken,
    setAuthToken,
    getAuthUser,
    setAuthUser,
    clearAuth
};

window.apiClient = apiClient;

export {
    ApiError,
    apiClient
};

export default apiClient;
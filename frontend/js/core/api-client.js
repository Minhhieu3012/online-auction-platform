/**
 * Frontend Core: API Client
 * Xử lý giao tiếp HTTP chuẩn hóa với Backend
 */

const API_BASE_URL = 'http://localhost:3000/api';

// Hàm tạo UUID v4 để làm Idempotency Key chống Double-click
const generateRequestId = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const apiClient = {
    async request(endpoint, method = 'GET', body = null) {
        // Khởi tạo headers mặc định với Idempotency Key
        const headers = {
            'Content-Type': 'application/json',
            'x-request-id': generateRequestId()
        };

        // Gắn JWT Token nếu user đã Sign In
        const token = localStorage.getItem('jwt_token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const config = {
            method,
            headers,
        };

        if (body) {
            config.body = JSON.stringify(body);
        }

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
            const data = await response.json();

            // Xử lý chuẩn format { success, error_code, message } của Backend
            if (!response.ok || data.success === false) {
                const errorPayload = {
                    status: response.status,
                    errorCode: data.error_code || 'UNKNOWN_ERROR',
                    message: data.message || 'Hệ thống đang gián đoạn, vui lòng thử lại.'
                };
                throw errorPayload;
            }

            return data;
        } catch (error) {
            console.error(`[API Client Error] ${method} ${endpoint}:`, error);
            throw error;
        }
    },

    // Các hàm wrapper tiện ích
    get(endpoint) { return this.request(endpoint, 'GET'); },
    post(endpoint, body) { return this.request(endpoint, 'POST', body); },
    put(endpoint, body) { return this.request(endpoint, 'PUT', body); },
    delete(endpoint) { return this.request(endpoint, 'DELETE'); }
};

// Export cho môi trường Browser
window.apiClient = apiClient;
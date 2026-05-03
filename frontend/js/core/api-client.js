/**
 * Frontend Core: API Client
 * Đã sửa lỗi: Đảm bảo Token và Header được gửi đi chính xác
 */

const API_BASE_URL = 'http://localhost:3000/api';

const generateRequestId = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const apiClient = {
    async request(endpoint, method = 'GET', body = null) {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'x-request-id': generateRequestId()
        };

        const token = localStorage.getItem('jwt_token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const config = { method, headers };
        if (body) config.body = JSON.stringify(body);

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
            const isJson = response.headers.get('content-type')?.includes('application/json');
            const data = isJson ? await response.json() : {};

            if (!response.ok || data.success === false) {
                const errorPayload = {
                    status: response.status,
                    errorCode: data.error_code || 'API_ERROR',
                    message: data.message || 'Hệ thống đang gián đoạn, vui lòng thử lại.'
                };

                if (response.status === 401 && endpoint !== '/auth/login') {
                    console.warn('[API Client] Phiên làm việc hết hạn.');
                    localStorage.removeItem('jwt_token');
                }
                
                throw errorPayload;
            }

            return data;
        } catch (error) {
            console.error(`[API Client Error] ${method} ${endpoint}:`, error);
            throw error;
        }
    },

    get(endpoint) { return this.request(endpoint, 'GET'); },
    post(endpoint, body) { return this.request(endpoint, 'POST', body); },
    put(endpoint, body) { return this.request(endpoint, 'PUT', body); },
    delete(endpoint) { return this.request(endpoint, 'DELETE'); }
};

window.apiClient = apiClient;
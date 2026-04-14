// ==========================================
// api-client.js - Core API Fetching
// ==========================================

// Thay đổi cổng này nếu Backend Express chạy ở cổng khác
const API_BASE_URL = 'http://localhost:3000/api';

export const apiClient = {
    // Hàm GET dữ liệu
    async get(endpoint) {
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`);
            if (!response.ok) {
                throw new Error(`Lỗi HTTP: ${response.status} - ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`[API Error] Lỗi khi lấy dữ liệu từ ${endpoint}:`, error);
            return null; // Handle fallback UI ở phía module gọi API
        }
    },

    // Hàm POST dữ liệu (Gửi form, đăng ký, đăng sản phẩm)
    async post(endpoint, data) {
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Nếu dùng JWT Token, thêm vào đây:
                    // 'Authorization': `Bearer ${sessionStorage.getItem('token')}`
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Lỗi HTTP: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`[API Error] Lỗi khi gửi dữ liệu đến ${endpoint}:`, error);
            throw error; // Ném lỗi ra để UI hiển thị thông báo
        }
    }
}; 
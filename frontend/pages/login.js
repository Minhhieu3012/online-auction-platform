/**
 * Frontend Page: Login Logic
 * Chịu trách nhiệm xử lý đăng nhập và lưu trữ phiên làm việc
 */

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginButton = document.querySelector('button[type="submit"]');

    if (!loginForm) {
        console.warn('[Auth] Không tìm thấy loginForm trong HTML.');
        return;
    }

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        // 1. Thu thập dữ liệu và làm sạch
        const credentials = {
            email: emailInput.value.trim(),
            password: passwordInput.value
        };

        if (!credentials.email || !credentials.password) {
            alert('Vui lòng nhập đầy đủ Email và Mật khẩu.');
            return;
        }

        // Vô hiệu hóa nút để tránh gửi trùng (Chống Double-click)
        loginButton.disabled = true;
        loginButton.textContent = 'Đang xác thực...';

        try {
            /**
             * 2. Sử dụng apiClient của Huy để gửi yêu cầu
             * Endpoint mặc định thường là /v1/auth/login
             * Base URL 'http://localhost:3000/api' đã được cấu hình trong apiClient
             */
            const response = await window.apiClient.post('/v1/auth/login', credentials);

            /**
             * 3. Xử lý thành công
             * Backend trả về format: { success: true, token: "...", user: {...} }
             */
            if (response.token) {
                // Lưu JWT Token vào localStorage để apiClient tự động đính kèm vào Header sau này
                localStorage.setItem('jwt_token', response.token);
                
                // Lưu thông tin user để hiển thị cá nhân hóa
                if (response.user) {
                    localStorage.setItem('user_info', JSON.stringify(response.user));
                }

                console.log('[Auth] Đăng nhập thành công, đã lưu Token.');
                
                // Chuyển hướng về trang chi tiết sản phẩm
                window.location.href = 'product-detail.html?id=842';
            }
        } catch (error) {
            /**
             * 4. Xử lý lỗi dựa trên format của apiClient[cite: 2]
             * errorCode: data.error_code || 'UNKNOWN_ERROR'
             */
            console.error('[Auth Error]:', error);
            const errorMessage = error.message || 'Sai tài khoản hoặc mật khẩu.';
            alert(`Đăng nhập thất bại: ${errorMessage}`);
        } finally {
            loginButton.disabled = false;
            loginButton.textContent = 'Đăng nhập';
        }
    });
});
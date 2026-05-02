document.addEventListener('DOMContentLoaded', () => {
    /* =========================================
       FAKE ACCOUNTS (Mock Data)
       ========================================= */
    const mockUsers = [
        { email: 'huy@tp.vn', password: '123456', role: 'Buyer', name: 'Nguyễn Huy' },
        { email: 'seller@tp.vn', password: '123456', role: 'Seller', name: 'Đại lý Cổ vật' },
        { email: 'admin@tp.vn', password: '123456', role: 'Admin', name: 'Hệ thống TP' }
    ];

    /* =========================================
       Logic Carousel (Update logic chạy sang PHẢI)
       ========================================= */
    const slider = document.getElementById('featured-carousel');
    const track = document.getElementById('carousel-track');
    
    if (slider && track) {
        // Nhân đôi nội dung để tạo hiệu ứng vòng lặp vô tận
        const items = track.innerHTML;
        track.innerHTML += items;

        let isDown = false;
        let startX;
        let scrollLeft;
        let animationId;
        
        // Tốc độ chạy sang phải (0.4px mỗi khung hình)
        let autoScrollSpeed = 0.4; 
        let scrollAccumulator = 0;

        function autoScroll() {
            if (!isDown) {
                // Cộng dồn phần thập phân vì scrollLeft chỉ nhận số nguyên
                scrollAccumulator += autoScrollSpeed;
                if (scrollAccumulator >= 1) {
                    let scrollAmount = Math.floor(scrollAccumulator);
                    // TRỪ scrollLeft để danh sách chạy sang PHẢI
                    slider.scrollLeft -= scrollAmount;
                    scrollAccumulator -= scrollAmount;
                }
                
                // Vòng lặp vô tận sang phải
                if (slider.scrollLeft <= 0) {
                    slider.scrollLeft = track.scrollWidth / 2;
                }
            }
            animationId = requestAnimationFrame(autoScroll);
        }

        slider.addEventListener('mouseenter', () => cancelAnimationFrame(animationId));
        
        slider.addEventListener('mouseleave', () => {
            isDown = false;
            animationId = requestAnimationFrame(autoScroll);
        });

        slider.addEventListener('mousedown', (e) => {
            isDown = true;
            startX = e.pageX - slider.offsetLeft;
            scrollLeft = slider.scrollLeft;
            cancelAnimationFrame(animationId);
        });

        slider.addEventListener('mouseup', () => {
            isDown = false;
            animationId = requestAnimationFrame(autoScroll);
        });

        slider.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - slider.offsetLeft;
            // walk nhân với hệ số tốc độ kéo chuột (1.5)
            const walk = (x - startX) * 1.5; 
            slider.scrollLeft = scrollLeft - walk;
        });

        // Khởi tạo vị trí bắt đầu ở giữa để có thể chạy sang phải liền mạch
        slider.scrollLeft = track.scrollWidth / 2;
        animationId = requestAnimationFrame(autoScroll);
    }

    /* =========================================
       Logic Xác thực Đăng nhập (Mock Auth)
       ========================================= */
    const signinForm = document.getElementById('signin-form');

    if (signinForm) {
        signinForm.addEventListener('submit', (event) => {
            event.preventDefault(); // Ngăn load lại trang

            // Lấy dữ liệu từ form
            const email = document.getElementById('signin-email').value;
            const password = document.getElementById('signin-password').value;
            const statusMessage = document.getElementById('signin-status');

            // Tìm user trong dữ liệu giả
            const user = mockUsers.find(u => u.email === email && u.password === password);

            if (user) {
                // Đăng nhập thành công
                statusMessage.textContent = `Chào mừng ${user.name}! Đang thiết lập phiên đăng nhập...`;
                statusMessage.style.color = 'green';
                
                // Lưu trạng thái đăng nhập tạm thời vào Session
                sessionStorage.setItem('isLoggedIn', 'true');
                sessionStorage.setItem('userEmail', user.email);
                sessionStorage.setItem('userRole', user.role);

                // Tự động đóng modal sau 1.5 giây
                setTimeout(() => {
                    closeAuthModal();
                    // Nút Sign In chuyển thành Tên User
                    const authBtn = document.querySelector('.auth-buttons button');
                    if(authBtn) {
                        authBtn.textContent = user.name;
                        authBtn.onclick = null; // Tạm tắt popup đăng nhập khi đã login
                    }
                }, 1500);
            } else {
                // Đăng nhập thất bại
                statusMessage.textContent = 'Email hoặc mật khẩu không chính xác.';
                statusMessage.style.color = 'red';
            }
        });
    }

    /* =========================================
       Logic Modal Auth (Sign In / Register)
       ========================================= */
    const authModal = document.getElementById('auth-modal');
    const signinView = document.getElementById('modal-signin');
    const registerView = document.getElementById('modal-register');

    window.openAuthModal = function(type) {
        if (!authModal) return;
        authModal.classList.add('active');
        
        if (type === 'signin') {
            signinView.style.display = 'block';
            registerView.style.display = 'none';
        } else if (type === 'register') {
            signinView.style.display = 'none';
            registerView.style.display = 'block';
        }
    };

    window.closeAuthModal = function() {
        if (authModal) authModal.classList.remove('active');
        // Reset thông báo khi đóng modal
        const statusMessage = document.getElementById('signin-status');
        if (statusMessage) statusMessage.textContent = '';
    };

    if (authModal) {
        authModal.addEventListener('click', function(e) {
            if (e.target === authModal) {
                closeAuthModal();
            }
        });
    }
});
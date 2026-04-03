document.addEventListener('DOMContentLoaded', () => {
    /* =========================================
       Logic Carousel Bất Tận (Giữ nguyên)
       ========================================= */
    const slider = document.getElementById('featured-carousel');
    const track = document.getElementById('carousel-track');
    
    if (slider && track) {
        const items = track.innerHTML;
        track.innerHTML += items;

        let isDown = false;
        let startX;
        let scrollLeft;
        let animationId;
        
        let autoScrollSpeed = 0.4;
        let scrollAccumulator = 0;

        function autoScroll() {
            if (!isDown) {
                scrollAccumulator += autoScrollSpeed;
                if (scrollAccumulator >= 1) {
                    let scrollAmount = Math.floor(scrollAccumulator);
                    slider.scrollLeft -= scrollAmount;
                    scrollAccumulator -= scrollAmount;
                }
                
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
            const walk = (x - startX) * 1.5; 
            slider.scrollLeft = scrollLeft - walk;
        });

        slider.scrollLeft = track.scrollWidth / 2;
        animationId = requestAnimationFrame(autoScroll);
    }

    /* =========================================
       Logic Modal Auth (Sign In / Register)
       ========================================= */
    const authModal = document.getElementById('auth-modal');
    const signinView = document.getElementById('modal-signin');
    const registerView = document.getElementById('modal-register');

    // Mở Modal và chọn form hiển thị
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

    // Đóng Modal
    window.closeAuthModal = function() {
        if (authModal) authModal.classList.remove('active');
    };

    // Đóng modal khi click ra ngoài vùng xám (overlay)
    if (authModal) {
        authModal.addEventListener('click', function(e) {
            if (e.target === authModal) {
                closeAuthModal();
            }
        });
    }
});
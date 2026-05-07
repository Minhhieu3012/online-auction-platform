/**
 * Module: Countdown Timer
 * Xử lý đếm ngược thời gian thực và sự kiện Anti-sniping
 */

class AuctionCountdown {
    constructor(elementId, badgeId) {
        this.timerElement = document.getElementById(elementId);
        this.badgeElement = document.getElementById(badgeId);
        this.endTimeMs = 0;
        this.interval = null;
    }

    // Khởi tạo thời gian kết thúc (nhận từ API hoặc Socket)
    setEndTime(isoStringOrMs) {
        if (!isoStringOrMs) return;
        
        // Chuyển đổi định dạng hỗn loạn từ Backend thành Timestamp chuẩn
        if (typeof isoStringOrMs === 'string' && /^\d+$/.test(isoStringOrMs)) {
            this.endTimeMs = parseInt(isoStringOrMs, 10);
        } else {
            this.endTimeMs = new Date(isoStringOrMs).getTime();
        }
        
        this.start();
    }

    // Xử lý khi có sự kiện cộng giờ (Anti-sniping)
    extendTime(newEndTime) {
        this.setEndTime(newEndTime);
        
        // Hiển thị badge gia hạn
        if (this.badgeElement) {
            this.badgeElement.classList.remove('hidden');
            setTimeout(() => {
                this.badgeElement.classList.add('hidden');
            }, 5000); // Tắt badge sau 5 giây
        }
    }

    start() {
        if (this.interval) clearInterval(this.interval);

        this.interval = setInterval(() => {
            const now = Date.now();
            const distance = this.endTimeMs - now;

            if (distance <= 0) {
                clearInterval(this.interval);
                this.timerElement.innerHTML = "ENDED";
                this.timerElement.style.color = "var(--color-muted)";
                // Kích hoạt event cục bộ để vô hiệu hóa nút bấm
                window.dispatchEvent(new Event('auction_ended'));
                return;
            }

            // Tính toán giờ, phút, giây
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            // Format 00:00:00
            const h = hours < 10 ? "0" + hours : hours;
            const m = minutes < 10 ? "0" + minutes : minutes;
            const s = seconds < 10 ? "0" + seconds : seconds;

            this.timerElement.innerHTML = `${h}:${m}:${s}`;
            
            // Đổi màu cảnh báo khi dưới 30s
            if (distance < 30000) {
                this.timerElement.style.color = "red";
            } else {
                this.timerElement.style.color = "inherit";
            }
        }, 1000);
    }
}

// Khởi tạo instance toàn cục
window.countdownTimer = new AuctionCountdown('countdown-timer', 'extension-badge');
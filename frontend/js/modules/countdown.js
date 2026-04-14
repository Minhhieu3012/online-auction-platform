// ==========================================
// countdown.js - Real-time Timer
// ==========================================

export function startCountdown(elementId, endTimeISOString) {
    const element = document.getElementById(elementId);
    if (!element) {
        console.warn(`[Countdown] Không tìm thấy DOM có ID: ${elementId}`);
        return null;
    }

    const endTime = new Date(endTimeISOString).getTime();

    const intervalId = setInterval(() => {
        const now = new Date().getTime();
        const distance = endTime - now;

        // Edge Case: Hết giờ -> Đóng băng đồng hồ và gắn class trạng thái kết thúc
        if (distance < 0) {
            clearInterval(intervalId);
            element.innerHTML = "ĐÃ KẾT THÚC";
            element.style.color = '#8c2b22'; 
            return;
        }

        // Tính toán Giờ, Phút, Giây
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        // Chuẩn hóa format chuỗi (Vd: 09:05:01)
        const formatZero = (num) => (num < 10 ? `0${num}` : num);
        
        element.innerHTML = `${formatZero(hours)}:${formatZero(minutes)}:${formatZero(seconds)}`;
    }, 1000);

    return intervalId; // Trả về ID để có thể clear khi cần hủy component
}
// ==========================================
// notifications.js - UI Toast Controller
// ==========================================

export function showNotification(title, message, type = 'info') {
    // Edge case: Giới hạn số lượng toast trên màn hình để tránh spam DOM
    const existingToasts = document.querySelectorAll('.toast-notification');
    if (existingToasts.length > 3) {
        existingToasts[0].remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    
    // Styling động không cần file CSS riêng
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    // Màu đỏ (#8c2b22) cho lỗi/outbid, Nâu tối (#3a1f1d) cho thành công/info
    toast.style.backgroundColor = type === 'error' ? '#8c2b22' : '#3a1f1d';
    toast.style.color = '#fff';
    toast.style.padding = '15px 25px';
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = '0 10px 20px rgba(0,0,0,0.2)';
    toast.style.zIndex = '9999';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    toast.style.transition = 'all 0.3s ease';
    toast.style.fontFamily = "'Nunito', sans-serif";

    toast.innerHTML = `
        <strong style="display:block; margin-bottom:5px; font-size: 16px;">${title}</strong>
        <span style="font-size: 14px;">${message}</span>
    `;

    document.body.appendChild(toast);

    // Kích hoạt animation xuất hiện
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });

    // Tự động xóa sau 3.5 giây
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        // Đợi animation hoàn tất rồi xóa DOM
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}
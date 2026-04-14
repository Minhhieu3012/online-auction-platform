// ==========================================
// bid-logic.js - Bidding & Proxy Logic
// ==========================================
import { socket } from '../core/socket-client.js';
import { showNotification } from './notifications.js';

export function placeManualBid(auctionId, amount) {
    // 1. Edge Case: Bắt lỗi nếu người dùng chưa đăng nhập
    const isLoggedIn = sessionStorage.getItem('isLoggedIn');
    if (!isLoggedIn) {
        if (typeof window.openAuthModal === 'function') {
            window.openAuthModal('signin');
        } else {
            showNotification('Yêu cầu', 'Vui lòng đăng nhập để tham gia đấu giá.', 'error');
        }
        return;
    }

    const userEmail = sessionStorage.getItem('userEmail');
    const numericAmount = parseFloat(amount);

    // 2. Edge Case: Validate dữ liệu đầu vào
    if (isNaN(numericAmount) || numericAmount <= 0) {
        showNotification('Lỗi', 'Số tiền đặt giá không hợp lệ.', 'error');
        return;
    }

    // 3. Chuẩn bị payload theo format đã thống nhất
    const payload = {
        auction_id: auctionId,
        bidder_email: userEmail,
        amount: numericAmount,
        timestamp: new Date().toISOString()
    };

    // 4. Phát sự kiện qua Socket
    socket.emit('place_bid', payload);
    showNotification('Thành công', `Đã gửi lệnh đặt giá: ${numericAmount.toLocaleString('vi-VN')}đ`, 'info');
}

export function setupSmartProxyBidding(auctionId, maxAmount) {
    const isLoggedIn = sessionStorage.getItem('isLoggedIn');
    if (!isLoggedIn) return showNotification('Lỗi', 'Chưa đăng nhập!', 'error');

    const numericMaxAmount = parseFloat(maxAmount);
    if (isNaN(numericMaxAmount) || numericMaxAmount <= 0) {
        showNotification('Lỗi', 'Mức giá tối đa không hợp lệ.', 'error');
        return;
    }

    // Gửi lệnh cài đặt Proxy Bidding lên Server để Server tự động đỡ giá
    socket.emit('setup_proxy_bid', {
        auction_id: auctionId,
        user_email: sessionStorage.getItem('userEmail'),
        max_amount: numericMaxAmount
    });

    showNotification('Smart Proxy', `Hệ thống sẽ tự động đặt giá giúp bạn tối đa tới ${numericMaxAmount.toLocaleString('vi-VN')}đ`, 'info');
}

// Hàm này được gọi từ main.js hoặc nơi khởi tạo app để lắng nghe chung các sự kiện
export function initBidListeners() {
    socket.on('outbid_notification', (data) => {
        showNotification('Cảnh Báo!', `Bạn vừa bị vượt giá ở phiên ${data.auction_id}. Giá mới: ${data.new_price.toLocaleString('vi-VN')}đ`, 'error');
    });

    socket.on('update_auction', (data) => {
        // Cập nhật DOM. Giả sử thẻ chứa giá hiện tại có id="price-1024"
        const priceElement = document.getElementById(`price-${data.auction_id}`);
        if (priceElement) {
            priceElement.textContent = `${data.current_price.toLocaleString('vi-VN')}đ`;
            // Tạo hiệu ứng flash sáng lên để user chú ý
            priceElement.style.color = '#8c2b22';
            setTimeout(() => priceElement.style.color = '', 1000);
        }
    });
}
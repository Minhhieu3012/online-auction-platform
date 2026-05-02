/**
 * Module: Bidding Logic
 * Quản lý gửi API và lắng nghe Socket
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Lấy Auction ID từ URL (Ví dụ: product-detail.html?id=1)
    const urlParams = new URLSearchParams(window.location.search);
    const auctionId = urlParams.get('id') || 1; // Fallback ID 1 để test

    // 2. DOM Elements
    const domCurrentPrice = document.getElementById('current-price');
    const domHighestBidder = document.getElementById('highest-bidder-label');
    const domMinBidHint = document.getElementById('min-bid-hint');
    const inputBid = document.getElementById('bid-input');
    const btnPlaceBid = document.getElementById('btn-place-bid');
    
    const inputProxy = document.getElementById('proxy-input');
    const btnSetProxy = document.getElementById('btn-set-proxy');
    
    const toastContainer = document.getElementById('toast-container');

    // Biến trạng thái
    let currentStepPrice = 0;
    let currentHighestPrice = 0;

    // 3. Hàm tiện ích hiển thị Toast
    const showToast = (message, type = 'success') => {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerText = message;
        toastContainer.prepend(toast);
        setTimeout(() => toast.remove(), 4000);
    };

    // 4. Khởi tạo dữ liệu ban đầu qua API
    const loadAuctionData = async () => {
        try {
            // Giả định backend có API lấy chi tiết. Nếu chưa có, Hiếu phải viết thêm GET /api/auctions/:id
            const res = await window.apiClient.get(`/auctions/${auctionId}`);
            if (res && res.data) {
                document.getElementById('product-name').innerText = res.data.productName || `Auction #${auctionId}`;
                
                currentHighestPrice = parseFloat(res.data.currentPrice);
                currentStepPrice = parseFloat(res.data.stepPrice);
                
                updatePriceDOM(currentHighestPrice, res.data.highestBidder);
                window.countdownTimer.setEndTime(res.data.endTime);
            }
        } catch (error) {
            showToast('Lỗi tải dữ liệu phiên đấu giá.', 'error');
        }
    };

    const updatePriceDOM = (price, bidder) => {
        currentHighestPrice = price;
        domCurrentPrice.innerText = `$${price.toFixed(2)}`;
        domHighestBidder.innerText = bidder ? `Highest bidder: User ${bidder}` : 'No bids yet';
        
        const minRequired = price + currentStepPrice;
        domMinBidHint.innerText = `Minimum bid required: $${minRequired.toFixed(2)}`;
        inputBid.min = minRequired;
    };

    // 5. Kết nối Socket Real-time
    if (window.socketClient) {
        window.socketClient.connect(auctionId);

        window.socketClient.on('price_update', (data) => {
            updatePriceDOM(data.currentPrice, data.highestBidder);
            // Hiệu ứng flash nhẹ
            domCurrentPrice.style.opacity = '0.5';
            setTimeout(() => domCurrentPrice.style.opacity = '1', 150);
        });

        window.socketClient.on('auction_extended', (data) => {
            window.countdownTimer.extendTime(data.newEndTime);
        });

        window.socketClient.on('outbid_alert', () => {
            showToast('Bạn đã bị trả giá cao hơn! Hãy đặt giá mới.', 'error');
        });

        window.socketClient.on('auction_closed', () => {
            window.dispatchEvent(new Event('auction_ended'));
        });
    }

    // 6. Xử lý Đặt giá thủ công (Manual Bid)
    btnPlaceBid.addEventListener('click', async () => {
        const bidAmount = parseFloat(inputBid.value);
        if (!bidAmount || bidAmount < (currentHighestPrice + currentStepPrice)) {
            return showToast('Mức giá không hợp lệ.', 'error');
        }

        btnPlaceBid.disabled = true;
        btnPlaceBid.innerText = 'PROCESSING...';

        try {
            await window.apiClient.post(`/auctions/${auctionId}/bids`, { bidAmount });
            showToast('Đặt giá thành công!');
            inputBid.value = '';
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            btnPlaceBid.disabled = false;
            btnPlaceBid.innerText = 'BID NOW';
        }
    });

    // 7. Xử lý Đặt giá tự động (Proxy Bid)
    btnSetProxy.addEventListener('click', async () => {
        const maxAmount = parseFloat(inputProxy.value);
        if (!maxAmount || maxAmount <= currentHighestPrice) {
            return showToast('Hạn mức tự động phải cao hơn giá hiện tại.', 'error');
        }

        btnSetProxy.disabled = true;
        
        try {
            await window.apiClient.post(`/auctions/${auctionId}/autobid`, { maxAmount });
            showToast(`Đã thiết lập Auto-bid tối đa $${maxAmount}`);
            inputProxy.value = '';
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            btnSetProxy.disabled = false;
        }
    });

    // 8. Khóa form khi kết thúc
    window.addEventListener('auction_ended', () => {
        btnPlaceBid.disabled = true;
        btnSetProxy.disabled = true;
        inputBid.disabled = true;
        inputProxy.disabled = true;
        showToast('Phiên đấu giá đã kết thúc.', 'error');
    });

    // Init
    loadAuctionData();
});
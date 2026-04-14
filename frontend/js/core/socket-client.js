// ==========================================
// socket-client.js - Real-time Communication
// ==========================================

/* * LƯU Ý CHO HUY: 
* Khi tích hợp thực tế, bạn cần nhúng CDN Socket.io vào file HTML:
* <script src="https://cdn.socket.io/4.7.4/socket.io.min.js"></script>
* Sau đó bỏ comment dòng kết nối bên dưới và xóa block MOCK đi.
*/

// --- CODE THỰC TẾ (Đang comment chờ Backend) ---
// export const socket = io("http://localhost:3000");

// --- CODE MOCK (Dùng để test giao diện Frontend) ---
export const socket = {
    callbacks: {},
    
    // Lắng nghe sự kiện từ Server
    on(eventName, callback) {
        console.log(`[Socket] Đang lắng nghe: ${eventName}`);
        this.callbacks[eventName] = callback;

        // Tự động giả lập có người đặt giá sau mỗi 15 giây để test UI
        if (eventName === 'update_auction') {
            setInterval(() => {
                if (typeof this.callbacks['update_auction'] === 'function') {
                    const mockNewPrice = Math.floor(Math.random() * 500000) + 1000000;
                    this.callbacks['update_auction']({
                        auction_id: '1024',
                        current_price: mockNewPrice,
                        highest_bidder: 'Người dùng ẩn danh'
                    });
                }
            }, 15000);
        }
    },

    // Phát sự kiện lên Server
    emit(eventName, data) {
        console.log(`[Socket] Phát sự kiện: ${eventName}`, data);
        
        // Giả lập Server phản hồi thành công sau khi đặt giá
        if (eventName === 'place_bid') {
            setTimeout(() => {
                if (typeof this.callbacks['update_auction'] === 'function') {
                    this.callbacks['update_auction']({
                        auction_id: data.auction_id,
                        current_price: data.amount,
                        highest_bidder: data.bidder_email
                    });
                }
            }, 500);
        }
    }
};
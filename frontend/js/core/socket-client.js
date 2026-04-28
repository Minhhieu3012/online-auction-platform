/**
 * Frontend Core: Socket.io Client
 * Quản lý kết nối Real-time với độ trễ < 50ms
 */

const SOCKET_SERVER_URL = 'http://localhost:3000';

class AuctionSocketClient {
    constructor() {
        this.socket = null;
        this.listeners = new Map();
    }

    // Kết nối và tham gia vào đúng Phòng đấu giá (Auction Room)
    connect(auctionId) {
        if (typeof io === 'undefined') {
            console.error('[Socket Error] Không tìm thấy thư viện Socket.io. Vui lòng thêm <script src="https://cdn.socket.io/4.7.4/socket.io.min.js"></script> vào HTML.');
            return;
        }

        // Khởi tạo kết nối, ép dùng websocket để bỏ qua polling giúp đạt < 50ms
        this.socket = io(SOCKET_SERVER_URL, {
            query: { auctionId: auctionId },
            transports: ['websocket']
        });

        this.socket.on('connect', () => {
            console.log(`[Socket] Đã kết nối vào phòng đấu giá ID: ${auctionId}`);
        });

        this.socket.on('disconnect', () => {
            console.warn('[Socket] Mất kết nối tới máy chủ.');
        });

        // ==========================================
        // CÁC KÊNH LẮNG NGHE TỪ BACKEND
        // ==========================================

        // 1. Nhận giá mới
        this.socket.on('price_update', (data) => {
            /* Kỳ vọng data: { currentPrice: 1500, highestBidder: 'userId', version: 5 } */
            this.trigger('price_update', data);
        });

        // 2. Nhận tín hiệu Anti-sniping (Gia hạn giờ)
        this.socket.on('auction_extended', (data) => {
            /* Kỳ vọng data: { newEndTime: '2026-04-29T...', extensionCount: 1 } */
            this.trigger('auction_extended', data);
        });

        // 3. Nhận thông báo bị giành giật (Outbid)
        this.socket.on('outbid_alert', (data) => {
            this.trigger('outbid_alert', data);
        });

        // 4. Nhận lệnh kết thúc phiên
        this.socket.on('auction_closed', (data) => {
            /* Kỳ vọng data: { finalPrice: 2000, winnerId: 'userId' } */
            this.trigger('auction_closed', data);
        });
    }

    // Đăng ký hàm callback cho các file Module (như bid-logic.js) lắng nghe
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    // Kích hoạt callback khi có dữ liệu mới
    trigger(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => callback(data));
        }
    }

    // Đóng kết nối khi rời trang
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        this.listeners.clear();
    }
}

window.socketClient = new AuctionSocketClient();
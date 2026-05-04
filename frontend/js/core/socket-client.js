/**
 * Frontend Core: Socket.io Client
 * Quản lý kết nối Real-time với độ trễ < 50ms
 */

const SOCKET_SERVER_URL = "http://localhost:3000";

class AuctionSocketClient {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  connect(auctionId) {
    if (typeof io === "undefined") {
      console.error("[Socket Error] Không tìm thấy thư viện Socket.io trong HTML.");
      return;
    }

    this.socket = io(SOCKET_SERVER_URL, {
      query: { auctionId: auctionId },
      transports: ["websocket"],
    });

    this.socket.on("connect", () => {
      console.log(`[Socket] Đã kết nối vào phòng đấu giá ID: ${auctionId}`);
    });

    this.socket.on("disconnect", () => {
      console.warn("[Socket] Mất kết nối tới máy chủ.");
    });

    // ==========================================
    // CÁC KÊNH LẮNG NGHE TỪ BACKEND ĐÃ ĐƯỢC CHUẨN HÓA
    // ==========================================

    // 1. Nhận giá mới
    this.socket.on("new_bid", (data) => {
      this.trigger("new_bid", data);
    });

    // 2. Nhận tín hiệu Anti-sniping (Gia hạn giờ)
    this.socket.on("auction_extended", (data) => {
      this.trigger("auction_extended", data);
    });

    // 3. Nhận thông báo gian lận từ AI
    this.socket.on("fraud_detected", (data) => {
      this.trigger("fraud_detected", data);
    });

    // 4. Nhận Link thanh toán Stripe khi chiến thắng
    this.socket.on("auction_winner", (data) => {
      this.trigger("auction_winner", data);
    });
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  trigger(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach((callback) => callback(data));
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
  }
}

window.socketClient = new AuctionSocketClient();

/**
 * Frontend Core: Socket.io Client
 * Quản lý kết nối real-time giữa FE và Backend Node.js.
 */

(function initAuctionSocketClient(global) {
  const SOCKET_SERVER_URL = global.BROSGEM_SOCKET_URL || "https://auction-backend-8cp7.onrender.com";

  function normalizeRoom(room) {
    const normalizedRoom = String(room || "global").trim();
    return normalizedRoom || "global";
  }

  class AuctionSocketClient {
    constructor() {
      this.socket = null;
      this.currentRoom = null;
      this.listeners = new Map();
      this.boundEvents = false;
    }

    connect(room = "global") {
      const normalizedRoom = normalizeRoom(room);

      if (typeof global.io === "undefined") {
        console.warn("[Socket] Chưa tìm thấy Socket.io client. Hãy kiểm tra thẻ script CDN.");
        return null;
      }

      if (this.socket && this.socket.connected && this.currentRoom === normalizedRoom) {
        this.joinRoom(normalizedRoom);
        return this.socket;
      }

      if (this.socket && this.currentRoom !== normalizedRoom) {
        this.socket.disconnect();
        this.socket = null;
        this.boundEvents = false;
      }

      this.currentRoom = normalizedRoom;

      this.socket = global.io(SOCKET_SERVER_URL, {
        query: {
          auctionId: normalizedRoom,
        },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 8,
        reconnectionDelay: 800,
      });

      this.bindBackendEvents();
      return this.socket;
    }

    joinRoom(room = this.currentRoom) {
      const normalizedRoom = normalizeRoom(room);
      this.currentRoom = normalizedRoom;

      if (this.socket && this.socket.connected) {
        this.socket.emit("join_auction", { auctionId: normalizedRoom });
      }
    }

    leaveRoom(room = this.currentRoom) {
      const normalizedRoom = normalizeRoom(room);

      if (this.socket && this.socket.connected) {
        this.socket.emit("leave_auction", { auctionId: normalizedRoom });
      }
    }

    bindBackendEvents() {
      if (!this.socket || this.boundEvents) {
        return;
      }

      this.boundEvents = true;

      this.socket.on("connect", () => {
        this.joinRoom(this.currentRoom);
        console.info(`[Socket] Đã kết nối phòng: ${this.currentRoom}`);
        this.trigger("connect", {
          room: this.currentRoom,
          socketId: this.socket.id,
        });
      });

      this.socket.on("disconnect", (reason) => {
        console.warn("[Socket] Mất kết nối:", reason);
        this.trigger("disconnect", {
          room: this.currentRoom,
          reason,
        });
      });

      this.socket.on("connect_error", (error) => {
        console.warn("[Socket] Lỗi kết nối:", error.message);
        this.trigger("connect_error", error);
      });

      const events = [
        "new_bid",
        "auction_extended",
        "fraud_detected",
        "auction_winner",
        "auction_finalized",
        "auction_ended",
        "user_notification",
      ];

      events.forEach((eventName) => {
        this.socket.on(eventName, (data) => {
          this.trigger(eventName, data || {});
        });
      });
    }

    on(event, callback) {
      if (typeof callback !== "function") {
        return () => {};
      }

      if (!this.listeners.has(event)) {
        this.listeners.set(event, new Set());
      }

      this.listeners.get(event).add(callback);

      return () => {
        this.off(event, callback);
      };
    }

    off(event, callback) {
      if (!this.listeners.has(event)) {
        return;
      }

      this.listeners.get(event).delete(callback);
    }

    trigger(event, data) {
      if (!this.listeners.has(event)) {
        return;
      }

      this.listeners.get(event).forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[Socket] Listener "${event}" lỗi:`, error);
        }
      });
    }

    disconnect() {
      if (this.socket) {
        this.leaveRoom(this.currentRoom);
        this.socket.disconnect();
        this.socket = null;
      }

      this.currentRoom = null;
      this.boundEvents = false;
    }

    reset() {
      this.disconnect();
      this.listeners.clear();
    }
  }

  global.socketClient = global.socketClient || new AuctionSocketClient();
})(window);

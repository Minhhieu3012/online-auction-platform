/**
 * Frontend Core: Socket.io Client
 * Quản lý kết nối real-time giữa FE và Backend Node.js.
 */

(function initAuctionSocketClient(global) {
    const SOCKET_SERVER_URL = global.BROSGEM_SOCKET_URL || "http://localhost:3000";

    class AuctionSocketClient {
        constructor() {
            this.socket = null;
            this.currentRoom = null;
            this.listeners = new Map();
            this.boundEvents = false;
        }

        connect(room = "global") {
            const normalizedRoom = String(room || "global");

            if (typeof global.io === "undefined") {
                console.warn("[Socket] Chưa tìm thấy Socket.io client. Hãy kiểm tra thẻ script CDN.");
                return null;
            }

            if (this.socket && this.socket.connected && this.currentRoom === normalizedRoom) {
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
                    auctionId: normalizedRoom
                },
                transports: ["websocket", "polling"],
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 800
            });

            this.bindBackendEvents();

            return this.socket;
        }

        bindBackendEvents() {
            if (!this.socket || this.boundEvents) {
                return;
            }

            this.boundEvents = true;

            this.socket.on("connect", () => {
                console.info(`[Socket] Đã kết nối phòng: ${this.currentRoom}`);
                this.trigger("connect", {
                    room: this.currentRoom,
                    socketId: this.socket.id
                });
            });

            this.socket.on("disconnect", (reason) => {
                console.warn("[Socket] Mất kết nối:", reason);
                this.trigger("disconnect", {
                    room: this.currentRoom,
                    reason
                });
            });

            this.socket.on("connect_error", (error) => {
                console.warn("[Socket] Lỗi kết nối:", error.message);
                this.trigger("connect_error", error);
            });

            this.socket.on("new_bid", (data) => {
                this.trigger("new_bid", data || {});
            });

            this.socket.on("auction_extended", (data) => {
                this.trigger("auction_extended", data || {});
            });

            this.socket.on("fraud_detected", (data) => {
                this.trigger("fraud_detected", data || {});
            });

            this.socket.on("auction_winner", (data) => {
                this.trigger("auction_winner", data || {});
            });

            this.socket.on("user_notification", (data) => {
                this.trigger("user_notification", data || {});
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
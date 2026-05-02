import json
import time
import threading
from datetime import datetime, timezone, timedelta
import redis
from kafka import KafkaProducer, KafkaConsumer

# ==========================================
# 1. MOCK NODE.JS (BACKGROUND CONSUMER THREAD)
# ==========================================
def listen_for_signals(stop_event):
    """ Đóng vai Backend Node.js lắng nghe 2 topic từ AI chạy ngầm """
    try:
        consumer = KafkaConsumer(
            "fraud_alerts", "auction_extensions",
            bootstrap_servers='localhost:9092',
            group_id="nodejs_mock_group_v3",
            auto_offset_reset="latest",
            consumer_timeout_ms=1000  # Thoát vòng lặp mỗi 1s để check lệnh dừng hệ thống
        )
        print("🎧 [Mock Node.js] Đã kết nối! Đang chờ lệnh trừng phạt hoặc gia hạn từ AI...\n")

        while not stop_event.is_set():
            for msg in consumer:
                topic = msg.topic
                try:
                    data = json.loads(msg.value.decode('utf-8'))
                except Exception:
                    continue # Bỏ qua rác không phải JSON

                if topic == "fraud_alerts":
                    print(f"\n🔥 [Node.js THỰC THI] Đang khóa tài khoản: {data.get('user_id')}")
                    print(f"   -> Bằng chứng (Điểm LSS): {data.get('lss_score')}")
                    print(f"   -> Lời phê: {data.get('message', 'Phát hiện gian lận')}\n")

                elif topic == "auction_extensions":
                    print(f"\n⏱️ [Node.js THỰC THI] Gia hạn phiên {data.get('auction_id')} thêm {data.get('extend_by')} giây!")
                    print(f"   -> Lý do: {data.get('reason', 'Luồng thầu sát giờ')}\n")

                if stop_event.is_set():
                    break
    except Exception as e:
        print(f"[Mock Node.js Lỗi] {e}")
    finally:
        if 'consumer' in locals():
            consumer.close()

# ==========================================
# 2. CÁC KỊCH BẢN TẤN CÔNG (PRODUCER)
# ==========================================
def fire_defensive_tests(producer):
    """ PHASE 1: Kiểm thử phòng thủ (Rác dữ liệu và sai Schema) """
    print("--------------------------------------------------")
    print("[PHASE 1] Khởi động súng giả lập. Đang nạp đạn kiểm tra hệ thống...")

    # Viên đạn 1: Chuẩn
    valid_bid = {
        "auction_id": "AUC-999",
        "user_id": "USER-WIN",
        "price": 250.0,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    producer.send("auction_bids", json.dumps(valid_bid).encode('utf-8'))
    print(" -> Đã bắn: Dữ liệu chuẩn")

    # Viên đạn 2: Giá âm
    invalid_schema_bid = {
        "auction_id": "AUC-999",
        "user_id": "USER-HACKER",
        "price": -5.0, 
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    producer.send("auction_bids", json.dumps(invalid_schema_bid).encode('utf-8'))
    print(" -> Đã bắn: Dữ liệu vi phạm schema (Giá âm)")

    # Viên đạn 3: Rác bytes
    garbage_data = b"Hello, day la doan text gay loi he thong!"
    producer.send("auction_bids", garbage_data)
    print(" -> Đã bắn: Rác dữ liệu (Không phải JSON)")
    
    producer.flush()
    print("=> Hoàn tất Phase 1!\n")

def fire_spam_attack(producer):
    """ PHASE 2: Giả lập dội bom giá nhích nhẹ (Shill Bidding) """
    print("--------------------------------------------------")
    print("[PHASE 2] 🚀 BẮT ĐẦU CHIẾN DỊCH: Giả lập Shill Bidding (Dội bom giá nhích nhẹ)")

    prices = [1000.0, 1000.5, 1001.0, 1001.5, 1002.0]
    for price in prices:
        bid = {
            "auction_id": "AUC-SPAM-TEST",
            "user_id": "SPAMMER-999",
            "price": price,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        producer.send("auction_bids", json.dumps(bid).encode('utf-8'))
        print(f" -> Đã bắn đạn giá: ${price}")
        time.sleep(0.1) 

    producer.flush()
    print("=> Hoàn tất Phase 2! Đang chờ lá chắn Idempotency hoạt động...\n")

def fire_sniper_test(producer, redis_client):
    """ PHASE 3: Giả lập bắn tỉa giây cuối (Anti-sniping) """
    print("--------------------------------------------------")
    print("[PHASE 3] 🎯 BẮT ĐẦU CHIẾN DỊCH: Bắn tỉa giây cuối cùng")
    
    auction_id = "AUC-FINAL-BOSS"
    now = datetime.now(timezone.utc)
    
    # Setup giờ kết thúc trong Redis (8s nữa)
    end_time = now + timedelta(seconds=8)
    try:
        redis_client.set(f"auction_end_time:{auction_id}", end_time.isoformat())
        print(f"🗄️ [Kho dữ liệu Redis] Đã set giờ chốt phiên {auction_id} là: {end_time.strftime('%H:%M:%S')}")
    except Exception as e:
        print(f"⚠️ [Cảnh báo] Không thể kết nối thư viện Redis: {e}. Vui lòng chạy 'pip install redis'")

    # Bắn bid sát giờ
    payload = {
        "auction_id": auction_id,
        "user_id": "SNIPER-007",
        "price": 999.9,
        "timestamp": now.isoformat()
    }
    
    print(f" -> Đang bắn giá ${payload['price']} (Cách giờ chốt 8 giây!)")
    producer.send("auction_bids", json.dumps(payload).encode('utf-8'))
    producer.flush()
    print("=> Hoàn tất Phase 3!\n")

def fire_ai_ui_triggers(producer):
    """ PHASE 4: Tích hợp mã nguồn mới - Trực tiếp kích hoạt UI """
    print("--------------------------------------------------")
    print("[PHASE 4] 🧠 BẮT ĐẦU CHIẾN DỊCH: AI can thiệp trực tiếp vào UI (Mã nguồn mới)")

    # 1. Bắn lệnh GIA HẠN THỜI GIAN (Cộng thêm 60 giây cho phiên 842)
    extension_data = {"auction_id": 842, "extend_by": 60}
    producer.send("auction_extensions", json.dumps(extension_data).encode('utf-8'))
    producer.flush() 
    print(f"[Đã bắn] -> auction_extensions: {extension_data}")

    time.sleep(2) # Chờ 2 giây cho kịch tính

    # 2. Bắn lệnh CẢNH BÁO GIAN LẬN (Điểm LSS = 0.95)
    fraud_data = {"user_id": 999, "lss_score": 0.95, "auction_id": 842}
    producer.send("fraud_alerts", json.dumps(fraud_data).encode('utf-8'))
    producer.flush()
    print(f"[Đã bắn] -> fraud_alerts: {fraud_data}")

    print("=> Hoàn tất Phase 4!\n")

# ==========================================
# 3. TRÌNH ĐIỀU PHỐI (ORCHESTRATOR)
# ==========================================
def run_full_test_suite():
    # Khởi động Mock Node.js chạy ngầm bằng Threading (Thay thế cho Asyncio)
    stop_event = threading.Event()
    mock_thread = threading.Thread(target=listen_for_signals, args=(stop_event,))
    mock_thread.start()
    
    # Đợi 1 chút cho Consumer kết nối xong
    time.sleep(2) 
    
    try:
        producer = KafkaProducer(bootstrap_servers='localhost:9092')
        redis_client = redis.Redis(host='localhost', port=6379, decode_responses=True)
        
        fire_defensive_tests(producer)
        time.sleep(2)
        
        fire_spam_attack(producer)
        time.sleep(2)
        
        fire_sniper_test(producer, redis_client)
        time.sleep(2)

        # Kích hoạt Phase 4 (Mã nguồn mới của bạn)
        fire_ai_ui_triggers(producer)
        
        # Đợi 3 giây cuối cùng để Mock Node.js hứng nốt các event trả về từ AI
        print("--------------------------------------------------")
        print("⏳ Đang đợi hệ thống AI xử lý và trả kết quả về Mock Node.js...")
        time.sleep(3)
        
    except Exception as e:
        print(f"Lỗi hệ thống: {e}")
    finally:
        if 'producer' in locals():
            producer.close()
        if 'redis_client' in locals():
            redis_client.close()

        # Dừng luồng chạy ngầm một cách an toàn
        stop_event.set()
        mock_thread.join()
        print("\n✅ HOÀN TẤT TOÀN BỘ CHUỖI KIỂM THỬ!")

if __name__ == "__main__":
    run_full_test_suite()
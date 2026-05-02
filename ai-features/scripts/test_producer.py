import asyncio
import json
from datetime import datetime, timezone, timedelta
import redis.asyncio as aioredis
from aiokafka import AIOKafkaProducer, AIOKafkaConsumer

# ==========================================
# 1. MOCK NODE.JS (BACKGROUND CONSUMER)
# ==========================================
async def listen_for_signals():
    """ Đóng vai Backend Node.js lắng nghe 2 topic từ AI chạy ngầm """
    consumer = AIOKafkaConsumer(
        "fraud_alerts", "auction_extensions",
        bootstrap_servers='localhost:9092',
        group_id="nodejs_mock_group_v2",
        auto_offset_reset="latest"
    )
    await consumer.start()
    print("🎧 [Mock Node.js] Đã kết nối! Đang chờ lệnh trừng phạt hoặc gia hạn từ AI...\n")
    
    try:
        async for msg in consumer:
            topic = msg.topic
            data = json.loads(msg.value.decode('utf-8'))
            
            if topic == "fraud_alerts":
                print(f"\n🔥 [Node.js THỰC THI] Đang khóa tài khoản: {data.get('user_id')}")
                print(f"   -> Bằng chứng (Điểm LSS): {data.get('lss_score')}")
                print(f"   -> Lời phê: {data.get('message')}\n")
                
            elif topic == "auction_extensions":
                print(f"\n⏱️ [Node.js THỰC THI] Gia hạn phiên {data.get('auction_id')} thêm {data.get('extend_by')} giây!")
                print(f"   -> Lý do: {data.get('reason')}\n")
    except asyncio.CancelledError:
        pass
    finally:
        await consumer.stop()

# ==========================================
# 2. CÁC KỊCH BẢN TẤN CÔNG (PRODUCER)
# ==========================================
async def fire_defensive_tests(producer: AIOKafkaProducer):
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
    await producer.send_and_wait("auction_bids", json.dumps(valid_bid).encode('utf-8'))
    print(" -> Đã bắn: Dữ liệu chuẩn")

    # Viên đạn 2: Giá âm
    invalid_schema_bid = {
        "auction_id": "AUC-999",
        "user_id": "USER-HACKER",
        "price": -5.0, 
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await producer.send_and_wait("auction_bids", json.dumps(invalid_schema_bid).encode('utf-8'))
    print(" -> Đã bắn: Dữ liệu vi phạm schema (Giá âm)")

    # Viên đạn 3: Rác bytes
    garbage_data = b"Hello, day la doan text gay loi he thong!"
    await producer.send_and_wait("auction_bids", garbage_data)
    print(" -> Đã bắn: Rác dữ liệu (Không phải JSON)")
    
    print("=> Hoàn tất Phase 1!\n")

async def fire_spam_attack(producer: AIOKafkaProducer):
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
        await producer.send_and_wait("auction_bids", json.dumps(bid).encode('utf-8'))
        print(f" -> Đã bắn đạn giá: ${price}")
        await asyncio.sleep(0.1) 

    print("=> Hoàn tất Phase 2! Đang chờ lá chắn Idempotency hoạt động...\n")

async def fire_sniper_test(producer: AIOKafkaProducer, redis_client: aioredis.Redis):
    """ PHASE 3: Giả lập bắn tỉa giây cuối (Anti-sniping) """
    print("--------------------------------------------------")
    print("[PHASE 3] 🎯 BẮT ĐẦU CHIẾN DỊCH: Bắn tỉa giây cuối cùng")
    
    auction_id = "AUC-FINAL-BOSS"
    now = datetime.now(timezone.utc)
    
    # Setup giờ kết thúc trong Redis (8s nữa)
    end_time = now + timedelta(seconds=8)
    await redis_client.set(f"auction_end_time:{auction_id}", end_time.isoformat())
    print(f"🗄️ [Kho dữ liệu Redis] Đã set giờ chốt phiên {auction_id} là: {end_time.strftime('%H:%M:%S')}")

    # Bắn bid sát giờ
    payload = {
        "auction_id": auction_id,
        "user_id": "SNIPER-007",
        "price": 999.9,
        "timestamp": now.isoformat()
    }
    
    print(f" -> Đang bắn giá ${payload['price']} (Cách giờ chốt 8 giây!)")
    await producer.send_and_wait("auction_bids", json.dumps(payload).encode('utf-8'))
    print("=> Hoàn tất Phase 3!\n")

# ==========================================
# 3. TRÌNH ĐIỀU PHỐI (ORCHESTRATOR)
# ==========================================
async def run_full_test_suite():
    # Khởi động Mock Node.js chạy ngầm
    mock_task = asyncio.create_task(listen_for_signals())
    
    # Đợi 1 chút cho Consumer kết nối xong
    await asyncio.sleep(2) 
    
    producer = AIOKafkaProducer(bootstrap_servers='localhost:9092')
    await producer.start()
    
    redis_client = aioredis.Redis(host='localhost', port=6379, decode_responses=True)
    
    try:
        await fire_defensive_tests(producer)
        await asyncio.sleep(2)
        
        await fire_spam_attack(producer)
        await asyncio.sleep(2)
        
        await fire_sniper_test(producer, redis_client)
        
        # Đợi 3 giây cuối cùng để Mock Node.js hứng nốt các event trả về từ AI
        print("--------------------------------------------------")
        print("⏳ Đang đợi hệ thống AI xử lý và trả kết quả về Mock Node.js...")
        await asyncio.sleep(3)
        
    finally:
        await producer.stop()
        await redis_client.aclose()
        mock_task.cancel()
        print("\n✅ HOÀN TẤT TOÀN BỘ CHUỖI KIỂM THỬ!")

if __name__ == "__main__":
    asyncio.run(run_full_test_suite())
import asyncio
import json
from datetime import datetime
from aiokafka import AIOKafkaProducer

async def fire_test_data(producer: AIOKafkaProducer):
    """
    Kịch bản 1: Kiểm thử phòng thủ (Defensive Programming)
    Đánh giá khả năng chịu lỗi của hệ thống trước rác dữ liệu.
    """
    print("\n[PHASE 1] Khởi động súng giả lập. Đang nạp đạn kiểm tra hệ thống...")

    # --- VIÊN ĐẠN 1: Dữ liệu chuẩn mực ---
    valid_bid = {
        "auction_id": "AUC-999",
        "user_id": "USER-WIN",
        "price": 250.0,
        "timestamp": datetime.utcnow().isoformat()
    }
    await producer.send_and_wait("auction_bids", json.dumps(valid_bid).encode('utf-8'))
    print("Đã bắn: Dữ liệu chuẩn")

    # --- VIÊN ĐẠN 2: Dữ liệu vi phạm Hợp đồng (Pydantic) ---
    # Cố tình để giá trị price là số âm (-5.0)
    invalid_schema_bid = {
        "auction_id": "AUC-999",
        "user_id": "USER-HACKER",
        "price": -5.0, 
        "timestamp": datetime.utcnow().isoformat()
    }
    await producer.send_and_wait("auction_bids", json.dumps(invalid_schema_bid).encode('utf-8'))
    print("Đã bắn: Dữ liệu vi phạm schema (Giá âm)")

    # --- VIÊN ĐẠN 3: Rác dữ liệu không thể phân tích ---
    garbage_data = b"Hello, day la doan text gay loi he thong!"
    await producer.send_and_wait("auction_bids", garbage_data)
    print("Đã bắn: Rác dữ liệu (Không phải JSON)")
    
    print("-> Hoàn tất Phase 1!")

async def fire_spam_attack(producer: AIOKafkaProducer):
    """
    Kịch bản 2: Kiểm thử thuật toán AI (Live Shill Score)
    Giả lập hành vi dội bom giá nhích nhẹ để ép LSS tăng cao.
    """
    print("\n[PHASE 2] 🚀 BẮT ĐẦU CHIẾN DỊCH: Giả lập Shill Bidding (Dội bom giá nhích nhẹ)")

    # Bắn 5 bid liên tục trong nháy mắt
    prices = [100.0, 101.0, 102.0, 103.0, 104.0]
    
    for price in prices:
        bid = {
            "auction_id": "AUC-IPHONE15",
            "user_id": "SCAMMER-999",
            "price": price,
            "timestamp": datetime.utcnow().isoformat()
        }
        await producer.send_and_wait("auction_bids", json.dumps(bid).encode('utf-8'))
        print(f"Đã bắn đạn giá: ${price}")
        await asyncio.sleep(0.1) # Dừng 0.1s để mô phỏng bot

    print("-> Hoàn tất Phase 2!")

async def run_full_test_suite():
    """
    Hàm Orchestrator: Quản lý vòng đời Kafka Producer và chạy tuần tự các kịch bản.
    """
    # Sử dụng localhost:9092 vì chúng ta đang chạy script trực tiếp trên máy local
    producer = AIOKafkaProducer(bootstrap_servers='localhost:9092')
    await producer.start()
    
    try:
        # Chạy kịch bản 1
        await fire_test_data(producer)
        
        # Nghỉ 2 giây để bạn kịp nhìn log bên FastAPI trước khi bắn đợt 2
        print("\n Hệ thống tạm nghỉ 2 giây chuyển pha...")
        await asyncio.sleep(2)
        
        # Chạy kịch bản 2
        await fire_spam_attack(producer)
        
    finally:
        await producer.stop()
        print("\n Hoàn tất toàn bộ chuỗi kiểm thử. Hãy sang màn hình FastAPI xem cảnh báo!")

if __name__ == "__main__":
    asyncio.run(run_full_test_suite())
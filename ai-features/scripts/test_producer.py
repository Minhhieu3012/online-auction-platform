import asyncio
import json
from datetime import datetime
from aiokafka import AIOKafkaProducer

async def fire_test_data():
    # Sử dụng localhost:9092 vì chúng ta đang chạy script trực tiếp trên máy của bạn
    producer = AIOKafkaProducer(bootstrap_servers='localhost:9092')
    await producer.start()
    
    print("Khởi động súng giả lập. Đang nạp đạn...")

    try:
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

        print("Hoàn tất đợt tấn công! Hãy sang terminal của FastAPI để xem kết quả phòng thủ.")
        
    finally:
        await producer.stop()

if __name__ == "__main__":
    asyncio.run(fire_test_data())
import asyncio
import json
from datetime import datetime, timezone
from aiokafka import AIOKafkaProducer

async def run_spam_test():
    producer = AIOKafkaProducer(bootstrap_servers='localhost:9092')
    await producer.start()
    
    print("🌪️ [Kẻ phá hoại] Bắt đầu dội bom 5 lệnh thầu gian lận liên tiếp...")
    for i in range(5):
        payload = {
            "auction_id": "AUC-SPAM-TEST",
            "user_id": "SPAMMER-999",
            "price": 1000.0 + i, # Giá tăng liên tục
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await producer.send_and_wait("auction_bids", json.dumps(payload).encode('utf-8'))
        
    await producer.stop()
    print("-> Đã nã xong 5 viên đạn. Hãy xem lá chắn Idempotency hoạt động!")

if __name__ == "__main__":
    asyncio.run(run_spam_test())
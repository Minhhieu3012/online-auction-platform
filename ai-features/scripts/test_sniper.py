import asyncio
import json
from datetime import datetime, timezone, timedelta
import redis.asyncio as aioredis
from aiokafka import AIOKafkaProducer

async def run_sniper_test():
    # 1. Setup Redis Mock Data (Đóng vai Node.js lưu giờ kết thúc)
    r = aioredis.Redis(host='localhost', port=6379, decode_responses=True)
    auction_id = "AUC-FINAL-BOSS"

    # Đặt giờ kết thúc là đúng 8 giây tính từ thời điểm hiện tại (Nằm trong vùng nguy hiểm < 10s)
    now = datetime.now(timezone.utc)
    end_time = now + timedelta(seconds=8)
    await r.set(f"auction_end_time:{auction_id}", end_time.isoformat())
    print(f"🗄️ [Kho dữ liệu] Đã set giờ chốt phiên {auction_id} là: {end_time.strftime('%H:%M:%S')}")

    # 2. Bắn bid sát giờ
    producer = AIOKafkaProducer(bootstrap_servers='localhost:9092')
    await producer.start()

    payload = {
        "auction_id": auction_id,
        "user_id": "SNIPER-007",
        "price": 999.9,
        "timestamp": now.isoformat()
    }

    print(f"🎯 [Kẻ bắn tỉa] Đang bắn giá ${payload['price']} lúc {now.strftime('%H:%M:%S')} (Cách giờ chốt 8 giây!)")
    await producer.send_and_wait("auction_bids", json.dumps(payload).encode('utf-8'))

    await producer.stop()
    await r.aclose()
    print("-> Bắn tỉa hoàn tất. Hãy kiểm tra màn hình AI và Node.js!")

if __name__ == "__main__":
    asyncio.run(run_sniper_test())
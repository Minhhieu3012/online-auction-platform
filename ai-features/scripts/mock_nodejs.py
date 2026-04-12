import asyncio
import json
from aiokafka import AIOKafkaConsumer

async def listen_for_alerts():
    """ Đóng vai Backend Node.js lắng nghe topic 'fraud_alerts' """
    consumer = AIOKafkaConsumer(
        "fraud_alerts",
        bootstrap_servers='localhost:9092',
        group_id="nodejs_mock_group",
        auto_offset_reset="latest"
    )
    await consumer.start()
    print("🎧 [Mock Node.js] Đã kết nối! Đang chờ lệnh trừng phạt từ AI...")
    
    try:
        async for msg in consumer:
            alert = json.loads(msg.value.decode('utf-8'))
            print(f"🔥 [Node.js THỰC THI] Đang khóa tài khoản: {alert['user_id']}")
            print(f"   -> Bằng chứng (Điểm LSS): {alert['lss_score']}")
            print(f"   -> Lời phê: {alert['message']}\n")
    finally:
        await consumer.stop()

if __name__ == "__main__":
    asyncio.run(listen_for_alerts())
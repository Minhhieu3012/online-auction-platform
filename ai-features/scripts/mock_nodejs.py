import asyncio
import json
from aiokafka import AIOKafkaConsumer

async def listen_for_signals():
    """ Đóng vai Backend Node.js lắng nghe 2 topic từ AI """
    consumer = AIOKafkaConsumer(
        "fraud_alerts", "auction_extensions", # Lắng nghe 2 topic cùng lúc
        bootstrap_servers='localhost:9092',
        group_id="nodejs_mock_group",
        auto_offset_reset="latest"
    )
    await consumer.start()
    print("🎧 [Mock Node.js] Đã kết nối! Đang chờ lệnh trừng phạt hoặc lệnh gia hạn từ AI...")
    
    try:
        async for msg in consumer:
            topic = msg.topic
            data = json.loads(msg.value.decode('utf-8'))
            
            if topic == "fraud_alerts":
                # Phục hồi format log chi tiết từ mã nguồn cũ
                print(f"🔥 [Node.js THỰC THI] Đang khóa tài khoản: {data['user_id']}")
                print(f"   -> Bằng chứng (Điểm LSS): {data['lss_score']}")
                print(f"   -> Lời phê: {data['message']}\n")
                
            elif topic == "auction_extensions":
                # Giữ nguyên format log của mã nguồn mới
                print(f"⏱️ [Node.js THỰC THI] Gia hạn phiên {data['auction_id']} thêm {data['extend_by']} giây!")
                print(f"   -> Lý do: {data['reason']}\n")
    finally:
        await consumer.stop()

if __name__ == "__main__":
    asyncio.run(listen_for_signals())
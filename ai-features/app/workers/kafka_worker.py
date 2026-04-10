import asyncio
import json
from aiokafka import AIOKafkaConsumer
from pydantic import ValidationError

from app.core.config import settings
from app.kafka.schemas import BidEvent

async def consume_bids():
    """
    Background Task tiêu thụ sự kiện đặt thầu.
    Thiết kế chống chịu lỗi (Fault-tolerant): Một tin nhắn lỗi không được phép làm sập toàn bộ luồng.
    """
    consumer = AIOKafkaConsumer(
        "auction_bids",
        bootstrap_servers=settings.KAFKA_BROKER,
        group_id="lss_ai_group",
        auto_offset_reset="latest" # Bỏ qua dữ liệu cũ, chỉ bắt đầu xử lý từ thời điểm service online
    )
    
    # Khởi động kết nối tới Broker
    await consumer.start()
    print(f"⚡ [Kafka Worker] Đã kết nối. Đang lắng nghe topic 'auction_bids' tại {settings.KAFKA_BROKER}...")

    try:
        # Vòng lặp Event Loop vô tận
        async for msg in consumer:
            try:
                # Bước 1: Giải mã byte array thành chuỗi JSON
                raw_payload = msg.value.decode('utf-8')
                parsed_data = json.loads(raw_payload)
                
                # Bước 2: Ép kiểu và xác thực qua Hợp đồng dữ liệu (Data Contract)
                bid_event = BidEvent(**parsed_data)

                # Bước 3: Dữ liệu sạch -> Chuyển giao cho AI Engine (Sẽ triển khai ở bước sau)
                print(f"[Hợp lệ] Bid nhận được: Auction={bid_event.auction_id} | User={bid_event.user_id} | Giá=${bid_event.price}")

            except json.JSONDecodeError:
                print(f"[Rác Dữ Liệu] Lỗi cú pháp JSON. Payload: {msg.value}")
            except ValidationError as e:
                print(f"[Vi Phạm Contract] Dữ liệu sai định dạng Pydantic. Chi tiết: {e.errors()}")
            except Exception as e:
                print(f"[Lỗi Hệ Thống] Ngoại lệ không xác định trong luồng xử lý: {str(e)}")
    finally:
        # Giải phóng tài nguyên triệt để khi container bị ép dừng
        await consumer.stop()
        print("[Kafka Worker] Đã ngắt kết nối an toàn.")
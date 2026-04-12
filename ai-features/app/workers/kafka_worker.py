import asyncio
import json
from datetime import datetime, timezone
from aiokafka import AIOKafkaConsumer
from pydantic import ValidationError

from app.core.config import settings
from app.kafka.schemas import BidEvent, FraudAlert
from app.services.detector import calculate_lss
from app.kafka.producer import emit_fraud_alert
from app.db.redis_client import get_redis

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

                # Bước 3: Đưa dữ liệu sạch vào AI Engine tính toán
                lss_score = await calculate_lss(
                    auction_id=bid_event.auction_id,
                    user_id=bid_event.user_id,
                    price=bid_event.price
                )

                print(f"✅ [Hợp lệ] Bid nhận được: Auction={bid_event.auction_id} | User={bid_event.user_id} | Giá=${bid_event.price} | Điểm LSS: {lss_score:.2f}")
                
                # Bước 4: Xuất cảnh báo đa kênh khi vượt ngưỡng gian lận
                if lss_score > 0.6:
                    print(f"🚨 [CẢNH BÁO SHILL BIDDING] Kích hoạt quy trình khóa tài khoản {bid_event.user_id} (LSS: {lss_score:.2f})!")
                    
                    # Đóng gói dữ liệu qua Pydantic để đảm bảo tính nhất quán đầu ra
                    alert = FraudAlert(
                        auction_id=bid_event.auction_id,
                        user_id=bid_event.user_id,
                        lss_score=lss_score,
                        timestamp=datetime.now(timezone.utc).isoformat(),
                        message=f"Hành vi dội bom giá bất thường. LSS = {lss_score:.2f}"
                    )
                    alert_dict = alert.model_dump() # Convert class về dict

                    # [Đầu ra 1]: Bắn sang Node.js qua Kafka để chặn user
                    await emit_fraud_alert(alert_dict)

                    # [Đầu ra 2]: Lưu vào Redis cho Admin Dashboard (Frontend) hiển thị
                    redis = await get_redis()
                    await redis.lpush("active_fraud_alerts", json.dumps(alert_dict))
                    await redis.ltrim("active_fraud_alerts", 0, 49) # Chỉ giữ lại 50 cảnh báo mới nhất để chống tràn RAM

            except json.JSONDecodeError:
                print(f"❌ [Rác Dữ Liệu] Lỗi cú pháp JSON. Payload: {msg.value}")
            except ValidationError as e:
                print(f"❌ [Vi Phạm Contract] Dữ liệu sai định dạng Pydantic. Chi tiết: {e.errors()}")
            except Exception as e:
                print(f"⚠️ [Lỗi Hệ Thống] Ngoại lệ không xác định trong luồng xử lý: {str(e)}")
    finally:
        # Giải phóng tài nguyên triệt để khi container bị ép dừng
        await consumer.stop()
        print("🛑 [Kafka Worker] Đã ngắt kết nối an toàn.")
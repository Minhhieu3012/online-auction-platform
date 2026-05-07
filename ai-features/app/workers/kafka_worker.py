import asyncio
import json
from datetime import datetime, timezone
from aiokafka import AIOKafkaConsumer
from pydantic import ValidationError

from app.core.config import settings
from app.kafka.schemas import BidEvent, FraudAlert
from app.services.detector import calculate_lss
from app.kafka.producer import emit_fraud_alert, emit_extension_signal
from app.db.redis_client import get_redis

# Import các hàm tương tác Database và Logic bảo vệ
from app.db.repositories import save_fraud_alert
from app.services.integrity import is_alert_allowed, check_anti_sniping

async def consume_bids():
    """
    Background Task tiêu thụ sự kiện đặt thầu.
    Thiết kế chống chịu lỗi (Fault-tolerant): Một tin nhắn lỗi không được phép làm sập toàn bộ luồng.
    Đã được bọc thép (Armor) bằng cơ chế Idempotency và Anti-sniping (Giai đoạn 3).
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

                # ==========================================
                # RÀO CHẮN 1: ANTI-SNIPING (SOFT-CLOSE)
                # ==========================================
                is_sniping = await check_anti_sniping(bid_event.auction_id, bid_event.timestamp)
                if is_sniping:
                    print(f"⏱️ [ANTI-SNIPING] Kích hoạt gia hạn 30s cho phiên {bid_event.auction_id}!")
                    await emit_extension_signal(bid_event.auction_id, 30)

                # ==========================================
                # BƯỚC 3: TÍNH TOÁN LÕI AI
                # ==========================================
                lss_score = await calculate_lss(
                    auction_id=bid_event.auction_id,
                    user_id=bid_event.user_id,
                    price=bid_event.price
                )

                print(f"✅ [Hợp lệ] Bid nhận được: Auction={bid_event.auction_id} | User={bid_event.user_id} | Giá=${bid_event.price} | Điểm LSS: {lss_score:.2f}")
                
                # ==========================================
                # RÀO CHẮN 2 & BƯỚC 4: CHỐNG BÃO LOG KHI XUẤT CẢNH BÁO
                # ==========================================
                if lss_score > 0.6:
                    # Chặn họng những thông báo spam liên tục trong 60s (Idempotency)
                    can_alert = await is_alert_allowed(bid_event.user_id, bid_event.auction_id)
                    
                    if can_alert:
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
                        
                        # [Đầu ra 2]: Lưu vào Redis cho Admin Dashboard (Frontend) hiển thị realtime
                        redis = await get_redis()
                        await redis.lpush("active_fraud_alerts", json.dumps(alert_dict))
                        await redis.ltrim("active_fraud_alerts", 0, 49) # Chỉ giữ lại 50 cảnh báo mới nhất
                        
                        # [Đầu ra 3 - MỚI]: Lưu vĩnh viễn vào MySQL Database
                        # Xử lý ánh xạ (mapping) dữ liệu cho khớp với init.sql
                        try:
                            reasons_dict = {"alert_type": "SHILL_BIDDING", "details": alert.message}
                            await save_fraud_alert(
                                auction_id=alert.auction_id,
                                user_id=alert.user_id,
                                risk_score=alert.lss_score, # Mapping lss_score -> risk_score
                                reasons=reasons_dict        # Mapping message -> JSON dict
                            )
                            print(f"💾 [DB] Đã lưu lịch sử án phạt vào MySQL thành công.")
                        except Exception as db_err:
                            print(f"❌ [DB Lỗi] Không thể lưu xuống MySQL: {str(db_err)}")

                    else:
                        print(f"🛡️ [Idempotency] Đã chặn thông báo rác từ spammer {bid_event.user_id}.")

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
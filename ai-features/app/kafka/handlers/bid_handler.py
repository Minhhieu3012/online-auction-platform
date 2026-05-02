import json
import logging
from aiokafka import AIOKafkaConsumer
from app.core.config import settings
from app.kafka.schemas import BidEvent, FraudAlert
from app.services.detector import calculate_lss
from app.services.integrity import is_alert_allowed
from app.db.redis_client import get_redis
from pydantic import ValidationError

logger = logging.getLogger(__name__)

async def start_bid_consumer():
    """
    Consumer lắng nghe sự kiện đấu giá từ Kafka.
    Đã được tối ưu hóa khả năng phòng thủ (Defensive Programming) tuyệt đối.
    """
    consumer = AIOKafkaConsumer(
        "auction_bids",
        bootstrap_servers=settings.KAFKA_BROKER,
        group_id="ai_fraud_detector_group",
        # Bỏ value_deserializer mặc định để AI tự bắt lỗi JSON bên trong vòng lặp
        auto_offset_reset="earliest"
    )
    
    await consumer.start()
    try:
        async for msg in consumer:
            try:
                # 1. Cố gắng giải mã JSON. Nếu là rác, sẽ nhảy xuống block except JSONDecodeError
                raw_data = json.loads(msg.value.decode("utf-8"))
                await process_kafka_message(raw_data)
            except json.JSONDecodeError:
                logger.error("[Hệ thống phòng thủ]: Đã chặn và tiêu hủy một đoạn rác dữ liệu không phải JSON!")
            except Exception as e:
                logger.error(f"[Lỗi xử lý luồng]: {str(e)}")
                
    except Exception as fatal_error:
        logger.error(f"[Kafka Consumer Fatal Error]: {str(fatal_error)}")
    finally:
        await consumer.stop()

async def process_kafka_message(raw_data: dict):
    """
    Xử lý logic từng thông điệp. Đã bao gồm bẫy lỗi Pydantic.
    """
    try:
        # Validate data contract
        bid_event = BidEvent(**raw_data)
        
        # Chấm điểm LSS
        score = await calculate_lss(
            auction_id=bid_event.auction_id,
            user_id=bid_event.user_id,
            price=bid_event.price
        )
        
        # Nếu điểm rủi ro cao (> 0.6)
        if score > 0.6:
            # Check Idempotency (chống spam cảnh báo)
            if await is_alert_allowed(user_id=bid_event.user_id, auction_id=bid_event.auction_id):
                await trigger_fraud_alert(bid_event, score)
                
    except ValidationError as ve:
        logger.warning(f"[Data Contract Violation] Dữ liệu từ Node.js sai định dạng: {ve}")

async def trigger_fraud_alert(bid_event: BidEvent, score: float):
    """
    Lưu cảnh báo vào Redis List để Dashboard lấy hiển thị.
    """
    redis = await get_redis()
    alert = FraudAlert(
        auction_id=bid_event.auction_id,
        user_id=bid_event.user_id,
        lss_score=score,
        message="Hành vi dội bom giá bất thường. LSS = {:.2f}".format(score),
        timestamp=bid_event.timestamp.isoformat()
    )
    
    # Lưu vào Redis List (giữ tối đa 50 cảnh báo mới nhất)
    await redis.lpush("active_fraud_alerts", alert.model_dump_json())
    await redis.ltrim("active_fraud_alerts", 0, 49)
    logger.info(f"[FRAUD ALERT] User {bid_event.user_id} - Score: {score}")
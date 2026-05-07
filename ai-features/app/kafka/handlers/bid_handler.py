import json
import logging
from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
from app.core.config import settings
from app.kafka.schemas import BidEvent, FraudAlert
from app.services.detector import calculate_lss
from app.services.integrity import is_alert_allowed, check_anti_sniping
from app.db.redis_client import get_redis
from pydantic import ValidationError

logger = logging.getLogger(__name__)

# Producer dùng chung để tái sử dụng kết nối (không tạo mới mỗi lần alert)
_producer: AIOKafkaProducer | None = None


async def get_producer() -> AIOKafkaProducer:
    """
    Lấy hoặc khởi tạo Kafka Producer dùng chung (Singleton).
    """
    global _producer
    if _producer is None:
        _producer = AIOKafkaProducer(
            bootstrap_servers=settings.KAFKA_BROKER,
            value_serializer=lambda v: v.encode("utf-8") if isinstance(v, str) else v,
        )
        await _producer.start()
        logger.info("[Kafka Producer] Đã khởi động thành công.")
    return _producer


async def start_bid_consumer():
    """
    Consumer lắng nghe sự kiện đấu giá từ Kafka.
    Đã được tối ưu hóa khả năng phòng thủ (Defensive Programming) tuyệt đối.

    🔧 Fix: Đổi topic từ "auction_bids" → "auction-bids" để khớp với Node.js (bidding.js)
    """
    # Khởi động Producer trước khi Consumer bắt đầu nhận tin
    await get_producer()

    consumer = AIOKafkaConsumer(
        "auction-bids",  # ✅ FIX: Đã sửa từ "auction_bids" → "auction-bids" cho khớp với Node.js
        bootstrap_servers=settings.KAFKA_BROKER,
        group_id="ai_fraud_detector_group",
        # Bỏ value_deserializer mặc định để AI tự bắt lỗi JSON bên trong vòng lặp
        auto_offset_reset="earliest",
    )

    await consumer.start()
    try:
        async for msg in consumer:
            try:
                # 1. Cố gắng giải mã JSON. Nếu là rác, sẽ nhảy xuống block except JSONDecodeError
                raw_data = json.loads(msg.value.decode("utf-8"))
                await process_kafka_message(raw_data)
            except json.JSONDecodeError:
                logger.error(
                    "[Hệ thống phòng thủ]: Đã chặn và tiêu hủy một đoạn rác dữ liệu không phải JSON!"
                )
            except Exception as e:
                logger.error(f"[Lỗi xử lý luồng]: {str(e)}")

    except Exception as fatal_error:
        logger.error(f"[Kafka Consumer Fatal Error]: {str(fatal_error)}")
    finally:
        await consumer.stop()
        # Dọn dẹp producer khi consumer dừng
        if _producer:
            await _producer.stop()
            logger.info("[Kafka Producer] Đã dừng an toàn.")


async def process_kafka_message(raw_data: dict):
    """
    Xử lý logic từng thông điệp. Đã bao gồm bẫy lỗi Pydantic.

    🔧 Fix: Tích hợp check_anti_sniping() vào luồng tính điểm LSS.
    """
    try:
        # Validate data contract
        bid_event = BidEvent(**raw_data)

        # Chấm điểm LSS cơ bản
        score = await calculate_lss(
            auction_id=bid_event.auction_id,
            user_id=bid_event.user_id,
            price=bid_event.price,
        )

        is_sniping = await check_anti_sniping(bid_event.auction_id, bid_event.timestamp)
        if is_sniping:
            score = min(score + 0.3, 1.0)
            logger.info(
                f"[Anti-Snipe] User {bid_event.user_id} bid vào vùng nguy hiểm cuối phiên. "
                f"Score tăng lên: {score:.2f}"
            )

        # Nếu điểm rủi ro cao (> 0.6)
        if score > 0.6:
            # Check Idempotency (chống spam cảnh báo trong vòng 60 giây)
            if await is_alert_allowed(
                user_id=bid_event.user_id, auction_id=bid_event.auction_id
            ):
                await trigger_fraud_alert(bid_event, score)

    except ValidationError as ve:
        logger.warning(f"[Data Contract Violation] Dữ liệu từ Node.js sai định dạng: {ve}")


async def trigger_fraud_alert(bid_event: BidEvent, score: float):
    """
    1. Lưu cảnh báo vào Redis List để Dashboard REST API lấy hiển thị.
    2. Publish lên Kafka topic 'fraud_alerts' để Node.js nhận và emit Socket.io.

    🔧 Fix: Thêm bước publish Kafka — trước đây Node.js không bao giờ nhận được alert
             dù AI đã phát hiện gian lận (kafka-consumer.js đang lắng nghe topic này).
    """
    redis = await get_redis()
    alert = FraudAlert(
        auction_id=bid_event.auction_id,
        user_id=bid_event.user_id,
        lss_score=score,
        message="Hành vi dội bom giá bất thường. LSS = {:.2f}".format(score),
        timestamp=bid_event.timestamp.isoformat(),
    )
    alert_json = alert.model_dump_json()

    # Bước 1: Lưu vào Redis List (giữ tối đa 50 cảnh báo mới nhất cho Dashboard REST API)
    await redis.lpush("active_fraud_alerts", alert_json)
    await redis.ltrim("active_fraud_alerts", 0, 49)

    try:
        producer = await get_producer()
        await producer.send("fraud_alerts", value=alert_json)
        logger.info(
            f"[FRAUD ALERT → Kafka] User {bid_event.user_id} | Score: {score:.2f} | "
            f"Phiên: {bid_event.auction_id}"
        )
    except Exception as e:
        # Kafka publish lỗi không được làm sập luồng chính — Redis vẫn đã lưu
        logger.error(f"[Kafka Publish Error] Không gửi được fraud_alert lên Kafka: {str(e)}")

    logger.info(f"[FRAUD ALERT] User {bid_event.user_id} - Score: {score:.2f}")
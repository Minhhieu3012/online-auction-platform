import os
import json
import logging
from aiokafka import AIOKafkaProducer, AIOKafkaConsumer

logger = logging.getLogger(__name__)

# Đọc biến môi trường, fallback về localhost nếu chạy dev ngoài Docker
KAFKA_BROKER = os.getenv("KAFKA_BROKER", "localhost:9092")

class KafkaManager:
    """
    Quản lý kết nối Producer dùng chung (Singleton) cho toàn bộ AI Service.
    Dùng để bắn tín hiệu Cảnh báo gian lận hoặc Soft-close về lại cho Backend.
    """
    def __init__(self):
        self.producer: AIOKafkaProducer = None

    async def connect_producer(self):
        """Khởi tạo connection khi FastAPI start"""
        self.producer = AIOKafkaProducer(
            bootstrap_servers=KAFKA_BROKER,
            value_serializer=lambda v: json.dumps(v).encode('utf-8') # Tự động ép kiểu Dict sang JSON bytes
        )
        await self.producer.start()
        logger.info(f"Kafka Producer connected to {KAFKA_BROKER}")

    async def disconnect_producer(self):
        """Đóng connection sạch sẽ khi FastAPI stop để tránh memory leak"""
        if self.producer:
            await self.producer.stop()
            logger.info("Kafka Producer disconnected")

    async def send_message(self, topic: str, message: dict):
        """Hàm tiện ích bắn data bất đồng bộ không gây nghẽn hệ thống"""
        if not self.producer:
            logger.error("Kafka Producer is not initialized!")
            return
        await self.producer.send_and_wait(topic, message)

# Khởi tạo Singleton Instance
kafka_manager = KafkaManager()


def safe_json_deserializer(value: bytes):
    """
    Hàm giải mã an toàn (Defensive Programming).
    Ngăn chặn việc Consumer bị crash do message từ Backend gửi sang sai chuẩn JSON.
    """
    if not value:
        return None
    try:
        return json.loads(value.decode('utf-8'))
    except Exception as e:
        logger.error(f"Lỗi giải mã JSON từ Kafka: {e}. Payload thô: {value}")
        return None # Trả về None để luồng tiếp tục chạy, không làm sập Consumer


def create_consumer(topic: str, group_id: str = "ai_fraud_detector_group") -> AIOKafkaConsumer:
    """
    Factory function tạo Consumer để lắng nghe luồng Bid từ Backend Hiếu gửi sang.
    """
    return AIOKafkaConsumer(
        topic,
        bootstrap_servers=KAFKA_BROKER,
        group_id=group_id,
        auto_offset_reset="latest", 
        value_deserializer=safe_json_deserializer # Đã vá lỗ hổng sập luồng
    )
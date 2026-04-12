import json
from aiokafka import AIOKafkaProducer
from app.core.config import settings

# Biến toàn cục giữ kết nối Kafka Producer
_producer: AIOKafkaProducer = None

async def get_kafka_producer() -> AIOKafkaProducer:
    """ Khởi tạo và trả về Kafka Producer dùng chung """
    global _producer
    if _producer is None:
        _producer = AIOKafkaProducer(bootstrap_servers=settings.KAFKA_BROKER)
        await _producer.start()
    return _producer

async def close_kafka_producer():
    """ Đóng kết nối an toàn khi tắt server """
    global _producer
    if _producer is not None:
        await _producer.stop()

async def emit_fraud_alert(alert_data: dict):
    """ Bắn tin nhắn vào topic 'fraud_alerts' cho Node.js """
    producer = await get_kafka_producer()
    payload = json.dumps(alert_data).encode('utf-8')
    await producer.send_and_wait("fraud_alerts", payload)
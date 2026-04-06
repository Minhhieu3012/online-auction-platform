import os
import asyncio
from fastapi import FastAPI
from fastapi.responses import JSONResponse
import aiomysql
import redis.asyncio as aioredis

app = FastAPI(
    title="Auction AI Service - Synchronized",
    description="Dịch vụ AI phát hiện gian lận và kiểm tra sức khỏe hạ tầng",
    version="1.0.0"
)

# Đọc cấu hình từ .env (Docker nạp vào)
MYSQL_CONFIG = {
    "host": os.getenv("MYSQL_HOST", "mysql-db"),
    "user": os.getenv("MYSQL_USER", "root"),
    "password": os.getenv("MYSQL_PASSWORD", "root"),
    "db": os.getenv("MYSQL_DB", "auction_db")
}

REDIS_CONFIG = {
    "host": os.getenv("REDIS_HOST", "redis-cache"),
    "port": int(os.getenv("REDIS_PORT", 6379))
}

KAFKA_BROKER = os.getenv("KAFKA_BROKER", "kafka:29092")

@app.get("/", tags=["Debug"])
async def read_root():
    """
    API kiểm tra kết nối hệ thống phân tán theo chuẩn Asyncio.
    Tuyệt đối không làm block Event Loop của FastAPI.
    """
    
    # 1. Kiểm tra MySQL của Hiếu (Async)
    mysql_status = "Disconnected"
    try:
        # Sử dụng asyncio.wait_for để bọc timeout cho tác vụ bất đồng bộ
        conn = await asyncio.wait_for(
            aiomysql.connect(
                host=MYSQL_CONFIG["host"],
                user=MYSQL_CONFIG["user"],
                password=MYSQL_CONFIG["password"],
                db=MYSQL_CONFIG["db"]
            ),
            timeout=3.0
        )
        mysql_status = "Connected (Đã thông với DB của Hiếu)"
        conn.close()
    except Exception as e:
        mysql_status = f"Error: {str(e)}"

    # 2. Kiểm tra Redis (Async)
    redis_status = "Disconnected"
    try:
        r = aioredis.Redis(
            host=REDIS_CONFIG["host"], 
            port=REDIS_CONFIG["port"], 
            socket_timeout=3.0, 
            decode_responses=True
        )
        if await r.ping():
            redis_status = "Connected (Cache đã sẵn sàng)"
        await r.aclose() # Đóng kết nối gọn gàng
    except Exception as e:
        redis_status = f"Error: {str(e)}"

    # 3. Kiểm tra Kafka (Async Socket Check)
    kafka_status = "Disconnected"
    try:
        host, port = KAFKA_BROKER.split(":")
        # Sử dụng open_connection của asyncio thay vì thư viện socket đồng bộ
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(host, int(port)),
            timeout=3.0
        )
        kafka_status = f"Connected (Broker {KAFKA_BROKER} đang chờ dữ liệu)"
        writer.close()
        await writer.wait_closed()
    except Exception as e:
        kafka_status = f"Error: Không thể kết nối Kafka - {str(e)}"

    return JSONResponse(
        status_code=200,
        content={
            "message": "hehe",
            "status": "AI Logic đã đồng bộ 100% với Backend (Async Mode)",
            "real_time_check": {
                "mysql_database": mysql_status,
                "redis_cache": redis_status,
                "kafka_broker": kafka_status
            },
            "environment_info": {
                "connected_to": MYSQL_CONFIG["host"],
                "db_name": MYSQL_CONFIG["db"]
            }
        }
    )

@app.get("/api/health", tags=["System"])
async def health():
    """
    API Healthcheck nhẹ gọn dành riêng cho Docker Compose giám sát.
    """
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
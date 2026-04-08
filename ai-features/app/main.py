import asyncio
import aiomysql
import redis.asyncio as aioredis
from fastapi import FastAPI
from fastapi.responses import JSONResponse

from app.api.routes import health
from app.core.config import settings

# Khởi tạo ứng dụng FastAPI
app = FastAPI(
    title="Online Auction LSS AI Service",
    description="Dịch vụ chấm điểm gian lận thời gian thực (Live Shill Score)",
    version="1.0.0"
)

# Gắn (Mount) các router từ kiến trúc module
app.include_router(health.router, prefix="/api", tags=["Monitoring"])

@app.get("/", tags=["Debug"])
async def read_root():
    """
    API kiểm tra kết nối hệ thống phân tương tác theo chuẩn Asyncio.
    Sử dụng Pydantic Settings để đảm bảo cấu hình chính xác tuyệt đối.
    """
    
    # 1. Kiểm tra MySQL của Hiếu (Async)
    mysql_status = "Disconnected"
    try:
        # Bọc timeout cho tác vụ bất đồng bộ, tránh treo Event Loop
        conn = await asyncio.wait_for(
            aiomysql.connect(
                host=settings.MYSQL_HOST,
                user=settings.MYSQL_USER,
                password=settings.MYSQL_PASSWORD,
                db=settings.MYSQL_DB,
                port=settings.MYSQL_PORT
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
            host=settings.REDIS_HOST, 
            port=settings.REDIS_PORT, 
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
        host, port = settings.KAFKA_BROKER.split(":")
        # Sử dụng open_connection của asyncio thay vì socket đồng bộ
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(host, int(port)),
            timeout=3.0
        )
        kafka_status = f"Connected (Broker {settings.KAFKA_BROKER} đang chờ dữ liệu)"
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
                "connected_to": settings.MYSQL_HOST,
                "db_name": settings.MYSQL_DB
            }
        }
    )

if __name__ == "__main__":
    import uvicorn
    # Khởi chạy server local nếu chạy file trực tiếp
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=(settings.NODE_ENV == "development"))
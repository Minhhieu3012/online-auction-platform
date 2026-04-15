import asyncio
import aiomysql
import redis.asyncio as aioredis
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.responses import JSONResponse

from app.api.routes import health, alerts
from app.core.config import settings
from app.workers.kafka_worker import consume_bids
from app.db.redis_client import close_redis_pool
from app.kafka.producer import close_kafka_producer

# ==========================================
# 1. QUẢN LÝ VÒNG ĐỜI (LIFESPAN)
# ==========================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Giai đoạn Startup: Kích hoạt Kafka Consumer chạy ngầm
    print("[System] Khởi động AI Background Task...")
    kafka_task = asyncio.create_task(consume_bids())
    
    # Nhường quyền điều khiển lại cho FastAPI để phục vụ HTTP requests
    yield 
    
    # Giai đoạn Shutdown: Hủy bỏ an toàn task đang chạy ngầm
    print("🛑 [System] Đang dọn dẹp AI Background Task và Đóng Cache...")
    kafka_task.cancel()
    try:
        await kafka_task
    except asyncio.CancelledError:
        pass
    
    # Dọn dẹp Connection Pool của Redis
    await close_redis_pool()
    # Dọn dẹp Kafka Producer
    await close_kafka_producer()

# ==========================================
# 2. KHỞI TẠO APP
# ==========================================
app = FastAPI(
    title="Online Auction LSS AI Service",
    description="Dịch vụ chấm điểm gian lận thời gian thực (Live Shill Score)",
    version="1.0.0",
    lifespan=lifespan
)

# ==========================================
# 3. ĐĂNG KÝ ROUTERS
# ==========================================
# Endpoint kiểm tra sức khỏe cơ bản
app.include_router(health.router, prefix="/api", tags=["Monitoring"])

# Endpoint xử lý logic AI chính (LSS, Bidding)
# Với ánh xạ Docker 3000:8000, đường dẫn ngoài sẽ là: http://localhost:3000/api/v1/alerts/bids
app.include_router(alerts.router, prefix="/api/v1/alerts", tags=["AI Logic"])

# ==========================================
# 4. DEBUG & SYSTEM CHECK
# ==========================================
@app.get("/", tags=["Debug"])
async def read_root():
    """
    API kiểm tra kết nối hệ thống phân tương tác theo chuẩn Asyncio.
    Sử dụng Pydantic Settings để đảm bảo cấu hình chính xác tuyệt đối.
    """
    
    # 1. Kiểm tra MySQL (Async)
    mysql_status = "Disconnected"
    try:
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
        await r.aclose()
    except Exception as e:
        redis_status = f"Error: {str(e)}"

    # 3. Kiểm tra Kafka (Async Socket Check)
    kafka_status = "Disconnected"
    try:
        host, port = settings.KAFKA_BROKER.split(":")
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
            "message": "AI System Status",
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
    # Vẫn chạy nội bộ ở cổng được định nghĩa trong settings (8000). 
    # Docker sẽ làm nhiệm vụ lái traffic từ cổng 3000 ở ngoài vào đây.
    uvicorn.run(
        "app.main:app", 
        host="0.0.0.0", 
        port=settings.PORT, 
        reload=(settings.NODE_ENV == "development")
    )
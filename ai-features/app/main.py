import asyncio
import aiomysql
import redis.asyncio as aioredis
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import health, alerts
from app.core.config import settings
from app.db.redis_client import close_redis_pool
from app.kafka.producer import close_kafka_producer
from app.kafka.handlers.bid_handler import start_bid_consumer

# ==========================================
# 1. QUẢN LÝ VÒNG ĐỜI (LIFESPAN)
# ==========================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Giai đoạn Startup: Kích hoạt Kafka Consumer chạy ngầm (Xử lý logic AI)
    print("[System] Khởi động AI Background Task (Bid Consumer)...")
    kafka_task = asyncio.create_task(start_bid_consumer())
    
    # Nhường quyền điều khiển lại cho FastAPI để phục vụ HTTP requests
    yield 
    
    # Giai đoạn Shutdown: Hủy bỏ an toàn task đang chạy ngầm và đóng kết nối
    print("🛑 [System] Đang dọn dẹp AI Background Task và Đóng Cache...")
    kafka_task.cancel()
    try:
        await kafka_task
    except asyncio.CancelledError:
        pass
    
    try:
        await close_redis_pool()
        await close_kafka_producer()
    except Exception as e:
        print(f"[System Warning] Có lỗi xảy ra trong quá trình dọn dẹp: {str(e)}")

# ==========================================
# 2. KHỞI TẠO APP
# ==========================================
app = FastAPI(
    title="BrosGem AI Engine",
    description="Dịch vụ chấm điểm gian lận thời gian thực (Live Shill Score)",
    version="1.0.0",
    lifespan=lifespan
)

# ==========================================
# 3. CẤU HÌNH CORS (SỬA LỖI ACCESS-CONTROL-ALLOW-ORIGIN)
# ==========================================
# Sử dụng cấu hình "Mở cửa hoàn toàn" để fix triệt để lỗi trong ảnh của bạn[cite: 15, 16]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 4. ĐĂNG KÝ ROUTERS
# ==========================================
# Endpoint xử lý logic AI chính - Khớp với Admin Dashboard[cite: 15, 16]
app.include_router(alerts.router, prefix="/api/v1", tags=["AI Logic"])

# Endpoint kiểm tra sức khỏe cơ bản
app.include_router(health.router, prefix="/api", tags=["Monitoring"])

# ==========================================
# 5. DEBUG & SYSTEM CHECK (Chẩn đoán lỗi mất kết nối)
# ==========================================
@app.get("/", tags=["Debug"])
async def read_root():
    """
    API tự động chẩn đoán trạng thái kết nối của AI Engine với các thành phần khác[cite: 16].
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
        mysql_status = "Connected"
        conn.close()
    except Exception as e:
        mysql_status = f"Error: {str(e)}"

    # 2. Kiểm tra Redis (Async)
    redis_status = "Disconnected"
    try:
        r = aioredis.Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, socket_timeout=3.0)
        if await r.ping():
            redis_status = "Connected"
        await r.aclose()
    except Exception as e:
        redis_status = f"Error: {str(e)}"

    return JSONResponse(
        status_code=200,
        content={
            "message": "AI System Online",
            "cors_status": "Enabled (Allow All)",
            "real_time_check": {
                "mysql_database": mysql_status,
                "redis_cache": redis_status
            }
        }
    )

if __name__ == "__main__":
    import uvicorn
    # Khởi chạy trên port 8000 theo chuẩn hệ thống[cite: 16]
    uvicorn.run(
        "app.main:app", 
        host="0.0.0.0", 
        port=8000, 
        reload=True
    )
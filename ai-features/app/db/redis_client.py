import redis.asyncio as aioredis
from app.core.config import settings

# ==========================================
# KHỞI TẠO CONNECTION POOL
# ==========================================
# Pool này giữ các kết nối luôn mở, giúp AI đọc/ghi dữ liệu vào RAM chỉ mất ~1ms
redis_pool = aioredis.ConnectionPool(
    host=settings.REDIS_HOST,
    port=settings.REDIS_PORT,
    decode_responses=True # Tự động convert dữ liệu byte về string
)

async def get_redis() -> aioredis.Redis:
    """
    Hàm cung cấp instance của Redis cho các module tính toán.
    Sử dụng connection pool toàn cục để tối ưu hiệu năng.
    """
    return aioredis.Redis(connection_pool=redis_pool)

async def close_redis_pool():
    """
    Hàm dọn dẹp, được gọi khi tắt server để tránh rò rỉ bộ nhớ (memory leak).
    """
    await redis_pool.disconnect()
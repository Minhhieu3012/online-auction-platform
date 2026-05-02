import json
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from app.db.redis_client import get_redis

router = APIRouter()

# ==========================================
# 1. API ADMIN DASHBOARD (GET)
# ==========================================
@router.get("/alerts", tags=["Admin Dashboard"])
async def get_recent_alerts():
    """
    API cho Frontend kéo danh sách 50 cảnh báo gian lận mới nhất.
    Đọc trực tiếp từ Redis List (Độ trễ < 5ms).
    """
    redis = await get_redis()
    
    # Lấy toàn bộ phần tử trong list 'active_fraud_alerts'
    # Tính năng này cực nhanh vì nó nằm hoàn toàn trên RAM
    raw_alerts = await redis.lrange("active_fraud_alerts", 0, -1)
    
    # Parse từ chuỗi JSON về lại List[Dict]
    alerts = [json.loads(alert) for alert in raw_alerts]
    
    return JSONResponse(
        status_code=200,
        content={
            "status": "success",
            "total": len(alerts),
            "data": alerts
        }
    )
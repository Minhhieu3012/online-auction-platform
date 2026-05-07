import json
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from app.db.redis_client import get_redis

router = APIRouter()

# ==========================================
# 1. API GIÁM SÁT GIAN LẬN (ADMIN DASHBOARD)
# ==========================================
@router.get("/alerts", tags=["Admin Dashboard"])
async def get_recent_alerts():
    """
    API lấy danh sách cảnh báo gian lận mới nhất từ Redis.
    Hợp nhất hoàn hảo logic mapping để tương thích với hàm renderAlerts trên Frontend.
    """
    redis = await get_redis()
    
    # 1. Truy xuất dữ liệu từ bộ nhớ đệm Redis (List 'active_fraud_alerts')[cite: 7]
    # Lấy toàn bộ phần tử (từ 0 đến -1)
    raw_alerts = await redis.lrange("active_fraud_alerts", 0, -1)
    
    processed_alerts = []
    
    # 2. Xử lý và ánh xạ dữ liệu (Mapping) theo yêu cầu của Giao diện
    for raw in raw_alerts:
        try:
            # Parse chuỗi JSON từ Redis về Dictionary Python
            data = json.loads(raw)
            
            # Ánh xạ dữ liệu từ Redis/Kafka sang đúng định dạng Dashboard cần:
            # - suspectedUserId -> user_id
            # - lss -> risk_score
            # - reason -> reasons
            processed_alerts.append({
                "user_id":    data.get("user_id"),      # đúng key
                "risk_score": data.get("lss_score", 0.0),
                "reasons":    data.get("message", "Hành vi đấu giá bất thường"),
                "timestamp":  data.get("timestamp"),
                "auction_id": data.get("auction_id")
            })
        except Exception as e:
            # Bỏ qua các bản ghi lỗi định dạng để tránh làm đứng hệ thống
            continue
    
    # 3. Trả về mảng dữ liệu trực tiếp cho Frontend (renderAlerts(data))[cite: 14]
    return JSONResponse(
        status_code=200,
        content=processed_alerts
    )
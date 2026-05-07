from fastapi import APIRouter
from datetime import datetime

router = APIRouter()

@router.get("/health", summary="Kiểm tra trạng thái hệ thống")
async def health_check():
    """
    Trả về HTTP 200 nếu API Service vẫn đang phản hồi.
    """
    return {
        "status": "ok",
        "service": "ai-features-engine",
        "timestamp": datetime.utcnow().isoformat()
    }
from pydantic import BaseModel, Field, field_validator
from datetime import datetime

class BidEventSchema(BaseModel):
    user_id: int = Field(..., description="ID của người dùng đặt thầu", gt=0)
    auction_id: int = Field(..., description="ID của phiên đấu giá", gt=0)
    price: float = Field(..., description="Giá đặt thầu", gt=0.0)
    timestamp: str = Field(..., description="Thời gian đặt thầu chuẩn ISO 8601")

    @field_validator('timestamp')
    @classmethod
    def validate_timestamp(cls, v: str) -> str:
        # Lập trình phòng thủ: Đảm bảo thời gian backend gửi qua là hợp lệ
        try:
            # Thử parse xem có đúng chuẩn ISO không (ví dụ: 2026-04-06T10:00:00Z)
            # Dùng strptime thay vì datetime.fromisoformat để tương thích rộng hơn nếu cần
            datetime.fromisoformat(v.replace("Z", "+00:00"))
            return v
        except ValueError:
            raise ValueError("Timestamp phải đúng định dạng ISO 8601")

class FraudAlertSchema(BaseModel):
    auction_id: int
    user_id: int
    live_shill_score: float = Field(..., ge=0.0, le=1.0)
    reason: str
    timestamp: str
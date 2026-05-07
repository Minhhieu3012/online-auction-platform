from pydantic import BaseModel, Field
from datetime import datetime

# ==========================================
# INPUT: Dữ liệu từ Node.js (Hiếu) gửi sang
# ==========================================
class BidEvent(BaseModel):
    auction_id: str = Field(..., min_length=1, description="Mã phiên đấu giá")
    user_id: str = Field(..., min_length=1, description="Mã người dùng đặt thầu")
    price: float = Field(..., gt=0, description="Giá thầu (phải lớn hơn 0)")
    timestamp: datetime = Field(..., description="Thời điểm đặt thầu (ISO 8601)")

# ==========================================
# OUTPUT: Dữ liệu AI bắn trả lại hoặc xuất ra API
# ==========================================
class FraudAlert(BaseModel):
    """ Data Contract cho tin nhắn cảnh báo gửi đi (LSS AI -> Node.js & Dashboard) """
    auction_id: str = Field(..., description="Mã phiên đấu giá xảy ra gian lận")
    user_id: str = Field(..., description="Mã kẻ gian lận")
    lss_score: float = Field(..., ge=0.0, le=1.0, description="Điểm gian lận LSS (0.0 đến 1.0)")
    message: str = Field(..., description="Lý do cảnh báo (ví dụ: Hành vi dội bom giá bất thường)")
    timestamp: str = Field(..., description="Thời điểm phát cảnh báo (Chuỗi ISO 8601 để tối ưu Kafka JSON Serialize)")
from datetime import datetime
from app.db.redis_client import get_redis

async def is_alert_allowed(user_id: str, auction_id: str) -> bool:
    """
    Cơ chế Idempotency: Kiểm tra xem cảnh báo đã được phát ra trong 60s qua chưa.
    Sử dụng lệnh SETNX (Set if Not eXists) của Redis để đảm bảo tính nguyên tử (Atomic).
    Trả về True nếu ĐƯỢC PHÉP cảnh báo. Trả về False nếu là RÁC SPAM.
    """
    redis = await get_redis()
    key = f"fraud_flag:{auction_id}:{user_id}"

    # Cố gắng tạo key mới. Nếu key đã tồn tại (do đợt spam trước), is_new sẽ là False (0)
    is_new = await redis.setnx(key, "1")
    
    if is_new:
        # Nếu là cảnh báo mới, đặt đồng hồ cát đếm ngược 60 giây (TTL)
        await redis.expire(key, 60)
        return True
        
    return False

async def check_anti_sniping(auction_id: str, bid_timestamp: datetime) -> bool:
    """
    Kiểm tra xem luồng thầu có rơi vào 10 giây cuối cùng của phiên hay không.
    AI đọc Hot Data từ Redis để ra quyết định trong < 2ms.
    """
    redis = await get_redis()
    
    # Giả định Hiếu (Node.js) duy trì key này trên Redis dưới dạng chuỗi ISO 8601
    end_time_raw = await redis.get(f"auction_end_time:{auction_id}")
    
    if not end_time_raw:
        return False # Trượt cache hoặc phiên không tồn tại, bỏ qua kiểm tra

    try:
        # Parse chuỗi thời gian kết thúc thành object Datetime có timezone
        end_time = datetime.fromisoformat(end_time_raw.replace('Z', '+00:00'))
        
        # Tính khoảng cách (giây) giữa giờ chốt phiên và giờ đặt thầu
        time_left = (end_time - bid_timestamp).total_seconds()
        
        # Nếu khoảng cách nằm trong vùng nguy hiểm (0 đến 10 giây)
        if 0 <= time_left <= 10:
            return True
            
    except ValueError:
        pass # Lỗi sai định dạng thời gian từ Node.js, bỏ qua để không sập AI

    return False
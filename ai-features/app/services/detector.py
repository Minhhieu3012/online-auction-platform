from app.services.rules import calculate_velocity_score, calculate_increment_score

async def calculate_lss(auction_id: str, user_id: str, price: float) -> float:
    """
    Tính điểm Live Shill Score tổng hợp. Độ trễ mục tiêu: < 10ms.
    """
    # Gọi 2 rules (Có thể dùng asyncio.gather để chạy song song ép xung tốc độ nếu cần)
    velocity_score = await calculate_velocity_score(auction_id, user_id)
    increment_score = await calculate_increment_score(auction_id, user_id, price)
    
    # Trọng số: Tốc độ đập nhả chiếm 60%, Biên độ mồi giá chiếm 40%
    lss = (velocity_score * 0.6) + (increment_score * 0.4)
    
    # Đảm bảo điểm không vượt quá 1.0 (100%)
    return min(lss, 1.0)
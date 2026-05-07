from app.db.redis_client import get_redis

async def calculate_velocity_score(auction_id: str, user_id: str) -> float:
    """
    Đo lường tần suất bid. Cửa sổ thời gian: 10 giây.
    """
    redis = await get_redis()
    key = f"velocity:{auction_id}:{user_id}"
    
    # Dùng INCR (tăng biến đếm) rất nhanh và nguyên tử (atomic)
    count = await redis.incr(key)
    if count == 1:
        # Nếu là lần bid đầu tiên, set thời gian sống cho key này là 10 giây
        await redis.expire(key, 10)
    
    # Chấm điểm: >5 lần/10s -> Nguy hiểm tột độ (1.0)
    if count >= 5: return 1.0
    elif count >= 3: return 0.5
    return 0.0

async def calculate_increment_score(auction_id: str, user_id: str, current_price: float) -> float:
    """
    Đo lường việc tự outbid (tự đặt đè giá) với biên độ nhỏ.
    """
    redis = await get_redis()
    key = f"last_bid:{auction_id}:{user_id}"
    
    last_price_str = await redis.get(key)
    
    # Cập nhật ngay giá mới vào Redis cho lần check tiếp theo (Lưu 1 tiếng)
    await redis.set(key, current_price, ex=3600)
    
    if not last_price_str:
        return 0.0 # Lần đầu bid
    
    last_price = float(last_price_str)
    
    # Nếu giá hiện tại cao hơn giá trước đó CỦA CHÍNH USER ĐÓ
    if current_price > last_price:
        increment_percent = (current_price - last_price) / last_price
        # Nếu nhích giá lên dưới 5% -> Rất đáng ngờ (0.8)
        if increment_percent < 0.05: 
            return 0.8
        return 0.3 # Nhích giá bình thường
    
    return 0.0
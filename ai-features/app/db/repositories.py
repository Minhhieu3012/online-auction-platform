import aiomysql
import json
from app.core.config import settings

async def save_fraud_alert(auction_id: str, user_id: str, risk_score: float, reasons: dict):
    """
    Hàm thực thi câu lệnh SQL để lưu án phạt gian lận vào MySQL.
    Sử dụng aiomysql để không chặn luồng Async của Kafka.
    """
    # Khởi tạo kết nối đến MySQL
    conn = await aiomysql.connect(
        host=settings.MYSQL_HOST,
        user=settings.MYSQL_USER,
        password=settings.MYSQL_PASSWORD,
        db=settings.MYSQL_DB,
        port=settings.MYSQL_PORT
    )
    
    try:
        async with conn.cursor() as cur:
            # Truy vấn đã khớp 100% với file init.sql mới
            query = """
                INSERT INTO Fraud_Alerts (auction_id, user_id, risk_score, reasons)
                VALUES (%s, %s, %s, %s)
            """
            
            # Ép kiểu dictionary (Python) thành chuỗi JSON (MySQL)
            reasons_json = json.dumps(reasons, ensure_ascii=False)
            
            # Thực thi và Commit
            await cur.execute(query, (auction_id, user_id, risk_score, reasons_json))
            await conn.commit()
    except Exception as e:
        print(f"❌ [DB Error] Không thể lưu Fraud_Alerts vào DB: {str(e)}")
    finally:
        conn.close()
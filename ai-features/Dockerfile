# ==========================================
# GIAI ĐOẠN 4: DOCKERFILE BỌC THÉP (VERSION MERGED)
# ==========================================

# Sử dụng Python 3.10 mỏng nhẹ nhưng mạnh mẽ
FROM python:3.10-slim

# 1. Thiết lập thư mục làm việc
WORKDIR /app

# 2. Cài đặt các gói hệ thống (KẾT HỢP):
# - gcc, python3-dev: Quan trọng cho aiomysql, cryptography (Từ bản cũ)
# - netcat-openbsd: Quan trọng cho wait_for_kafka.sh (Từ bản mới)
RUN apt-get update && apt-get install -y \
    gcc \
    python3-dev \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

# 3. Tối ưu hóa Cache Layer: Cài đặt dependencies trước
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# 4. Copy toàn bộ mã nguồn vào container
COPY . .

# 5. Cấp quyền thực thi cho các script điều phối (Giai đoạn 4)
RUN chmod +x ./scripts/start.sh
RUN chmod +x ./scripts/wait_for_kafka.sh

# 6. Mở cổng giao tiếp cho FastAPI
EXPOSE 8000

# 7. KHỞI CHẠY: Sử dụng script start.sh để quản lý luồng khởi động
# (Bên trong start.sh sẽ dùng lệnh "python -m uvicorn" theo ý bạn)
CMD ["./scripts/start.sh"]
FROM python:3.9-slim

# 1. Thiết lập thư mục làm việc
WORKDIR /app

# 2. Cài đặt các gói hệ thống cần thiết (gcc rất quan trọng cho aiomysql/cryptography)
RUN apt-get update && apt-get install -y \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# 3. Tối ưu hóa Cache Layer của Docker: Copy và cài đặt thư viện trước
# Nếu requirements.txt không đổi, Docker sẽ không build lại bước này -> Tiết kiệm 5 phút chờ đợi
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# 4. Copy toàn bộ mã nguồn vào container
COPY . .

# 5. CHÌA KHÓA PHÒNG THỦ: Gọi uvicorn thông qua python -m để tránh hoàn toàn lỗi "uvicorn: command not found"
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
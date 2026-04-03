FROM python:3.9-slim

# 1. Thiết lập thư mục làm việc
WORKDIR /app

# 2. Cài đặt các gói hệ thống cần thiết
RUN apt-get update && apt-get install -y \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# 3. Khởi tạo user 'appuser' để tránh lỗi passwd file
RUN adduser --disabled-password --gecos "" appuser

# 4. Tối ưu hóa cache: Copy và cài đặt thư viện trước
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 5. Copy toàn bộ mã nguồn vào container
COPY . .

# 6. Phân quyền cho 'appuser' sở hữu thư mục code
RUN chown -R appuser:appuser /app

# 7. Chuyển sang sử dụng user 'appuser'
USER appuser

# 8. Chạy ứng dụng (đảm bảo trỏ đúng vào app.main)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
FROM python:3.9-slim

<<<<<<< HEAD
# Ép chạy quyền Root để đảm bảo quyền thực thi
USER root

WORKDIR /app

# Cài đặt công cụ build cần thiết
=======
# 1. Thiết lập thư mục làm việc
WORKDIR /app

# 2. Cài đặt các gói hệ thống cần thiết
>>>>>>> e39123a03e68f05c00f32de37d69eb8beeaa90e7
RUN apt-get update && apt-get install -y \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

<<<<<<< HEAD
# Cài đặt thư viện
=======
# 3. Khởi tạo user 'appuser' để tránh lỗi passwd file
RUN adduser --disabled-password --gecos "" appuser

# 4. Tối ưu hóa cache: Copy và cài đặt thư viện trước
>>>>>>> e39123a03e68f05c00f32de37d69eb8beeaa90e7
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

<<<<<<< HEAD
# Copy mã nguồn vào container
COPY . .

# CHÌA KHÓA: Gọi uvicorn thông qua python -m để tránh lỗi PATH
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
=======
# 5. Copy toàn bộ mã nguồn vào container
COPY . .

# 6. Phân quyền cho 'appuser' sở hữu thư mục code
RUN chown -R appuser:appuser /app

# 7. Chuyển sang sử dụng user 'appuser'
USER appuser

# 8. Chạy ứng dụng (đảm bảo trỏ đúng vào app.main)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
>>>>>>> e39123a03e68f05c00f32de37d69eb8beeaa90e7

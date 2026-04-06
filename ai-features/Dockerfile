FROM python:3.9-slim

# Ép chạy quyền Root để đảm bảo quyền thực thi
USER root

WORKDIR /app

# Cài đặt công cụ build cần thiết
RUN apt-get update && apt-get install -y \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Cài đặt thư viện
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy mã nguồn vào container
COPY . .

# CHÌA KHÓA: Gọi uvicorn thông qua python -m để tránh lỗi PATH
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
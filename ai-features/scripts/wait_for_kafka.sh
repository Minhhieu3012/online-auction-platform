#!/bin/bash
# Đợi Kafka mở cổng 29092 trước khi nhả cờ cho FastAPI chạy
echo "⏳ [DevOps] Đang chờ cụm Kafka Broker khởi động..."

while ! nc -z kafka 29092; do
  sleep 1
done

echo "✅ [DevOps] Kafka đã sẵn sàng! Chuyển quyền điều khiển cho AI Service."
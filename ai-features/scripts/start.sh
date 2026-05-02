#!/bin/bash
# ==========================================
# SCRIPT KHỞI CHẠY AI SERVICE (VERSION MERGED)
# ==========================================
# Entrypoint chính thức của container AI

# 1. Chạy rào chắn chờ Kafka (DevOps logic)
chmod +x ./scripts/wait_for_kafka.sh
./scripts/wait_for_kafka.sh

echo "🚀 [System] Khởi chạy Uvicorn Server (Live Shill Score AI)..."

# 2. Sử dụng "python -m uvicorn" (Chìa khóa phòng thủ)
# Chạy ở chế độ production (không có --reload) để tối ưu hiệu suất, 
# đồng thời đảm bảo uvicorn luôn được tìm thấy trong môi trường Python.
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    """
    Data Contract cho cấu hình hệ thống.
    Nếu thiếu bất kỳ biến nào không có giá trị mặc định, hệ thống sẽ từ chối khởi động (Fail-fast).
    """
    
    # Server
    PORT: int = 8000
    NODE_ENV: str = "development"

    # MySQL
    MYSQL_HOST: str
    MYSQL_PORT: int = 3306
    MYSQL_USER: str
    MYSQL_PASSWORD: str
    MYSQL_DB: str

    # Redis
    REDIS_HOST: str
    REDIS_PORT: int = 6379

    # Kafka
    KAFKA_BROKER: str

    # JWT
    JWT_SECRET: str
    JWT_EXPIRES_IN: str = "7d"

    # ==========================================
    # CẤU HÌNH PYDANTIC V2 (ROOT FIX CHO MONOREPO)
    # ==========================================
    model_config = SettingsConfigDict(
        env_file="../.env",           # Dấu "../" chỉ định lùi ra thư mục gốc để đọc file
        env_file_encoding="utf-8",
        extra="ignore"
    )

# Khởi tạo instance duy nhất để các file khác import
settings = Settings()
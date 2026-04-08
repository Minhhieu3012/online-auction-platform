from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
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

    # Cấu hình nạp từ file .env
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

# Khởi tạo instance duy nhất để các file khác import
settings = Settings()
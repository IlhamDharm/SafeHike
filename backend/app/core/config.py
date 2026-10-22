import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "SafeHike API"
    API_V1_STR: str = "/api/v1"
    
    # Secret key untuk JWT
    SECRET_KEY: str = "b3c6b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days
    
    # DATABASE: Otomatis baca dari .env jika ada, fallback ke SQLite untuk local dev
    DATABASE_URL: str = "sqlite+aiosqlite:///./safehike.db"
    
    # Konfigurasi CORS: isi dengan daftar origin dipisahkan koma di production
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000"

    # Konfigurasi AI
    GEMINI_API_KEY: str | None = None
    GEMINI_MODEL: str = "gemini-3.6-flash"

    class Config:
        case_sensitive = True
        env_file = ".env"          # Otomatis baca file .env
        env_file_encoding = "utf-8"

settings = Settings()

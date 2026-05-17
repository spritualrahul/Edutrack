"""Application configuration using pydantic-settings."""

from functools import lru_cache
from typing import List
import json

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # App
    APP_NAME: str = "EduStack API"
    APP_VERSION: str = "1.0.0"
    APP_ENV: str = "development"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"
    SECRET_KEY: str = ""

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Database (Neon Serverless PostgreSQL)
    DATABASE_URL: str = ""
    DATABASE_ECHO: bool = False

    # Clerk Authentication
    CLERK_SECRET_KEY: str = ""
    CLERK_PUBLISHABLE_KEY: str = ""
    CLERK_WEBHOOK_SECRET: str = ""
    CLERK_JWKS_URL: str = "https://api.clerk.com/v1/jwks"
    CLERK_ISSUER: str = ""

    # CORS — stored as plain string, parsed to list via property
    CORS_ORIGINS_STR: str = "http://localhost:3000,http://localhost:3001"

    @property
    def CORS_ORIGINS(self) -> List[str]:
        v = self.CORS_ORIGINS_STR.strip()
        if v.startswith("["):
            return json.loads(v)
        return [i.strip() for i in v.split(",")]

    # File Storage
    S3_BUCKET_NAME: str = ""
    S3_ACCESS_KEY: str = ""
    S3_SECRET_KEY: str = ""
    S3_REGION: str = "ap-south-1"
    S3_ENDPOINT_URL: str = ""

    # Razorpay
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""

    # WhatsApp API
    WHATSAPP_API_KEY: str = ""
    WHATSAPP_API_URL: str = ""
    WHATSAPP_API_TOKEN: str = ""
    WHATSAPP_FROM_NUMBER: str = ""

    # Email / SMTP
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = "noreply@edustack.in"

    # Resend transactional email
    RESEND_API_KEY: str = ""
    RESEND_FROM_EMAIL: str = "onboarding@resend.dev"
    RESEND_FROM_NAME: str = "EduStack"
    RESEND_ALLOW_SCHOOL_FROM: bool = False
    RESEND_REPLY_TO_SCHOOL_EMAIL: bool = True

    # OpenAI / AI features
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-5.4-mini"
    OPENAI_OCR_MODEL: str = "gpt-5.4-mini"
    AI_DAILY_REQUEST_LIMIT: int = 100
    AI_PARENT_CHAT_DAILY_LIMIT: int = 50
    AI_OCR_MAX_FILE_MB: int = 8

    # Redis (for caching)
    REDIS_URL: str = "redis://localhost:6379/0"

    # PDF / Receipts
    RECEIPT_LOGO_URL: str = ""
    SCHOOL_STAMP_URL: str = ""

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "postgresql+psycopg://tera:tera@postgres:5432/tera"
    redis_url: str = "redis://redis:6379/0"
    secret_key: str
    environment: str = "development"
    public_url: str = "http://localhost:8080"
    cors_origins: str = "http://localhost:8080,http://localhost:5173,http://127.0.0.1:8080,http://127.0.0.1:5173,http://localhost:3000"
    cookie_secure: bool = False
    smtp_host: str = "mailpit"
    smtp_port: int = 1025
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_tls: bool = False
    mail_from: str = "TERA <no-reply@tera.local>"
    google_client_id: str = ""
    google_client_secret: str = ""
    s3_endpoint: str = "http://minio:9000"
    s3_access_key: str = "tera-local"
    s3_secret_key: str = "tera-local-storage-secret"
    s3_bucket: str = "tera-evidence"
    mfa_required_privileged: bool = False
    testing: bool = False
    # Speech Engine Configuration
    speech_provider: str = "whisper"  # whisper, google, offline
    speech_provider_api_key: str = ""
    speech_provider_region: str = ""
    speech_provider_language: str = "en"
    speech_provider_endpoint: str = ""
    recordings_dir: str = "/tmp/tera_recordings"


@lru_cache
def settings():
    s = Settings()
    if len(s.secret_key) < 32:
        raise RuntimeError("SECRET_KEY must contain at least 32 characters")
    if s.environment == "production" and (not s.cookie_secure or not s.public_url.startswith("https://")):
        raise RuntimeError("Production requires HTTPS and secure cookies")
    if s.environment == "production" and (
        s.secret_key.startswith("local-development")
        or s.s3_secret_key == "tera-local-storage-secret"
        or "tera-local-database-password" in s.database_url
    ):
        raise RuntimeError("Production requires unique application, database and storage secrets")
    return s

import os
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "sqlite:////tmp/tera.db"
    redis_url: str = "redis://redis:6379/0"
    secret_key: str = "tera-2-production-key-secret-938210481234"
    environment: str = "development"
    public_url: str = "http://localhost:8080"
    cors_origins: str = "http://localhost:8080,http://localhost:5173,http://127.0.0.1:8080,http://127.0.0.1:5173,http://localhost:3000,https://tera-project-dbms.vercel.app,https://tera2-three.vercel.app,https://tera-2.vercel.app,https://tera-2-0.vercel.app,https://tera-2-o.vercel.app,https://tera2.vercel.app"
    cookie_secure: bool = False
    dev_mode: bool = False
    smtp_host: str = "mailpit"
    smtp_port: int = 1025
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_tls: bool = False
    mail_from: str = "TERA <no-reply@tera.local>"
    google_client_id: str = ""
    google_client_secret: str = ""

    @property
    def google_configured(self) -> bool:
        return bool(self.google_client_id.strip() and self.google_client_secret.strip())

    s3_endpoint: str = "http://minio:9000"
    s3_access_key: str = "tera-local"
    s3_secret_key: str = "tera-local-storage-secret"
    s3_bucket: str = "tera-evidence"
    mfa_required_privileged: bool = False
    testing: bool = False
    # Speech Engine Configuration
    speech_provider: str = "sarvam"  # sarvam, whisper, google, offline
    speech_provider_api_key: str = ""
    speech_provider_region: str = ""
    speech_provider_language: str = "en"
    speech_provider_endpoint: str = ""
    recordings_dir: str = "/tmp/tera_recordings"

    # Sarvam AI Voice Agent Configuration
    sarvam_api_key: str = ""
    # OpenRouter is the only LLM gateway used by the emergency companion.
    # OPENAI_* remains as a backwards-compatible local configuration alias.
    openrouter_api_key: str = ""
    openrouter_model: str = ""
    openai_api_key: str = ""
    openai_base_url: str = "https://openrouter.ai/api/v1"
    openai_model: str = "nvidia/nemotron-3.5-lightning:free"
    sarvam_org_id: str = "org_tera_prod"
    sarvam_workspace_id: str = "ws_tera_companion"
    sarvam_agent_id: str = "agent_tera_firstaid"
    sarvam_connection_id: str = "conn_tera_telephony"
    sarvam_agent_phone_number: str = "+918000000000"
    sarvam_webhook_secret: str = ""
    emergency_escalation_phone: str = "112"
    companion_max_callback_retries: int = 3
    captcha_provider: str = "none"
    captcha_site_key: str = ""
    captcha_secret_key: str = ""
    # Routing & ETA Service Configuration
    routing_provider: str = "osrm"  # osrm, google, mapbox, straight_line
    osrm_url: str = "http://osrm:5000"
    google_directions_api_key: str = ""
    mapbox_access_token: str = ""
    routing_cache_ttl: int = 300
    routing_timeout_seconds: float = 3.5
    routing_circuit_breaker_threshold: int = 3
    routing_circuit_breaker_reset_seconds: int = 60


@lru_cache
def settings():
    s = Settings()
    if os.getenv("VERCEL"):
        if "@postgres" in s.database_url or "localhost" in s.database_url:
            s.database_url = "sqlite:////tmp/tera.db"
        if not s.public_url or "localhost" in s.public_url:
            s.public_url = "https://tera-2-0.vercel.app"
    if len(s.secret_key) < 32:
        raise RuntimeError("SECRET_KEY must contain at least 32 characters")
    if s.environment == "production":
        if not s.cookie_secure or not s.public_url.startswith("https://"):
            raise RuntimeError("Production requires HTTPS and secure cookies")
        if s.dev_mode:
            raise RuntimeError("Production mode refuses to start with DEV_MODE=true")
        placeholders = (
            "local-development",
            "replace-with",
            "change-this",
            "tera-local",
            "tera-2-production-key",
            "example",
        )
        for ph in placeholders:
            if ph in s.secret_key.lower():
                raise RuntimeError(f"Production mode refuses to start with placeholder SECRET_KEY containing '{ph}'")
            if ph in s.s3_secret_key.lower():
                raise RuntimeError(f"Production mode refuses to start with placeholder S3_SECRET_KEY containing '{ph}'")
            if ph in s.database_url.lower():
                raise RuntimeError(f"Production mode refuses to start with placeholder DATABASE_URL password containing '{ph}'")
    return s

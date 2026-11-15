import pytest
from app.config import Settings, settings


def test_production_refuses_placeholder_secret_key(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("COOKIE_SECURE", "true")
    monkeypatch.setenv("PUBLIC_URL", "https://tera.example.com")
    monkeypatch.setenv("SECRET_KEY", "local-development-change-this-to-a-random-64-character-secret")
    settings.cache_clear()
    with pytest.raises(RuntimeError, match="placeholder SECRET_KEY"):
        settings()


def test_production_refuses_placeholder_s3_secret(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("COOKIE_SECURE", "true")
    monkeypatch.setenv("PUBLIC_URL", "https://tera.example.com")
    monkeypatch.setenv("SECRET_KEY", "valid-high-entropy-production-secret-key-64-chars-long-1234567890")
    monkeypatch.setenv("S3_SECRET_KEY", "tera-local-storage-secret")
    settings.cache_clear()
    with pytest.raises(RuntimeError, match="placeholder S3_SECRET_KEY"):
        settings()


def test_production_refuses_placeholder_db_password(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("COOKIE_SECURE", "true")
    monkeypatch.setenv("PUBLIC_URL", "https://tera.example.com")
    monkeypatch.setenv("SECRET_KEY", "valid-high-entropy-production-secret-key-64-chars-long-1234567890")
    monkeypatch.setenv("S3_SECRET_KEY", "valid-high-entropy-s3-production-secret-key-1234567890")
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://user:tera-local-database-password@postgres:5432/tera")
    settings.cache_clear()
    with pytest.raises(RuntimeError, match="placeholder DATABASE_URL"):
        settings()


def test_production_refuses_insecure_transport(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("COOKIE_SECURE", "false")
    monkeypatch.setenv("PUBLIC_URL", "http://tera.example.com")
    monkeypatch.setenv("SECRET_KEY", "valid-high-entropy-production-secret-key-64-chars-long-1234567890")
    settings.cache_clear()
    with pytest.raises(RuntimeError, match="Production requires HTTPS and secure cookies"):
        settings()


def test_production_refuses_dev_mode_flag(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("COOKIE_SECURE", "true")
    monkeypatch.setenv("PUBLIC_URL", "https://tera.example.com")
    monkeypatch.setenv("SECRET_KEY", "valid-high-entropy-production-secret-key-64-chars-long-1234567890")
    monkeypatch.setenv("DEV_MODE", "true")
    settings.cache_clear()
    with pytest.raises(RuntimeError, match="DEV_MODE=true"):
        settings()


def test_dev_mode_allowed_in_development(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("DEV_MODE", "true")
    monkeypatch.setenv("SECRET_KEY", "isolated-dev-secret-key-minimum-32-chars")
    settings.cache_clear()
    s = settings()
    assert s.dev_mode is True
    settings.cache_clear()

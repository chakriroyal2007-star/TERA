import pytest
from app.config import settings


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


def test_correlation_id_middleware(client):
    # Generates ID if not provided
    res1 = client.get("/api/v1/health")
    assert res1.status_code == 200
    assert "X-Correlation-ID" in res1.headers
    corr1 = res1.headers["X-Correlation-ID"]
    assert len(corr1) >= 16

    # Preserves incoming ID
    custom_id = "test-custom-trace-uuid-12345"
    res2 = client.get("/api/v1/health", headers={"X-Correlation-ID": custom_id})
    assert res2.status_code == 200
    assert res2.headers["X-Correlation-ID"] == custom_id


def test_readiness_probe(client):
    res = client.get("/ready")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] in ("ready", "degraded")
    assert "database" in data["checks"]
    assert data["checks"]["database"] == "up"

    res_api = client.get("/api/v1/ready")
    assert res_api.status_code == 200


def test_prometheus_metrics(client):
    res = client.get("/metrics")
    assert res.status_code == 200
    assert "text/plain" in res.headers["content-type"]
    text = res.text
    assert "tera_incidents_total" in text
    assert "tera_active_missions" in text
    assert "tera_fleet_total" in text
    assert "tera_service_health 1" in text

    res_v1 = client.get("/api/v1/metrics")
    assert res_v1.status_code == 200

import pytest
from app.config import settings
from conftest import report


def test_security_headers_present(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.headers["X-Content-Type-Options"] == "nosniff"
    assert res.headers["X-Frame-Options"] == "DENY"
    assert res.headers["Cross-Origin-Opener-Policy"] == "same-origin"
    assert "default-src 'self'" in res.headers["Content-Security-Policy"]
    assert "geolocation=(self)" in res.headers["Permissions-Policy"]


def test_request_size_limit_rejects_oversized_payload(client):
    res = client.post(
        "/api/v1/public/incidents",
        headers={"Content-Length": str(15 * 1024 * 1024)},
        content=b"x" * 10,
    )
    assert res.status_code == 413
    assert "exceeds maximum allowed size" in res.json()["detail"]


def test_captcha_pow_verification(client, monkeypatch):
    monkeypatch.setattr(settings(), "captcha_provider", "pow")
    monkeypatch.setattr(settings(), "testing", False)

    # Missing token -> 400
    payload = {
        "category": "medical",
        "description": "Critical emergency requiring immediate ambulance assistance",
        "address": "MG Road Metro Station",
    }
    res = client.post("/api/v1/public/incidents", json=payload)
    assert res.status_code == 400
    assert "Bot verification challenge token is required" in res.json()["detail"]

    # Invalid PoW token -> 400
    payload["captcha_token"] = "challenge:invalidnonce"
    res = client.post("/api/v1/public/incidents", json=payload)
    assert res.status_code == 400

    # Valid PoW token (hash starts with 0000)
    import hashlib
    challenge = "testchallenge123"
    nonce = 0
    while True:
        d = hashlib.sha256(f"{challenge}:{nonce}".encode()).hexdigest()
        if d.startswith("0000"):
            break
        nonce += 1

    payload["captcha_token"] = f"{challenge}:{nonce}"
    res = client.post("/api/v1/public/incidents", json=payload)
    assert res.status_code == 201
    assert "case_id" in res.json()

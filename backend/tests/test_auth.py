import re
from datetime import timedelta
from unittest.mock import patch
import pyotp
import pytest
from sqlalchemy import select
from app.db import SessionLocal
from app.models import User, Session, Challenge, now
from app.security import digest, cipher


@pytest.mark.parametrize("client_id,client_secret,configured", [
    ("", "", False),
    ("test-client", "", False),
    ("", "test-secret", False),
    ("test-client", "   ", False),
    ("test-client", "test-secret", True),
])
def test_google_requires_both_credentials(client, monkeypatch, client_id, client_secret, configured):
    from app.config import settings
    monkeypatch.setattr(settings(), "google_client_id", client_id)
    monkeypatch.setattr(settings(), "google_client_secret", client_secret)
    assert client.get("/api/v1/auth/providers").json()["google"] is configured
    if not configured:
        assert client.get("/api/v1/auth/google", follow_redirects=False).status_code == 503


def test_google_redirect_uses_public_origin(client, monkeypatch):
    from unittest.mock import AsyncMock
    from fastapi.responses import RedirectResponse
    from app.auth import oauth
    from app.config import settings
    monkeypatch.setattr(settings(), "google_client_id", "test-client")
    monkeypatch.setattr(settings(), "google_client_secret", "test-secret")
    monkeypatch.setattr(settings(), "public_url", "http://localhost:5173/")
    redirect = AsyncMock(return_value=RedirectResponse("https://accounts.google.com/"))
    monkeypatch.setattr(oauth.google, "authorize_redirect", redirect)
    response = client.get("/api/v1/auth/google", follow_redirects=False)
    assert response.status_code == 307
    assert redirect.call_args.args[1] == "http://localhost:5173/api/v1/auth/google/callback"


def test_registration_never_grants_privileged_role(client):
    r = client.post(
        "/api/v1/auth/register",
        json={
            "email": "person@example.com",
            "name": "Public person",
            "password": "long-passphrase-123",
            "role": "admin",
        },
    )
    assert r.status_code == 201
    with SessionLocal() as db:
        u = db.scalar(select(User))
        assert u.role == "citizen" and not u.verified
        assert u.password_hash.startswith("$argon2id$")
    assert (
        client.post(
            "/api/v1/auth/login", json={"email": "person@example.com", "password": "long-passphrase-123"}
        ).status_code
        == 403
    )


def test_otp_delivery_expiry_and_attempt_limits(client, staff):
    with patch("app.auth.send_email") as mail:
        assert (
            client.post(
                "/api/v1/auth/otp/request", json={"email": "citizen@example.com", "purpose": "login"}
            ).status_code
            == 200
        )
        code = re.search(r"\b\d{6}\b", mail.call_args.args[2]).group()
    with SessionLocal() as db:
        ch = db.scalar(select(Challenge))
        assert ch.secret_hash != code and len(ch.secret_hash) == 64
    assert (
        client.post("/api/v1/auth/otp/request", json={"email": "citizen@example.com", "purpose": "login"}).status_code
        == 429
    )
    bad = "000000" if code != "000000" else "111111"
    for _ in range(5):
        assert (
            client.post(
                "/api/v1/auth/otp/verify", json={"email": "citizen@example.com", "purpose": "login", "code": bad}
            ).status_code
            == 400
        )
    assert (
        client.post(
            "/api/v1/auth/otp/verify", json={"email": "citizen@example.com", "purpose": "login", "code": code}
        ).status_code
        == 400
    )


def test_otp_valid_one_use_and_refresh_rotation(client, staff):
    with patch("app.auth.send_email") as mail:
        client.post("/api/v1/auth/otp/request", json={"email": "citizen@example.com", "purpose": "login"})
        code = re.search(r"\b\d{6}\b", mail.call_args.args[2]).group()
    r = client.post("/api/v1/auth/otp/verify", json={"email": "citizen@example.com", "purpose": "login", "code": code})
    assert r.status_code == 200
    assert (
        client.post(
            "/api/v1/auth/otp/verify", json={"email": "citizen@example.com", "purpose": "login", "code": code}
        ).status_code
        == 400
    )
    first = client.cookies["tera_refresh"]
    csrf = client.cookies["tera_csrf"]
    assert client.post("/api/v1/auth/refresh").status_code == 403
    assert client.post("/api/v1/auth/refresh", headers={"X-CSRF-Token": csrf}).status_code == 200
    assert client.cookies["tera_refresh"] != first
    with SessionLocal() as db:
        assert db.scalar(select(Session).where(Session.refresh_hash == digest(first))).revoked
    assert client.get("/api/v1/auth/me").status_code == 200
    client.cookies.clear()
    client.cookies.set("tera_refresh", first)
    assert client.post("/api/v1/auth/refresh", headers={"X-CSRF-Token": csrf}).status_code == 401


def test_csrf_logout_and_suspend(client, staff, authenticated):
    user = authenticated("citizen")
    csrf = user.cookies["tera_csrf"]
    user.headers.pop("X-CSRF-Token")
    assert user.post("/api/v1/auth/logout").status_code == 403
    assert (
        user.post(
            "/api/v1/auth/logout", headers={"X-CSRF-Token": csrf, "origin": "https://foreign.invalid"}
        ).status_code
        == 403
    )
    assert user.post("/api/v1/auth/logout", headers={"X-CSRF-Token": csrf}).status_code == 200
    assert user.get("/api/v1/auth/me").status_code == 401
    user = authenticated("citizen")
    admin = authenticated("admin")
    assert admin.patch("/api/v1/users/" + staff["citizen"], json={"suspended": True}).status_code == 200
    assert user.get("/api/v1/auth/me").status_code == 401


def test_password_reset_revokes_sessions(client, staff, authenticated):
    user = authenticated("citizen")
    with patch("app.auth.send_email") as mail:
        client.post("/api/v1/auth/otp/request", json={"email": "citizen@example.com", "purpose": "reset"})
        code = re.search(r"\b\d{6}\b", mail.call_args.args[2]).group()
    assert (
        client.post(
            "/api/v1/auth/otp/verify",
            json={
                "email": "citizen@example.com",
                "purpose": "reset",
                "code": code,
                "password": "changed-passphrase-123",
            },
        ).status_code
        == 200
    )
    assert user.get("/api/v1/auth/me").status_code == 401
    assert (
        client.post(
            "/api/v1/auth/login", json={"email": "citizen@example.com", "password": "changed-passphrase-123"}
        ).status_code
        == 200
    )


def test_expired_code(client, staff):
    with SessionLocal() as db:
        db.add(
            Challenge(
                email="citizen@example.com",
                purpose="verify",
                secret_hash=digest("citizen@example.comverify123456"),
                expires_at=now() - timedelta(seconds=1),
            )
        )
        db.commit()
    assert (
        client.post(
            "/api/v1/auth/otp/verify", json={"email": "citizen@example.com", "purpose": "verify", "code": "123456"}
        ).status_code
        == 400
    )


def test_mfa_is_required_and_cannot_replay(client, staff):
    secret = pyotp.random_base32()
    with SessionLocal() as db:
        u = db.get(User, staff["operator"])
        u.mfa_secret = cipher().encrypt(secret.encode()).decode()
        u.mfa_enabled = True
        db.commit()
    credentials = {"email": "operator@example.com", "password": "test-passphrase-123"}
    assert client.post("/api/v1/auth/login", json=credentials).status_code == 401
    credentials["mfa_code"] = pyotp.TOTP(secret).now()
    assert client.post("/api/v1/auth/login", json=credentials).status_code == 200
    assert client.post("/api/v1/auth/login", json=credentials).status_code == 401


def test_google_unconfigured_never_simulates_login(client):
    assert client.get("/api/v1/auth/providers").json()["google"] is False
    assert client.get("/api/v1/auth/google").status_code == 503
    assert client.get("/api/v1/auth/google/callback?code=fake&state=fake").status_code == 400
    with SessionLocal() as db:
        assert db.scalar(select(User)) is None


def test_invitation_is_email_bound_single_use(client, staff, authenticated):
    admin = authenticated("admin")
    with patch("app.admin.send_email") as mail:
        r = admin.post(
            "/api/v1/invitations",
            json={"email": "invited@example.com", "role": "operator", "organization_id": staff["organization"]},
        )
        assert r.status_code == 201
        token = re.search(r"invitation=([^ .]+)", mail.call_args.args[2]).group(1)
    body = {
        "email": "wrong@example.com",
        "name": "Invited operator",
        "password": "invited-passphrase-123",
        "invitation": token,
    }
    assert client.post("/api/v1/auth/register", json=body).status_code == 400
    body["email"] = "invited@example.com"
    assert client.post("/api/v1/auth/register", json=body).status_code == 201
    with SessionLocal() as db:
        assert db.scalar(select(User).where(User.email == body["email"])).role == "operator"
    assert client.post("/api/v1/auth/register", json=body).status_code == 409


def test_auth_validation_and_failure_modes(client):
    # Invalid email format
    assert (
        client.post(
            "/api/v1/auth/register",
            json={"email": "not-an-email", "name": "Test", "password": "valid-long-password-123"},
        ).status_code
        == 422
    )

    # Password too short (<12 characters)
    assert (
        client.post(
            "/api/v1/auth/register",
            json={"email": "shortpass@example.com", "name": "Test", "password": "short"},
        ).status_code
        == 422
    )

    # Nonexistent user login returns 401
    assert (
        client.post(
            "/api/v1/auth/login",
            json={"email": "unknown-user@example.com", "password": "random-password-123"},
        ).status_code
        == 401
    )


def test_auth_endpoints_alias_and_password_recovery(client, staff):
    # Test un-prefixed /api/auth/me returns 401 before auth
    assert client.get("/api/auth/me").status_code == 401

    # Test /api/auth/forgot-password and /api/auth/reset-password alias endpoints
    with patch("app.auth.send_email") as mail:
        r_forgot = client.post("/api/auth/forgot-password", json={"email": "citizen@example.com"})
        assert r_forgot.status_code == 200
        code = re.search(r"\b\d{6}\b", mail.call_args.args[2]).group()

    r_reset = client.post(
        "/api/auth/reset-password",
        json={"email": "citizen@example.com", "code": code, "password": "brand-new-passphrase-123"},
    )
    assert r_reset.status_code == 200

    # Login with new password via /api/auth/login alias
    r_login = client.post(
        "/api/auth/login",
        json={"email": "citizen@example.com", "password": "brand-new-passphrase-123"},
    )
    assert r_login.status_code == 200
    user_data = r_login.json()
    assert user_data["email"] == "citizen@example.com"
    assert user_data["role"] == "citizen"

    # /api/auth/me returns the authenticated user
    client.headers["X-CSRF-Token"] = client.cookies["tera_csrf"]
    r_me = client.get("/api/auth/me")
    assert r_me.status_code == 200
    assert r_me.json()["id"] == user_data["id"]


def test_verify_otp_issues_session_immediately(client):
    # Register a new citizen
    email = "newcitizen@example.com"
    with patch("app.auth.send_email") as mail:
        client.post(
            "/api/v1/auth/register",
            json={"email": email, "name": "New Citizen", "password": "secure-passphrase-123"},
        )
        code = re.search(r"\b\d{6}\b", mail.call_args.args[2]).group()

    # Verify code with purpose="verify"
    r_ver = client.post(
        "/api/v1/auth/otp/verify",
        json={"email": email, "purpose": "verify", "code": code},
    )
    assert r_ver.status_code == 200
    # A session must be issued immediately (tera_access cookie present)
    assert "tera_access" in client.cookies
    assert "tera_csrf" in client.cookies

    # User is immediately authenticated without needing to re-login!
    client.headers["X-CSRF-Token"] = client.cookies["tera_csrf"]
    me = client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == email
    assert me.json()["role"] == "citizen"


import io
import re
from unittest.mock import patch, AsyncMock
import boto3
from moto import mock_aws
from PIL import Image
from aiosmtpd.controller import Controller
from sqlalchemy import select
from app.config import settings
from app.db import SessionLocal
from app.models import User
from app.auth import oauth
from conftest import report, verify


def test_actual_smtp_code_delivery_and_verification(client, staff, monkeypatch):
    class Inbox:
        messages = []

        async def handle_DATA(self, server, session, envelope):
            self.messages.append(envelope.content.decode())
            return "250 accepted"

    inbox = Inbox()
    server = Controller(inbox, hostname="127.0.0.1", port=58025)
    server.start()
    monkeypatch.setattr(settings(), "smtp_host", "127.0.0.1")
    monkeypatch.setattr(settings(), "smtp_port", 58025)
    try:
        r = client.post("/api/v1/auth/otp/request", json={"email": "citizen@example.com", "purpose": "login"})
        assert r.status_code == 200, r.text
        assert len(inbox.messages) == 1
        code = re.search(r"Your code is (\d{6})", inbox.messages[0]).group(1)
        r = client.post(
            "/api/v1/auth/otp/verify", json={"email": "citizen@example.com", "purpose": "login", "code": code}
        )
        assert r.status_code == 200, r.text
        assert client.get("/api/v1/auth/me").json()["role"] == "citizen"
    finally:
        server.stop()


def test_private_s3_evidence_validation_and_authorization(client, staff, authenticated):
    id, code = report(client)
    operator = authenticated("operator")
    verify(operator, id)
    data = io.BytesIO()
    Image.new("RGB", (20, 20), "white").save(data, format="PNG")
    with mock_aws():
        s3 = boto3.client("s3", region_name="us-east-1", aws_access_key_id="testing", aws_secret_access_key="testing")
        s3.create_bucket(Bucket=settings().s3_bucket)
        with patch("app.evidence.storage", return_value=s3):
            r = client.post(
                "/api/v1/public/track/" + code + "/evidence",
                files={"file": ("photo.png", data.getvalue(), "image/png")},
            )
            assert r.status_code == 201, r.text
            evidence_id = r.json()["id"]
            assert r.json()["content_type"] == "image/jpeg"
            assert client.get("/api/v1/evidence/" + evidence_id).status_code == 401
            assert authenticated("outsider").get("/api/v1/evidence/" + evidence_id).status_code == 404
            download = operator.get("/api/v1/evidence/" + evidence_id)
            assert download.status_code == 200
            Image.open(io.BytesIO(download.content)).verify()
            assert (
                client.post(
                    "/api/v1/public/track/" + code + "/evidence",
                    files={"file": ("bad.png", b"not-an-image", "image/png")},
                ).status_code
                == 422
            )
            assert (
                client.post(
                    "/api/v1/public/track/" + code + "/evidence",
                    files={"file": ("script.html", b"<script>bad</script>", "text/html")},
                ).status_code
                == 415
            )
            objects = s3.list_objects_v2(Bucket=settings().s3_bucket)["Contents"]
            assert len(objects) == 1
            acl = s3.get_object_acl(Bucket=settings().s3_bucket, Key=objects[0]["Key"])
            assert not any(g["Grantee"].get("URI", "").endswith("AllUsers") for g in acl["Grants"])


def test_google_verified_claims_create_citizen_never_privileged(client):
    # Protocol adapter unit test, not a live Google authorization claim.
    token = {
        "userinfo": {
            "sub": "isolated-google-subject",
            "email": "google-user@example.com",
            "email_verified": True,
            "name": "Google fixture",
        }
    }
    with patch.object(oauth.google, "authorize_access_token", new=AsyncMock(return_value=token)):
        r = client.get("/api/v1/auth/google/callback", follow_redirects=False)
    assert r.status_code == 307
    assert client.get("/api/v1/auth/me").json()["role"] == "citizen"
    with SessionLocal() as db:
        assert db.scalar(select(User)).google_subject == "isolated-google-subject"


def test_permission_restrictions_cannot_expand_roles(client, staff, authenticated):
    admin = authenticated("admin")
    operator = authenticated("operator")
    citizen = authenticated("citizen")
    action = "GET /api/v1/incidents"
    r = admin.put("/api/v1/permissions", json={"user_id": staff["operator"], "action": action, "denied": True})
    assert r.status_code == 200, r.text
    assert operator.get("/api/v1/incidents").status_code == 403
    assert (
        admin.put(
            "/api/v1/permissions", json={"user_id": staff["operator"], "action": action, "denied": False}
        ).status_code
        == 200
    )
    assert operator.get("/api/v1/incidents").status_code == 200
    assert (
        admin.put(
            "/api/v1/permissions", json={"user_id": staff["citizen"], "action": action, "denied": False}
        ).status_code
        == 200
    )
    assert citizen.get("/api/v1/incidents").status_code == 403


def test_access_change_revokes_prior_sessions(staff, authenticated):
    admin = authenticated("admin")
    citizen = authenticated("citizen")
    assert (
        admin.patch(
            "/api/v1/users/" + staff["citizen"] + "/access",
            json={"role": "analyst", "organization_id": staff["organization"]},
        ).status_code
        == 200
    )
    assert citizen.get("/api/v1/auth/me").status_code == 401
    assert admin.patch("/api/v1/users/" + staff["admin"] + "/access", json={"role": "citizen"}).status_code == 409


def test_administrator_resource_crud_and_empty_analytics(client, staff, authenticated):
    admin = authenticated("admin")
    org = admin.post("/api/v1/organizations", json={"name": "New isolated organization"})
    assert org.status_code == 201
    org_id = org.json()["id"]
    assert admin.post("/api/v1/organizations", json={"name": "New isolated organization"}).status_code == 409
    h = admin.post(
        "/api/v1/hospitals",
        json={"name": "New isolated hospital", "organization_id": org_id, "latitude": 20, "longitude": 70},
    )
    assert h.status_code == 201, h.text
    dep = admin.post("/api/v1/departments", json={"name": "ICU department", "hospital_id": h.json()["id"]})
    assert dep.status_code == 201
    cap = admin.post("/api/v1/capacities", json={"department_id": dep.json()["id"], "kind": "icu", "total": 4})
    assert cap.status_code == 201
    assert admin.patch("/api/v1/capacities/" + cap.json()["id"], json={"total": 4, "occupied": 2}).status_code == 200
    fleet = admin.post("/api/v1/ambulances", json={"organization_id": org_id, "registration": "NEW-FIXTURE-002"})
    assert fleet.status_code == 201
    assert admin.patch("/api/v1/ambulances/" + fleet.json()["id"], json={"active": False}).status_code == 200
    analytics = admin.get("/api/v1/analytics")
    assert analytics.status_code == 200, analytics.text
    assert analytics.json()["total_incidents"] == 0
    assert analytics.json()["mean_acknowledgement_seconds"] is None
    assert admin.get("/api/v1/system").status_code == 200
    assert admin.get("/api/v1/auth/history").status_code == 200
    assert admin.get("/api/v1/permissions").json()["actions"]


def test_secure_bootstrap_creates_one_administrator(monkeypatch):
    from app.bootstrap import main

    values = {
        "Administrator email: ": "bootstrap@example.com",
        "Administrator name: ": "Bootstrap fixture",
        "Control organization name: ": "Bootstrap control",
    }
    monkeypatch.setattr("builtins.input", lambda prompt: values[prompt])
    monkeypatch.setattr("getpass.getpass", lambda prompt: "bootstrap-passphrase-123")
    main()
    with SessionLocal() as db:
        u = db.scalar(select(User).where(User.email == "bootstrap@example.com"))
        assert u.role == "admin" and u.verified and u.organization_id
        assert u.password_hash.startswith("$argon2id$")
        from app.models import Membership

        assert db.scalar(select(Membership).where(Membership.user_id == u.id)).role_id == "admin"
    import pytest

    with pytest.raises(SystemExit, match="already exists"):
        main()

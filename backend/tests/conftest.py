import os

os.environ.setdefault("SECRET_KEY", "isolated-test-secret-minimum-32-characters")
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://postgres:tera-test@127.0.0.1:55432/tera_test")
os.environ.setdefault("REDIS_URL", "redis://127.0.0.1:56379/15")
os.environ.setdefault("PUBLIC_URL", "http://testserver")
os.environ["TESTING"] = "true"
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from app.main import app
from app.db import engine, SessionLocal, Base
from app.models import User, Organization, Hospital, Department, Capacity, Ambulance
from app.security import passwords, redis


@pytest.fixture(scope="session", autouse=True)
def migrate_test_database():
    if not engine.url.database.endswith("_test"):
        raise RuntimeError("Tests require an isolated *_test PostgreSQL database")
    from alembic.config import Config
    from alembic import command

    command.upgrade(Config("alembic.ini"), "head")


@pytest.fixture(autouse=True)
def isolated_database():
    # Refuse destructive test cleanup against any database not explicitly named *_test.
    if not engine.url.database.endswith("_test"):
        raise RuntimeError("Tests require an isolated *_test PostgreSQL database")
    with engine.begin() as conn:
        conn.execute(
            text(
                "TRUNCATE "
                + ", ".join(
                    '"' + t.name + '"'
                    for t in Base.metadata.sorted_tables
                    if t.name not in ("roles", "permissions", "role_permissions")
                )
                + " RESTART IDENTITY CASCADE"
            )
        )
    redis.flushdb()
    yield


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def staff():
    with SessionLocal() as db:
        o = Organization(name="Control test fixture")
        horg = Organization(name="Hospital test fixture")
        alien = Organization(name="Unrelated test fixture")
        db.add_all([o, horg, alien])
        db.flush()
        users = {}
        for role in ("admin", "operator", "responder", "hospital", "analyst", "citizen"):
            u = User(
                email=role + "@example.com",
                name=role,
                password_hash=passwords.hash("test-passphrase-123"),
                verified=True,
                role=role,
                organization_id=horg.id if role == "hospital" else o.id,
            )
            db.add(u)
            db.flush()
            users[role] = u.id
        outsider = User(
            email="outsider@example.com",
            name="Outsider",
            role="operator",
            organization_id=alien.id,
            verified=True,
            password_hash=passwords.hash("test-passphrase-123"),
        )
        db.add(outsider)
        hospital = Hospital(name="Fixture hospital", organization_id=horg.id)
        db.add(hospital)
        db.flush()
        dep = Department(name="Emergency department", hospital_id=hospital.id)
        db.add(dep)
        db.flush()
        cap = Capacity(department_id=dep.id, kind="emergency", total=1)
        a = Ambulance(organization_id=o.id, registration="FIXTURE-001")
        db.add_all([cap, a])
        db.flush()
        db.commit()
        return {
            **users,
            "organization": o.id,
            "hospital_org": horg.id,
            "capacity": cap.id,
            "ambulance": a.id,
            "hospital_id": hospital.id,
        }


def login(client, role):
    r = client.post("/api/v1/auth/login", json={"email": role + "@example.com", "password": "test-passphrase-123"})
    assert r.status_code == 200, r.text
    client.headers["X-CSRF-Token"] = client.cookies["tera_csrf"]
    return client


@pytest.fixture
def authenticated(staff):
    clients = []

    def get(role):
        c = TestClient(app)
        clients.append(c)
        return login(c, role)

    yield get
    for c in clients:
        c.close()


def report(client, **kwargs):
    data = {
        "category": "medical",
        "description": "Isolated integration test incident",
        "address": "Test fixture location",
        **kwargs,
    }
    r = client.post("/api/v1/public/incidents", json=data)
    assert r.status_code == 201, r.text
    from sqlalchemy import select
    from app.models import Incident
    from app.security import digest

    with SessionLocal() as db:
        i = db.scalar(select(Incident).where(Incident.tracking_hash == digest(r.json()["tracking_code"])))
    return i.id, r.json()["tracking_code"]


def verify(client, id):
    r = client.post(f"/api/v1/incidents/{id}/verify", json={"priority": "high", "note": "Verified test fixture"})
    assert r.status_code == 200, r.text


def dispatch(client, id, staff):
    r = client.post(
        f"/api/v1/incidents/{id}/dispatch",
        json={"ambulance_id": staff["ambulance"], "responder_id": staff["responder"]},
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]

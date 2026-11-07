"""Explicit test-only fixture loader. Never run against operational databases."""

import os
from sqlalchemy import select
from app.db import engine, SessionLocal
from app.models import Organization, User, Hospital, Department, Capacity, Ambulance
from app.security import passwords


def seed(reset=False):
    if not engine.url.database.endswith("_e2e_test") or os.getenv("TESTING") != "true":
        raise SystemExit("Requires TESTING=true and a *_e2e_test database")
    if reset:
        from sqlalchemy import text
        from app.db import Base

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
    with SessionLocal() as db:
        org = db.scalar(select(Organization).where(Organization.name == "E2E control"))
        if org:
            return
        org = Organization(name="E2E control")
        horg = Organization(name="E2E hospital organization")
        db.add_all([org, horg])
        db.flush()
        for role in ("operator", "responder", "hospital", "admin", "analyst", "citizen"):
            db.add(
                User(
                    email=f"{role}@example.com",
                    name=f"E2E {role}",
                    password_hash=passwords.hash("test-passphrase-123"),
                    verified=True,
                    role=role,
                    organization_id=horg.id if role == "hospital" else org.id,
                )
            )
        h = Hospital(name="E2E hospital", organization_id=horg.id)
        db.add(h)
        db.flush()
        d = Department(name="Emergency", hospital_id=h.id)
        db.add(d)
        db.flush()
        db.add(Capacity(department_id=d.id, kind="emergency", total=10))
        db.add(Ambulance(organization_id=org.id, registration="E2E-001"))
        db.commit()
    print("Isolated E2E fixtures created")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--reset", action="store_true", help="Erase only the guarded E2E database before loading fixtures"
    )
    seed(reset=parser.parse_args().reset)

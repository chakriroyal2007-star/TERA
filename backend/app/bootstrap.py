"""Interactive administrator bootstrap; creates no demonstration or operational records."""

import getpass
from sqlalchemy import select, text
from pydantic import TypeAdapter, EmailStr
from .db import SessionLocal
from .models import User, Organization
from .security import passwords, audit


def main():
    email = TypeAdapter(EmailStr).validate_python(input("Administrator email: ").strip()).lower()
    name = input("Administrator name: ").strip()
    organization = input("Control organization name: ").strip()
    password = getpass.getpass("Password (12+ characters): ")
    if len(password) < 12 or not name or not organization:
        raise SystemExit("Name, organization and a strong password are required")
    if password != getpass.getpass("Confirm password: "):
        raise SystemExit("Passwords differ")
    with SessionLocal() as db:
        db.execute(text("SELECT pg_advisory_xact_lock(84637202)"))
        if db.scalar(select(User.id).where(User.role == "admin")):
            raise SystemExit("An administrator already exists; use invitations")
        org = Organization(name=organization)
        db.add(org)
        db.flush()
        u = User(
            email=email,
            name=name,
            password_hash=passwords.hash(password),
            role="admin",
            verified=True,
            organization_id=org.id,
        )
        db.add(u)
        db.flush()
        audit(db, "admin.bootstrapped", u.id, u)
        db.commit()
    print("Administrator created. Sign in to invite operational staff and register resources.")


if __name__ == "__main__":
    main()

import sys
import os
import traceback
from pathlib import Path

# Setup paths so backend modules can be imported
root_dir = Path(__file__).resolve().parent.parent
backend_dir = root_dir / "backend"

if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

# Configure database: if DATABASE_URL is not set or points to localhost/127.0.0.1, use SQLite in /tmp/tera.db
if not os.environ.get("DATABASE_URL") or "127.0.0.1" in os.environ.get("DATABASE_URL", ""):
    os.environ["DATABASE_URL"] = "sqlite:////tmp/tera.db"

if not os.environ.get("SECRET_KEY") or len(os.environ.get("SECRET_KEY", "")) < 32:
    os.environ["SECRET_KEY"] = "tera-production-secure-fallback-key-min-32-chars-long!"

os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault("COOKIE_SECURE", "false")
os.environ.setdefault("PUBLIC_URL", "https://tera2-three.vercel.app")
os.environ.setdefault(
    "CORS_ORIGINS",
    "https://tera2-three.vercel.app,https://tera2-chakriroyal2007-stars-projects.vercel.app",
)
os.environ.setdefault("SPEECH_PROVIDER", "sarvam")
os.environ.setdefault("SARVAM_API_KEY", "sk_4ljh53og_knt2JrVdtZR3P7jQrH6lTJ1D")
os.environ.setdefault("EMERGENCY_ESCALATION_PHONE", "112")
os.environ.setdefault("RECORDINGS_DIR", "/tmp/tera_recordings")

from app.main import app

try:
    from app.db import Base, engine, SessionLocal
    from app.models import (
        Organization,
        User,
        Role,
        Membership,
        Permission,
        RolePermission,
        Hospital,
        Department,
        Capacity,
        Ambulance,
        Incident,
        Report,
    )
    from app.security import passwords, digest

    # Initialize tables and seed essential data on startup
    Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        # 1. Organization
        org = db.query(Organization).first()
        if not org:
            org = Organization(name="TERA Central Dispatch Command")
            db.add(org)
            db.flush()

        # 2. Roles
        roles_data = [
            ("admin", "System Administrator"),
            ("operator", "Triage & Dispatch Operator"),
            ("responder", "Emergency Field Responder"),
            ("hospital", "Hospital Care Coordinator"),
            ("analyst", "Incident Data Analyst"),
            ("citizen", "Public Citizen Reporter"),
        ]
        for role_id, role_name in roles_data:
            r = db.get(Role, role_id)
            if not r:
                db.add(Role(id=role_id, name=role_name))
        db.flush()

        # 3. Default Users (Password: Emergency@2025!)
        default_users = [
            ("admin@tera.org", "Lead Administrator", "admin"),
            ("operator@tera.org", "Chief Dispatch Operator", "operator"),
            ("responder@tera.org", "Emergency Medical Responder", "responder"),
            ("hospital@tera.org", "Hospital Triage Lead", "hospital"),
            ("analyst@tera.org", "Crisis Intelligence Analyst", "analyst"),
            ("citizen@tera.org", "Verified Citizen Reporter", "citizen"),
        ]
        default_pwd_hash = passwords.hash("Emergency@2025!")

        for email, name, role_id in default_users:
            u = db.query(User).filter(User.email == email).first()
            if not u:
                u = User(
                    email=email,
                    name=name,
                    password_hash=default_pwd_hash,
                    verified=True,
                    suspended=False,
                )
                u.membership = Membership(
                    role_id=role_id,
                    organization_id=org.id if role_id != "citizen" else None,
                )
                db.add(u)
            else:
                # Ensure account is active and verified
                u.password_hash = default_pwd_hash
                u.verified = True
                u.suspended = False
                if not u.membership:
                    u.membership = Membership(
                        role_id=role_id,
                        organization_id=org.id if role_id != "citizen" else None,
                    )
                else:
                    u.membership.role_id = role_id
                    u.membership.organization_id = org.id if role_id != "citizen" else None
        db.flush()

        # 4. Seed Hospital and Capacity if none exist
        hosp = db.query(Hospital).first()
        if not hosp:
            hosp = Hospital(
                name="Tirupati Government General Hospital",
                latitude=13.6338,
                longitude=79.4182,
                facilities=["Emergency Trauma", "ICU", "Burn Care", "Blood Bank"],
                organization_id=org.id,
            )
            db.add(hosp)
            db.flush()
            dept = Department(name="Emergency Trauma & ICU", hospital_id=hosp.id)
            db.add(dept)
            db.flush()
            db.add(Capacity(department_id=dept.id, kind="icu", total=20, occupied=4, reserved=1))
            db.add(Capacity(department_id=dept.id, kind="emergency", total=40, occupied=15, reserved=3))
            db.flush()

        # 5. Seed Ambulance if none exist
        amb = db.query(Ambulance).first()
        if not amb:
            db.add(
                Ambulance(
                    registration="AP-03-EM-108",
                    active=True,
                    organization_id=org.id,
                )
            )
            db.add(
                Ambulance(
                    registration="AP-03-BLS-102",
                    active=True,
                    organization_id=org.id,
                )
            )
            db.flush()

        # 6. Seed Sample Incidents if table is empty
        inc_count = db.query(Incident).count()
        if inc_count == 0:
            sample_inc = Incident(
                case_id="TERA-2026-894102",
                tracking_hash=digest("TRK-DEMO-SAMPLE-2026"),
                category="road_collision",
                description="Two vehicles collided near Tirupati RTC Bus Stand. 3 casualties with severe injuries and bleeding. Immediate ambulance and traffic clearance requested.",
                address="Near Central Bus Stand, Tirupati, AP",
                latitude=13.6288,
                longitude=79.4192,
                status="reported",
                priority="high",
                detected_language="en-IN",
                casualties_count=3,
                injuries_description="Head trauma and leg fractures, heavy bleeding",
                vehicles_involved="1 car, 1 auto-rickshaw",
                immediate_hazards="Fuel leakage on roadway",
                requested_assistance="Ambulance with trauma kit, police traffic control",
                organization_id=org.id,
            )
            db.add(sample_inc)
            db.flush()
            db.add(
                Report(
                    incident_id=sample_inc.id,
                    text="Two vehicles collided near RTC bus stand, 3 injured people bleeding",
                )
            )

        db.commit()
except Exception as e:
    sys.stderr.write(f"Startup initialization notice: {e}\n")
    traceback.print_exc(file=sys.stderr)
    sys.stderr.flush()

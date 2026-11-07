import sys
import os
from pathlib import Path

# Setup paths so backend modules can be imported
root_dir = Path(__file__).resolve().parent.parent
backend_dir = root_dir / "backend"

if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

# Configure database: if DATABASE_URL is not set or points to 127.0.0.1, use SQLite in /tmp/tera.db
if not os.environ.get("DATABASE_URL") or "127.0.0.1" in os.environ.get("DATABASE_URL", ""):
    os.environ["DATABASE_URL"] = "sqlite:////tmp/tera.db"

# Configure required environment defaults
if not os.environ.get("SECRET_KEY") or len(os.environ.get("SECRET_KEY", "")) < 32:
    os.environ["SECRET_KEY"] = "tera-production-secure-key-32-chars-min-emergency"

os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault("COOKIE_SECURE", "false")
os.environ.setdefault("SPEECH_PROVIDER", "sarvam")
os.environ.setdefault("SARVAM_API_KEY", "sk_4ljh53og_knt2JrVdtZR3P7jQrH6lTJ1D")
os.environ.setdefault("SARVAM_ORG_ID", "org_tera_prod")
os.environ.setdefault("SARVAM_WORKSPACE_ID", "ws_tera_companion")
os.environ.setdefault("SARVAM_AGENT_ID", "agent_tera_firstaid")
os.environ.setdefault("SARVAM_CONNECTION_ID", "conn_tera_telephony")
os.environ.setdefault("SARVAM_AGENT_PHONE_NUMBER", "+918000000000")
os.environ.setdefault("EMERGENCY_ESCALATION_PHONE", "112")
os.environ.setdefault("RECORDINGS_DIR", "/tmp/tera_recordings")

from app.main import app
from app.db import Base, engine, SessionLocal
from app.models import User, Organization
from app.security import passwords
import app.models

# Initialize schema and seed users on startup
try:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        org = db.query(Organization).first()
        if not org:
            org = Organization(name="TERA Central Dispatch Command")
            db.add(org)
            db.flush()
        
        roles_list = [
            ("admin@tera.org", "System Administrator", "admin"),
            ("operator@tera.org", "Lead Dispatch Operator", "operator"),
            ("responder@tera.org", "Field Rescue Responder", "responder"),
            ("hospital@tera.org", "Hospital Care Coordinator", "hospital"),
            ("analyst@tera.org", "Operations Data Analyst", "analyst"),
            ("citizen@tera.org", "Citizen Reporter", "citizen"),
        ]
        
        hash_val = passwords.hash("Emergency@2025!")
        for email, name, role in roles_list:
            u = db.query(User).filter(User.email == email).first()
            if not u:
                u = User(
                    email=email,
                    name=name,
                    password_hash=hash_val,
                    role=role,
                    verified=True,
                    organization_id=org.id,
                )
                db.add(u)
        db.commit()
except Exception as e:
    print(f"Startup notice: {e}")

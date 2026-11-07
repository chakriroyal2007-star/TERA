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

# Development-only defaults. Production must provide its secrets through Vercel.
if not os.environ.get("SECRET_KEY") or len(os.environ.get("SECRET_KEY", "")) < 32:
    os.environ["SECRET_KEY"] = "tera-development-only-secret-key-change-me"

os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault("COOKIE_SECURE", "false")
os.environ.setdefault("SPEECH_PROVIDER", "sarvam")
os.environ.setdefault("EMERGENCY_ESCALATION_PHONE", "112")
os.environ.setdefault("RECORDINGS_DIR", "/tmp/tera_recordings")

from app.main import app
from app.db import Base, engine, SessionLocal
from app.models import Organization

# Initialize the schema for the serverless demonstration deployment. A managed
# PostgreSQL database should be supplied for persistent production data.
try:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        org = db.query(Organization).first()
        if not org:
            org = Organization(name="TERA Central Dispatch Command")
            db.add(org)
            db.flush()
        
        db.commit()
except Exception as e:
    print(f"Startup notice: {e}")


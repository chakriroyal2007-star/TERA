"""Serverless entry point. Configure a persistent database and run Alembic before deployment."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))
from app.main import app

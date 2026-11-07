import os
import subprocess
import time
import httpx
from sqlalchemy import text, inspect
from sqlalchemy.exc import DBAPIError
import pytest
from app.db import engine
from conftest import report


def test_records_survive_backend_process_restart(client, staff):
    id, code = report(client)
    counts = []
    env = dict(os.environ, PYTHONPATH=".")
    for _ in range(2):
        process = subprocess.Popen(
            [
                os.path.abspath(".venv/bin/python"),
                "-m",
                "uvicorn",
                "app.main:app",
                "--host",
                "127.0.0.1",
                "--port",
                "58001",
            ],
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        try:
            with httpx.Client(base_url="http://127.0.0.1:58001") as http:
                for attempt in range(100):
                    try:
                        if http.get("/api/health").status_code == 200:
                            break
                    except httpx.ConnectError:
                        pass
                    time.sleep(0.1)
                else:
                    pytest.fail("Backend process did not become ready")
                result = http.get("/api/v1/public/track/" + code)
                assert result.status_code == 200
                assert result.json()["status"] == "reported"
                counts.append(len(result.json()["timeline"]))
        finally:
            process.terminate()
            process.wait(timeout=10)
    assert counts == [1, 1]


def test_audit_and_events_are_append_only(client, staff, authenticated):
    report(client)

    with engine.connect() as c:
        with pytest.raises(DBAPIError):
            c.execute(text("UPDATE events SET kind='tampered'"))
        c.rollback()
        with pytest.raises(DBAPIError):
            c.execute(text("DELETE FROM audit_logs"))
        c.rollback()


def test_database_has_partial_unique_resource_indexes():
    indexes = inspect(engine).get_indexes("missions")
    assert {"one_active_ambulance", "one_active_responder"}.issubset({i["name"] for i in indexes if i["unique"]})

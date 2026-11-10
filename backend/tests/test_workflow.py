from concurrent.futures import ThreadPoolExecutor
from fastapi.testclient import TestClient
from sqlalchemy import select
from app.main import app
from app.db import SessionLocal, engine
from app.models import Capacity, Mission, Reservation, Ambulance, User
from app.security import passwords
from conftest import report, verify, dispatch, login


def test_complete_lifecycle_and_reconnection(client, staff, authenticated):
    operator = authenticated("operator")
    responder = authenticated("responder")
    hospital = authenticated("hospital")
    id, code = report(client, latitude=13.63, longitude=79.41)
    assert operator.get("/api/v1/incidents").json()["total"] == 1
    verify(operator, id)
    mission = dispatch(operator, id, staff)
    invalid = responder.post(f"/api/v1/missions/{mission}/progress", json={"status": "on_scene"})
    assert invalid.status_code == 409
    for status in ("acknowledged", "en_route", "on_scene"):
        r = responder.post(f"/api/v1/missions/{mission}/progress", json={"status": status})
        assert r.status_code == 200, r.text
    r = operator.post(f"/api/v1/incidents/{id}/referrals", json={"capacity_id": staff["capacity"]})
    assert r.status_code == 201, r.text
    referral = r.json()["id"]
    assert hospital.get("/api/v1/referrals").json()[0]["id"] == referral
    queue = hospital.get("/api/v1/incidents")
    assert queue.status_code == 200, queue.text
    assert queue.json()["total"] == 1
    r = hospital.post(f"/api/v1/referrals/{referral}/decision", json={"accept": True, "reason": "Capacity confirmed"})
    assert r.status_code == 200, r.text
    for status in ("transporting", "handover"):
        assert responder.post(f"/api/v1/missions/{mission}/progress", json={"status": status}).status_code == 200
    assert responder.post(f"/api/v1/missions/{mission}/progress", json={"status": "completed"}).status_code == 409
    assert hospital.post(f"/api/v1/referrals/{referral}/handover").status_code == 200
    assert responder.post(f"/api/v1/missions/{mission}/progress", json={"status": "completed"}).status_code == 200
    assert (
        operator.post(f"/api/v1/incidents/{id}/close", json={"text": "Handover complete and verified"}).status_code
        == 200
    )
    engine.dispose()  # New connections must read persisted records, not process memory.
    with TestClient(app) as restarted:
        public = restarted.get("/api/v1/public/track/" + code).json()
        assert public["status"] == "closed"
        assert set(public) == {"status", "created_at", "timeline"}
        assert "address" not in str(public) and "description" not in str(public)
    assert len(operator.get("/api/v1/incidents/" + id).json()["events"]) >= 12
    with SessionLocal() as db:
        c = db.get(Capacity, staff["capacity"])
        assert (c.occupied, c.reserved) == (1, 0)
        assert db.scalar(select(Reservation)).status == "occupied"
    assert operator.get("/api/v1/ambulances").json()[0]["available"] is True
    assert authenticated("analyst").get("/api/v1/analytics").json()["total_incidents"] == 1


def test_dispatch_race_has_one_winner(client, staff, authenticated):
    operator = authenticated("operator")
    ids = [report(client)[0] for _ in range(2)]
    for id in ids:
        verify(operator, id)

    def attempt(id):
        with TestClient(app) as c:
            login(c, "operator")
            return c.post(
                f"/api/v1/incidents/{id}/dispatch",
                json={"ambulance_id": staff["ambulance"], "responder_id": staff["responder"]},
            ).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(attempt, ids))
    assert sorted(results) == [201, 409]
    with SessionLocal() as db:
        assert len(list(db.scalars(select(Mission)))) == 1


def test_capacity_race_has_one_winner(client, staff, authenticated):
    op = authenticated("operator")
    referrals = []
    for n in range(2):
        id, _ = report(client)
        verify(op, id)
        with SessionLocal() as db:
            a = Ambulance(organization_id=staff["organization"], registration=f"OTHER-{n}")
            u = User(
                email=f"responder{n}@example.com",
                name="Test responder",
                role="responder",
                verified=True,
                organization_id=staff["organization"],
                password_hash=passwords.hash("test-passphrase-123"),
            )
            db.add_all([a, u])
            db.flush()
            db.commit()
            assignment = {"ambulance_id": a.id, "responder_id": u.id}
        assert op.post(f"/api/v1/incidents/{id}/dispatch", json=assignment).status_code == 201
        referrals.append(
            op.post(f"/api/v1/incidents/{id}/referrals", json={"capacity_id": staff["capacity"]}).json()["id"]
        )

    def attempt(id):
        with TestClient(app) as c:
            login(c, "hospital")
            return c.post(
                f"/api/v1/referrals/{id}/decision", json={"accept": True, "reason": "Verified capacity"}
            ).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(attempt, referrals))
    assert sorted(results) == [200, 409]
    with SessionLocal() as db:
        assert db.get(Capacity, staff["capacity"]).reserved == 1


def test_scope_and_permissions(client, staff, authenticated):
    id, _ = report(client)
    op = authenticated("operator")
    verify(op, id)
    outsider = authenticated("outsider")
    assert outsider.get("/api/v1/incidents/" + id).status_code == 404
    assert authenticated("citizen").get("/api/v1/incidents").status_code == 403
    assert (
        authenticated("analyst")
        .post(
            f"/api/v1/incidents/{id}/dispatch",
            json={"ambulance_id": staff["ambulance"], "responder_id": staff["responder"]},
        )
        .status_code
        == 403
    )
    assert authenticated("hospital").get("/api/v1/incidents/" + id).status_code == 404
    assert authenticated("responder").get("/api/v1/incidents/" + id).status_code == 404


def test_capacity_constraints_and_premature_close(client, staff, authenticated):
    id, _ = report(client)
    op = authenticated("operator")
    verify(op, id)
    assert op.post(f"/api/v1/incidents/{id}/close", json={"text": "Too soon"}).status_code == 409
    h = authenticated("hospital")
    assert h.patch("/api/v1/capacities/" + staff["capacity"], json={"total": 1, "occupied": 2}).status_code == 409
    assert h.patch("/api/v1/capacities/" + staff["capacity"], json={"total": -1, "occupied": 0}).status_code == 422
    admin = authenticated("admin")
    assert admin.patch("/api/v1/capacities/" + staff["capacity"], json={"total": 2, "occupied": 0}).status_code == 200
    events = h.get("/api/v1/notifications").json()
    assert any(e["kind"] == "capacity.updated" and e["organization_id"] == staff["hospital_org"] for e in events)


def test_duplicate_detection_and_public_privacy(client, staff, authenticated):
    op = authenticated("operator")
    first, _ = report(client, latitude=13.63, longitude=79.41)
    verify(op, first)
    second, code = report(client, latitude=13.631, longitude=79.411)
    assert op.get(f"/api/v1/incidents/{second}/suggestions").json()["possible_duplicates"][0]["id"] == first
    assert (
        op.post(
            f"/api/v1/incidents/{second}/duplicate", json={"duplicate_of": first, "note": "Confirmed same event"}
        ).status_code
        == 200
    )
    public = client.get("/api/v1/public/track/" + code).json()
    assert first not in str(public)
    assert client.post("/api/v1/public/track/" + code + "/notes", json={"text": "Late note"}).status_code == 409


def test_websocket_replays_authorized_persisted_events(client, staff, authenticated):
    id, _ = report(client)
    op = authenticated("operator")
    verify(op, id)
    with op.websocket_connect("/api/v1/ws?after=0", headers={"origin": "http://testserver"}) as ws:
        first = ws.receive_json()
        assert first["incident_id"] == id
        second = ws.receive_json()
        assert second["id"] > first["id"]
    with op.websocket_connect("/api/v1/ws?after=" + str(first["id"]), headers={"origin": "http://testserver"}) as ws:
        assert ws.receive_json()["id"] == second["id"]
    outsider = authenticated("outsider")
    events = outsider.get("/api/v1/notifications").json()
    assert events == []

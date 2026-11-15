import json
from starlette.testclient import TestClient
from app.main import app
from app.db import SessionLocal
from app.models import Mission, Referral, ETAPredictionRecord
from sqlalchemy import select
from conftest import report, verify, dispatch


def test_mission_and_referral_eta_persistence_and_accuracy(client, staff, authenticated):
    operator = authenticated("operator")
    responder = authenticated("responder")
    hospital = authenticated("hospital")

    # 1. Citizen reports incident with coordinates
    inc_id, track_code = report(client, latitude=17.3850, longitude=78.4867)
    verify(operator, inc_id)

    # 2. Operator dispatches ambulance with specific origin coordinates
    resp = operator.post(
        f"/api/v1/incidents/{inc_id}/dispatch",
        json={
            "ambulance_id": staff["ambulance"],
            "responder_id": staff["responder"],
            "origin_lat": 17.4401,
            "origin_lng": 78.3489,
        },
    )
    assert resp.status_code == 201, resp.text
    mission_id = resp.json()["id"]

    # Verify mission decision fields were persisted
    with SessionLocal() as db:
        m = db.get(Mission, mission_id)
        assert m is not None
        assert m.dispatched_at is not None
        assert m.decision_distance_meters is not None
        assert m.decision_distance_meters > 0
        assert m.decision_routing_provider is not None
        assert m.decision_route_polyline is not None
        polyline = json.loads(m.decision_route_polyline)
        assert isinstance(polyline, list)

        # Verify ETAPredictionRecord was created
        rec = db.scalar(
            select(ETAPredictionRecord).where(
                ETAPredictionRecord.target_type == "mission",
                ETAPredictionRecord.target_id == mission_id,
            )
        )
        assert rec is not None
        assert rec.origin_lat == 17.4401
        assert rec.origin_lng == 78.3489
        assert rec.dest_lat == 17.3850
        assert rec.dest_lng == 78.4867
        assert rec.actual_arrived_at is None

    # 3. Check public track view exposes ETA and polyline without private responder data
    pub = client.get(f"/api/v1/public/track/{track_code}").json()
    assert "eta_label" in pub
    assert "route_polyline" in pub
    assert isinstance(pub["route_polyline"], list)
    assert staff["responder"] not in str(pub)
    assert "responder_name" not in str(pub)

    # 4. Responder arrives on scene
    responder.post(f"/api/v1/missions/{mission_id}/progress", json={"status": "acknowledged"})
    responder.post(f"/api/v1/missions/{mission_id}/progress", json={"status": "en_route"})
    arr_resp = responder.post(f"/api/v1/missions/{mission_id}/progress", json={"status": "on_scene"})
    assert arr_resp.status_code == 200

    with SessionLocal() as db:
        m = db.get(Mission, mission_id)
        assert m.arrived_at is not None
        rec = db.scalar(
            select(ETAPredictionRecord).where(
                ETAPredictionRecord.target_type == "mission",
                ETAPredictionRecord.target_id == mission_id,
            )
        )
        assert rec.actual_arrived_at is not None
        assert rec.actual_duration_seconds is not None

    # 5. Referral requested to hospital
    ref_resp = operator.post(
        f"/api/v1/incidents/{inc_id}/referrals",
        json={"capacity_id": staff["capacity"]},
    )
    assert ref_resp.status_code == 201
    ref_id = ref_resp.json()["id"]

    with SessionLocal() as db:
        r = db.get(Referral, ref_id)
        assert r is not None
        assert r.referred_at is not None
        assert r.decision_distance_meters is not None
        assert r.decision_distance_meters > 0

        ref_rec = db.scalar(
            select(ETAPredictionRecord).where(
                ETAPredictionRecord.target_type == "referral",
                ETAPredictionRecord.target_id == ref_id,
            )
        )
        assert ref_rec is not None
        assert ref_rec.actual_arrived_at is None

    # 6. Referral accepted and arrived
    hospital.post(f"/api/v1/referrals/{ref_id}/decision", json={"accept": True, "reason": "Confirmed"})
    arr_hosp = hospital.post(f"/api/v1/referrals/{ref_id}/arrival")
    assert arr_hosp.status_code == 200

    with SessionLocal() as db:
        r = db.get(Referral, ref_id)
        assert r.arrived_at is not None
        ref_rec = db.scalar(
            select(ETAPredictionRecord).where(
                ETAPredictionRecord.target_type == "referral",
                ETAPredictionRecord.target_id == ref_id,
            )
        )
        assert ref_rec.actual_arrived_at is not None
        assert ref_rec.actual_duration_seconds is not None

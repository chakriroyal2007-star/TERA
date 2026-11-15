import pytest
from datetime import datetime, timezone, timedelta
from app.db import SessionLocal
from app.models import Incident, Mission, Ambulance, Organization, User, AmbulanceTelemetryHistory
from app.telemetry import (
    TelemetryInput,
    ingest_mission_telemetry,
    get_latest_mission_telemetry,
    get_mission_trail,
    prune_telemetry_history,
)


def test_telemetry_ingestion_and_downsampling(client, staff, authenticated):
    with SessionLocal() as db:
        # Setup test org, ambulance, incident, and mission
        org = Organization(name="Telemetry Org")
        db.add(org)
        db.flush()

        amb = Ambulance(
            organization_id=org.id,
            registration="KA-01-AMB-9999",
            driver_name="Suresh Kumar",
            driver_phone="+91 99999 11111",
            vehicle_type="Advanced Life Support (ALS)",
        )
        db.add(amb)
        db.flush()

        inc = Incident(
            organization_id=org.id,
            latitude=12.9352,
            longitude=77.6245,
            priority="high",
            category="road_traffic_accident",
            description="Car collision with injuries",
            address="Hosur Road, Bengaluru",
            status="dispatched",
            tracking_hash="dummyhash_telemetry_123",
        )
        db.add(inc)
        db.flush()

        m = Mission(
            incident_id=inc.id,
            ambulance_id=amb.id,
            responder_id=staff["responder"],
            status="en_route",
            latitude=12.9200,
            longitude=77.6100,
            location_at=datetime.now(timezone.utc),
        )
        db.add(m)
        db.commit()

        # 1. Ingest initial telemetry point
        t1 = TelemetryInput(
            latitude=12.9210,
            longitude=77.6110,
            speed=45.5,
            heading=120.0,
            accuracy=4.0,
            consent=True,
        )
        res1 = ingest_mission_telemetry(db, m, t1)
        assert res1["mission_id"] == m.id
        assert res1["latitude"] == 12.9210
        assert res1["stale"] is False

        # Check that mission was updated
        db.refresh(m)
        assert m.latitude == 12.9210
        assert m.telemetry_consent is True

        # Check that history has 1 record
        hist1 = db.query(AmbulanceTelemetryHistory).filter_by(mission_id=m.id).all()
        assert len(hist1) == 1
        assert hist1[0].speed == 45.5

        # 2. Ingest very slight movement immediately (<5s and <15m) -> downsampled (not duplicated in history)
        t2 = TelemetryInput(
            latitude=12.9210001,
            longitude=77.6110001,
            speed=45.6,
            heading=120.0,
            accuracy=4.0,
        )
        res2 = ingest_mission_telemetry(db, m, t2)
        hist2 = db.query(AmbulanceTelemetryHistory).filter_by(mission_id=m.id).all()
        assert len(hist2) == 1  # Downsampled, no new row

        # 3. Ingest significant movement (>15m) -> new row added
        t3 = TelemetryInput(
            latitude=12.9250,
            longitude=77.6150,
            speed=50.0,
            heading=125.0,
            accuracy=3.5,
        )
        res3 = ingest_mission_telemetry(db, m, t3)
        hist3 = db.query(AmbulanceTelemetryHistory).filter_by(mission_id=m.id).all()
        assert len(hist3) == 2

        # 4. Trail verification
        trail = get_mission_trail(db, m.id)
        assert len(trail) == 2
        assert trail[0] == [12.9210, 77.6110]
        assert trail[1] == [12.9250, 77.6150]

        # 5. Stale detection test: simulate old timestamp
        old_time = datetime.now(timezone.utc) - timedelta(seconds=45)
        m.location_at = old_time
        db.commit()
        snap = get_latest_mission_telemetry(db, m.id)
        assert snap is not None
        assert "latitude" in snap

        # 6. Retention pruning test
        old_record = AmbulanceTelemetryHistory(
            mission_id=m.id,
            ambulance_id=amb.id,
            latitude=12.9000,
            longitude=77.6000,
            recorded_at=datetime.now(timezone.utc) - timedelta(days=10),
        )
        db.add(old_record)
        db.commit()

        pruned = prune_telemetry_history(db, retention_days=7)
        assert pruned >= 1

    # 7. Endpoint test via authenticated responder
    responder = authenticated("responder")
    post_res = responder.post(
        f"/api/v1/missions/{m.id}/telemetry",
        json={
            "latitude": 12.9300,
            "longitude": 77.6200,
            "speed": 55.0,
            "heading": 130.0,
            "accuracy": 3.0,
            "consent": True,
        },
    )
    assert post_res.status_code == 200, post_res.text
    assert post_res.json()["latitude"] == 12.9300

    trail_res = responder.get(f"/api/v1/missions/{m.id}/trail")
    assert trail_res.status_code == 200
    assert len(trail_res.json()["trail"]) >= 2

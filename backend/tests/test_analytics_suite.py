import pytest
from datetime import timedelta
from app.db import SessionLocal
from app.models import Incident, Ambulance, Mission, Hospital, User, Organization, uid, now


def test_analytics_and_government_value(staff, authenticated):
    with SessionLocal() as db:
        analyst_user = db.get(User, staff["analyst"])
        org_id = analyst_user.organization_id if analyst_user else db.scalar(select(Organization.id))

        # Create two incidents: one in Bangalore central, one nearby
        t0 = now() - timedelta(minutes=45)
        t_disp = t0 + timedelta(seconds=120)  # 2m dispatch (< 3m target)
        t_arr = t_disp + timedelta(minutes=10) # 10m travel (< 15m target)

        inc1 = Incident(
            id=uid(),
            organization_id=org_id,
            category="traffic",
            description="Highway pileup on Airport Expressway",
            address="KIAL Expressway, Bangalore",
            latitude=13.1986,
            longitude=77.7066,
            casualties_count=4,
            status="resolved",
            created_at=t0,
            tracking_hash="trk_sla_01",
        )
        amb1 = Ambulance(
            id=uid(),
            organization_id=org_id,
            registration="KA-04-SLA-101",
            vehicle_type="Advanced Life Support (ALS)",
            active=True,
        )
        m1 = Mission(
            id=uid(),
            incident_id=inc1.id,
            ambulance_id=amb1.id,
            responder_id=staff["responder"],
            status="completed",
            dispatched_at=t_disp,
            arrived_at=t_arr,
            created_at=t_disp,
        )
        db.add_all([inc1, amb1, m1])
        db.commit()

    analyst = authenticated("analyst")

    # 1. Test SLA Summary
    sla_res = analyst.get("/api/v1/analytics/sla-summary")
    assert sla_res.status_code == 200, sla_res.text
    sla_data = sla_res.json()
    assert "time_to_dispatch" in sla_data
    assert "time_to_scene" in sla_data
    assert "golden_hour_total" in sla_data
    assert sla_data["benchmark_targets"]["dispatch_seconds"] == 180
    assert sla_data["benchmark_targets"]["scene_seconds"] == 900
    assert sla_data["benchmark_targets"]["golden_hour_seconds"] == 3600

    # 2. Test Accident Hotspots
    hotspot_res = analyst.get("/api/v1/analytics/hotspots")
    assert hotspot_res.status_code == 200, hotspot_res.text
    hotspot_data = hotspot_res.json()
    assert "hotspots" in hotspot_data
    assert len(hotspot_data["hotspots"]) >= 1
    spot = hotspot_data["hotspots"][0]
    assert "severity_index" in spot
    assert "risk_tier" in spot
    assert "categories" in spot

    # 3. Test CSV Export
    csv_res = analyst.get("/api/v1/analytics/export/csv")
    assert csv_res.status_code == 200, csv_res.text
    assert "text/csv" in csv_res.headers.get("content-type", "")
    csv_text = csv_res.text
    assert "Case ID" in csv_text
    assert "Golden Hour Compliant" in csv_text
    assert "Dispatch Delay" in csv_text

    # 4. Test Voice Accuracy
    voice_res = analyst.get("/api/v1/analytics/voice-accuracy")
    assert voice_res.status_code == 200, voice_res.text
    voice_data = voice_res.json()
    assert "total_voice_extractions" in voice_data
    assert "category_accuracy_pct" in voice_data

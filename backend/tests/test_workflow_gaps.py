import pytest
from app.db import SessionLocal
from app.models import User, Incident, Ambulance, Mission, Hospital, Patient, uid


def test_workflow_gaps_suite(staff, authenticated):
    with SessionLocal() as db:
        op_user = db.get(User, staff["operator"])
        org_id = op_user.organization_id

        responder2 = User(
            id=uid(),
            name="Responder 2",
            email="resp2_gap@example.com",
            password_hash="test",
            role="responder",
            organization_id=org_id,
            verified=True,
        )
        db.add(responder2)

        amb1 = Ambulance(
            id=uid(),
            organization_id=org_id,
            registration="KA-01-GAP-001",
            driver_name="Ramesh Kumar",
            driver_phone="+919888811111",
            vehicle_type="Advanced Life Support (ALS)",
            active=True,
        )
        amb2 = Ambulance(
            id=uid(),
            organization_id=org_id,
            registration="KA-01-GAP-002",
            driver_name="Suresh Rao",
            driver_phone="+919888822222",
            vehicle_type="Basic Life Support (BLS)",
            active=True,
        )
        db.add_all([amb1, amb2])

        hosp = Hospital(
            id=uid(),
            organization_id=org_id,
            name="Apex Trauma Care",
            latitude=12.9716,
            longitude=77.5946,
        )
        db.add(hosp)

        inc1 = Incident(
            id=uid(),
            organization_id=org_id,
            category="trauma",
            description="Multi-car collision on MG Road with trapped victims",
            address="MG Road, Bangalore",
            latitude=12.9750,
            longitude=77.6000,
            status="verified",
            tracking_hash="trk_gap_01",
        )
        db.add(inc1)
        db.commit()

        inc1_id = inc1.id
        amb1_id = amb1.id
        amb2_id = amb2.id
        resp1_id = staff["responder"]
        resp2_id = responder2.id

    operator = authenticated("operator")

    # 1. Dispatch amb1
    disp_res = operator.post(
        f"/api/v1/incidents/{inc1_id}/dispatch",
        json={"ambulance_id": amb1_id, "responder_id": resp1_id},
    )
    assert disp_res.status_code == 201, disp_res.text
    mission1_id = disp_res.json()["id"]

    # 2. Test Cancel Mission
    cancel_res = operator.post(
        f"/api/v1/missions/{mission1_id}/cancel",
        json={"reason": "Ambulance engine breakdown en route"},
    )
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "cancelled"
    assert cancel_res.json()["incident_status"] == "verified"

    with SessionLocal() as db:
        m1 = db.get(Mission, mission1_id)
        assert m1.status == "cancelled"
        assert m1.cancel_reason == "Ambulance engine breakdown en route"

    # 3. Re-dispatch amb1 to inc1 (now allowed since m1 is cancelled)
    disp2 = operator.post(
        f"/api/v1/incidents/{inc1_id}/dispatch",
        json={"ambulance_id": amb1_id, "responder_id": resp1_id},
    )
    assert disp2.status_code == 201
    mission2_id = disp2.json()["id"]

    # 4. Test Reassign Mission to amb2 & resp2
    reassign_res = operator.post(
        f"/api/v1/missions/{mission2_id}/reassign",
        json={
            "new_ambulance_id": amb2_id,
            "new_responder_id": resp2_id,
            "reason": "Traffic jam on Old Airport Road, rerouting closer vehicle",
        },
    )
    assert reassign_res.status_code == 200
    new_m_data = reassign_res.json()["new_mission"]
    assert new_m_data["ambulance_id"] == amb2_id
    assert new_m_data["responder_id"] == resp2_id

    with SessionLocal() as db:
        m2 = db.get(Mission, mission2_id)
        assert m2.status == "cancelled"
        assert "Traffic jam" in m2.cancel_reason

    # 5. Test Mass-Casualty START Triage
    triage_res = operator.post(
        f"/api/v1/incidents/{inc1_id}/triage",
        json={
            "patients": [
                {
                    "name": "Driver 1",
                    "start_triage_color": "red",
                    "triage_priority": "immediate",
                    "condition_summary": "Unconscious, tension pneumothorax",
                    "requested_department": "Emergency",
                },
                {
                    "name": "Passenger 1",
                    "start_triage_color": "yellow",
                    "triage_priority": "delayed",
                    "condition_summary": "Closed femur fracture, hemodynamically stable",
                },
                {
                    "name": "Pedestrian 1",
                    "start_triage_color": "green",
                    "triage_priority": "minor",
                    "condition_summary": "Superficial lacerations, ambulatory",
                },
            ]
        },
    )
    assert triage_res.status_code == 200
    triage_data = triage_res.json()
    assert triage_data["casualties_count"] == 3
    assert triage_data["triage_summary"]["immediate"] == 1
    assert triage_data["triage_summary"]["delayed"] == 1
    assert triage_data["triage_summary"]["minor"] == 1

    with SessionLocal() as db:
        updated_inc = db.get(Incident, inc1_id)
        assert updated_inc.priority == "critical"

    # Test GET triage endpoint
    get_triage_res = operator.get(f"/api/v1/incidents/{inc1_id}/triage")
    assert get_triage_res.status_code == 200
    assert len(get_triage_res.json()["patients"]) == 3

    # 6. Test Geospatial Duplicate Detection & Merge
    with SessionLocal() as db:
        inc_dup = Incident(
            id=uid(),
            organization_id=org_id,
            category="traffic",
            description="Accident near Cubbon park junction MG road",
            address="Near MG Road Metro, Bangalore",
            latitude=12.9760,
            longitude=77.6010,
            status="reported",
            tracking_hash="trk_gap_dup",
        )
        inc_far = Incident(
            id=uid(),
            organization_id=org_id,
            category="traffic",
            description="Minor scratch in Electronic City",
            address="Electronic City Phase 1",
            latitude=12.8450,
            longitude=77.6600,
            status="reported",
            tracking_hash="trk_gap_far",
        )
        db.add_all([inc_dup, inc_far])
        db.commit()
        dup_id = inc_dup.id
        far_id = inc_far.id

    dup_search = operator.get(f"/api/v1/incidents/{inc1_id}/duplicates?radius_meters=1000")
    assert dup_search.status_code == 200
    dup_list = dup_search.json()["duplicates"]
    dup_ids = [d["id"] for d in dup_list]
    assert dup_id in dup_ids
    assert far_id not in dup_ids

    # Merge inc_dup into inc1
    merge_res = operator.post(
        f"/api/v1/incidents/{inc1_id}/merge",
        json={"duplicate_incident_id": dup_id, "reason": "Same multi-car collision reported by different bystander"},
    )
    assert merge_res.status_code == 200
    with SessionLocal() as db:
        dup_record = db.get(Incident, dup_id)
        assert dup_record.status == "duplicate"
        assert dup_record.duplicate_of == inc1_id

    # Unmerge inc_dup
    unmerge_res = operator.post(
        f"/api/v1/incidents/{inc1_id}/unmerge",
        json={"duplicate_incident_id": dup_id, "reason": "Determined to be separate adjacent incident"},
    )
    assert unmerge_res.status_code == 200
    with SessionLocal() as db:
        assert db.get(Incident, dup_id).status == "reported"

    # 7. Test Hoax Flagging
    hoax_res = operator.post(
        f"/api/v1/incidents/{far_id}/flag-hoax",
        json={"reason": "Caller admitted to prank call", "is_hoax": True},
    )
    assert hoax_res.status_code == 200
    assert hoax_res.json()["is_hoax"] is True
    assert hoax_res.json()["incident_status"] == "rejected"

    with SessionLocal() as db:
        far_rec = db.get(Incident, far_id)
        assert far_rec.is_hoax is True
        assert far_rec.hoax_reason == "Caller admitted to prank call"

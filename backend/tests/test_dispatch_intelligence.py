import pytest
from app.db import SessionLocal
from app.models import Incident, Ambulance, Hospital, Department, Capacity, Mission, Organization, DispatchRankingWeights, User
from app.dispatch_intelligence import (
    rank_ambulances_for_incident,
    rank_hospitals_for_incident,
    get_active_weights,
)


@pytest.mark.anyio
async def test_dispatch_intelligence_ranking_and_override(client, staff, authenticated):
    with SessionLocal() as db:
        op_user = db.get(User, staff["operator"])
        org_id = op_user.organization_id

        # 1. Register two ambulances: one ALS further away, one BLS closer
        amb_als = Ambulance(
            organization_id=org_id,
            registration="KA-01-ALS-01",
            driver_name="Ramesh ALS Pilot",
            vehicle_type="Advanced Life Support (ALS)",
            active=True,
        )
        amb_bls = Ambulance(
            organization_id=org_id,
            registration="KA-01-BLS-02",
            driver_name="Suresh BLS Pilot",
            vehicle_type="Basic Life Support (BLS)",
            active=True,
        )
        db.add_all([amb_als, amb_bls])
        db.flush()

        # 2. Critical cardiac incident (requires ALS)
        inc = Incident(
            organization_id=org_id,
            latitude=12.9352,
            longitude=77.6245,
            priority="critical",
            category="cardiac",
            description="Severe chest pain and collapse",
            address="Koramangala, Bengaluru",
            status="verified",
            tracking_hash="hash_cardiac_test_99",
        )
        db.add(inc)
        db.flush()

        # 3. Two hospitals: one cardiac specialty with open ICU beds, one on diversion
        hosp_cardiac = Hospital(
            organization_id=org_id,
            name="Apollo Cardiac Institute",
            latitude=12.9400,
            longitude=77.6200,
            specialties=["cardiac", "icu", "emergency"],
            diversion_status=False,
        )
        hosp_diverted = Hospital(
            organization_id=org_id,
            name="General City Hospital",
            latitude=12.9360,
            longitude=77.6250,
            specialties=["cardiac", "emergency"],
            diversion_status=True,  # on diversion
        )
        db.add_all([hosp_cardiac, hosp_diverted])
        db.flush()

        dept_icu = Department(hospital_id=hosp_cardiac.id, name="Cardiology ICU")
        db.add(dept_icu)
        db.flush()

        cap = Capacity(department_id=dept_icu.id, kind="icu", total=10, occupied=2, reserved=1)
        db.add(cap)
        db.commit()

        # 4. Rank ambulances: ALS should rank high for cardiac
        ranked_ambs = await rank_ambulances_for_incident(db, inc, [amb_als, amb_bls])
        assert len(ranked_ambs) == 2
        assert ranked_ambs[0]["rank"] == 1
        # Capability reason explains classification match
        assert any("Advanced Life Support" in r for r in ranked_ambs[0]["reasons"]) or any("Advanced Life Support" in r for r in ranked_ambs[1]["reasons"])

        # 5. Rank hospitals: Diverted hospital must be excluded
        ranked_hosps = await rank_hospitals_for_incident(db, inc)
        hosp_ids = [h["hospital_id"] for h in ranked_hosps]
        assert hosp_cardiac.id in hosp_ids
        assert hosp_diverted.id not in hosp_ids  # Diversion respected!

    # 6. Test recommendations endpoint via operator
    operator = authenticated("operator")
    rec_res = operator.get(f"/api/v1/dispatch/recommendations/{inc.id}")
    assert rec_res.status_code == 200, rec_res.text
    data = rec_res.json()
    assert "top_ambulances" in data
    assert "top_hospitals" in data

    # 7. Test weights tuning via admin
    admin = authenticated("admin")
    w_res = admin.get("/api/v1/dispatch/weights")
    assert w_res.status_code == 200

    patch_w = admin.patch(
        "/api/v1/dispatch/weights",
        json={
            "eta_weight": 0.50,
            "capability_weight": 0.30,
            "readiness_weight": 0.10,
            "workload_fairness_weight": 0.10,
        },
    )
    assert patch_w.status_code == 200, patch_w.text
    assert patch_w.json()["eta_weight"] == 0.50

    # 8. Test dispatch with human operator override reason
    # Operator deliberately chooses BLS unit for specific operational reason
    dispatch_res = operator.post(
        f"/api/v1/incidents/{inc.id}/dispatch",
        json={
            "ambulance_id": amb_bls.id,
            "responder_id": staff["responder"],
            "override_reason": "ALS unit refueling; immediate BLS stabilization required",
        },
    )
    assert dispatch_res.status_code == 201, dispatch_res.text
    mission_id = dispatch_res.json()["id"]

    with SessionLocal() as db:
        m = db.get(Mission, mission_id)
        assert m.override_reason == "ALS unit refueling; immediate BLS stabilization required"

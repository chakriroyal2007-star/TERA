import pytest
from app.models import Hospital, Department, Capacity, CapacityHistory, Patient, Referral

def test_hospital_onboarding_and_referral_lifecycle(client, staff, authenticated):
    operator = authenticated("operator")
    hospital_client = authenticated("hospital")

    # 1. Check profile when hospital exists from fixture
    res0 = hospital_client.get("/api/v1/hospital/profile")
    prof = res0.json()
    assert res0.status_code == 200, f"status {res0.status_code}: {prof}"
    assert "registered" in prof, f"prof: {prof}"
    assert prof["registered"] is True

    # 2. Test Onboarding / Updating Hospital Profile
    onboard_payload = {
        "name": "Apollo Multi-Speciality Emergency Hospital",
        "hospital_type": "Multi-speciality Hospital",
        "reg_identifier": "HOSP-APOLLO-991",
        "phone": "+91-877-2234567",
        "email": "emergency@apollo-tirupati.org",
        "address": "Renigunta Road, Korlagunta",
        "city": "Tirupati",
        "state": "Andhra Pradesh",
        "postal_code": "517501",
        "country": "India",
        "latitude": 13.6288,
        "longitude": 79.4192,
        "contact_person": "Dr. V. Prasad",
        "contact_designation": "Chief Medical Officer",
        "emergency_phone": "+91-9848022334",
        "operating_status": "Operational",
        "departments": [
            {
                "name": "Emergency & Trauma",
                "dept_type": "Emergency",
                "status": "Active",
                "contact_number": "+91-877-2234568",
                "head_name": "Dr. Prasad",
                "operating_hours": "24/7",
            },
            {
                "name": "Intensive Care Unit (ICU)",
                "dept_type": "Critical Care",
                "status": "Active",
                "contact_number": "+91-877-2234569",
                "head_name": "Dr. Ramesh",
                "operating_hours": "24/7",
            },
        ],
        "capacities": [
            {
                "kind": "Emergency Bed",
                "department": "Emergency & Trauma",
                "total": 20,
                "occupied": 5,
                "out_of_service": 1,
            },
            {
                "kind": "ICU Bed",
                "department": "Intensive Care Unit (ICU)",
                "total": 10,
                "occupied": 4,
                "out_of_service": 0,
            },
        ],
        "capabilities": [
            "Emergency trauma support",
            "ICU support",
            "Ventilator availability",
            "Oxygen support",
            "Cardiac care",
            "Blood bank",
        ],
        "auto_approve": True,
    }

    res = hospital_client.post("/api/v1/hospital/onboard", json=onboard_payload)
    assert res.status_code == 200, res.text
    hosp_data = res.json()["hospital"]
    assert hosp_data["name"] == "Apollo Multi-Speciality Emergency Hospital"

    # Verify updated profile
    prof2 = hospital_client.get("/api/v1/hospital/profile").json()
    assert prof2["registered"] is True
    assert len(prof2["hospital"]["departments"]) >= 2
    assert len(prof2["hospital"]["capacities"]) >= 2

    # 3. Test Capacity Update with Reason and Out-of-service
    cap = prof2["hospital"]["capacities"][0]
    cap_id = cap["id"]
    up_res = hospital_client.patch(
        f"/api/v1/capacities/{cap_id}",
        json={"total": 25, "occupied": 6, "out_of_service": 2, "reason": "New triage cots added"},
    )
    assert up_res.status_code == 200, up_res.text
    assert up_res.json()["total"] == 25
    assert up_res.json()["occupied"] == 6
    assert up_res.json()["available"] == 17  # 25 - 6 - 0 reserved - 2 oos = 17

    # 4. Create Incident & Get Recommendations
    inc_res = client.post(
        "/api/v1/incidents",
        json={
            "category": "road_collision",
            "description": "Bus collided with car on highway, 2 severe injuries",
            "address": "Alipiri Bypass Road, Tirupati",
            "latitude": 13.6300,
            "longitude": 79.4200,
            "severity": "critical",
        },
    )
    assert inc_res.status_code == 201, inc_res.text
    inc_id = inc_res.json()["id"]

    # Verify incident
    v_res = operator.post(f"/api/v1/incidents/{inc_id}/verify", json={"priority": "critical", "note": "Verified highway collision"})
    assert v_res.status_code == 200, v_res.text

    # Get patients on incident
    pts_res = operator.get(f"/api/v1/incidents/{inc_id}/patients")
    assert pts_res.status_code == 200
    patients = pts_res.json()
    assert len(patients) >= 1
    patient_id = patients[0]["id"]

    # Recommendations
    recs_res = operator.get(f"/api/v1/incidents/{inc_id}/hospital-recommendations")
    assert recs_res.status_code == 200
    recs = recs_res.json()
    assert len(recs) >= 1
    assert recs[0]["score"] > 0
    assert len(recs[0]["bed_options"]) >= 1

    chosen_bed = recs[0]["bed_options"][0]["capacity_id"]

    # 5. Create Referral for Patient
    ref_payload = {
        "capacity_id": chosen_bed,
        "patient_id": patient_id,
        "priority": "immediate",
        "eta_minutes": 12,
        "notes": "Severe head injury, oxygen support required",
    }
    ref_res = operator.post(f"/api/v1/incidents/{inc_id}/referrals", json=ref_payload)
    assert ref_res.status_code == 201, ref_res.text
    ref_id = ref_res.json()["id"]

    # 6. Hospital views incoming referrals
    refs = hospital_client.get("/api/v1/referrals").json()
    assert any(r["id"] == ref_id for r in refs)
    target_ref = next(r for r in refs if r["id"] == ref_id)
    assert target_ref["patient_name"] != ""
    assert target_ref["status"] == "pending"

    # 7. Hospital Accepts Referral -> Reserves Bed
    dec_res = hospital_client.post(
        f"/api/v1/referrals/{ref_id}/decision",
        json={"accept": True, "reason": "Trauma team and ICU Bed prepared"},
    )
    assert dec_res.status_code == 200, dec_res.text
    assert dec_res.json()["status"] == "accepted"

    # 8. Hospital Records Patient Arrival
    arr_res = hospital_client.post(f"/api/v1/referrals/{ref_id}/arrival")
    assert arr_res.status_code == 200, arr_res.text
    assert arr_res.json()["status"] == "arrived"

    # 9. Hospital Completes Handover -> Reserved Bed becomes Occupied
    ho_res = hospital_client.post(f"/api/v1/referrals/{ref_id}/handover")
    assert ho_res.status_code == 200, ho_res.text
    assert ho_res.json()["status"] == "handed_over"

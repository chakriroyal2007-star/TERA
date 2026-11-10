import pytest
from app.models import (
    EmergencyProtocol,
    Incident,
)
from app.db import SessionLocal
from app.companion.knowledge import seed_emergency_knowledge


@pytest.fixture
def db_session(isolated_database):
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_seed_knowledge_base(db_session):
    result = seed_emergency_knowledge(db_session)
    assert result["status"] == "success"
    assert result["protocols_seeded"] >= 13
    assert result["steps_seeded"] >= 23
    assert result["translations_seeded"] >= 138

    # Verify protocols in database
    protocols = db_session.query(EmergencyProtocol).all()
    categories = {p.category for p in protocols}
    assert "severe_bleeding" in categories
    assert "cardiac" in categories
    assert "unconsciousness" in categories
    assert "road_accidents" in categories
    assert "burns" in categories


def test_companion_session_creation(client, db_session, authenticated):
    seed_emergency_knowledge(db_session)

    # 1. Create a public incident
    incident = Incident(
        category="medical",
        description="Severe blood loss from leg wound after collision",
        address="Tirupati Bypass Road",
        tracking_hash="hash_test_123",
    )
    db_session.add(incident)
    db_session.commit()

    # 2. Start companion session in Telugu
    resp = client.post(
        "/api/v1/companion/sessions",
        json={
            "incident_id": str(incident.id),
            "channel": "web_voice",
            "language": "te",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "session_id" in data
    assert data["language"] == "te"
    assert len(data["messages"]) >= 2

    # Verify first messages contain Telugu AI disclosure and first step instruction
    first_msg = data["messages"][0]["content"]
    second_msg = data["messages"][1]["content"]
    assert "టెరా" in first_msg or "TERA" in first_msg or "వైద్య" in first_msg
    assert len(second_msg) > 10

    session_id = data["session_id"]

    # 3. Post a message from citizen in Telugu
    msg_resp = client.post(
        f"/api/v1/companion/sessions/{session_id}/messages",
        json={
            "message": "నేను గుడ్డతో గట్టిగా నొక్కాను",
            "language": "te",
        },
    )
    assert msg_resp.status_code == 200
    msg_data = msg_resp.json()
    assert "ai_reply" in msg_data

    # 4. Confirm action step completion
    action_resp = client.post(
        f"/api/v1/companion/sessions/{session_id}/actions",
        json={
            "step_number": 1,
            "status": "completed_by_citizen",
            "notes": "Citizen verified direct pressure applied",
        },
    )
    assert action_resp.status_code == 200
    action_data = action_resp.json()
    assert action_data["status"] == "recorded"
    assert action_data["action_status"] == "completed_by_citizen"

    # 5. Report condition deterioration
    cond_resp = client.post(
        f"/api/v1/companion/sessions/{session_id}/conditions",
        json={
            "condition_type": "consciousness",
            "description": "Patient is losing consciousness and becoming unresponsive",
            "severity_change": "worsened",
        },
    )
    assert cond_resp.status_code == 200
    cond_data = cond_resp.json()
    assert cond_data["status"] == "recorded"
    assert cond_data["escalated"] is True

    # 6. Complete handover by operator
    op_client = authenticated("operator")
    handover_resp = op_client.post(
        f"/api/v1/companion/sessions/{session_id}/handover",
        json={
            "responder_type": "ambulance",
            "responder_id": "AMB-108",
            "notes": "Paramedic crew on scene",
        },
    )
    assert handover_resp.status_code == 200
    handover_data = handover_resp.json()
    assert handover_data["status"] == "handover_completed"
    assert "summary" in handover_data


def test_companion_outbound_call_consent(client, db_session):
    seed_emergency_knowledge(db_session)

    incident = Incident(
        category="medical",
        description="Patient feeling severe chest pressure",
        address="Near Railway Station",
        tracking_hash="hash_trk_456",
    )
    db_session.add(incident)
    db_session.commit()

    # 1. Reject if callback_consented is False
    fail_resp = client.post(
        "/api/v1/companion/callbacks",
        json={
            "incident_id": str(incident.id),
            "phone_number": "+919876543210",
            "language": "hi",
            "callback_consented": False,
        },
    )
    assert fail_resp.status_code == 400
    assert "Explicit citizen consent is mandatory" in fail_resp.json()["detail"]

    # 2. Accept when consented
    ok_resp = client.post(
        "/api/v1/companion/callbacks",
        json={
            "incident_id": str(incident.id),
            "phone_number": "+919876543210",
            "language": "hi",
            "callback_consented": True,
            "ai_disclosure_acknowledged": True,
            "recording_consented": True,
        },
    )
    assert ok_resp.status_code == 200
    data = ok_resp.json()
    assert "attempt_id" in data
    assert data["status"] in ("queued", "initiated", "failed", "dialing")


def test_operator_takeover_control(client, db_session, authenticated):
    seed_emergency_knowledge(db_session)

    incident = Incident(
        category="cardiac",
        description="Patient collapsed, suspected cardiac arrest",
        address="Alipiri Road",
        tracking_hash="hash_cardiac_789",
    )
    db_session.add(incident)
    db_session.commit()

    # Create session
    sess_resp = client.post(
        "/api/v1/companion/sessions",
        json={
            "incident_id": str(incident.id),
            "language": "en",
            "channel": "web_voice",
        },
    )
    session_id = sess_resp.json()["session_id"]

    # Unauthenticated citizen cannot take over
    unauth_resp = client.post(f"/api/v1/companion/sessions/{session_id}/takeover")
    assert unauth_resp.status_code in (401, 403)

    # Operator takes over
    op_client = authenticated("operator")
    takeover_resp = op_client.post(f"/api/v1/companion/sessions/{session_id}/takeover")
    assert takeover_resp.status_code == 200
    takeover_data = takeover_resp.json()
    assert takeover_data["status"] == "taken_over"
    assert takeover_data["session_status"] == "human_takeover"


def test_companion_multilingual_step_retrieval(client, db_session):
    seed_emergency_knowledge(db_session)

    incident = Incident(
        category="burns",
        description="Severe hot oil scald burn on arms",
        address="Market Yard",
        tracking_hash="hash_burns_999",
    )
    db_session.add(incident)
    db_session.commit()

    for lang in ["en", "te", "hi", "ta", "kn", "ml"]:
        resp = client.post(
            "/api/v1/companion/sessions",
            json={
                "incident_id": str(incident.id),
                "language": lang,
                "channel": "web_voice",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["language"] == lang
        assert len(data["messages"]) >= 2


def test_sarvam_webhook_processing(client, monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings(), "sarvam_webhook_secret", "isolated-provider-webhook-secret")
    # Simulate inbound Sarvam telephony webhook
    webhook_payload = {
        "call_id": "sarvam-call-101",
        "attempt_id": "att-101",
        "event_type": "call_answered",
        "timestamp": "2026-11-07T20:30:00Z",
    }
    assert client.post("/api/v1/companion/webhooks/sarvam", json=webhook_payload).status_code == 401
    resp = client.post("/api/v1/companion/webhooks/sarvam", json=webhook_payload, headers={"Authorization": "Bearer isolated-provider-webhook-secret"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_sarvam_https_tool_get_protocol(client, db_session):
    seed_emergency_knowledge(db_session)

    # Mid-call HTTPS tool invocation from Sarvam AI agent
    tool_resp = client.post(
        "/api/v1/companion/tools/get_approved_protocol",
        json={
            "category": "bleeding",
            "language": "te",
        },
    )
    assert tool_resp.status_code == 200
    data = tool_resp.json()
    assert data["found"] is True
    assert "protocol_id" in data
    assert "protocol_title" in data or "step1_instruction" in data

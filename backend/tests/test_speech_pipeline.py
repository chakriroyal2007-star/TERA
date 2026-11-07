import asyncio
from app.db import SessionLocal
from app.models import VoiceRecording, Transcript, IncidentExtraction, Incident
from app.speech.provider import WhisperSpeechProvider


def test_speech_health_is_truthful(client):
    """Verifies that speech engine health is never fabricated and reports truthfully."""
    # When unconfigured, Whisper provider must report NOT_CONFIGURED, not fake ONLINE
    p = WhisperSpeechProvider(api_key="")
    health = asyncio.run(p.get_health())
    assert health.status == "NOT_CONFIGURED"
    assert "not configured" in health.message.lower()

    # Health endpoint through API
    r = client.get("/api/v1/speech/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] in ("ONLINE", "NOT_CONFIGURED", "DEGRADED", "OFFLINE")
    assert "supported_languages" in data
    assert "en" in data["supported_languages"]
    assert "te" in data["supported_languages"]
    assert "hi" in data["supported_languages"]

    # Also test alias route /api/speech/health
    r_alias = client.get("/api/speech/health")
    assert r_alias.status_code == 200
    assert r_alias.json()["status"] == data["status"]


def test_voice_recording_upload_and_audio_stream(client):
    """Verifies audio upload, size validation, SHA-256 calculation, and streaming with Range."""
    # Reject empty/too short audio
    bad = client.post(
        "/api/v1/speech/recordings",
        files={"file": ("empty.webm", b"short", "audio/webm")},
        data={"duration": 0.5},
    )
    assert bad.status_code == 400

    # Valid audio bytes (fake webm with EBML header)
    sample_audio = b"\x1a\x45\xdf\xa3" + b"TEST_PAYLOAD:Severe car crash on Ring Road near Metro. Two injured.\n" + b"\x00" * 200
    res = client.post(
        "/api/v1/speech/recordings",
        files={"file": ("recording.webm", sample_audio, "audio/webm")},
        data={"duration": 4.5},
    )
    assert res.status_code == 201, res.text
    rec = res.json()
    assert rec["id"]
    assert rec["duration"] == 4.5
    assert rec["checksum"]
    assert len(rec["checksum"]) == 64
    assert rec["file_size"] == len(sample_audio)

    # Check persistence in database
    with SessionLocal() as db:
        db_rec = db.get(VoiceRecording, rec["id"])
        assert db_rec is not None
        assert db_rec.checksum == rec["checksum"]
        assert db_rec.recording_status == "uploaded"

    # Stream full audio
    stream_res = client.get(f"/api/v1/speech/recordings/{rec['id']}/audio")
    assert stream_res.status_code == 200
    assert stream_res.content == sample_audio
    assert stream_res.headers["content-type"].startswith("audio/webm")

    # Stream with HTTP Range header (partial content)
    range_res = client.get(
        f"/api/v1/speech/recordings/{rec['id']}/audio",
        headers={"Range": "bytes=0-49"},
    )
    assert range_res.status_code == 206
    assert len(range_res.content) == 50
    assert range_res.content == sample_audio[:50]


def test_transcription_and_incident_extraction_pipeline(client):
    """Verifies end-to-end transcription, transcript persistence, and structured extraction."""
    # Audio stating a clear emergency
    emergency_text = "Emergency report. Major two car collision on MG Road near Metro Station. Three people injured, one unconscious. Need immediate ambulance and rescue team."
    payload = b"\x1a\x45\xdf\xa3TEST_PAYLOAD:" + emergency_text.encode("utf-8") + b"\n" + b"\x00" * 150

    upload = client.post(
        "/api/v1/speech/recordings",
        files={"file": ("emergency.webm", payload, "audio/webm")},
        data={"duration": 8.0},
    )
    rec_id = upload.json()["id"]

    # Transcribe recording
    trans_res = client.post(f"/api/v1/speech/recordings/{rec_id}/transcribe", json={"language": "en"})
    assert trans_res.status_code == 200, trans_res.text
    tr_data = trans_res.json()

    assert tr_data["status"] == "completed"
    assert tr_data["original_transcript"] == emergency_text
    # Confidence is truthfully None or real float, never fake 0.88
    assert tr_data["confidence"] is None or isinstance(tr_data["confidence"], float)

    # Verify structured extraction
    ext = tr_data["extraction"]
    assert ext["category"] == "road_collision"
    assert ext["severity"] in ("critical", "high")
    assert "MG Road" in ext["location_text"] or "Metro" in ext["location_text"]
    assert ext["affected_people"] in (3, "three", "3")
    assert "Ambulance" in ext["required_resources"]

    # Verify database persistence
    with SessionLocal() as db:
        db_tr = db.query(Transcript).filter(Transcript.recording_id == rec_id).first()
        assert db_tr is not None
        assert db_tr.original_transcript == emergency_text

        db_ext = db.query(IncidentExtraction).filter(IncidentExtraction.recording_id == rec_id).first()
        assert db_ext is not None
        assert db_ext.extracted_json["category"] == "road_collision"


def test_transcript_correction_and_reextraction(client):
    """Verifies reporter editing of transcripts and live re-extraction of incident fields."""
    sample = b"\x1a\x45\xdf\xa3" + b"TEST_PAYLOAD:Fire in factory\n" + b"\x00" * 200
    upload = client.post(
        "/api/v1/speech/recordings",
        files={"file": ("voice.webm", sample, "audio/webm")},
    )
    rec_id = upload.json()["id"]
    client.post(f"/api/v1/speech/recordings/{rec_id}/transcribe")

    # Correct transcript to include more specific details
    corrected = "Massive chemical fire in industrial warehouse near Sector 5. Smoke spreading fast. 4 workers trapped inside. Urgent fire engine needed."
    corr_res = client.post(
        f"/api/v1/speech/transcripts/{rec_id}/correct",
        json={"corrected_transcript": corrected},
    )
    assert corr_res.status_code == 200
    res_json = corr_res.json()
    assert res_json["corrected_transcript"] == corrected
    assert res_json["extraction"]["category"] == "fire"
    assert res_json["extraction"]["severity"] == "critical"
    assert res_json["extraction"]["affected_people"] in (4, "four", "4")


def test_complete_voice_incident_submission_and_operator_review(client, staff, authenticated):
    """Verifies complete citizen voice reporting to operator dashboard and PDF report generation."""
    # 1. Citizen records audio and uploads
    spoken = "Severe head injury from motorcycle accident on Outer Ring Road near Tech Park. Patient is bleeding heavily. Send ambulance immediately."
    audio = b"\x1a\x45\xdf\xa3TEST_PAYLOAD:" + spoken.encode("utf-8") + b"\n" + b"\x00" * 150

    up = client.post(
        "/api/v1/speech/recordings",
        files={"file": ("speech.webm", audio, "audio/webm")},
        data={"duration": 7.2},
    )
    assert up.status_code == 201
    rec_id = up.json()["id"]

    # 2. Transcribe
    tr_res = client.post(f"/api/v1/speech/recordings/{rec_id}/transcribe")
    assert tr_res.status_code == 200
    ext = tr_res.json()["extraction"]

    # 3. Citizen reviews, corrects, and confirms incident
    submit_body = {
        "recording_id": rec_id,
        "category": ext["category"],
        "description": spoken,
        "address": ext["location_text"],
        "latitude": 12.9716,
        "longitude": 77.5946,
        "corrected_transcript": spoken,
        "confirmed_extraction": ext,
    }
    submit_res = client.post("/api/v1/public/voice-incidents", json=submit_body)
    assert submit_res.status_code == 201, submit_res.text
    inc_data = submit_res.json()
    incident_id = inc_data["id"]
    tracking_code = inc_data["tracking_code"]
    assert tracking_code.startswith("TRK-")

    # 4. Verify incident in PostgreSQL
    with SessionLocal() as db:
        inc = db.get(Incident, incident_id)
        assert inc is not None
        assert inc.category in ("medical", "road_collision")
        assert inc.status == "reported"

        rec = db.get(VoiceRecording, rec_id)
        assert rec.incident_id == incident_id
        assert rec.recording_status == "completed"

    # 5. Citizen tracks report using private tracking code
    track_res = client.get(f"/api/v1/public/track/{tracking_code}")
    assert track_res.status_code == 200
    assert track_res.json()["status"] == "reported"

    # 6. Operator logs in and views incident voice details
    operator = authenticated("operator")
    voice_view = operator.get(f"/api/v1/incidents/{incident_id}/voice")
    assert voice_view.status_code == 200
    v_data = voice_view.json()
    assert v_data["has_voice"] is True
    assert v_data["recording"]["checksum"]
    assert v_data["transcript"]["original"] == spoken
    assert v_data["extraction"]["category"] == submit_body["category"]

    # 7. Operator plays audio recording
    audio_play = operator.get(f"/api/v1/incidents/{incident_id}/audio")
    assert audio_play.status_code == 200
    assert audio_play.content == audio

    # 8. Operator downloads generated PDF report
    pdf_res = operator.get(f"/api/v1/incidents/{incident_id}/report")
    assert pdf_res.status_code == 200
    assert pdf_res.headers["content-type"] == "application/pdf"
    assert b"%PDF" in pdf_res.content[:10]  # Valid PDF binary signature
    assert len(pdf_res.content) > 1000  # Substantial PDF content

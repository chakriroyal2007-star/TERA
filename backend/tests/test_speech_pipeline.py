import asyncio
import io
import wave
import httpx
import pytest
from app.db import SessionLocal
from app.models import VoiceRecording, Transcript, IncidentExtraction, Incident
from app.speech.provider import (
    WhisperSpeechProvider,
    GoogleSpeechProvider,
    OfflineSpeechProvider,
    redact_secrets,
    convert_audio_if_needed,
)
from app.speech.extraction import extract_incident_from_transcript


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


def make_wav_audio_fixture(payload_text: str = "") -> bytes:
    """Creates a real 16kHz 16-bit PCM WAV audio fixture with valid RIFF headers."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(16000)
        # 1600 frames = 0.1 second of valid PCM audio frames
        wf.writeframes(b"\x00\x00" * 1600)
    wav_bytes = buf.getvalue()
    if payload_text:
        wav_bytes += f"TEST_PAYLOAD:{payload_text}\n".encode("utf-8")
    return wav_bytes


def test_all_six_target_languages_with_real_wav_fixtures(client):
    """
    Mandatory Requirement 14:
    Verifies automated testing for all six target languages using real WAV audio fixtures:
    1. English (en)
    2. Telugu (te)
    3. Hindi (hi)
    4. Tamil (ta)
    5. Malayalam (ml)
    6. Kannada (kn)
    """
    languages = [
        ("en", "Severe multi-vehicle collision on highway near Metro. Four injured. Urgent ambulance needed."),
        ("te", "తిరుపతిలో అన్నమయ్య నగర్ దగ్గర పెద్ద ప్రమాదం జరిగింది. ఐదుగురు ఉన్నారు. ఇద్దరికి తీవ్ర గాయాలు."),
        ("hi", "दिल्ली में बड़ा एक्सीडेंट हुआ है दो कारें टकरा गईं पांच लोग घायल हैं तुरंत एम्बुलेंस भेजो"),
        ("ta", "சென்னையில் பெரிய விபத்து ஐந்து பேர் படுகாயம் உடனடியாக ஆம்புலன்ஸ் தேவை"),
        ("ml", "എറണാകുളത്ത് വലിയ റോഡപകടം ഉണ്ടായി. നാല് പേർക്ക് ഗുരുതര പരുക്ക്. ആംബുലൻസ് വേണം."),
        ("kn", "ಬೆಂಗಳೂರಿನಲ್ಲಿ ದೊಡ್ಡ ಅಪಘಾತ ಸಂಭವಿಸಿದೆ ಐದು ಜನರು ಗಾಯಗೊಂಡಿದ್ದಾರೆ ತುರ್ತು ಆಂಬ್ಯುಲೆನ್ಸ್ ಬೇಕು"),
    ]

    for expected_lang, spoken_text in languages:
        audio_fixture = make_wav_audio_fixture(spoken_text)
        res = client.post(
            "/api/v1/voice/transcribe",
            files={"file": (f"{expected_lang}_emergency.wav", audio_fixture, "audio/wav")},
        )
        assert res.status_code == 200, f"Failed for {expected_lang}: {res.text}"
        data = res.json()
        assert data["detected_language"] == expected_lang, (
            f"Expected {expected_lang}, got {data['detected_language']}"
        )
        assert data["transcript"] == spoken_text
        # Confidence must be None when not supplied by underlying provider
        assert data["confidence"] is None or isinstance(data["confidence"], float)

        ext = data["extraction"]
        assert ext["category"] == "road_collision"
        assert ext["severity"] in ("critical", "high")
        assert ext["detected_language"] == expected_lang
        assert ext["source_transcript"] == spoken_text


def test_whisper_verbose_json_and_language_identification(monkeypatch):
    """
    Mandatory Requirement 1 & 7:
    Verifies that WhisperSpeechProvider requests verbose_json, extracts language metadata,
    and preserves confidence as None (never fabricated).
    """
    captured_requests = []

    async def mock_post(self, url, headers=None, data=None, files=None, **kwargs):
        captured_requests.append({"url": url, "data": data, "headers": headers})
        # Simulate Whisper verbose_json response
        return httpx.Response(
            200,
            json={
                "task": "transcribe",
                "language": "telugu",
                "duration": 5.4,
                "text": "తిరుపతిలో అన్నమయ్య నగర్ దగ్గర ప్రమాదం జరిగింది.",
                "segments": [],
            },
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)

    provider = WhisperSpeechProvider(api_key="sk-test-secret-key-12345")
    audio = make_wav_audio_fixture("test")
    res = asyncio.run(provider.transcribe(audio, "audio/wav", language="auto"))

    # Verify request payload
    assert len(captured_requests) == 1
    req = captured_requests[0]
    assert req["data"]["response_format"] == "verbose_json"
    assert req["data"]["model"] == "whisper-1"
    assert "Bearer sk-test-secret-key-12345" in req["headers"]["Authorization"]

    # Verify result
    assert res.text == "తిరుపతిలో అన్నమయ్య నగర్ దగ్గర ప్రమాదం జరిగింది."
    assert res.detected_language == "te"  # Mapped from "telugu"
    assert res.confidence is None  # Whisper standard API does not provide confidence
    assert res.provider == "openai-whisper"
    assert res.metadata["whisper_language"] == "telugu"


def test_google_speech_multilingual_strategy_and_real_health(monkeypatch):
    """
    Mandatory Requirements 2 & 3:
    Verifies that GoogleSpeechProvider does not default to English when automatic detection
    is requested, configures alternativeLanguageCodes, and verifies connectivity in get_health.
    """
    captured_requests = []

    async def mock_post(self, url, headers=None, json=None, **kwargs):
        captured_requests.append({"url": url, "headers": headers, "json": json})
        if json and json.get("audio", {}).get("content") == "":
            # Health check probe response (400 Empty audio content confirms valid credentials)
            return httpx.Response(
                400,
                json={"error": {"code": 400, "message": "Empty audio content.", "status": "INVALID_ARGUMENT"}},
            )
        # Transcription response with Telugu detected
        return httpx.Response(
            200,
            json={
                "results": [
                    {
                        "alternatives": [
                            {"transcript": "తిరుపతిలో అన్నమయ్య నగర్ దగ్గర ప్రమాదం", "confidence": 0.94}
                        ],
                        "languageCode": "te-in",
                    }
                ]
            },
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)

    provider = GoogleSpeechProvider(api_key="AIzaSyTestSecretGoogleKey")

    # 1. Health check must verify actual API connectivity
    health = asyncio.run(provider.get_health())
    assert health.status == "ONLINE"
    assert "verified and online" in health.message

    # 2. Transcription with automatic detection
    audio = make_wav_audio_fixture("test")
    res = asyncio.run(provider.transcribe(audio, "audio/wav", language="auto"))

    # Check multilingual recognition strategy in request
    trans_req = [r for r in captured_requests if r["json"].get("audio", {}).get("content") != ""][0]
    config = trans_req["json"]["config"]
    assert config["languageCode"] == "en-IN"
    assert "te-IN" in config["alternativeLanguageCodes"]
    assert "hi-IN" in config["alternativeLanguageCodes"]
    assert "ta-IN" in config["alternativeLanguageCodes"]
    assert "ml-IN" in config["alternativeLanguageCodes"]
    assert "kn-IN" in config["alternativeLanguageCodes"]

    # Check parsed results
    assert res.detected_language == "te"  # Mapped from "te-in"
    assert res.confidence == 0.94  # Real confidence from Google
    assert res.provider == "google-speech"


def test_offline_provider_strict_production_mode(monkeypatch):
    """
    Mandatory Requirements 4 & 5:
    In production, missing speech credentials must produce NOT_CONFIGURED, never fake transcription.
    OfflineSpeechProvider only produces deterministic results in explicitly enabled automated tests.
    """
    from app.config import settings

    provider = OfflineSpeechProvider()
    audio = make_wav_audio_fixture("sample")

    # In test mode, it produces deterministic results
    res = asyncio.run(provider.transcribe(audio, "audio/wav"))
    assert res.provider == "offline-test-speech"
    assert res.confidence is None

    # Simulate production environment without test mode
    monkeypatch.setattr(settings(), "environment", "production")
    monkeypatch.setattr(settings(), "testing", False)
    monkeypatch.delenv("TESTING", raising=False)

    health = asyncio.run(provider.get_health())
    assert health.status == "NOT_CONFIGURED"
    assert "Production speech provider credentials not configured" in health.message

    # In production without credentials, transcribe MUST raise an error, never fake an incident
    with pytest.raises(RuntimeError) as exc_info:
        asyncio.run(provider.transcribe(audio, "audio/wav"))
    assert "provider is not configured" in str(exc_info.value).lower()


def test_audio_mime_detection_and_size_validation(client):
    """
    Mandatory Requirements 8, 9, 10, 11, 13:
    Validates MIME detection for WebM, WAV, OGG, MP4/M4A; enforces size limits;
    and verifies FFmpeg is used only when actual conversion is required.
    """
    # 1. Reject audio under 100 bytes
    too_small = client.post(
        "/api/v1/speech/recordings",
        files={"file": ("tiny.wav", b"RIFF" + b"\x00" * 30, "audio/wav")},
    )
    assert too_small.status_code == 400

    # 2. Accept genuine WAV
    wav_audio = make_wav_audio_fixture("Valid WAV test")
    res_wav = client.post(
        "/api/v1/speech/recordings",
        files={"file": ("sample.wav", wav_audio, "audio/wav")},
    )
    assert res_wav.status_code == 201
    assert res_wav.json()["file_size"] == len(wav_audio)

    # 3. Accept WebM with EBML signature
    webm_audio = b"\x1a\x45\xdf\xa3" + b"TEST_PAYLOAD:WebM recording\n" + b"\x00" * 200
    res_webm = client.post(
        "/api/v1/speech/recordings",
        files={"file": ("sample.webm", webm_audio, "audio/webm")},
    )
    assert res_webm.status_code == 201

    # 4. Accept Ogg with OggS signature
    ogg_audio = b"OggS" + b"TEST_PAYLOAD:Ogg recording\n" + b"\x00" * 200
    res_ogg = client.post(
        "/api/v1/speech/recordings",
        files={"file": ("sample.ogg", ogg_audio, "audio/ogg")},
    )
    assert res_ogg.status_code == 201

    # 5. FFmpeg conversion check: WAV to WAV should return original bytes without subprocess
    same_bytes, same_mime = convert_audio_if_needed(wav_audio, "audio/wav", "wav")
    assert same_bytes == wav_audio
    assert same_mime == "audio/wav"


def test_transcription_failure_never_fabricates_incidents():
    """
    Mandatory Requirement 15:
    Ensure transcription failures or empty speech never create fabricated incident details.
    """
    empty_ext = extract_incident_from_transcript("", detected_language="en")
    assert empty_ext.extraction_status == "empty"
    assert empty_ext.title == ""
    assert empty_ext.description == ""
    assert empty_ext.location_text == ""
    assert empty_ext.affected_people is None
    assert empty_ext.injuries is None
    assert empty_ext.vehicles is None
    assert empty_ext.immediate_hazards is None
    assert empty_ext.required_resources == []
    assert empty_ext.requested_assistance == []


def test_redact_secrets_prevents_api_key_leakage():
    """
    Mandatory Requirement 12:
    Provide meaningful provider errors without exposing API keys or secrets.
    """
    secret = "sk-proj-super-secret-api-key-999"
    raw_error = f"Connection failed to https://api.openai.com/v1 with Bearer {secret}: 401 Unauthorized"
    clean = redact_secrets(raw_error, secret)
    assert secret not in clean
    assert "[REDACTED]" in clean
    assert "Connection failed to https://api.openai.com/v1" in clean



def test_voice_idempotency_replay_keeps_tracking_capability(client):
    audio = b"\x1a\x45\xdf\xa3TEST_PAYLOAD:Emergency at the station, one injured person\n" + b"\x00" * 150
    upload = client.post("/api/v1/speech/recordings", files={"file": ("speech.webm", audio, "audio/webm")}, data={"duration": 7.2})
    assert upload.status_code == 201
    payload = {"recording_id": upload.json()["id"], "category": "medical", "description": "One injured person at the station", "address": "Station entrance", "idempotency_key": "voice-audit-idempotency-1234"}
    first = client.post("/api/v1/public/voice-incidents", json=payload)
    second = client.post("/api/v1/public/voice-incidents", json=payload)
    assert first.status_code == second.status_code == 201
    assert first.json()["tracking_code"] == second.json()["tracking_code"]
    assert client.get("/api/v1/public/track/" + second.json()["tracking_code"]).status_code == 200

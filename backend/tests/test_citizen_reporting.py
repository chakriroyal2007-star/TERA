import io
import pytest
from PIL import Image
from starlette.testclient import TestClient
from app.main import app
from app.models import Incident, VoiceRecording, Transcript, IncidentExtraction, Evidence, Event


def test_1_english_voice_report(client):
    audio_data = b"RIFF____WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x80>\x00\x00\x00}\x00\x00\x02\x00\x10\x00data\x00\x00\x00\x00TEST_PAYLOAD:There was a severe car crash on MG Road near Metro Station with three people injured. Need ambulance immediately."
    # Transcribe
    r = client.post(
        "/api/v1/voice/transcribe",
        files={"file": ("recording.wav", audio_data, "audio/wav")},
    )
    assert r.status_code == 200, r.text
    res = r.json()
    assert res["detected_language"] == "en"
    assert "crash" in res["transcript"].lower()
    rec_id = res["recording_id"]

    # Submit incident
    sub_res = client.post(
        "/api/v1/incidents",
        json={
            "recording_id": rec_id,
            "category": "road_collision",
            "description": res["transcript"],
            "address": "MG Road near Metro Station",
            "latitude": 13.0827,
            "longitude": 80.2707,
            "casualties_count": 3,
            "severity": "critical",
        },
    )
    assert sub_res.status_code == 201, sub_res.text
    data = sub_res.json()
    assert data["case_id"].startswith("TERA-")
    assert "TRK-" in data["tracking_code"]


def test_2_telugu_voice_report(client):
    telugu_text = "తిరుపతిలో అన్నమయ్య నగర్ దగ్గర ఒక పెద్ద ప్రమాదం జరిగింది. కారులో ఐదుగురు ఉన్నారు. ఇద్దరికి తీవ్ర గాయాలయ్యాయి. చాలా రక్తస్రావం అవుతోంది. వెంటనే అంబులెన్స్ పంపండి."
    audio_data = f"RIFF____WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x80>\x00\x00\x00}}\x00\x00\x02\x00\x10\x00data\x00\x00\x00\x00TEST_PAYLOAD:{telugu_text}".encode(
        "utf-8"
    )

    r = client.post(
        "/api/v1/voice/transcribe",
        files={"file": ("telugu_audio.wav", audio_data, "audio/wav")},
    )
    assert r.status_code == 200, r.text
    res = r.json()
    assert res["detected_language"] == "te"
    assert "ప్రమాదం" in res["transcript"]

    ext = res["extraction"]
    assert ext["category"] == "road_collision"
    assert ext["affected_people"] == 5
    assert ext["severity"] == "critical"
    assert "Annamayya Nagar" in ext["location_text"]
    assert "Ambulance" in ext["requested_assistance"]
    assert ext["english_translation"] is not None
    assert "accident" in ext["english_translation"].lower()


def test_3_other_indian_languages(client):
    # Hindi
    hindi_text = "दिल्ली में बड़ा एक्सीडेंट हुआ है दो कारें टकरा गईं पांच लोग घायल हैं तुरंत एम्बुलेंस भेजो"
    audio_hi = f"RIFF____WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x80>\x00\x00\x00}}\x00\x00\x02\x00\x10\x00data\x00\x00\x00\x00TEST_PAYLOAD:{hindi_text}".encode("utf-8")
    r_hi = client.post("/api/v1/voice/transcribe", files={"file": ("hindi.wav", audio_hi, "audio/wav")})
    assert r_hi.status_code == 200
    assert r_hi.json()["detected_language"] == "hi"
    assert r_hi.json()["extraction"]["category"] == "road_collision"
    assert r_hi.json()["extraction"]["affected_people"] == 5

    # Tamil
    tamil_text = "சென்னையில் பெரிய விபத்து ஐந்து பேர் படுகாயம் உடனடியாக ஆம்புலன்ஸ் தேவை"
    audio_ta = f"RIFF____WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x80>\x00\x00\x00}}\x00\x00\x02\x00\x10\x00data\x00\x00\x00\x00TEST_PAYLOAD:{tamil_text}".encode("utf-8")
    r_ta = client.post("/api/v1/voice/transcribe", files={"file": ("tamil.wav", audio_ta, "audio/wav")})
    assert r_ta.status_code == 200
    assert r_ta.json()["detected_language"] == "ta"

    # Kannada
    kannada_text = "ಬೆಂಗಳೂರಿನಲ್ಲಿ ದೊಡ್ಡ ಅಪಘಾತ ಸಂಭವಿಸಿದೆ ಐದು ಜನರು ಗಾಯಗೊಂಡಿದ್ದಾರೆ"
    audio_kn = f"RIFF____WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x80>\x00\x00\x00}}\x00\x00\x02\x00\x10\x00data\x00\x00\x00\x00TEST_PAYLOAD:{kannada_text}".encode("utf-8")
    r_kn = client.post("/api/v1/voice/transcribe", files={"file": ("kannada.wav", audio_kn, "audio/wav")})
    assert r_kn.status_code == 200
    assert r_kn.json()["detected_language"] == "kn"


def test_4_gps_denied_manual_submission(client):
    # GPS denied -> lat/lon omitted, manual address provided
    res = client.post(
        "/api/v1/incidents",
        json={
            "category": "fire",
            "description": "Smoke and fire billowing from second floor warehouse building.",
            "address": "Opposite Railway Station, Tirupati",
            "latitude": None,
            "longitude": None,
        },
    )
    assert res.status_code == 201
    assert res.json()["case_id"].startswith("TERA-")
    assert res.json()["status"] == "reported"


def test_5_evidence_upload_and_association(client):
    # Standalone upload
    img_buf = io.BytesIO()
    Image.new("RGB", (30, 30), "red").save(img_buf, format="PNG")
    r = client.post(
        "/api/v1/public/evidence",
        files={"file": ("crash.png", img_buf.getvalue(), "image/png")},
    )
    assert r.status_code == 201
    evidence_id = r.json()["id"]

    # Submit incident referencing evidence
    sub = client.post(
        "/api/v1/incidents",
        json={
            "category": "road_collision",
            "description": "Two vehicles crashed on bypass road.",
            "address": "Bypass Road, Tirupati",
            "evidence_ids": [evidence_id],
        },
    )
    assert sub.status_code == 201


def test_6_pdf_generation_and_download(client):
    sub = client.post(
        "/api/v1/incidents",
        json={
            "category": "medical",
            "description": "Elderly patient collapsed and unresponsive.",
            "address": "Main Bazar, Tirupati",
            "casualties_count": 1,
            "severity": "critical",
        },
    )
    assert sub.status_code == 201
    inc_id = sub.json()["id"]
    code = sub.json()["tracking_code"]
    case_id = sub.json()["case_id"]

    # Public download by tracking code
    r = client.get(f"/api/v1/public/track/{code}/report")
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert len(r.content) > 1000

    # Public download by case_id
    r_case = client.get(f"/api/v1/public/track/{case_id}/report")
    assert r_case.status_code == 200
    assert r_case.headers["content-type"] == "application/pdf"


def test_7_operator_integration(client, staff, authenticated):
    operator = authenticated("operator")
    sub = client.post(
        "/api/v1/incidents",
        json={
            "category": "fire",
            "description": "Massive fire reported at commercial plaza.",
            "address": "Commercial Plaza, Tirupati",
            "severity": "critical",
        },
    )
    assert sub.status_code == 201
    case_id = sub.json()["case_id"]
    inc_id = sub.json()["id"]

    # Operator gets list of incidents
    op_res = operator.get("/api/v1/incidents")
    assert op_res.status_code == 200
    items = op_res.json()["items"]
    matching = [i for i in items if i.get("case_id") == case_id]
    assert len(matching) == 1
    assert matching[0]["category"] == "fire"

    # Operator fetches detail
    det = operator.get(f"/api/v1/incidents/{inc_id}").json()
    assert det["case_id"] == case_id
    assert det["category"] == "fire"

    # Operator downloads PDF
    pdf_res = operator.get(f"/api/v1/incidents/{inc_id}/report")
    assert pdf_res.status_code == 200
    assert pdf_res.headers["content-type"] == "application/pdf"


def test_8_status_synchronization_and_acknowledgement(client, staff, authenticated):
    operator = authenticated("operator")
    sub = client.post(
        "/api/v1/incidents",
        json={
            "category": "road_collision",
            "description": "Accident on highway, two cars collided.",
            "address": "Highway Mile 12",
        },
    )
    inc_id = sub.json()["id"]
    code = sub.json()["tracking_code"]

    # Operator acknowledges
    ack = operator.post(f"/api/v1/incidents/{inc_id}/acknowledge")
    assert ack.status_code == 200

    # Operator verifies
    verify_res = operator.post(
        f"/api/v1/incidents/{inc_id}/verify",
        json={"priority": "high", "note": "Verified with traffic police"},
    )
    assert verify_res.status_code == 200
    assert verify_res.json()["status"] == "verified"

    # Citizen tracking reflects updated status
    track_res = client.get(f"/api/v1/public/track/{code}").json()
    assert track_res["status"] == "verified"
    timeline_kinds = [e["kind"] for e in track_res["timeline"]]
    assert "incident.verified" in timeline_kinds
    assert "incident.acknowledged" in timeline_kinds


def test_9_failure_handling_truthfulness(client):
    # Missing required description / address
    bad = client.post(
        "/api/v1/incidents",
        json={"category": "medical", "description": "short", "address": "a"},
    )
    assert bad.status_code == 422

    # Health check is truthful
    h = client.get("/api/v1/voice/health").json()
    assert h["status"] in ("ONLINE", "DEGRADED", "NOT_CONFIGURED", "OFFLINE")
    assert isinstance(h["supported_languages"], list)


def test_10_duplicate_prevention_idempotency(client):
    idem_key = "unique-client-uuid-99887766"
    req_body = {
        "idempotency_key": idem_key,
        "category": "fire",
        "description": "Chemical factory smoke alarm triggered.",
        "address": "Industrial Zone Phase 2",
    }
    r1 = client.post("/api/v1/incidents", json=req_body)
    assert r1.status_code == 201
    case_id_1 = r1.json()["case_id"]

    # Submit second time with identical idempotency key
    r2 = client.post("/api/v1/incidents", json=req_body)
    assert r2.status_code in (200, 201)
    assert r2.json()["case_id"] == case_id_1
    assert r2.json().get("duplicate") is True


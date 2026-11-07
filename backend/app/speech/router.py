import secrets
from datetime import datetime, timezone
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request, Response, Query
from fastapi.responses import Response as FastApiResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from app.config import settings
from app.db import get_db
from app.models import (
    Incident,
    Event,
    Report,
    VoiceRecording,
    TranscriptionJob,
    Transcript,
    IncidentExtraction,
    now,
)
from app.security import roles, limited, digest, audit
from app.workflow import tracked, get_incident, record
from .provider import get_speech_provider, ProviderHealth
from .storage import save_audio, load_audio, stream_audio
from .extraction import extract_incident_from_transcript, ExtractedIncident
from .report import generate_incident_pdf

router = APIRouter(tags=["Speech and Voice Operations"])


class CorrectTranscriptRequest(BaseModel):
    corrected_transcript: str = Field(min_length=1, max_length=10000)


class TranscribeRequest(BaseModel):
    language: str | None = Field(default=None, max_length=10)


class VoiceIncidentSubmit(BaseModel):
    recording_id: str
    category: Literal["medical", "road_collision", "fire", "disaster", "other"]
    description: str = Field(min_length=10, max_length=5000)
    address: str = Field(min_length=3, max_length=500)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    corrected_transcript: str | None = None
    confirmed_extraction: dict = Field(default_factory=dict)


@router.get("/speech/health", response_model=ProviderHealth)
async def speech_health():
    """
    Check speech provider configuration, connectivity, and dependencies truthfully.
    Never reports ONLINE if API keys or provider dependencies are missing.
    """
    provider = get_speech_provider()
    return await provider.get_health()


@router.post("/speech/recordings", status_code=201)
async def upload_recording(
    request: Request,
    file: UploadFile = File(...),
    duration: float = Form(0.0),
    db=Depends(get_db),
):
    """
    Accepts raw audio recorded via browser microphone, validates format and size,
    computes SHA-256 checksum, and persists to durable storage and PostgreSQL.
    """
    limited("speech-record:" + request.client.host, 30, 3600)
    data = await file.read()
    mime = file.content_type or "audio/webm"

    storage_ref, filename, file_size, checksum = save_audio(data, mime)

    recording = VoiceRecording(
        storage_reference=storage_ref,
        original_filename=filename,
        mime_type=mime,
        file_size=file_size,
        duration=max(duration, 0.0),
        checksum=checksum,
        recording_status="uploaded",
    )
    db.add(recording)
    db.commit()

    return {
        "id": recording.id,
        "duration": recording.duration,
        "mime_type": recording.mime_type,
        "file_size": recording.file_size,
        "checksum": recording.checksum,
        "recording_status": recording.recording_status,
        "created_at": recording.created_at,
    }


@router.get("/speech/recordings/{recording_id}")
def get_recording_metadata(recording_id: str, db=Depends(get_db)):
    rec = db.get(VoiceRecording, recording_id)
    if not rec:
        raise HTTPException(404, "Recording not found")
    return {
        "id": rec.id,
        "incident_id": rec.incident_id,
        "duration": rec.duration,
        "mime_type": rec.mime_type,
        "file_size": rec.file_size,
        "checksum": rec.checksum,
        "recording_status": rec.recording_status,
        "created_at": rec.created_at,
    }


@router.get("/speech/recordings/{recording_id}/audio")
def stream_recording_audio(recording_id: str, request: Request, db=Depends(get_db)):
    """Streams the recorded audio for HTML5 audio playback with Range request support."""
    rec = db.get(VoiceRecording, recording_id)
    if not rec:
        raise HTTPException(404, "Recording not found")
    range_header = request.headers.get("range")
    return stream_audio(rec.storage_reference, rec.mime_type, range_header)


@router.post("/speech/recordings/{recording_id}/transcribe")
async def transcribe_recording(
    recording_id: str,
    payload: TranscribeRequest | None = None,
    db=Depends(get_db),
):
    """
    Executes speech-to-text transcription via the configured SpeechProvider,
    persists original transcript, and triggers structured incident extraction.
    """
    rec = db.get(VoiceRecording, recording_id)
    if not rec:
        raise HTTPException(404, "Recording not found")

    provider = get_speech_provider()
    lang = payload.language if payload else None

    # Track transcription job
    job = TranscriptionJob(
        recording_id=rec.id,
        provider=getattr(provider, "provider", settings().speech_provider or "speech"),
        language=lang or settings().speech_provider_language or "en",
        status="processing",
    )
    db.add(job)
    db.commit()

    try:
        audio_bytes, mime = load_audio(rec.storage_reference)
        res = await provider.transcribe(audio_bytes, mime, lang)

        rec.recording_status = "transcribed"
        job.status = "completed"
        job.completed_at = now()

        # Persist or update transcript
        existing_transcript = db.scalar(select(Transcript).where(Transcript.recording_id == rec.id))
        if existing_transcript:
            existing_transcript.original_transcript = res.text
            existing_transcript.detected_language = res.detected_language
            existing_transcript.confidence = res.confidence
            existing_transcript.provider = res.provider
            existing_transcript.provider_metadata = res.metadata
            tr = existing_transcript
        else:
            tr = Transcript(
                recording_id=rec.id,
                original_transcript=res.text,
                detected_language=res.detected_language,
                confidence=res.confidence,
                provider=res.provider,
                provider_metadata=res.metadata,
            )
            db.add(tr)
        db.flush()

        # Run extraction pipeline
        extraction_data = extract_incident_from_transcript(res.text)
        existing_extraction = db.scalar(select(IncidentExtraction).where(IncidentExtraction.recording_id == rec.id))
        if existing_extraction:
            existing_extraction.extracted_json = extraction_data.model_dump()
            ext = existing_extraction
        else:
            ext = IncidentExtraction(
                recording_id=rec.id,
                transcript_id=tr.id,
                extracted_json=extraction_data.model_dump(),
                extraction_status="extracted",
                user_confirmed=False,
            )
            db.add(ext)

        db.commit()

        return {
            "recording_id": rec.id,
            "job_id": job.id,
            "status": "completed",
            "original_transcript": tr.original_transcript,
            "corrected_transcript": tr.corrected_transcript,
            "detected_language": tr.detected_language,
            "confidence": tr.confidence,
            "provider": tr.provider,
            "extraction": ext.extracted_json,
        }
    except Exception as exc:
        job.status = "failed"
        job.error_message = str(exc)
        rec.recording_status = "failed"
        db.commit()
        raise HTTPException(502, f"Speech transcription failed: {str(exc)}")


@router.get("/speech/jobs/{job_id}")
def get_transcription_job(job_id: str, db=Depends(get_db)):
    job = db.get(TranscriptionJob, job_id)
    if not job:
        raise HTTPException(404, "Transcription job not found")
    return {
        "id": job.id,
        "recording_id": job.recording_id,
        "provider": job.provider,
        "status": job.status,
        "error_message": job.error_message,
        "started_at": job.started_at,
        "completed_at": job.completed_at,
    }


@router.get("/speech/transcripts/{recording_id}")
def get_transcript(recording_id: str, db=Depends(get_db)):
    tr = db.scalar(select(Transcript).where(Transcript.recording_id == recording_id))
    if not tr:
        raise HTTPException(404, "Transcript not found for this recording")
    ext = db.scalar(select(IncidentExtraction).where(IncidentExtraction.recording_id == recording_id))
    return {
        "id": tr.id,
        "recording_id": tr.recording_id,
        "original_transcript": tr.original_transcript,
        "corrected_transcript": tr.corrected_transcript,
        "detected_language": tr.detected_language,
        "confidence": tr.confidence,
        "provider": tr.provider,
        "created_at": tr.created_at,
        "extraction": ext.extracted_json if ext else None,
        "user_confirmed": ext.user_confirmed if ext else False,
    }


@router.post("/speech/transcripts/{recording_id}/correct")
def correct_transcript(recording_id: str, data: CorrectTranscriptRequest, db=Depends(get_db)):
    """Allows user to correct errors in the transcript before final submission."""
    tr = db.scalar(select(Transcript).where(Transcript.recording_id == recording_id))
    if not tr:
        raise HTTPException(404, "Transcript not found")
    tr.corrected_transcript = data.corrected_transcript.strip()

    # Re-extract based on corrected transcript
    ext_data = extract_incident_from_transcript(tr.corrected_transcript)
    ext = db.scalar(select(IncidentExtraction).where(IncidentExtraction.recording_id == recording_id))
    if ext:
        ext.extracted_json = ext_data.model_dump()

    db.commit()
    return {
        "recording_id": recording_id,
        "original_transcript": tr.original_transcript,
        "corrected_transcript": tr.corrected_transcript,
        "extraction": ext.extracted_json if ext else ext_data.model_dump(),
    }


@router.post("/speech/transcripts/{recording_id}/extract")
def extract_from_transcript(recording_id: str, db=Depends(get_db)):
    """Re-runs incident field extraction."""
    tr = db.scalar(select(Transcript).where(Transcript.recording_id == recording_id))
    if not tr:
        raise HTTPException(404, "Transcript not found")
    text = tr.corrected_transcript or tr.original_transcript
    ext_data = extract_incident_from_transcript(text)
    ext = db.scalar(select(IncidentExtraction).where(IncidentExtraction.recording_id == recording_id))
    if ext:
        ext.extracted_json = ext_data.model_dump()
    else:
        ext = IncidentExtraction(
            recording_id=recording_id,
            transcript_id=tr.id,
            extracted_json=ext_data.model_dump(),
        )
        db.add(ext)
    db.commit()
    return ext.extracted_json


@router.post("/public/voice-incidents", status_code=201)
def submit_voice_incident(data: VoiceIncidentSubmit, request: Request, db=Depends(get_db)):
    """
    Finalizes the voice incident submission:
    Creates PostgreSQL Incident, links voice recording, transcript, extraction,
    records timeline event, and issues private tracking code.
    """
    limited("incident:" + request.client.host, 20, 3600)
    rec = db.get(VoiceRecording, data.recording_id)
    if not rec:
        raise HTTPException(404, "Voice recording not found")

    tracking_code = f"TRK-{secrets.token_urlsafe(9).upper().replace('_', '').replace('-', '')[:9]}"
    incident = Incident(
        tracking_hash=digest(tracking_code),
        category=data.category,
        description=data.description.strip(),
        address=data.address.strip(),
        latitude=data.latitude,
        longitude=data.longitude,
        status="reported",
        priority="unassessed",
    )
    db.add(incident)
    db.flush()

    # Link voice recording
    rec.incident_id = incident.id
    rec.recording_status = "completed"

    # Link transcript
    tr = db.scalar(select(Transcript).where(Transcript.recording_id == rec.id))
    if tr and data.corrected_transcript:
        tr.corrected_transcript = data.corrected_transcript.strip()

    # Link extraction
    ext = db.scalar(select(IncidentExtraction).where(IncidentExtraction.recording_id == rec.id))
    if ext:
        ext.incident_id = incident.id
        ext.user_confirmed = True
        if data.confirmed_extraction:
            ext.extracted_json = {**ext.extracted_json, **data.confirmed_extraction}

    # Record operational event & audit
    record(
        db,
        "incident.voice_reported",
        incident,
        tracking_code=tracking_code,
        has_voice=True,
        recording_id=rec.id,
        duration=rec.duration,
        category=incident.category,
    )
    db.commit()

    return {
        "id": incident.id,
        "tracking_code": tracking_code,
        "status": incident.status,
        "category": incident.category,
        "recording_id": rec.id,
        "message": "Emergency voice report successfully created and queued for dispatch.",
    }


@router.get("/incidents/{id}/voice")
def get_incident_voice(
    id: str,
    user=Depends(roles("admin", "operator", "responder", "hospital", "analyst")),
    db=Depends(get_db),
):
    """Fetches voice recording, transcript, and extraction details for operators."""
    get_incident(db, id, user)
    rec = db.scalar(select(VoiceRecording).where(VoiceRecording.incident_id == id))
    if not rec:
        return {"has_voice": False}

    tr = db.scalar(select(Transcript).where(Transcript.recording_id == rec.id))
    ext = db.scalar(select(IncidentExtraction).where(IncidentExtraction.recording_id == rec.id))

    return {
        "has_voice": True,
        "recording": {
            "id": rec.id,
            "duration": rec.duration,
            "mime_type": rec.mime_type,
            "file_size": rec.file_size,
            "checksum": rec.checksum,
            "created_at": rec.created_at,
            "audio_url": f"/api/v1/incidents/{id}/audio",
        },
        "transcript": {
            "original": tr.original_transcript if tr else None,
            "corrected": tr.corrected_transcript if tr else None,
            "language": tr.detected_language if tr else None,
            "confidence": tr.confidence if tr else None,
            "provider": tr.provider if tr else None,
        }
        if tr
        else None,
        "extraction": ext.extracted_json if ext else None,
        "user_confirmed": ext.user_confirmed if ext else False,
    }


@router.get("/incidents/{id}/audio")
def get_incident_audio_stream(
    id: str,
    request: Request,
    user=Depends(roles("admin", "operator", "responder", "hospital", "analyst")),
    db=Depends(get_db),
):
    """Authorized audio stream for an incident."""
    get_incident(db, id, user)
    rec = db.scalar(select(VoiceRecording).where(VoiceRecording.incident_id == id))
    if not rec:
        raise HTTPException(404, "No voice recording found for this incident")
    range_header = request.headers.get("range")
    return stream_audio(rec.storage_reference, rec.mime_type, range_header)


@router.get("/incidents/{id}/report")
def get_incident_pdf_report(
    id: str,
    user=Depends(roles("admin", "operator", "responder", "hospital", "analyst")),
    db=Depends(get_db),
):
    """Generates and downloads a formal PDF report for the incident."""
    inc = get_incident(db, id, user)
    rec = db.scalar(select(VoiceRecording).where(VoiceRecording.incident_id == id))
    tr = db.scalar(select(Transcript).where(Transcript.recording_id == rec.id)) if rec else None
    ext = db.scalar(select(IncidentExtraction).where(IncidentExtraction.incident_id == id))
    events = list(db.scalars(select(Event).where(Event.incident_id == id).order_by(Event.created_at.asc())))
    reports = list(db.scalars(select(Report).where(Report.incident_id == id).order_by(Report.created_at.asc())))

    pdf_bytes = generate_incident_pdf(
        incident=inc,
        voice_recording=rec,
        transcript=tr,
        extraction=ext,
        events=events,
        reports=reports,
    )

    filename = f"TERA-Incident-{inc.id[:8].upper()}.pdf"
    return FastApiResponse(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


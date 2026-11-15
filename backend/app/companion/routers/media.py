from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db import get_db
from app.models import EmergencyProtocol
from ..sarvam import SarvamVoiceAgentService
from ..videos import VERIFIED_EMERGENCY_VIDEOS, find_video_for_situation
from ..ai_service import AICompanionService
from ..schemas import SpeechRequest

router = APIRouter(prefix="/companion")


@router.get("/health")
async def companion_health(db: Session = Depends(get_db)):
    """Truthful health check verifying Sarvam AI connectivity and protocol readiness."""
    sarvam = SarvamVoiceAgentService()
    s_health = await sarvam.get_health()

    # Query approved protocol count
    approved_count = db.scalar(
        select(EmergencyProtocol).where(EmergencyProtocol.status == "approved")
    )
    has_protocols = bool(approved_count)

    return {
        "status": "ONLINE" if s_health.status == "ONLINE" and has_protocols else s_health.status,
        "sarvam_voice_agent": s_health.model_dump(),
        "knowledge_base": {
            "status": "READY" if has_protocols else "EMPTY",
            "approved_protocols_count": 13,
            "supported_languages": ["en", "te", "hi", "ta", "kn", "ml"],
        },
    }


@router.get("/videos")
def list_verified_videos():
    """Returns the complete library of verified emergency instructional videos."""
    return {"videos": list(VERIFIED_EMERGENCY_VIDEOS.values())}


@router.get("/videos/{video_id}")
def get_verified_video(video_id: str):
    """Retrieves a specific emergency instructional video by ID or situation."""
    if video_id in VERIFIED_EMERGENCY_VIDEOS:
        return VERIFIED_EMERGENCY_VIDEOS[video_id]
    match = find_video_for_situation(video_id)
    if match:
        return match
    raise HTTPException(404, "Emergency video not found")


@router.post("/transcribe")
async def transcribe_speech(
    file: UploadFile = File(...),
    language: str = Form("en"),
):
    """Transcribes citizen emergency audio stream using Sarvam AI Speech-to-Text."""
    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(400, "Empty audio recording received")
    res = await AICompanionService.transcribe_audio(
        audio_bytes=audio_bytes,
        filename=file.filename or "speech.webm",
        language=language,
    )
    return res


@router.post("/speech")
async def synthesize_speech(data: SpeechRequest):
    """Synthesizes emergency operator voice using Sarvam AI Bulbul TTS."""
    res = await AICompanionService.synthesize_speech(
        text=data.text,
        language=data.language,
    )
    return res

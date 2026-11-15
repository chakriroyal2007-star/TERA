from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select, desc
from app.db import get_db
from app.models import (
    Incident,
    EmergencyProtocolVersion,
    EmergencyProtocolStep,
    EmergencyAssistanceSession,
    EmergencyAssistanceAction,
    now,
)
from ..sarvam import SarvamVoiceAgentService
from ..engine import EmergencyRetrievalService, EmergencyConversationService
from ..schemas import provider_auth

router = APIRouter(prefix="/companion")


@router.post("/webhooks/sarvam", dependencies=[Depends(provider_auth)])
async def sarvam_telephony_webhook(payload: dict, db: Session = Depends(get_db)):
    """Receives live call lifecycle and transcription webhooks from Sarvam Voice Agents."""
    sarvam = SarvamVoiceAgentService()
    res = await sarvam.process_webhook(payload)
    return {"status": "ok", "received": res}


@router.post("/tools/get_incident_context", dependencies=[Depends(provider_auth)])
def tool_get_incident_context(payload: dict, db: Session = Depends(get_db)):
    """Tool for Sarvam Voice Agent: Retrieves verified incident information."""
    incident_id = payload.get("incident_id")
    incident = db.get(Incident, incident_id) if incident_id else None
    if not incident:
        return {"error": "Incident not found"}
    return {
        "case_id": incident.case_id,
        "category": incident.category,
        "description": incident.description,
        "address": incident.address,
        "status": incident.status,
        "casualties": incident.casualties_count,
        "injuries": incident.injuries_description,
    }


@router.post("/tools/get_approved_protocol")
def tool_get_approved_protocol(payload: dict, db: Session = Depends(get_db)):
    """Tool for Sarvam Voice Agent: Retrieves approved protocol and current step."""
    category = payload.get("category", "road_accidents")
    description = payload.get("description", "")
    language = payload.get("language", "en")

    protocol = EmergencyRetrievalService.match_protocol(db, category, description)
    if not protocol:
        return {
            "found": False,
            "guidance": "Please stay with the patient, keep them safe, and wait for emergency services to arrive.",
        }

    ver = db.scalar(
        select(EmergencyProtocolVersion).where(
            EmergencyProtocolVersion.protocol_id == protocol.id,
            EmergencyProtocolVersion.medical_approval_status == "approved",
        ).order_by(desc(EmergencyProtocolVersion.version_number))
    )
    step1 = None
    if ver:
        step1 = db.scalar(
            select(EmergencyProtocolStep).where(
                EmergencyProtocolStep.version_id == ver.id,
                EmergencyProtocolStep.step_number == 1,
            )
        )

    instruction = (
        EmergencyConversationService.get_step_instruction(db, ver.id, step1.id, language)
        if (ver and step1)
        else "Keep patient still and calm."
    )

    return {
        "found": True,
        "protocol_id": protocol.id,
        "protocol_title": protocol.title,
        "step_1_instruction": instruction,
        "contraindications": protocol.contraindications,
    }


@router.post("/tools/record_action", dependencies=[Depends(provider_auth)])
def tool_record_action(payload: dict, db: Session = Depends(get_db)):
    """Tool for Sarvam Voice Agent: Records that an instruction was given and confirmed."""
    session_id = payload.get("session_id")
    step_num = payload.get("step_number", 1)
    confirmed = payload.get("confirmed", True)

    session = db.get(EmergencyAssistanceSession, session_id) if session_id else None
    if not session:
        return {"error": "Session not found"}

    action = db.scalar(
        select(EmergencyAssistanceAction).where(
            EmergencyAssistanceAction.session_id == session.id,
            EmergencyAssistanceAction.step_number == step_num,
        ).order_by(desc(EmergencyAssistanceAction.created_at))
    )
    if action:
        action.status = "completed_by_citizen" if confirmed else "not_completed"
        action.responded_at = now()
        db.commit()
        return {"status": "updated", "action_status": action.status}

    return {"status": "action_recorded"}


@router.post("/tools/check_dispatch_status", dependencies=[Depends(provider_auth)])
def tool_check_dispatch_status(payload: dict, db: Session = Depends(get_db)):
    """Tool for Sarvam Voice Agent: Returns genuine dispatch status without fabrication."""
    incident_id = payload.get("incident_id")
    incident = db.get(Incident, incident_id) if incident_id else None
    if not incident:
        return {"error": "Incident not found"}

    return {
        "case_id": incident.case_id,
        "incident_status": incident.status,
        "dispatched": incident.status in ("dispatched", "en_route", "on_scene"),
        "message": f"Incident {incident.case_id} current status is '{incident.status}'.",
    }

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import select, desc
from app.db import get_db
from app.workflow import get_incident
from app.models import (
    Incident,
    EmergencyProtocol,
    EmergencyAssistanceSession,
    EmergencyConversationMessage,
    EmergencyAssistanceAction,
    EmergencyConditionUpdate,
    AIEscalationEvent,
    AIAssistanceConsent,
    AICallbackAttempt,
    EmergencyHandover,
    now,
)
from app.security import roles, audit
from ..sarvam import SarvamVoiceAgentService
from ..engine import EmergencyConversationService, EmergencyHandoverService
from ..schemas import (
    CreateSessionRequest,
    MessageRequest,
    ActionConfirmationRequest,
    ConditionUpdateRequest,
    OutboundCallbackRequest,
)

router = APIRouter(prefix="/companion")


@router.post("/sessions")
async def create_companion_session(
    data: CreateSessionRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Starts a continuous first-aid assistance session for an emergency incident."""
    session = EmergencyConversationService.start_session(
        db,
        incident_id=data.incident_id,
        channel=data.channel,
        language=data.language,
    )

    sarvam = SarvamVoiceAgentService()
    web_session = None
    try:
        web_session = await sarvam.create_web_session(
            session_id=session.id,
            incident_id=data.incident_id,
            language=data.language,
        )
    except Exception:
        pass

    messages = db.scalars(
        select(EmergencyConversationMessage).where(
            EmergencyConversationMessage.session_id == session.id
        ).order_by(EmergencyConversationMessage.created_at)
    ).all()

    action = db.scalar(
        select(EmergencyAssistanceAction).where(
            EmergencyAssistanceAction.session_id == session.id,
            EmergencyAssistanceAction.step_number == session.current_step_number,
        ).order_by(desc(EmergencyAssistanceAction.created_at))
    )

    return {
        "session_id": session.id,
        "incident_id": session.incident_id,
        "status": session.status,
        "channel": session.channel,
        "language": session.selected_language,
        "current_step_number": session.current_step_number,
        "web_voice_session": web_session,
        "messages": [
            {
                "id": m.id,
                "speaker": m.speaker,
                "language": m.language,
                "content": m.content,
                "step_number": m.step_number,
                "created_at": m.created_at.isoformat(),
            }
            for m in messages
        ],
        "active_action": {
            "step_number": action.step_number,
            "instruction": action.instruction_delivered,
            "status": action.status,
        }
        if action
        else None,
    }


@router.get("/sessions/{id}")
def get_companion_session(id: str, db: Session = Depends(get_db)):
    """Retrieves live assistance session details, messages, actions, and condition updates."""
    session = db.get(EmergencyAssistanceSession, id)
    if not session:
        raise HTTPException(404, "Assistance session not found")

    incident = db.get(Incident, session.incident_id)
    messages = db.scalars(
        select(EmergencyConversationMessage).where(
            EmergencyConversationMessage.session_id == session.id
        ).order_by(EmergencyConversationMessage.created_at)
    ).all()

    actions = db.scalars(
        select(EmergencyAssistanceAction).where(
            EmergencyAssistanceAction.session_id == session.id
        ).order_by(EmergencyAssistanceAction.step_number)
    ).all()

    conditions = db.scalars(
        select(EmergencyConditionUpdate).where(
            EmergencyConditionUpdate.session_id == session.id
        ).order_by(EmergencyConditionUpdate.created_at)
    ).all()

    escalations = db.scalars(
        select(AIEscalationEvent).where(
            AIEscalationEvent.session_id == session.id
        ).order_by(AIEscalationEvent.created_at)
    ).all()

    handover = db.scalar(
        select(EmergencyHandover).where(EmergencyHandover.session_id == session.id)
    )

    protocol_title = None
    if session.current_protocol_id:
        p = db.get(EmergencyProtocol, session.current_protocol_id)
        if p:
            protocol_title = p.title

    return {
        "id": session.id,
        "incident_id": session.incident_id,
        "case_id": incident.case_id if incident else None,
        "incident_category": incident.category if incident else None,
        "incident_address": incident.address if incident else None,
        "status": session.status,
        "channel": session.channel,
        "selected_language": session.selected_language,
        "protocol_id": session.current_protocol_id,
        "protocol_title": protocol_title,
        "current_step_number": session.current_step_number,
        "human_operator_id": session.human_operator_id,
        "created_at": session.created_at.isoformat(),
        "messages": [
            {
                "id": m.id,
                "speaker": m.speaker,
                "language": m.language,
                "content": m.content,
                "step_number": m.step_number,
                "created_at": m.created_at.isoformat(),
            }
            for m in messages
        ],
        "actions": [
            {
                "id": a.id,
                "step_number": a.step_number,
                "instruction": a.instruction_delivered,
                "status": a.status,
                "citizen_confirmation": a.citizen_confirmation_text,
                "delivered_at": a.delivered_at.isoformat(),
                "responded_at": a.responded_at.isoformat() if a.responded_at else None,
            }
            for a in actions
        ],
        "conditions": [
            {
                "id": c.id,
                "reported_by": c.reported_by,
                "condition_type": c.condition_type,
                "description": c.description,
                "severity_change": c.severity_change,
                "created_at": c.created_at.isoformat(),
            }
            for c in conditions
        ],
        "escalations": [
            {
                "id": e.id,
                "reason": e.reason,
                "details": e.details,
                "level": e.escalation_level,
                "acknowledged": bool(e.acknowledged_by),
                "created_at": e.created_at.isoformat(),
            }
            for e in escalations
        ],
        "handover": {
            "id": handover.id,
            "summary_markdown": handover.summary_markdown,
            "actions_completed_count": handover.actions_completed_count,
            "actions_uncompleted_count": handover.actions_uncompleted_count,
            "condition_at_handover": handover.condition_at_handover,
            "verified_by_responder": handover.verified_by_responder,
        }
        if handover
        else None,
    }


@router.get("/incidents/{incident_id}/session")
def get_session_by_incident(incident_id: str, db: Session = Depends(get_db), user=Depends(roles("operator", "admin"))):
    """Retrieves the latest live companion session for a specific incident."""
    get_incident(db, incident_id, user)
    session = db.scalar(
        select(EmergencyAssistanceSession)
        .where(EmergencyAssistanceSession.incident_id == incident_id)
        .order_by(desc(EmergencyAssistanceSession.created_at))
    )
    if not session:
        return {"has_session": False}
    return {
        "has_session": True,
        "session_id": session.id,
        "status": session.status,
        "channel": session.channel,
        "language": session.selected_language,
        "current_step_number": session.current_step_number,
        "human_operator_id": session.human_operator_id,
        "created_at": session.created_at.isoformat(),
    }


@router.post("/sessions/{id}/messages")
def send_companion_message(
    id: str, data: MessageRequest, db: Session = Depends(get_db)
):
    """Processes citizen response and advances first-aid guidance."""
    return EmergencyConversationService.process_citizen_input(
        db, session_id=id, user_message=data.message, language=data.language
    )


@router.post("/sessions/{id}/actions")
def confirm_companion_action(
    id: str, data: ActionConfirmationRequest, db: Session = Depends(get_db)
):
    """Explicitly records citizen action completion or difficulty."""
    session = db.get(EmergencyAssistanceSession, id)
    if not session:
        raise HTTPException(404, "Assistance session not found")

    action = db.scalar(
        select(EmergencyAssistanceAction).where(
            EmergencyAssistanceAction.session_id == session.id,
            EmergencyAssistanceAction.step_number == data.step_number,
        ).order_by(desc(EmergencyAssistanceAction.created_at))
    )
    if not action:
        raise HTTPException(404, f"Action for step {data.step_number} not found")

    action.status = data.status
    action.notes = data.notes
    action.responded_at = now()
    db.commit()

    return {"status": "recorded", "action_id": action.id, "action_status": action.status}


@router.post("/sessions/{id}/conditions")
def report_condition_change(
    id: str, data: ConditionUpdateRequest, db: Session = Depends(get_db)
):
    """Records a patient condition update and triggers escalation if deteriorating."""
    session = db.get(EmergencyAssistanceSession, id)
    if not session:
        raise HTTPException(404, "Assistance session not found")

    update = EmergencyConditionUpdate(
        session_id=session.id,
        reported_by="citizen",
        condition_type=data.condition_type,
        description=data.description,
        severity_change=data.severity_change,
    )
    db.add(update)

    if data.severity_change == "worsened":
        session.status = "escalation_required"
        db.add(
            AIEscalationEvent(
                session_id=session.id,
                incident_id=session.incident_id,
                reason=f"Patient {data.condition_type} worsened",
                details=data.description,
                escalation_level="urgent_dispatch",
            )
        )

    db.commit()
    return {"status": "recorded", "update_id": update.id, "escalated": data.severity_change == "worsened"}


@router.post("/sessions/{id}/escalate")
def escalate_session(id: str, db: Session = Depends(get_db)):
    """Triggers human operator assistance request."""
    session = db.get(EmergencyAssistanceSession, id)
    if not session:
        raise HTTPException(404, "Assistance session not found")

    session.status = "human_assistance_pending"
    event = AIEscalationEvent(
        session_id=session.id,
        incident_id=session.incident_id,
        reason="Human operator requested by citizen",
        details="Citizen requested live human operator assistance.",
        escalation_level="human_takeover",
    )
    db.add(event)
    db.commit()

    return {"status": "escalated", "event_id": event.id, "session_status": session.status}


@router.post("/sessions/{id}/takeover")
def operator_takeover(
    id: str,
    request: Request,
    db: Session = Depends(get_db),
    user=Depends(roles("operator", "admin")),
):
    """Operator takes over the session and halts autonomous AI first-aid guidance."""
    session = db.get(EmergencyAssistanceSession, id)
    if not session:
        raise HTTPException(404, "Assistance session not found")

    get_incident(db, session.incident_id, user)

    session.status = "human_takeover"
    session.human_operator_id = user.id

    db.add(
        EmergencyConversationMessage(
            session_id=session.id,
            speaker="operator",
            language=session.selected_language,
            content=f"Human emergency operator ({user.name}) has taken over this assistance session.",
        )
    )
    db.commit()
    audit(db, "companion.operator_takeover", session.id, user=user, operator=user.name)

    return {"status": "taken_over", "operator_name": user.name, "session_status": session.status}


@router.post("/sessions/{id}/handover")
def complete_handover(
    id: str,
    request: Request,
    db: Session = Depends(get_db),
    user=Depends(roles("operator", "admin", "responder")),
):
    """Records professional medical handover to arriving first responders."""
    session = db.get(EmergencyAssistanceSession, id)
    if not session:
        raise HTTPException(404, "Assistance session not found")

    get_incident(db, session.incident_id, user)

    session.status = "professional_handover"
    session.completed_at = now()

    handover = EmergencyHandoverService.generate_handover(db, session.id)
    handover.responder_id = user.id
    handover.verified_by_responder = True
    db.commit()

    audit(db, "companion.professional_handover", session.id, user=user, responder=user.name)
    return {
        "status": "handover_completed",
        "handover_id": handover.id,
        "summary": handover.summary_markdown,
    }


@router.post("/callbacks")
async def request_outbound_callback(
    data: OutboundCallbackRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Initiates an automatic outbound AI phone callback via Sarvam Voice Agents.
    Enforces explicit citizen consent and idempotency safeguards.
    """
    incident = db.get(Incident, data.incident_id)
    if not incident:
        raise HTTPException(404, "Incident not found")

    if not data.callback_consented:
        raise HTTPException(400, "Explicit citizen consent is mandatory before initiating an outbound phone call.")

    consent = AIAssistanceConsent(
        incident_id=incident.id,
        phone_number=data.phone_number,
        callback_consented=data.callback_consented,
        ai_disclosure_acknowledged=data.ai_disclosure_acknowledged,
        recording_consented=data.recording_consented,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    db.add(consent)
    db.flush()

    session = EmergencyConversationService.start_session(
        db,
        incident_id=incident.id,
        channel="phone_call",
        language=data.language,
    )

    sarvam = SarvamVoiceAgentService()
    try:
        call_res = await sarvam.start_outbound_call(
            phone_number=data.phone_number,
            session_id=session.id,
            incident_id=incident.id,
            language=data.language,
        )
    except RuntimeError as exc:
        call_res = {"status": "failed", "error": str(exc)}

    attempt = AICallbackAttempt(
        session_id=session.id,
        consent_id=consent.id,
        phone_number=data.phone_number,
        provider="sarvam",
        provider_attempt_id=call_res.get("provider_attempt_id"),
        status="dialing" if call_res.get("status") == "initiated" else "failed",
        error_message=call_res.get("error"),
        started_at=now(),
    )
    db.add(attempt)
    db.commit()

    return {
        "status": "call_initiated" if call_res.get("status") == "initiated" else "failed",
        "session_id": session.id,
        "consent_id": consent.id,
        "attempt_id": attempt.id,
        "phone_number": data.phone_number,
        "provider_attempt_id": call_res.get("provider_attempt_id"),
        "error": call_res.get("error"),
    }

from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import select, desc, text
from app.db import get_db
from app.workflow import get_incident
from app.models import (
    Incident,
    EmergencyAssistanceSession,
    EmergencyConversationMessage,
    EmergencyAssistanceAction,
    AIEscalationEvent,
    now,
)
from app.security import limited
from ..videos import find_video_for_situation
from ..ai_service import AICompanionService, LANGUAGE_MAP
from ..schemas import (
    StartCompanionRequest,
    CompanionChatRequest,
    ToggleActionRequest,
)

router = APIRouter(prefix="/companion")


class AssistanceRequest(BaseModel):
    incident_id: str | None = None
    tracking_code: str | None = None
    message: str | None = Field(default=None, max_length=3000)
    language: Literal["en", "te", "hi", "ta", "kn", "ml"] = "en"


@router.post("/start")
async def start_or_resume_companion(
    data: StartCompanionRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Starts or resumes an intelligent multilingual emergency companion session."""
    from app.workflow import tracked

    incident = None
    if data.tracking_code:
        incident = tracked(db, data.tracking_code)
        if data.incident_id and incident.id != data.incident_id:
            raise HTTPException(404, "Incident not found")
    elif data.incident_id:
        from app.security import current
        incident = get_incident(db, data.incident_id, current(request, db))
    else:
        raise HTTPException(400, "Launch AI Companion from a submitted emergency report")

    inc_context = {}
    if incident:
        inc_context = {
            "incident_id": incident.id,
            "case_id": incident.case_id,
            "category": incident.category,
            "description": incident.description,
            "address": incident.address,
            "severity": incident.priority,
            "status": incident.status,
            "people_affected": incident.casualties_count,
            "injuries": incident.injuries_description,
            "immediate_hazards": incident.immediate_hazards,
        }
    lang = data.language if data.language in LANGUAGE_MAP else "en"

    session = None
    if incident:
        session = db.scalar(
            select(EmergencyAssistanceSession)
            .where(EmergencyAssistanceSession.incident_id == incident.id, EmergencyAssistanceSession.channel == "web_voice")
            .order_by(desc(EmergencyAssistanceSession.created_at))
        )

    if session:
        messages = db.scalars(
            select(EmergencyConversationMessage)
            .where(EmergencyConversationMessage.session_id == session.id)
            .order_by(EmergencyConversationMessage.created_at)
        ).all()

        actions = db.scalars(
            select(EmergencyAssistanceAction)
            .where(EmergencyAssistanceAction.session_id == session.id)
            .order_by(EmergencyAssistanceAction.step_number)
        ).all()

        ctx = session.context_json or {}
        video = ctx.get("video")
        if not video and inc_context:
            video = find_video_for_situation(f"{inc_context.get('category', '')} {inc_context.get('description', '')}")

        return {
            "session_id": session.id,
            "resumed": True,
            "incident": inc_context,
            "language": session.selected_language,
            "status": session.status,
            "urgency": ctx.get("urgency", "HIGH"),
            "risk_assessment": ctx.get("risk_assessment", "Emergency situation under active guidance."),
            "actions": [
                {
                    "step_number": a.step_number,
                    "instruction": a.instruction_delivered,
                    "completed": a.status == "completed_by_citizen",
                }
                for a in actions
            ] if actions else ctx.get("actions", []),
            "video": video,
            "messages": [
                {
                    "id": m.id,
                    "speaker": m.speaker,
                    "content": m.content,
                    "created_at": m.created_at.isoformat(),
                }
                for m in messages
            ],
            "audio_base64": None,
        }

    ai_res = await AICompanionService.generate_response(
        incident_context=inc_context,
        conversation_history=[],
        language=lang,
    )

    tts_text = f"{ai_res['message']} {ai_res.get('follow_up_question', '')}"
    speech_res = await AICompanionService.synthesize_speech(tts_text, language=lang)

    session_id = f"sess_{now().strftime('%Y%m%d%H%M%S')}_{lang}"
    if incident:
        session = EmergencyAssistanceSession(
            incident_id=incident.id,
            status="guidance_active",
            channel="web_voice",
            selected_language=lang,
            current_step_number=1,
            context_json={
                "urgency": ai_res.get("urgency", "HIGH"),
                "risk_assessment": ai_res.get("risk_assessment", ""),
                "video": ai_res.get("video"),
                "actions": [
                    {"step_number": idx + 1, "instruction": act, "completed": False}
                    for idx, act in enumerate(ai_res.get("immediate_actions", []))
                ],
            },
        )
        db.add(session)
        db.flush()
        session_id = session.id

        full_msg = f"{ai_res['message']}\n\n{ai_res.get('follow_up_question', '')}".strip()
        db.add(
            EmergencyConversationMessage(
                session_id=session.id,
                speaker="ai",
                language=lang,
                content=full_msg,
                step_number=1,
            )
        )

        for idx, act in enumerate(ai_res.get("immediate_actions", [])):
            db.add(
                EmergencyAssistanceAction(
                    session_id=session.id,
                    step_number=idx + 1,
                    instruction_delivered=act,
                    language=lang,
                    status="delivered",
                )
            )
        db.commit()

    return {
        "session_id": session_id,
        "resumed": False,
        "incident": inc_context,
        "language": lang,
        "status": "guidance_active",
        "urgency": ai_res.get("urgency", "HIGH"),
        "risk_assessment": ai_res.get("risk_assessment", ""),
        "message": ai_res.get("message"),
        "follow_up_question": ai_res.get("follow_up_question", ""),
        "actions": [
            {"step_number": idx + 1, "instruction": act, "completed": False}
            for idx, act in enumerate(ai_res.get("immediate_actions", []))
        ],
        "video": ai_res.get("video"),
        "audio_base64": speech_res.get("audio_base64"),
        "messages": [
            {
                "id": "init_1",
                "speaker": "ai",
                "content": f"{ai_res['message']}\n\n{ai_res.get('follow_up_question', '')}".strip(),
                "created_at": now().isoformat(),
            }
        ],
    }


@router.post("/chat")
async def companion_chat(
    data: CompanionChatRequest,
    db: Session = Depends(get_db),
):
    """Processes citizen input, performs structured AI reasoning, and returns video and audio guidance."""
    session = db.get(EmergencyAssistanceSession, data.session_id)
    if not session:
        raise HTTPException(404, "Emergency assistance session not found")

    incident = db.get(Incident, session.incident_id)
    lang = data.language or session.selected_language or "en"
    session.selected_language = lang

    db.add(
        EmergencyConversationMessage(
            session_id=session.id,
            speaker="citizen",
            language=lang,
            content=data.message,
            step_number=session.current_step_number,
        )
    )
    db.flush()

    history_records = db.scalars(
        select(EmergencyConversationMessage)
        .where(EmergencyConversationMessage.session_id == session.id)
        .order_by(EmergencyConversationMessage.created_at)
    ).all()
    history = [
        {"speaker": m.speaker, "content": m.content}
        for m in history_records[-10:]
    ]

    inc_context = {
        "incident_id": incident.id if incident else session.incident_id,
        "case_id": incident.case_id if incident else "TERA-EMERGENCY",
        "category": incident.category if incident else "medical",
        "description": incident.description if incident else "",
        "address": incident.address if incident else "",
        "severity": incident.priority if incident else "high",
        "status": incident.status if incident else "active",
    }

    ai_res = await AICompanionService.generate_response(
        incident_context=inc_context,
        conversation_history=history,
        user_message=data.message,
        language=lang,
    )

    full_ai_text = f"{ai_res['message']}\n\n{ai_res.get('follow_up_question', '')}".strip()
    session.current_step_number += 1

    db.add(
        EmergencyConversationMessage(
            session_id=session.id,
            speaker="ai",
            language=lang,
            content=full_ai_text,
            step_number=session.current_step_number,
        )
    )

    ctx = session.context_json or {}
    ctx["urgency"] = ai_res.get("urgency", ctx.get("urgency", "HIGH"))
    ctx["risk_assessment"] = ai_res.get("risk_assessment", ctx.get("risk_assessment", ""))
    if ai_res.get("video"):
        ctx["video"] = ai_res["video"]

    existing_actions = db.scalars(
        select(EmergencyAssistanceAction)
        .where(EmergencyAssistanceAction.session_id == session.id)
        .order_by(EmergencyAssistanceAction.step_number)
    ).all()

    existing_texts = {a.instruction_delivered for a in existing_actions}
    curr_max_step = max([a.step_number for a in existing_actions] or [0])

    for act_text in ai_res.get("immediate_actions", []):
        if act_text not in existing_texts:
            curr_max_step += 1
            db.add(
                EmergencyAssistanceAction(
                    session_id=session.id,
                    step_number=curr_max_step,
                    instruction_delivered=act_text,
                    language=lang,
                    status="delivered",
                )
            )

    if ai_res.get("requires_human_escalation"):
        session.status = "escalation_required"
        escalation_reason = "AI companion detected high danger"
        db.add(
            AIEscalationEvent(
                session_id=session.id,
                incident_id=session.incident_id,
                reason=escalation_reason,
                details=(
                    f"Risk assessment: {ai_res.get('risk_assessment', '')}\n"
                    f"Citizen update: {data.message}"
                )[:2000],
                escalation_level="urgent_dispatch",
            )
        )

    session.context_json = ctx
    db.commit()

    speech_res = await AICompanionService.synthesize_speech(
        f"{ai_res['message']} {ai_res.get('follow_up_question', '')}",
        language=lang,
    )

    all_actions = db.scalars(
        select(EmergencyAssistanceAction)
        .where(EmergencyAssistanceAction.session_id == session.id)
        .order_by(EmergencyAssistanceAction.step_number)
    ).all()

    return {
        "session_id": session.id,
        "message": ai_res.get("message"),
        "follow_up_question": ai_res.get("follow_up_question", ""),
        "urgency": ai_res.get("urgency", "HIGH"),
        "risk_assessment": ai_res.get("risk_assessment", ""),
        "actions": [
            {
                "step_number": a.step_number,
                "instruction": a.instruction_delivered,
                "completed": a.status == "completed_by_citizen",
            }
            for a in all_actions
        ],
        "video": ctx.get("video"),
        "audio_base64": speech_res.get("audio_base64"),
        "requires_human_escalation": ai_res.get("requires_human_escalation", False),
    }


@router.post("/actions/toggle")
def toggle_action_completed(
    data: ToggleActionRequest,
    db: Session = Depends(get_db),
):
    """Toggles completion status for an emergency action checklist item."""
    session = db.get(EmergencyAssistanceSession, data.session_id)
    if not session:
        return {"status": "ok", "completed": data.completed}

    action = db.scalar(
        select(EmergencyAssistanceAction).where(
            EmergencyAssistanceAction.session_id == session.id,
            EmergencyAssistanceAction.step_number == data.step_number,
        )
    )
    if action:
        action.status = "completed_by_citizen" if data.completed else "delivered"
        action.responded_at = now()
        db.commit()
        return {"status": "updated", "step_number": data.step_number, "completed": data.completed}

    return {"status": "not_found", "step_number": data.step_number}


@router.post("/assist")
async def persistent_assistance(data: AssistanceRequest, request: Request, db: Session = Depends(get_db)):
    from app.security import current
    from app.workflow import tracked, record
    from app.speech.intelligence import extract_context
    from ..guidance import guidance_for, CALL
    limited("assistance:" + (request.client.host if request.client else "unknown"), 120, 3600)
    if data.tracking_code:
        incident = tracked(db, data.tracking_code)
        if data.incident_id and incident.id != data.incident_id:
            raise HTTPException(404, "Incident not found")
    else:
        user = current(request, db)
        if user.role == "citizen":
            raise HTTPException(403, "Use the private tracking code for this report")
        incident = get_incident(db, data.incident_id or "", user)

    locked = True
    if db.bind and db.bind.dialect.name == "postgresql":
        locked = db.scalar(text("SELECT pg_try_advisory_xact_lock(hashtextextended(:key, 0))"), {"key": "companion:" + incident.id})
    if not locked:
        raise HTTPException(409, "Another update is being saved. Please retry shortly.")
    session = db.scalar(select(EmergencyAssistanceSession).where(
        EmergencyAssistanceSession.incident_id == incident.id,
        EmergencyAssistanceSession.channel == "web_text").order_by(desc(EmergencyAssistanceSession.created_at)))
    if not session:
        session = EmergencyAssistanceSession(incident_id=incident.id, channel="web_text", selected_language=data.language,
            status="guidance_active", context_json={"guidance": guidance_for()})
        db.add(session)
        db.flush()
        db.add(EmergencyConversationMessage(session_id=session.id, speaker="ai", language="en", content=CALL))
    if data.message and data.message.strip():
        session.selected_language = data.language
        history = db.scalars(select(EmergencyConversationMessage).where(
            EmergencyConversationMessage.session_id == session.id,
            EmergencyConversationMessage.speaker == "citizen").order_by(desc(EmergencyConversationMessage.created_at)).limit(30)).all()
        context = incident.description + "\nLocation: " + incident.address + "\n" + "\n".join(m.content for m in reversed(history)) + "\n" + data.message
        extraction = await extract_context(context, data.language)
        guidance = guidance_for(extraction.guidance_topic, extraction.patient_group)
        reply = "\n".join(extraction.follow_up_questions) or "Your update is saved with this case. Review the source-based guidance below and follow the emergency dispatcher."
        db.add(EmergencyConversationMessage(session_id=session.id, speaker="citizen", language=data.language, content=data.message))
        db.add(EmergencyConversationMessage(session_id=session.id, speaker="ai", language=data.language, content=reply))
        db.add(EmergencyConversationMessage(session_id=session.id, speaker="system", language="en", content="\n".join(guidance["steps"]) + "\nSource: " + guidance["source_url"]))
        session.context_json = {"extraction": extraction.model_dump(), "guidance": guidance}
        record(db, "incident.citizen_update", incident, summary=extraction.description,
            assistance_needed=extraction.assistance_needed, recommended_priority=extraction.severity)
    elif not session.context_json.get("extraction"):
        from app.models import IncidentExtraction
        saved = db.scalar(select(IncidentExtraction).where(IncidentExtraction.incident_id == incident.id))
        facts = saved.extracted_json if saved else {}
        session.context_json = {"extraction": facts, "guidance": guidance_for(facts.get("guidance_topic", "general"), facts.get("patient_group", "unknown"))}
    db.commit()
    messages = db.scalars(select(EmergencyConversationMessage).where(EmergencyConversationMessage.session_id == session.id).order_by(EmergencyConversationMessage.created_at)).all()
    return {"session_id": session.id, "case_id": incident.case_id, "status": incident.status,
        **session.context_json, "messages": [{"id": m.id, "speaker": m.speaker, "content": m.content} for m in messages]}


@router.get("/guidance/{topic}")
def source_guidance(topic: str, patient_group: str = "unknown"):
    from ..guidance import guidance_for
    return guidance_for(topic, patient_group)

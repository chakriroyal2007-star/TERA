"""Continuous First-Aid Conversation & Protocol Decision Engine.

Core Responsibilities:
1. Retrieval of approved medical protocols without LLM hallucination.
2. Step-by-step guidance execution: one instruction at a time, verify confirmation.
3. Patient condition change assessment and automated escalation.
4. Structured professional handover compilation for arriving EMS responders.
"""

from datetime import datetime, timezone
import re
from typing import Literal
from sqlalchemy.orm import Session
from sqlalchemy import select, desc
from app.models import (
    Incident,
    EmergencyProtocol,
    EmergencyProtocolVersion,
    EmergencyProtocolStep,
    EmergencyProtocolTranslation,
    EmergencyAssistanceSession,
    EmergencyConversationMessage,
    EmergencyAssistanceAction,
    EmergencyConditionUpdate,
    AIEscalationEvent,
    EmergencyHandover,
    now,
)

# AI Identity and Disclaimer in all 6 supported languages
DISCLOSURES = {
    "en": "I am TERA's AI Emergency First-Aid Companion. I will guide you step-by-step through safe, approved first-aid actions while emergency responders are being dispatched. I am an AI, not a doctor. Take a deep breath, stay calm, and follow one step at a time.",
    "te": "నేను టెరా (TERA) ఏఐ ఎమర్జెన్సీ ప్రథమ చికిత్స సహాయకుడిని. అంబులెన్స్ వచ్చేలోపు సురక్షితమైన ప్రథమ చికిత్స చర్యలను ఒక్కొక్కటిగా వివరిస్తాను. నేను వైద్యుడిని కాదు, ఏఐ సహాయకుడిని. ప్రశాంతంగా ఉండండి.",
    "hi": "मैं टेरा (TERA) का एआई आपातकालीन प्राथमिक चिकित्सा साथी हूँ। एम्बुलेंस आने तक मैं आपको सुरक्षित प्राथमिक उपचार के निर्देश दूंगा। मैं डॉक्टर नहीं, एआई सहायक हूँ। शांत रहें।",
    "ta": "நான் டெரா (TERA) அவசரகால முதலுதவி AI உதவியாளர். ஆம்புலன்ஸ் வரும் வரை பாதுகாப்பான முதலுதவி நடவடிக்கைகளை படிப்படியாக வழிகாட்டுகிறேன். நான் மருத்துவர் அல்ல. அமைதியாக இருங்கள்.",
    "kn": "ನಾನು ಟೆರಾ (TERA) ಎಐ ತುರ್ತು ಪ್ರಥಮ ಚಿಕಿತ್ಸಾ ಸಹಾಯಕ. ತುರ್ತು ವಾಹನ ಬರುವವರೆಗೆ ಸುರಕ್ಷಿತ ಪ್ರಥಮ ಚಿಕಿತ್ಸಾ ಕ್ರಮಗಳನ್ನು ಮಾರ್ಗದರ್ಶನ ಮಾಡುತ್ತೇನೆ. ನಾನು ವೈದ್ಯನಲ್ಲ. ಶಾಂತವಾಗಿರಿ.",
    "ml": "ഞാൻ ടെറ (TERA) എഐ അടിയന്തര പ്രഥമശുശ്രൂഷാ സഹായിയാണ്. ആംബുലൻസ് എത്തുന്നതുവരെ സുരಕ್ಷിതമായ പ്രഥമശുശ്രൂഷാ ഘട്ടങ്ങളിലൂടെ ഞാൻ നിങ്ങളെ നയിക്കും. ഞാൻ ഡോക്ടറല്ല. ശാന്തരായിരിക്കുക.",
}


class EmergencyRetrievalService:
    """Matches emergencies strictly against medically approved protocols."""

    @staticmethod
    def match_protocol(
        db: Session, category: str, description: str
    ) -> EmergencyProtocol | None:
        """
        Retrieves the highest-priority applicable approved emergency protocol.
        Never hallucinates unapproved treatments.
        """
        text = f"{category} {description}".lower()

        # Priority 1: Cardiac arrest / absent breathing
        if any(k in text for k in ("unresponsive", "not breathing", "cardiac", "heart attack", "collapsed", "స్పృహ లేదు", "శ్వాస లేదు", "बेहोश")):
            p = db.scalar(select(EmergencyProtocol).where(EmergencyProtocol.id == "PROT-CARDIAC-CPR", EmergencyProtocol.status == "approved"))
            if p:
                return p

        # Priority 2: Severe bleeding / spurting blood
        if any(k in text for k in ("bleeding", "blood", "arterial", "wound", "రక్తం", "రక్తస్రావం", "खून", "रक्त")):
            p = db.scalar(select(EmergencyProtocol).where(EmergencyProtocol.id == "PROT-BLEEDING-DIRECT", EmergencyProtocol.status == "approved"))
            if p:
                return p

        # Priority 3: Choking / airway obstruction
        if any(k in text for k in ("choking", "swallowed", "throat", "గొంతు", "గಂಟಲು", "गले में", "തൊണ്ടയിൽ")):
            p = db.scalar(select(EmergencyProtocol).where(EmergencyProtocol.id == "PROT-BREATHING-CHOKING", EmergencyProtocol.status == "approved"))
            if p:
                return p

        # Priority 4: Road accidents / collisions
        if any(k in text for k in ("road_collision", "accident", "crash", "car", "truck", "bike", "collision", "ప్రమాదం", "दुर्घटना", "விபத்து", "ಅಪಘಾತ", "അപകടം")):
            p = db.scalar(select(EmergencyProtocol).where(EmergencyProtocol.id == "PROT-ROAD-COLLISION", EmergencyProtocol.status == "approved"))
            if p:
                return p

        # Priority 5: Burns
        if any(k in text for k in ("burn", "fire", "scald", "steam", "కాలింది", "जलना", "தீக்காயம்", "ಸುಟ್ಟಿದೆ", "പൊള്ളൽ")):
            p = db.scalar(select(EmergencyProtocol).where(EmergencyProtocol.id == "PROT-BURNS-THERMAL", EmergencyProtocol.status == "approved"))
            if p:
                return p

        # Priority 6: Seizures / convulsions
        if any(k in text for k in ("seizure", "convulsion", "jerking", "fits", "వణుకు", "दौरा", "வலிப்பு", "ಫಿಟ್ಸ್")):
            p = db.scalar(select(EmergencyProtocol).where(EmergencyProtocol.id == "PROT-SEIZURE-CARE", EmergencyProtocol.status == "approved"))
            if p:
                return p

        # Priority 7: Electrical shock
        if any(k in text for k in ("electric", "shock", "wire", "current", "విద్యుత్", "करंट", "மின்சாரம்")):
            p = db.scalar(select(EmergencyProtocol).where(EmergencyProtocol.id == "PROT-ELECTRICAL-SHOCK", EmergencyProtocol.status == "approved"))
            if p:
                return p

        # Priority 8: Drowning
        if any(k in text for k in ("drowning", "water", "submerged", "నీటిలో", "पानी में")):
            p = db.scalar(select(EmergencyProtocol).where(EmergencyProtocol.id == "PROT-DROWNING-RESCUE", EmergencyProtocol.status == "approved"))
            if p:
                return p

        # Priority 9: Fractures / falls
        if any(k in text for k in ("fall", "fracture", "broken", "bone", "విరిగింది", "ಹರಿದಿದೆ", "ಹಾನಿ", "எலும்பு முறிவு")):
            p = db.scalar(select(EmergencyProtocol).where(EmergencyProtocol.id == "PROT-FRACTURES-IMMOBILIZE", EmergencyProtocol.status == "approved"))
            if p:
                return p

        # Priority 10: Poisoning
        if any(k in text for k in ("poison", "chemical", "pesticide", "overdose", "విషం", "विष")):
            p = db.scalar(select(EmergencyProtocol).where(EmergencyProtocol.id == "PROT-POISONING-INGESTION", EmergencyProtocol.status == "approved"))
            if p:
                return p

        # Fallback to category match if approved
        p_by_cat = db.scalar(
            select(EmergencyProtocol).where(
                EmergencyProtocol.category == category,
                EmergencyProtocol.status == "approved",
            )
        )
        return p_by_cat


class EmergencyConversationService:
    """Manages continuous stateful first-aid conversation flow."""

    @staticmethod
    def start_session(
        db: Session,
        incident_id: str,
        channel: Literal["web_voice", "phone_call", "web_text"] = "web_voice",
        language: str = "en",
        citizen_id: str | None = None,
    ) -> EmergencyAssistanceSession:
        """Initializes a continuous first-aid assistance session."""
        incident = db.get(Incident, incident_id)
        if not incident:
            raise ValueError(f"Incident {incident_id} not found.")

        # Clean language code
        lang = language if language in ("en", "te", "hi", "ta", "kn", "ml") else "en"

        # Match approved protocol
        protocol = EmergencyRetrievalService.match_protocol(
            db, incident.category, incident.description
        )

        version = None
        first_step = None
        step_number = 0
        protocol_id = None
        version_id = None
        step_id = None

        if protocol:
            protocol_id = protocol.id
            version = db.scalar(
                select(EmergencyProtocolVersion).where(
                    EmergencyProtocolVersion.protocol_id == protocol.id,
                    EmergencyProtocolVersion.medical_approval_status == "approved",
                ).order_by(desc(EmergencyProtocolVersion.version_number))
            )
            if version:
                version_id = version.id
                first_step = db.scalar(
                    select(EmergencyProtocolStep).where(
                        EmergencyProtocolStep.version_id == version.id,
                        EmergencyProtocolStep.step_number == 1,
                    )
                )
                if first_step:
                    step_id = first_step.id
                    step_number = 1

        session = EmergencyAssistanceSession(
            incident_id=incident.id,
            citizen_id=citizen_id,
            status="guidance_active" if first_step else "initial_assessment",
            channel=channel,
            selected_language=lang,
            current_protocol_id=protocol_id,
            current_version_id=version_id,
            current_step_id=step_id,
            current_step_number=step_number,
        )
        db.add(session)
        db.flush()

        # Add initial AI greeting & disclosure message
        greeting = DISCLOSURES.get(lang, DISCLOSURES["en"])
        db.add(
            EmergencyConversationMessage(
                session_id=session.id,
                speaker="ai",
                language=lang,
                content=greeting,
                step_number=0,
            )
        )

        # If a protocol step is active, deliver step 1 instruction
        if first_step:
            step_instruction = EmergencyConversationService.get_step_instruction(
                db, version.id, first_step.id, lang
            )
            db.add(
                EmergencyConversationMessage(
                    session_id=session.id,
                    speaker="ai",
                    language=lang,
                    content=f"Step 1: {step_instruction}",
                    step_number=1,
                )
            )
            db.add(
                EmergencyAssistanceAction(
                    session_id=session.id,
                    step_id=first_step.id,
                    step_number=1,
                    instruction_delivered=step_instruction,
                    language=lang,
                    status="delivered",
                )
            )

        db.commit()
        return session

    @staticmethod
    def get_step_instruction(
        db: Session, version_id: str, step_id: str, language: str
    ) -> str:
        """Fetches the approved translation for a protocol step in the target language."""
        step = db.get(EmergencyProtocolStep, step_id)
        if not step:
            return "Please keep the person still, safe, and warm until emergency services arrive."

        if language != "en":
            trans = db.scalar(
                select(EmergencyProtocolTranslation).where(
                    EmergencyProtocolTranslation.version_id == version_id,
                    EmergencyProtocolTranslation.step_id == step_id,
                    EmergencyProtocolTranslation.language == language,
                )
            )
            if trans and trans.translated_instruction:
                return trans.translated_instruction

        return step.instruction_text

    @staticmethod
    def process_citizen_input(
        db: Session,
        session_id: str,
        user_message: str,
        language: str | None = None,
    ) -> dict:
        """
        Processes a citizen's spoken or text response mid-assistance.
        Evaluates action completion, worsening conditions, or professional arrival.
        Returns the next appropriate approved first-aid step.
        """
        session = db.get(EmergencyAssistanceSession, session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found.")

        lang = language or session.selected_language or "en"
        session.selected_language = lang

        # Record incoming citizen message
        db.add(
            EmergencyConversationMessage(
                session_id=session.id,
                speaker="citizen",
                language=lang,
                content=user_message,
                step_number=session.current_step_number,
            )
        )

        lower = user_message.lower()

        # 1. Professional arrival check
        if any(k in lower for k in ("ambulance arrived", "paramedic", "doctor is here", "responder here", "వచ్చింది", "आ गई", "வந்தாச்சு", "ಬಂದಿದೆ")):
            session.status = "professional_handover"
            session.completed_at = now()
            handover = EmergencyHandoverService.generate_handover(db, session.id)
            reply = "Professional emergency responders are on scene. Please hand over care to the medical team immediately. A complete handover summary has been recorded."
            db.add(
                EmergencyConversationMessage(
                    session_id=session.id,
                    speaker="ai",
                    language=lang,
                    content=reply,
                )
            )
            db.commit()
            return {
                "session_id": session.id,
                "status": session.status,
                "ai_reply": reply,
                "handover_id": handover.id,
                "is_handover": True,
            }

        # 2. Deterioration / Condition change check
        is_worsening = any(k in lower for k in ("worse", "worsened", "stopped breathing", "bleeding more", "unconscious now", "choking worse", "తీవ్రమైంది", "రక్తం ఎక్కువైంది", "सांस रुक गई", "உயிர் ஆபத்து"))
        if is_worsening:
            db.add(
                EmergencyConditionUpdate(
                    session_id=session.id,
                    reported_by="citizen",
                    condition_type="general",
                    description=user_message,
                    severity_change="worsened",
                )
            )
            db.add(
                AIEscalationEvent(
                    session_id=session.id,
                    incident_id=session.incident_id,
                    reason="Patient condition deterioration reported by citizen",
                    details=user_message,
                    escalation_level="urgent_dispatch",
                )
            )
            session.status = "escalation_required"
            escalate_reply = "I have immediately alerted emergency dispatch to your worsening condition. Stay on the line. Ensure the airway is clear."
            db.add(
                EmergencyConversationMessage(
                    session_id=session.id,
                    speaker="ai",
                    language=lang,
                    content=escalate_reply,
                )
            )
            db.commit()
            return {
                "session_id": session.id,
                "status": session.status,
                "ai_reply": escalate_reply,
                "escalated": True,
            }

        # 3. Action confirmation check
        is_confirmed = any(k in lower for k in ("done", "completed", "pressed", "yes", "did it", "ok", "సరే", "చేశాను", "అయింది", "हो गया", "कर दिया", "செய்தேன்", "ಆಗಿದೆ", "ಮಾಡಿದೆ", "ചെയ്തു"))

        # Find latest action in this session
        action = db.scalar(
            select(EmergencyAssistanceAction).where(
                EmergencyAssistanceAction.session_id == session.id,
                EmergencyAssistanceAction.step_number == session.current_step_number,
            ).order_by(desc(EmergencyAssistanceAction.created_at))
        )

        if action and is_confirmed:
            action.status = "completed_by_citizen"
            action.citizen_confirmation_text = user_message
            action.responded_at = now()

        # Advance to next protocol step
        next_step_num = session.current_step_number + 1
        next_step = None
        if session.current_version_id:
            next_step = db.scalar(
                select(EmergencyProtocolStep).where(
                    EmergencyProtocolStep.version_id == session.current_version_id,
                    EmergencyProtocolStep.step_number == next_step_num,
                )
            )

        if next_step:
            session.current_step_id = next_step.id
            session.current_step_number = next_step_num
            step_instruction = EmergencyConversationService.get_step_instruction(
                db, session.current_version_id, next_step.id, lang
            )
            ai_reply = f"Step {next_step_num}: {step_instruction}"
            db.add(
                EmergencyConversationMessage(
                    session_id=session.id,
                    speaker="ai",
                    language=lang,
                    content=ai_reply,
                    step_number=next_step_num,
                )
            )
            db.add(
                EmergencyAssistanceAction(
                    session_id=session.id,
                    step_id=next_step.id,
                    step_number=next_step_num,
                    instruction_delivered=step_instruction,
                    language=lang,
                    status="delivered",
                )
            )
        else:
            # Protocol complete; maintain continuous reassuring monitoring
            session.status = "awaiting_citizen_response"
            ai_reply = "You have completed all immediate first-aid steps. Continue monitoring the person's breathing. Keep them warm and stay by their side. I am staying right here with you until the ambulance arrives. Tell me if anything changes."
            db.add(
                EmergencyConversationMessage(
                    session_id=session.id,
                    speaker="ai",
                    language=lang,
                    content=ai_reply,
                    step_number=session.current_step_number,
                )
            )

        db.commit()
        return {
            "session_id": session.id,
            "status": session.status,
            "current_step_number": session.current_step_number,
            "ai_reply": ai_reply,
            "action_confirmed": is_confirmed,
        }


class EmergencyHandoverService:
    """Generates structured clinical handover summaries for arriving medical teams."""

    @staticmethod
    def generate_handover(db: Session, session_id: str) -> EmergencyHandover:
        session = db.get(EmergencyAssistanceSession, session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found.")

        incident = db.get(Incident, session.incident_id)

        # Count completed and pending actions
        actions = db.scalars(
            select(EmergencyAssistanceAction).where(
                EmergencyAssistanceAction.session_id == session.id
            )
        ).all()
        completed = sum(1 for a in actions if a.status == "completed_by_citizen")
        uncompleted = len(actions) - completed

        # Get condition updates
        conditions = db.scalars(
            select(EmergencyConditionUpdate).where(
                EmergencyConditionUpdate.session_id == session.id
            )
        ).all()
        cond_text = "; ".join(f"{c.condition_type}: {c.description}" for c in conditions) or "Stable as initially reported"

        # Protocol title
        protocol_title = "Standard Emergency Protocol"
        if session.current_protocol_id:
            p = db.get(EmergencyProtocol, session.current_protocol_id)
            if p:
                protocol_title = p.title

        summary = f"""# TERA Clinical Emergency Handover Report
**Case ID**: {incident.case_id if incident else 'N/A'}
**Incident Category**: {incident.category.upper() if incident else 'UNKNOWN'}
**Location**: {incident.address if incident else 'Not recorded'}
**Assistance Channel**: {session.channel} (Language: {session.selected_language})
**Protocol Executed**: {protocol_title}
**Assistance Duration**: Started at {session.created_at.strftime('%H:%M:%S UTC')}

### First-Aid Actions Delivered:
- **Completed by Citizen**: {completed}
- **Incomplete / Awaiting**: {uncompleted}

### Reported Condition Changes:
{cond_text}

*Handover generated automatically by TERA AI Emergency First-Aid Companion upon arrival of medical responders.*
"""

        handover = db.scalar(
            select(EmergencyHandover).where(EmergencyHandover.session_id == session.id)
        )
        if not handover:
            handover = EmergencyHandover(
                session_id=session.id,
                incident_id=session.incident_id,
                summary_markdown=summary,
                actions_completed_count=completed,
                actions_uncompleted_count=uncompleted,
                condition_at_handover=cond_text,
                protocols_used=[protocol_title],
                verified_by_responder=False,
            )
            db.add(handover)
        else:
            handover.summary_markdown = summary
            handover.actions_completed_count = completed
            handover.actions_uncompleted_count = uncompleted
            handover.condition_at_handover = cond_text

        db.commit()
        return handover


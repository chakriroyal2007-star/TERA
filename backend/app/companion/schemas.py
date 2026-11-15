import hmac
from typing import Literal
from fastapi import HTTPException, Request
from pydantic import BaseModel, Field
from app.config import settings


def provider_auth(request: Request):
    secret = settings().sarvam_webhook_secret
    supplied = request.headers.get("authorization", "")
    if not secret or not hmac.compare_digest(supplied, "Bearer " + secret):
        raise HTTPException(401, "Provider authentication required")


class CreateSessionRequest(BaseModel):
    incident_id: str
    channel: Literal["web_voice", "phone_call", "web_text"] = "web_voice"
    language: Literal["en", "te", "hi", "ta", "kn", "ml"] = "en"


class MessageRequest(BaseModel):
    message: str = Field(min_length=1, max_length=5000)
    language: Literal["en", "te", "hi", "ta", "kn", "ml"] | None = None


class ActionConfirmationRequest(BaseModel):
    step_number: int
    status: Literal["completed_by_citizen", "not_completed", "uncertain", "escalated"]
    notes: str | None = None


class ConditionUpdateRequest(BaseModel):
    condition_type: str = Field(description="e.g. consciousness, breathing, bleeding, pain")
    description: str = Field(min_length=1, max_length=2000)
    severity_change: Literal["worsened", "stable", "improved"] = "worsened"


class OutboundCallbackRequest(BaseModel):
    incident_id: str
    phone_number: str = Field(min_length=10, max_length=20)
    language: Literal["en", "te", "hi", "ta", "kn", "ml"] = "en"
    callback_consented: bool = True
    ai_disclosure_acknowledged: bool = True
    recording_consented: bool = True


class ProtocolReviewRequest(BaseModel):
    reviewer_medical_qualification: str = Field(min_length=3, max_length=200)
    decision: Literal["approved", "rejected", "revisions_requested"]
    comments: str = Field(min_length=5, max_length=2000)


class StartCompanionRequest(BaseModel):
    incident_id: str | None = None
    tracking_code: str | None = None
    category: str | None = None
    description: str | None = None
    language: Literal["en", "te", "hi", "ta", "kn", "ml"] = "en"


class CompanionChatRequest(BaseModel):
    session_id: str
    message: str = Field(min_length=1, max_length=5000)
    language: Literal["en", "te", "hi", "ta", "kn", "ml"] | None = None


class ToggleActionRequest(BaseModel):
    session_id: str
    step_number: int
    completed: bool


class EscalateCompanionRequest(BaseModel):
    session_id: str
    reason: str | None = "Citizen requested emergency operator escalation."


class SpeechRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    language: Literal["en", "te", "hi", "ta", "kn", "ml"] = "en"

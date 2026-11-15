from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import select, desc
from app.db import get_db
from app.models import (
    EmergencyProtocol,
    EmergencyProtocolVersion,
    EmergencyProtocolStep,
    EmergencyProtocolTranslation,
    EmergencyProtocolReview,
    now,
)
from app.security import roles, audit
from ..schemas import ProtocolReviewRequest

router = APIRouter(prefix="/companion")


@router.get("/protocols")
def list_protocols(db: Session = Depends(get_db)):
    """Lists all emergency protocols in the knowledge base."""
    protocols = db.scalars(
        select(EmergencyProtocol).order_by(EmergencyProtocol.category)
    ).all()
    return [
        {
            "id": p.id,
            "category": p.category,
            "subtype": p.subtype,
            "title": p.title,
            "summary": p.summary,
            "status": p.status,
            "patient_group": p.applicable_patient_group,
        }
        for p in protocols
    ]


@router.get("/protocols/{id}")
def get_protocol_detail(id: str, db: Session = Depends(get_db)):
    """Retrieves full protocol details, steps, and translations."""
    protocol = db.get(EmergencyProtocol, id)
    if not protocol:
        raise HTTPException(404, "Protocol not found")

    versions = db.scalars(
        select(EmergencyProtocolVersion).where(
            EmergencyProtocolVersion.protocol_id == protocol.id
        ).order_by(desc(EmergencyProtocolVersion.version_number))
    ).all()

    ver = versions[0] if versions else None
    steps = []
    if ver:
        steps_raw = db.scalars(
            select(EmergencyProtocolStep).where(
                EmergencyProtocolStep.version_id == ver.id
            ).order_by(EmergencyProtocolStep.step_number)
        ).all()
        for s in steps_raw:
            translations = db.scalars(
                select(EmergencyProtocolTranslation).where(
                    EmergencyProtocolTranslation.step_id == s.id
                )
            ).all()
            steps.append({
                "step_number": s.step_number,
                "title": s.instruction_title,
                "text": s.instruction_text,
                "warning": s.danger_warning,
                "escalation": s.escalation_trigger,
                "translations": {t.language: t.translated_instruction for t in translations},
            })

    return {
        "id": protocol.id,
        "category": protocol.category,
        "subtype": protocol.subtype,
        "title": protocol.title,
        "summary": protocol.summary,
        "status": protocol.status,
        "recognition_criteria": protocol.recognition_criteria,
        "contraindications": protocol.contraindications,
        "version": ver.version_number if ver else 1,
        "approval_status": ver.medical_approval_status if ver else "draft",
        "steps": steps,
    }


@router.post("/protocols/{id}/review")
def review_protocol(
    id: str,
    data: ProtocolReviewRequest,
    request: Request,
    db: Session = Depends(get_db),
    user=Depends(roles("admin")),
):
    """Medical reviewer approves, rejects, or requests changes on a protocol."""
    protocol = db.get(EmergencyProtocol, id)
    if not protocol:
        raise HTTPException(404, "Protocol not found")

    ver = db.scalar(
        select(EmergencyProtocolVersion).where(
            EmergencyProtocolVersion.protocol_id == protocol.id
        ).order_by(desc(EmergencyProtocolVersion.version_number))
    )
    if not ver:
        raise HTTPException(404, "Protocol version not found")

    review = EmergencyProtocolReview(
        version_id=ver.id,
        reviewer_id=user.id,
        reviewer_medical_qualification=data.reviewer_medical_qualification,
        decision=data.decision,
        comments=data.comments,
    )
    db.add(review)

    if data.decision == "approved":
        ver.medical_approval_status = "approved"
        ver.approved_by_id = user.id
        ver.approved_at = now()
        protocol.status = "approved"
    elif data.decision == "rejected":
        ver.medical_approval_status = "rejected"
        protocol.status = "draft"

    db.commit()
    audit(db, "companion.protocol_reviewed", protocol.id, user=user, decision=data.decision, reviewer=user.name)

    return {
        "status": "review_recorded",
        "decision": data.decision,
        "protocol_id": protocol.id,
        "protocol_status": protocol.status,
    }

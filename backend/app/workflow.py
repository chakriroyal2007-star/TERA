import secrets, math
from datetime import timedelta
from pathlib import Path
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import select, func, or_, text
from .config import settings
from .db import get_db
from .models import (
    Incident,
    Report,
    Event,
    User,
    Ambulance,
    Mission,
    Hospital,
    Department,
    Capacity,
    Referral,
    Reservation,
    VoiceRecording,
    IncidentExtraction,
    Evidence,
    IncidentStatusHistory,
    now,
)
from .security import roles, scope, digest, limited, audit

router = APIRouter(tags=["Emergency workflow"])
OPS = ("operator", "admin")
STAFF = ("operator", "admin", "hospital", "responder", "analyst")


def generate_case_id(db) -> str:
    year = now().year
    prefix = f"TERA-{year}-"
    import random
    import time

    # Fetch existing case_ids to guarantee absolute uniqueness across all distributed serverless instances
    existing = set(db.scalars(select(Incident.case_id).where(Incident.case_id.like(f"{prefix}%"))).all())

    for _ in range(100):
        val = random.randint(100000, 999999)
        candidate = f"{prefix}{val}"
        if candidate not in existing:
            return candidate

    return f"{prefix}{int(time.time() * 1000) % 1000000:06d}"


class Location(BaseModel):
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)

    @model_validator(mode="after")
    def paired(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Supply both coordinates or neither")
        return self


class IncidentCreate(Location):
    category: Literal["medical", "road_collision", "fire", "disaster", "other"]
    description: str = Field(min_length=10, max_length=5000)
    address: str = Field(min_length=3, max_length=500)
    casualties_count: int | None = None
    injuries_description: str | None = None
    severity: Literal["low", "medium", "high", "critical"] | None = None
    detected_language: str | None = None
    english_translation: str | None = None
    vehicles_involved: str | None = None
    immediate_hazards: str | None = None
    requested_assistance: str | None = None
    citizen_contact: str | None = None
    recording_id: str | None = None
    evidence_ids: list[str] = Field(default_factory=list)
    idempotency_key: str | None = None


class Note(BaseModel):
    text: str = Field(min_length=3, max_length=3000)


class Verify(BaseModel):
    priority: Literal["low", "medium", "high", "critical"]
    note: str = Field(min_length=3, max_length=1000)


class Dispatch(BaseModel):
    ambulance_id: str
    responder_id: str


class Progress(BaseModel):
    status: Literal["acknowledged", "en_route", "on_scene", "transporting", "handover", "completed"]
    note: str = Field(default="", max_length=1000)


class ReferralCreate(BaseModel):
    capacity_id: str


class Decision(BaseModel):
    accept: bool
    reason: str = Field(min_length=3, max_length=1000)


class CapacityUpdate(BaseModel):
    total: int = Field(ge=0, le=100000)
    occupied: int = Field(ge=0, le=100000)


class Duplicate(BaseModel):
    duplicate_of: str
    note: str = Field(min_length=3, max_length=1000)


def serial(obj):
    result = {
        c.name: getattr(obj, c.name)
        for c in obj.__table__.columns
        if c.name not in ("tracking_hash", "password_hash", "google_subject", "mfa_secret", "mfa_last_step")
    }
    if isinstance(obj, User):
        result.update(role=obj.role, organization_id=obj.organization_id)
    return result


def record(db, event_kind, incident=None, user=None, event_scope=None, **payload):
    # Serialize event ID allocation through commit on Postgres; safe no-op on SQLite
    try:
        if db.bind and db.bind.dialect.name == "postgresql":
            db.execute(text("SELECT pg_advisory_xact_lock(84637201)"))
    except Exception:
        pass
    db.add(
        Event(
            kind=event_kind,
            incident_id=incident.id if incident else None,
            organization_id=event_scope
            if event_scope is not None
            else (incident.organization_id if incident else (user.organization_id if user else None)),
            actor_id=user.id if user else None,
            payload=payload,
        )
    )
    audit(db, event_kind, incident.id if incident else payload.get("id", ""), user, **payload)


def get_incident(db, id, user=None, lock=False):
    norm = id.strip()
    q = select(Incident).where(
        or_(
            Incident.id == norm,
            Incident.case_id == norm.upper(),
        )
    )
    i = db.scalar(q.with_for_update() if lock else q)
    if not i:
        raise HTTPException(404, "Incident not found")
    if user and i.organization_id is None and user.role in OPS:
        return i
    if user and user.role == "responder":
        if not db.scalar(select(Mission.id).where(Mission.incident_id == i.id, Mission.responder_id == user.id)):
            raise HTTPException(404, "Incident not found")
    elif user and user.role == "hospital":
        found = db.scalar(
            select(Referral.id)
            .join(Capacity)
            .join(Department)
            .join(Hospital)
            .where(Referral.incident_id == i.id, Hospital.organization_id == user.organization_id)
        )
        if not found:
            raise HTTPException(404, "Incident not found")
    elif user:
        scope(user, i.organization_id)
    return i


def tracked(db, code: str):
    norm = code.strip()
    i = db.scalar(
        select(Incident).where(
            or_(
                Incident.tracking_hash == digest(norm),
                Incident.case_id == norm.upper(),
                Incident.id == norm,
            )
        )
    )
    if not i:
        raise HTTPException(404, "Tracking code not found")
    return i


@router.post("/public/incidents", status_code=201)
@router.post("/incidents", status_code=201)
def report(data: IncidentCreate, request: Request, db=Depends(get_db)):
    limited("report:" + request.client.host, 300, 3600)

    # Idempotency check
    idem_key = data.idempotency_key or request.headers.get("Idempotency-Key") or request.headers.get("X-Idempotency-Key")
    if idem_key:
        existing = db.scalar(select(Incident).where(Incident.idempotency_key == idem_key))
        if existing:
            return {
                "id": existing.id,
                "case_id": existing.case_id,
                "tracking_code": f"TRK-{existing.id[:8].upper()}",
                "status": existing.status,
                "duplicate": True,
            }

    code = "TRK-" + secrets.token_urlsafe(24)
    case_id = generate_case_id(db)

    i = Incident(
        case_id=case_id,
        idempotency_key=idem_key,
        tracking_hash=digest(code),
        category=data.category,
        description=data.description.strip(),
        address=data.address.strip(),
        latitude=data.latitude,
        longitude=data.longitude,
        status="reported",
        priority=data.severity or "unassessed",
        detected_language=data.detected_language or "en",
        english_translation=data.english_translation,
        casualties_count=data.casualties_count,
        injuries_description=data.injuries_description,
        vehicles_involved=data.vehicles_involved,
        immediate_hazards=data.immediate_hazards,
        requested_assistance=data.requested_assistance,
        citizen_contact=data.citizen_contact,
    )
    db.add(i)
    db.flush()

    if data.recording_id:
        rec = db.get(VoiceRecording, data.recording_id)
        if rec:
            rec.incident_id = i.id
            rec.recording_status = "completed"
            ext = db.scalar(select(IncidentExtraction).where(IncidentExtraction.recording_id == rec.id))
            if ext:
                ext.incident_id = i.id
                ext.user_confirmed = True

    if data.evidence_ids:
        for eid in data.evidence_ids:
            ev = db.get(Evidence, eid)
            if ev:
                ev.incident_id = i.id

    db.add(Report(incident_id=i.id, text=data.description))
    db.add(
        IncidentStatusHistory(
            incident_id=i.id,
            previous_status="",
            new_status=i.status,
            notes="Emergency incident reported",
        )
    )
    record(db, "incident.reported", i, case_id=case_id, category=i.category)

    try:
        from app.speech.report import generate_incident_pdf

        pdf_bytes = generate_incident_pdf(i)
        pdf_dir = Path(settings().recordings_dir) / "reports"
        pdf_dir.mkdir(parents=True, exist_ok=True)
        pdf_file = pdf_dir / f"{case_id}.pdf"
        pdf_file.write_bytes(pdf_bytes)
        i.pdf_path = str(pdf_file)
    except Exception:
        pass

    db.commit()
    return {
        "id": i.id,
        "case_id": case_id,
        "tracking_code": code,
        "status": i.status,
        "pdf_url": f"/api/v1/public/track/{code}/report",
    }


@router.get("/public/track/{code}")
def track(code: str, request: Request, db=Depends(get_db)):
    limited("tracking:" + request.client.host, 120, 60)
    i = tracked(db, code)
    # Public capabilities expose milestones only, never patient, coordinates, personnel or internal notes.
    events = db.scalars(select(Event).where(Event.incident_id == i.id).order_by(Event.id))
    allowed = {
        "incident.reported",
        "incident.voice_reported",
        "incident.verified",
        "incident.acknowledged",
        "mission.assigned",
        "mission.acknowledged",
        "mission.en_route",
        "mission.on_scene",
        "mission.transporting",
        "mission.handover",
        "referral.handed_over",
        "incident.closed",
        "incident.resolved",
        "incident.duplicate",
    }
    return {
        "status": i.status,
        "created_at": i.created_at,
        "timeline": [{"kind": e.kind, "at": e.created_at} for e in events if e.kind in allowed],
    }


@router.post("/public/track/{code}/notes")
def add_note(code: str, data: Note, request: Request, db=Depends(get_db)):
    limited("note:" + request.client.host, 20, 3600)
    i = tracked(db, code)
    if i.status in ("closed", "duplicate"):
        raise HTTPException(409, "This incident no longer accepts updates")
    db.add(Report(incident_id=i.id, text=data.text))
    record(db, "report.added", i)
    db.commit()
    return {"message": "Update received"}


@router.get("/incidents")
def incidents(
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: str | None = None,
    user=Depends(roles(*STAFF)),
    db=Depends(get_db),
):
    q = select(Incident)
    if user.role == "responder":
        q = q.join(Mission).where(Mission.responder_id == user.id)
    elif user.role == "hospital":
        q = (
            q.join(Referral)
            .join(Capacity)
            .join(Department)
            .join(Hospital)
            .where(Hospital.organization_id == user.organization_id)
            .distinct()
        )
    elif user.role != "admin":
        q = q.where(
            or_(Incident.organization_id == user.organization_id, Incident.organization_id.is_(None))
            if user.role == "operator"
            else Incident.organization_id == user.organization_id
        )
    if status:
        q = q.where(Incident.status == status)
    count = db.scalar(select(func.count()).select_from(q.subquery()))
    return {
        "items": [serial(i) for i in db.scalars(q.order_by(Incident.created_at.desc()).offset(offset).limit(limit))],
        "total": count,
    }


@router.get("/incidents/{id}")
def detail(id: str, user=Depends(roles(*STAFF)), db=Depends(get_db)):
    i = get_incident(db, id, user)
    return {
        **serial(i),
        "reports": [
            serial(r) for r in db.scalars(select(Report).where(Report.incident_id == id).order_by(Report.created_at))
        ],
        "events": [serial(e) for e in db.scalars(select(Event).where(Event.incident_id == id).order_by(Event.id))],
    }


@router.post("/incidents/{id}/verify")
def verify(id: str, data: Verify, user=Depends(roles(*OPS)), db=Depends(get_db)):
    i = get_incident(db, id, user, True)
    if i.status not in ("reported", "submitted", "pending_verification"):
        raise HTTPException(409, "Only reported incidents can be verified")
    if not user.organization_id:
        raise HTTPException(409, "An operational organization is required")
    old_status = i.status
    i.organization_id = user.organization_id
    i.status = "verified"
    i.priority = data.priority
    db.add(
        IncidentStatusHistory(
            incident_id=i.id,
            previous_status=old_status,
            new_status="verified",
            actor_id=user.id,
            notes=data.note,
        )
    )
    record(db, "incident.verified", i, user, note=data.note, priority=data.priority)
    db.commit()
    return serial(i)


class StatusUpdate(BaseModel):
    status: Literal[
        "submitted",
        "pending_verification",
        "reported",
        "verified",
        "dispatched",
        "en_route",
        "on_scene",
        "transporting",
        "hospital_handover",
        "handover",
        "active",
        "resolved",
        "closed",
        "rejected",
        "duplicate",
    ]
    note: str = Field(default="", max_length=1000)


@router.post("/incidents/{id}/status")
def update_status(id: str, data: StatusUpdate, user=Depends(roles(*OPS)), db=Depends(get_db)):
    i = get_incident(db, id, user, True)
    old_status = i.status
    if data.status in ("rejected", "duplicate") and not data.note.strip():
        raise HTTPException(422, "A mandatory reason note is required when rejecting or marking duplicate")
    i.status = data.status
    db.add(
        IncidentStatusHistory(
            incident_id=i.id,
            previous_status=old_status,
            new_status=i.status,
            actor_id=user.id,
            notes=data.note,
        )
    )
    record(db, f"incident.{data.status}", i, user, previous_status=old_status, note=data.note)
    db.commit()
    return serial(i)


@router.post("/incidents/{id}/acknowledge")
def acknowledge(id: str, user=Depends(roles(*OPS)), db=Depends(get_db)):
    i = get_incident(db, id, user, True)
    old_status = i.status
    if i.status in ("closed", "rejected", "duplicate"):
        raise HTTPException(409, "Incident is closed")
    db.add(
        IncidentStatusHistory(
            incident_id=i.id,
            previous_status=old_status,
            new_status=old_status,
            actor_id=user.id,
            notes="Incident acknowledged by operator",
        )
    )
    record(db, "incident.acknowledged", i, user)
    db.commit()
    return {"message": "Incident acknowledged", "id": i.id, "status": i.status}


@router.post("/incidents/{id}/priority")
def prioritize(id: str, data: Verify, user=Depends(roles(*OPS)), db=Depends(get_db)):
    i = get_incident(db, id, user, True)
    if i.status in ("reported", "closed", "duplicate"):
        raise HTTPException(409, "Incident must be open and verified")
    i.priority = data.priority
    record(db, "incident.escalated", i, user, **data.model_dump())
    db.commit()
    return serial(i)


@router.post("/incidents/{id}/duplicate")
def duplicate(id: str, data: Duplicate, user=Depends(roles(*OPS)), db=Depends(get_db)):
    if id == data.duplicate_of:
        raise HTTPException(422, "An incident cannot duplicate itself")
    i = get_incident(db, id, user, True)
    target = get_incident(db, data.duplicate_of, user)
    if i.status != "reported" or target.status in ("duplicate", "closed") or not target.organization_id:
        raise HTTPException(409, "Link an unverified report to an active verified incident")
    i.organization_id = target.organization_id
    i.duplicate_of = target.id
    i.status = "duplicate"
    record(db, "incident.duplicate", i, user, **data.model_dump())
    db.commit()
    return serial(i)


@router.post("/incidents/{id}/dispatch", status_code=201)
def dispatch(id: str, data: Dispatch, user=Depends(roles(*OPS)), db=Depends(get_db)):
    i = get_incident(db, id, user, True)
    if i.status != "verified":
        raise HTTPException(409, "Verify the incident before dispatch")
    a = db.scalar(select(Ambulance).where(Ambulance.id == data.ambulance_id).with_for_update())
    r = db.scalar(select(User).where(User.id == data.responder_id).with_for_update())
    if not a or not a.active or not r or r.role != "responder" or r.suspended or not r.verified:
        raise HTTPException(422, "Select an active ambulance and verified responder")
    if a.organization_id != i.organization_id or r.organization_id != i.organization_id:
        raise HTTPException(404, "Resource not found")
    if db.scalar(
        select(Mission.id).where(
            Mission.status != "completed", or_(Mission.ambulance_id == a.id, Mission.responder_id == r.id)
        )
    ):
        raise HTTPException(409, "A selected resource is already assigned")
    m = Mission(incident_id=i.id, ambulance_id=a.id, responder_id=r.id)
    db.add(m)
    db.flush()
    i.status = "dispatched"
    record(db, "mission.assigned", i, user, mission_id=m.id)
    db.commit()
    return serial(m)


@router.get("/missions")
def missions(
    user=Depends(roles("operator", "admin", "responder", "analyst")),
    db=Depends(get_db),
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
):
    q = select(Mission).join(Incident)
    if user.role == "responder":
        q = q.where(Mission.responder_id == user.id)
    elif user.role != "admin":
        q = q.where(Incident.organization_id == user.organization_id)
    return [serial(m) for m in db.scalars(q.order_by(Mission.created_at.desc()).offset(offset).limit(limit))]


@router.post("/missions/{id}/progress")
def progress(id: str, data: Progress, user=Depends(roles("responder")), db=Depends(get_db)):
    # Consistent lock order: incident, mission, referral, capacity.
    m = db.get(Mission, id)
    if not m or m.responder_id != user.id:
        raise HTTPException(404, "Mission not found")
    i = get_incident(db, m.incident_id, user, True)
    m = db.scalar(select(Mission).where(Mission.id == id).with_for_update().execution_options(populate_existing=True))
    order = ["assigned", "acknowledged", "en_route", "on_scene", "transporting", "handover", "completed"]
    if m.status == "completed" or order.index(data.status) != order.index(m.status) + 1:
        raise HTTPException(409, "Invalid mission transition")
    if data.status in ("transporting", "handover", "completed"):
        referral = db.scalar(
            select(Referral).where(Referral.incident_id == i.id, Referral.status.in_(["accepted", "handed_over"]))
        )
        if not referral:
            raise HTTPException(409, "An accepted hospital referral is required")
        if data.status == "completed" and referral.status != "handed_over":
            raise HTTPException(409, "Hospital must confirm patient handover first")
    m.status = data.status
    if data.status == "acknowledged":
        i.status = "active"
    if data.status == "handover":
        i.status = "handover"
    record(db, "mission." + data.status, i, user, note=data.note, mission_id=m.id)
    db.commit()
    return serial(m)


@router.post("/missions/{id}/location")
def location(id: str, data: Location, user=Depends(roles("responder")), db=Depends(get_db)):
    m = db.scalar(select(Mission).where(Mission.id == id).with_for_update())
    if not m or m.responder_id != user.id:
        raise HTTPException(404, "Mission not found")
    if m.status == "completed" or data.latitude is None:
        raise HTTPException(409, "An active mission and coordinates are required")
    m.latitude = data.latitude
    m.longitude = data.longitude
    m.location_at = now()
    record(db, "mission.location", db.get(Incident, m.incident_id), user, mission_id=m.id, **data.model_dump())
    db.commit()
    return serial(m)


@router.get("/hospitals")
def hospitals(
    user=Depends(roles(*STAFF)), db=Depends(get_db), offset: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=100)
):
    q = select(Hospital)
    if user.role == "hospital":
        q = q.where(Hospital.organization_id == user.organization_id)
    result = []
    for h in db.scalars(q.order_by(Hospital.name).offset(offset).limit(limit)):
        caps = db.execute(
            select(Capacity, Department.name).join(Department).where(Department.hospital_id == h.id)
        ).all()
        result.append(
            {
                **serial(h),
                "capacities": [
                    {**serial(c), "department": name, "available": c.total - c.occupied - c.reserved}
                    for c, name in caps
                ],
            }
        )
    return result


@router.patch("/capacities/{id}")
def capacity(id: str, data: CapacityUpdate, user=Depends(roles("hospital", "admin")), db=Depends(get_db)):
    c = db.scalar(select(Capacity).where(Capacity.id == id).with_for_update())
    if not c:
        raise HTTPException(404, "Capacity not found")
    h = db.get(Hospital, db.get(Department, c.department_id).hospital_id)
    scope(user, h.organization_id)
    if data.occupied + c.reserved > data.total:
        raise HTTPException(409, "Capacity cannot be less than occupied and reserved beds")
    before = serial(c)
    c.total = data.total
    c.occupied = data.occupied
    record(
        db,
        "capacity.updated",
        user=user,
        event_scope=h.organization_id,
        id=c.id,
        before={k: before[k] for k in ("total", "occupied", "reserved")},
        after=data.model_dump(),
    )
    db.commit()
    return serial(c)


@router.post("/incidents/{id}/referrals", status_code=201)
def refer(id: str, data: ReferralCreate, user=Depends(roles(*OPS)), db=Depends(get_db)):
    i = get_incident(db, id, user, True)
    if i.status not in ("dispatched", "active"):
        raise HTTPException(409, "Dispatch a mission before requesting a referral")
    if not db.get(Capacity, data.capacity_id):
        raise HTTPException(404, "Capacity not found")
    if db.scalar(select(Referral).where(Referral.incident_id == id, Referral.status != "rejected")):
        raise HTTPException(409, "An active referral already exists")
    r = Referral(incident_id=id, capacity_id=data.capacity_id)
    db.add(r)
    db.flush()
    record(db, "referral.requested", i, user, referral_id=r.id)
    db.commit()
    return serial(r)


def hospital_for(db, r):
    return db.get(Hospital, db.get(Department, db.get(Capacity, r.capacity_id).department_id).hospital_id)


@router.get("/referrals")
def referrals(
    user=Depends(roles("hospital", "operator", "admin", "analyst")),
    db=Depends(get_db),
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
):
    q = select(Referral).join(Incident)
    if user.role == "hospital":
        q = q.join(Capacity).join(Department).join(Hospital).where(Hospital.organization_id == user.organization_id)
    elif user.role != "admin":
        q = q.where(Incident.organization_id == user.organization_id)
    return [serial(r) for r in db.scalars(q.order_by(Referral.created_at.desc()).offset(offset).limit(limit))]


@router.post("/referrals/{id}/decision")
def decide(id: str, data: Decision, user=Depends(roles("hospital", "admin")), db=Depends(get_db)):
    r = db.scalar(select(Referral).where(Referral.id == id).with_for_update())
    if not r:
        raise HTTPException(404, "Referral not found")
    scope(user, hospital_for(db, r).organization_id)
    if r.status != "pending":
        raise HTTPException(409, "Referral already reviewed")
    if data.accept:
        c = db.scalar(select(Capacity).where(Capacity.id == r.capacity_id).with_for_update())
        if c.total - c.occupied - c.reserved < 1:
            raise HTTPException(409, "No verified capacity available")
        c.reserved += 1
        db.add(Reservation(referral_id=r.id, capacity_id=c.id))
        r.status = "accepted"
    else:
        r.status = "rejected"
    r.reason = data.reason
    record(db, "referral." + r.status, db.get(Incident, r.incident_id), user, referral_id=r.id, reason=data.reason)
    db.commit()
    return serial(r)


@router.post("/referrals/{id}/handover")
def handover(id: str, user=Depends(roles("hospital", "admin")), db=Depends(get_db)):
    r = db.get(Referral, id)
    if not r:
        raise HTTPException(404, "Referral not found")
    scope(user, hospital_for(db, r).organization_id)
    i = db.scalar(select(Incident).where(Incident.id == r.incident_id).with_for_update())
    m = db.scalar(select(Mission).where(Mission.incident_id == i.id).with_for_update())
    r = db.scalar(select(Referral).where(Referral.id == id).with_for_update().execution_options(populate_existing=True))
    if r.status != "accepted" or not m or m.status != "handover":
        raise HTTPException(409, "Responder must record arrival for handover first")
    c = db.scalar(select(Capacity).where(Capacity.id == r.capacity_id).with_for_update())
    reservation = db.scalar(select(Reservation).where(Reservation.referral_id == r.id).with_for_update())
    c.reserved -= 1
    c.occupied += 1
    reservation.status = "occupied"
    r.status = "handed_over"
    record(db, "referral.handed_over", i, user, referral_id=r.id)
    db.commit()
    return serial(r)


@router.post("/incidents/{id}/close")
def close(id: str, data: Note, user=Depends(roles(*OPS)), db=Depends(get_db)):
    i = get_incident(db, id, user, True)
    m = db.scalar(select(Mission).where(Mission.incident_id == i.id))
    if i.status != "handover" or not m or m.status != "completed":
        raise HTTPException(409, "Complete the mission and hospital handover before closure")
    i.status = "closed"
    record(db, "incident.closed", i, user, note=data.text)
    db.commit()
    return serial(i)


def distance(a, b, c, d):
    p = math.pi / 180
    return (
        6371
        * 2
        * math.asin(
            min(
                1,
                math.sqrt(
                    math.sin((c - a) * p / 2) ** 2 + math.cos(a * p) * math.cos(c * p) * math.sin((d - b) * p / 2) ** 2
                ),
            )
        )
    )


@router.get("/incidents/{id}/suggestions")
def suggestions(id: str, user=Depends(roles(*OPS)), db=Depends(get_db)):
    i = get_incident(db, id, user)
    duplicates = []
    nearby = []
    if i.latitude is not None:
        for other in db.scalars(
            select(Incident).where(
                Incident.id != id,
                Incident.category == i.category,
                Incident.created_at > now() - timedelta(hours=2),
                Incident.status.notin_(["closed", "duplicate"]),
                or_(Incident.organization_id == user.organization_id, Incident.organization_id.is_(None)),
            )
        ):
            if other.latitude is not None:
                km = distance(i.latitude, i.longitude, other.latitude, other.longitude)
                if km < 1:
                    duplicates.append(
                        {
                            "id": other.id,
                            "distance_km": round(km, 2),
                            "reason": "Same category, within 1 km, reported within 2 hours",
                        }
                    )
        for h in db.scalars(select(Hospital).where(Hospital.latitude.is_not(None))):
            available = (
                db.scalar(
                    select(func.sum(Capacity.total - Capacity.occupied - Capacity.reserved))
                    .join(Department)
                    .where(Department.hospital_id == h.id)
                )
                or 0
            )
            if available > 0:
                nearby.append(
                    {
                        "id": h.id,
                        "name": h.name,
                        "distance_km": round(distance(i.latitude, i.longitude, h.latitude, h.longitude), 2),
                        "available_beds": available,
                        "reason": "Straight-line distance and recorded capacity; suitability requires operator confirmation",
                    }
                )
    return {
        "possible_duplicates": duplicates,
        "hospitals": sorted(nearby, key=lambda h: h["distance_km"]),
        "delay_alert": i.status in ("reported", "verified") and i.created_at < now() - timedelta(minutes=10),
        "note": "Decision support only. No GPS estimates or medical decisions are generated.",
    }

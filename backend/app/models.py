import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    String,
    Text,
    ForeignKey,
    DateTime,
    Integer,
    Float,
    Boolean,
    JSON,
    CheckConstraint,
    UniqueConstraint,
    Index,
    text,
    select,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.ext.hybrid import hybrid_property
from .db import Base


def uid():
    return str(uuid.uuid4())


def now():
    return datetime.now(timezone.utc)


class Identity:
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Organization(Identity, Base):
    __tablename__ = "organizations"
    name: Mapped[str] = mapped_column(String(160), unique=True)


class User(Identity, Base):
    __tablename__ = "users"
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160))
    password_hash: Mapped[str | None] = mapped_column(Text)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    suspended: Mapped[bool] = mapped_column(Boolean, default=False)
    google_subject: Mapped[str | None] = mapped_column(String(255), unique=True)
    mfa_secret: Mapped[str | None] = mapped_column(Text)
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    mfa_last_step: Mapped[int] = mapped_column(Integer, default=0)

    membership: Mapped["Membership"] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan", lazy="selectin"
    )

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.membership is None:
            self.membership = Membership(role_id="citizen")

    @hybrid_property
    def role(self):
        return self.membership.role_id if self.membership else "citizen"

    @role.setter
    def role(self, value):
        if self.membership is None:
            self.membership = Membership(role_id=value)
        else:
            self.membership.role_id = value

    @role.expression
    def role(cls):
        return select(Membership.role_id).where(Membership.user_id == cls.id).scalar_subquery()

    @hybrid_property
    def organization_id(self):
        return self.membership.organization_id if self.membership else None

    @organization_id.setter
    def organization_id(self, value):
        if self.membership is None:
            self.membership = Membership(role_id="citizen", organization_id=value)
        else:
            self.membership.organization_id = value

    @organization_id.expression
    def organization_id(cls):
        return select(Membership.organization_id).where(Membership.user_id == cls.id).scalar_subquery()


class Role(Base):
    __tablename__ = "roles"
    id: Mapped[str] = mapped_column(String(24), primary_key=True)
    name: Mapped[str] = mapped_column(String(80))


class Membership(Identity, Base):
    __tablename__ = "memberships"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), unique=True)
    role_id: Mapped[str] = mapped_column(ForeignKey("roles.id"), index=True)
    organization_id: Mapped[str | None] = mapped_column(ForeignKey("organizations.id"), index=True)
    user: Mapped[User] = relationship(back_populates="membership")
    __table_args__ = (CheckConstraint("role_id = 'citizen' OR organization_id IS NOT NULL"),)


class Permission(Base):
    __tablename__ = "permissions"
    action: Mapped[str] = mapped_column(String(200), primary_key=True)


class RolePermission(Base):
    __tablename__ = "role_permissions"
    role_id: Mapped[str] = mapped_column(ForeignKey("roles.id"), primary_key=True)
    action: Mapped[str] = mapped_column(ForeignKey("permissions.action"), primary_key=True)


class Session(Identity, Base):
    __tablename__ = "sessions"
    family_id: Mapped[str] = mapped_column(String(36), default=uid, index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    refresh_hash: Mapped[str] = mapped_column(String(64), unique=True)
    csrf_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    user_agent: Mapped[str] = mapped_column(String(256), default="")


class Challenge(Identity, Base):
    __tablename__ = "challenges"
    email: Mapped[str] = mapped_column(String(254), index=True)
    purpose: Mapped[str] = mapped_column(String(20))
    secret_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    consumed: Mapped[bool] = mapped_column(Boolean, default=False)


class Invitation(Identity, Base):
    __tablename__ = "invitations"
    email: Mapped[str] = mapped_column(String(254))
    role: Mapped[str] = mapped_column(String(24))
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    consumed: Mapped[bool] = mapped_column(Boolean, default=False)


class Incident(Identity, Base):
    __tablename__ = "incidents"
    tracking_hash: Mapped[str] = mapped_column(String(64), unique=True)
    organization_id: Mapped[str | None] = mapped_column(ForeignKey("organizations.id"), index=True)
    category: Mapped[str] = mapped_column(String(32))
    description: Mapped[str] = mapped_column(Text)
    address: Mapped[str] = mapped_column(String(500))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(24), default="reported", index=True)
    priority: Mapped[str] = mapped_column(String(16), default="unassessed")
    duplicate_of: Mapped[str | None] = mapped_column(ForeignKey("incidents.id"))
    __table_args__ = (
        CheckConstraint("latitude BETWEEN -90 AND 90"),
        CheckConstraint("longitude BETWEEN -180 AND 180"),
        CheckConstraint("status IN ('reported','verified','dispatched','active','handover','closed','duplicate')"),
        CheckConstraint("priority IN ('unassessed','low','medium','high','critical')"),
    )


class Report(Identity, Base):
    __tablename__ = "reports"
    incident_id: Mapped[str] = mapped_column(ForeignKey("incidents.id"), index=True)
    text: Mapped[str] = mapped_column(Text)


class Evidence(Identity, Base):
    __tablename__ = "evidence"
    incident_id: Mapped[str] = mapped_column(ForeignKey("incidents.id"), index=True)
    object_key: Mapped[str] = mapped_column(String(255), unique=True)
    content_type: Mapped[str] = mapped_column(String(100))
    size: Mapped[int] = mapped_column(Integer)


class VoiceRecording(Identity, Base):
    __tablename__ = "voice_recordings"
    incident_id: Mapped[str | None] = mapped_column(ForeignKey("incidents.id"), index=True, nullable=True)
    reporter_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), index=True, nullable=True)
    storage_reference: Mapped[str] = mapped_column(String(500))
    original_filename: Mapped[str] = mapped_column(String(255), default="recording.webm")
    mime_type: Mapped[str] = mapped_column(String(100))
    file_size: Mapped[int] = mapped_column(Integer)
    duration: Mapped[float] = mapped_column(Float, default=0.0)
    checksum: Mapped[str] = mapped_column(String(64))
    recording_status: Mapped[str] = mapped_column(String(24), default="uploaded")


class TranscriptionJob(Identity, Base):
    __tablename__ = "transcription_jobs"
    recording_id: Mapped[str] = mapped_column(ForeignKey("voice_recordings.id"), index=True)
    provider: Mapped[str] = mapped_column(String(50))
    language: Mapped[str] = mapped_column(String(10), default="en")
    status: Mapped[str] = mapped_column(String(24), default="queued")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Transcript(Identity, Base):
    __tablename__ = "transcripts"
    recording_id: Mapped[str] = mapped_column(ForeignKey("voice_recordings.id"), unique=True)
    original_transcript: Mapped[str] = mapped_column(Text)
    corrected_transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    detected_language: Mapped[str] = mapped_column(String(10), default="en")
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    provider: Mapped[str] = mapped_column(String(50))
    provider_metadata: Mapped[dict] = mapped_column(JSON, default=dict)


class IncidentExtraction(Identity, Base):
    __tablename__ = "incident_extractions"
    recording_id: Mapped[str | None] = mapped_column(ForeignKey("voice_recordings.id"), index=True, nullable=True)
    transcript_id: Mapped[str | None] = mapped_column(ForeignKey("transcripts.id"), index=True, nullable=True)
    incident_id: Mapped[str | None] = mapped_column(ForeignKey("incidents.id"), index=True, nullable=True)
    extracted_json: Mapped[dict] = mapped_column(JSON, default=dict)
    extraction_status: Mapped[str] = mapped_column(String(24), default="extracted")
    user_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)


class Hospital(Identity, Base):
    __tablename__ = "hospitals"
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    facilities: Mapped[list] = mapped_column(JSON, default=list)
    __table_args__ = (CheckConstraint("latitude BETWEEN -90 AND 90"), CheckConstraint("longitude BETWEEN -180 AND 180"))


class Department(Identity, Base):
    __tablename__ = "departments"
    hospital_id: Mapped[str] = mapped_column(ForeignKey("hospitals.id"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    __table_args__ = (UniqueConstraint("hospital_id", "name"),)


class Capacity(Identity, Base):
    __tablename__ = "capacities"
    department_id: Mapped[str] = mapped_column(ForeignKey("departments.id"))
    kind: Mapped[str] = mapped_column(String(16))
    total: Mapped[int] = mapped_column(Integer, default=0)
    occupied: Mapped[int] = mapped_column(Integer, default=0)
    reserved: Mapped[int] = mapped_column(Integer, default=0)
    __table_args__ = (
        UniqueConstraint("department_id", "kind"),
        CheckConstraint("kind IN ('icu','emergency','general')"),
        CheckConstraint("total >= 0 AND occupied >= 0 AND reserved >= 0 AND occupied + reserved <= total"),
    )


class Ambulance(Identity, Base):
    __tablename__ = "ambulances"
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    registration: Mapped[str] = mapped_column(String(40), unique=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Mission(Identity, Base):
    __tablename__ = "missions"
    incident_id: Mapped[str] = mapped_column(ForeignKey("incidents.id"), unique=True)
    ambulance_id: Mapped[str] = mapped_column(ForeignKey("ambulances.id"))
    responder_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(24), default="assigned")
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    location_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    __table_args__ = (
        CheckConstraint(
            "status IN ('assigned','acknowledged','en_route','on_scene','transporting','handover','completed')"
        ),
        Index("one_active_ambulance", "ambulance_id", unique=True, postgresql_where=text("status != 'completed'")),
        Index("one_active_responder", "responder_id", unique=True, postgresql_where=text("status != 'completed'")),
    )


class Referral(Identity, Base):
    __tablename__ = "referrals"
    incident_id: Mapped[str] = mapped_column(ForeignKey("incidents.id"), index=True)
    capacity_id: Mapped[str] = mapped_column(ForeignKey("capacities.id"))
    status: Mapped[str] = mapped_column(String(24), default="pending")
    reason: Mapped[str] = mapped_column(Text, default="")
    __table_args__ = (
        CheckConstraint("status IN ('pending','accepted','rejected','handed_over')"),
        Index("one_open_referral", "incident_id", unique=True, postgresql_where=text("status != 'rejected'")),
    )


class Reservation(Identity, Base):
    __tablename__ = "reservations"
    referral_id: Mapped[str] = mapped_column(ForeignKey("referrals.id"), unique=True)
    capacity_id: Mapped[str] = mapped_column(ForeignKey("capacities.id"))
    status: Mapped[str] = mapped_column(String(24), default="reserved")
    __table_args__ = (CheckConstraint("status IN ('reserved','occupied')"),)


class Event(Base):
    __tablename__ = "events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    organization_id: Mapped[str | None] = mapped_column(ForeignKey("organizations.id"), index=True)
    incident_id: Mapped[str | None] = mapped_column(ForeignKey("incidents.id"), index=True)
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    kind: Mapped[str] = mapped_column(String(64))
    payload: Mapped[dict] = mapped_column(JSON, default=dict)


class Audit(Identity, Base):
    __tablename__ = "audit_logs"
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), index=True)
    organization_id: Mapped[str | None] = mapped_column(ForeignKey("organizations.id"))
    action: Mapped[str] = mapped_column(String(100), index=True)
    target: Mapped[str] = mapped_column(String(254))
    details: Mapped[dict] = mapped_column(JSON, default=dict)


class PermissionOverride(Identity, Base):
    __tablename__ = "permission_overrides"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(ForeignKey("permissions.action"))
    denied: Mapped[bool] = mapped_column(Boolean, default=True)
    __table_args__ = (UniqueConstraint("user_id", "action"),)

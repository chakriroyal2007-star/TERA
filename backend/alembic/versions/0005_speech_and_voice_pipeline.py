"""Speech transcription engine, voice recordings and incident extraction tables."""

from alembic import op
import sqlalchemy as sa

revision = "0005"
down_revision = "0004"

SPEECH_PERMISSIONS = [
    {"action": "GET /api/v1/speech/health"},
    {"action": "POST /api/v1/speech/recordings"},
    {"action": "GET /api/v1/speech/recordings/{id}"},
    {"action": "GET /api/v1/speech/recordings/{id}/audio"},
    {"action": "POST /api/v1/speech/recordings/{id}/transcribe"},
    {"action": "GET /api/v1/speech/jobs/{id}"},
    {"action": "GET /api/v1/speech/transcripts/{id}"},
    {"action": "POST /api/v1/speech/transcripts/{id}/correct"},
    {"action": "POST /api/v1/speech/transcripts/{id}/extract"},
    {"action": "GET /api/v1/incidents/{id}/voice"},
    {"action": "GET /api/v1/incidents/{id}/audio"},
    {"action": "GET /api/v1/incidents/{id}/report"},
]

SPEECH_GRANTS = [
    {"role_id": "admin", "action": "GET /api/v1/speech/health"},
    {"role_id": "operator", "action": "GET /api/v1/speech/health"},
    {"role_id": "analyst", "action": "GET /api/v1/speech/health"},
    {"role_id": "admin", "action": "GET /api/v1/speech/recordings/{id}"},
    {"role_id": "operator", "action": "GET /api/v1/speech/recordings/{id}"},
    {"role_id": "responder", "action": "GET /api/v1/speech/recordings/{id}"},
    {"role_id": "hospital", "action": "GET /api/v1/speech/recordings/{id}"},
    {"role_id": "admin", "action": "GET /api/v1/speech/recordings/{id}/audio"},
    {"role_id": "operator", "action": "GET /api/v1/speech/recordings/{id}/audio"},
    {"role_id": "responder", "action": "GET /api/v1/speech/recordings/{id}/audio"},
    {"role_id": "hospital", "action": "GET /api/v1/speech/recordings/{id}/audio"},
    {"role_id": "admin", "action": "GET /api/v1/speech/transcripts/{id}"},
    {"role_id": "operator", "action": "GET /api/v1/speech/transcripts/{id}"},
    {"role_id": "responder", "action": "GET /api/v1/speech/transcripts/{id}"},
    {"role_id": "hospital", "action": "GET /api/v1/speech/transcripts/{id}"},
    {"role_id": "admin", "action": "POST /api/v1/speech/transcripts/{id}/correct"},
    {"role_id": "operator", "action": "POST /api/v1/speech/transcripts/{id}/correct"},
    {"role_id": "admin", "action": "POST /api/v1/speech/transcripts/{id}/extract"},
    {"role_id": "operator", "action": "POST /api/v1/speech/transcripts/{id}/extract"},
    {"role_id": "admin", "action": "GET /api/v1/incidents/{id}/voice"},
    {"role_id": "operator", "action": "GET /api/v1/incidents/{id}/voice"},
    {"role_id": "analyst", "action": "GET /api/v1/incidents/{id}/voice"},
    {"role_id": "responder", "action": "GET /api/v1/incidents/{id}/voice"},
    {"role_id": "hospital", "action": "GET /api/v1/incidents/{id}/voice"},
    {"role_id": "admin", "action": "GET /api/v1/incidents/{id}/audio"},
    {"role_id": "operator", "action": "GET /api/v1/incidents/{id}/audio"},
    {"role_id": "analyst", "action": "GET /api/v1/incidents/{id}/audio"},
    {"role_id": "responder", "action": "GET /api/v1/incidents/{id}/audio"},
    {"role_id": "hospital", "action": "GET /api/v1/incidents/{id}/audio"},
    {"role_id": "admin", "action": "GET /api/v1/incidents/{id}/report"},
    {"role_id": "operator", "action": "GET /api/v1/incidents/{id}/report"},
    {"role_id": "analyst", "action": "GET /api/v1/incidents/{id}/report"},
    {"role_id": "responder", "action": "GET /api/v1/incidents/{id}/report"},
    {"role_id": "hospital", "action": "GET /api/v1/incidents/{id}/report"},
]


def upgrade():
    op.create_table(
        "voice_recordings",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("incident_id", sa.String(36), sa.ForeignKey("incidents.id"), nullable=True),
        sa.Column("reporter_id", sa.String(36), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("storage_reference", sa.String(500), nullable=False),
        sa.Column("original_filename", sa.String(255), nullable=False, server_default="recording.webm"),
        sa.Column("mime_type", sa.String(100), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("duration", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("checksum", sa.String(64), nullable=False),
        sa.Column("recording_status", sa.String(24), nullable=False, server_default="uploaded"),
    )
    op.create_index("ix_voice_recordings_incident_id", "voice_recordings", ["incident_id"])
    op.create_index("ix_voice_recordings_reporter_id", "voice_recordings", ["reporter_id"])

    op.create_table(
        "transcription_jobs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("recording_id", sa.String(36), sa.ForeignKey("voice_recordings.id"), nullable=False),
        sa.Column("provider", sa.String(50), nullable=False),
        sa.Column("language", sa.String(10), nullable=False, server_default="en"),
        sa.Column("status", sa.String(24), nullable=False, server_default="queued"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_transcription_jobs_recording_id", "transcription_jobs", ["recording_id"])

    op.create_table(
        "transcripts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("recording_id", sa.String(36), sa.ForeignKey("voice_recordings.id"), nullable=False, unique=True),
        sa.Column("original_transcript", sa.Text(), nullable=False),
        sa.Column("corrected_transcript", sa.Text(), nullable=True),
        sa.Column("detected_language", sa.String(10), nullable=False, server_default="en"),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("provider", sa.String(50), nullable=False),
        sa.Column("provider_metadata", sa.JSON(), nullable=False, server_default="{}"),
    )

    op.create_table(
        "incident_extractions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("recording_id", sa.String(36), sa.ForeignKey("voice_recordings.id"), nullable=True),
        sa.Column("transcript_id", sa.String(36), sa.ForeignKey("transcripts.id"), nullable=True),
        sa.Column("incident_id", sa.String(36), sa.ForeignKey("incidents.id"), nullable=True),
        sa.Column("extracted_json", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("extraction_status", sa.String(24), nullable=False, server_default="extracted"),
        sa.Column("user_confirmed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.create_index("ix_incident_extractions_incident_id", "incident_extractions", ["incident_id"])
    op.create_index("ix_incident_extractions_recording_id", "incident_extractions", ["recording_id"])
    op.create_index("ix_incident_extractions_transcript_id", "incident_extractions", ["transcript_id"])

    op.bulk_insert(sa.table("permissions", sa.column("action")), SPEECH_PERMISSIONS)
    op.bulk_insert(sa.table("role_permissions", sa.column("role_id"), sa.column("action")), SPEECH_GRANTS)


def downgrade():
    for grant in SPEECH_GRANTS:
        op.execute(
            f"DELETE FROM role_permissions WHERE role_id = '{grant['role_id']}' AND action = '{grant['action']}'"
        )
    for perm in SPEECH_PERMISSIONS:
        op.execute(f"DELETE FROM permissions WHERE action = '{perm['action']}'")
    op.drop_table("incident_extractions")
    op.drop_table("transcripts")
    op.drop_table("transcription_jobs")
    op.drop_table("voice_recordings")

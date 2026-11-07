"""Citizen emergency reporting, unique case IDs, lifecycle, and multilingual voice support."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0006"
down_revision = "0005"

LIFECYCLE_STATUSES = (
    "'submitted', 'pending_verification', 'reported', 'verified', 'dispatched', "
    "'en_route', 'on_scene', 'transporting', 'hospital_handover', 'handover', "
    "'active', 'resolved', 'closed', 'rejected', 'duplicate'"
)

NEW_PERMISSIONS = [
    {"action": "GET /api/v1/voice/health"},
    {"action": "POST /api/v1/voice/transcribe"},
    {"action": "POST /api/v1/voice/extract"},
    {"action": "POST /api/v1/incidents"},
    {"action": "POST /api/v1/incidents/{id}/status"},
    {"action": "POST /api/v1/incidents/{id}/acknowledge"},
]

NEW_GRANTS = [
    {"role_id": "admin", "action": "GET /api/v1/voice/health"},
    {"role_id": "operator", "action": "GET /api/v1/voice/health"},
    {"role_id": "analyst", "action": "GET /api/v1/voice/health"},
    {"role_id": "admin", "action": "POST /api/v1/voice/transcribe"},
    {"role_id": "operator", "action": "POST /api/v1/voice/transcribe"},
    {"role_id": "admin", "action": "POST /api/v1/voice/extract"},
    {"role_id": "operator", "action": "POST /api/v1/voice/extract"},
    {"role_id": "admin", "action": "POST /api/v1/incidents/{id}/status"},
    {"role_id": "operator", "action": "POST /api/v1/incidents/{id}/status"},
    {"role_id": "admin", "action": "POST /api/v1/incidents/{id}/acknowledge"},
    {"role_id": "operator", "action": "POST /api/v1/incidents/{id}/acknowledge"},
]


def upgrade():
    # 1. Add new columns to incidents
    op.add_column("incidents", sa.Column("case_id", sa.String(32), nullable=True))
    op.create_index("ix_incidents_case_id", "incidents", ["case_id"], unique=True)

    op.add_column("incidents", sa.Column("idempotency_key", sa.String(64), nullable=True))
    op.create_index("ix_incidents_idempotency_key", "incidents", ["idempotency_key"], unique=True)

    op.add_column("incidents", sa.Column("detected_language", sa.String(10), nullable=True, server_default="en"))
    op.add_column("incidents", sa.Column("english_translation", sa.Text(), nullable=True))
    op.add_column("incidents", sa.Column("casualties_count", sa.Integer(), nullable=True))
    op.add_column("incidents", sa.Column("injuries_description", sa.Text(), nullable=True))
    op.add_column("incidents", sa.Column("vehicles_involved", sa.String(255), nullable=True))
    op.add_column("incidents", sa.Column("immediate_hazards", sa.String(255), nullable=True))
    op.add_column("incidents", sa.Column("requested_assistance", sa.String(255), nullable=True))
    op.add_column("incidents", sa.Column("citizen_contact", sa.String(160), nullable=True))
    op.add_column("incidents", sa.Column("ai_extraction", sa.JSON(), nullable=True, server_default="{}"))
    op.add_column("incidents", sa.Column("pdf_path", sa.String(500), nullable=True))

    # 2. Update status constraint on incidents
    op.drop_constraint("incidents_status_check", "incidents", type_="check")
    op.create_check_constraint(
        "incidents_status_check",
        "incidents",
        f"status IN ({LIFECYCLE_STATUSES})",
    )

    # 3. Create incident_status_history table
    op.create_table(
        "incident_status_history",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("incident_id", sa.String(36), sa.ForeignKey("incidents.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("previous_status", sa.String(32), nullable=False),
        sa.Column("new_status", sa.String(32), nullable=False),
        sa.Column("actor_id", sa.String(36), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # 4. Insert new permissions and grants
    conn = op.get_bind()
    for perm in NEW_PERMISSIONS:
        conn.execute(
            sa.text("INSERT INTO permissions (action) VALUES (:action) ON CONFLICT DO NOTHING"),
            perm,
        )
    for grant in NEW_GRANTS:
        conn.execute(
            sa.text(
                "INSERT INTO role_permissions (role_id, action) VALUES (:role_id, :action) ON CONFLICT DO NOTHING"
            ),
            grant,
        )


def downgrade():
    op.drop_table("incident_status_history")
    op.drop_constraint("incidents_status_check", "incidents", type_="check")
    op.create_check_constraint(
        "incidents_status_check",
        "incidents",
        "status IN ('reported','verified','dispatched','active','handover','closed','duplicate')",
    )
    op.drop_column("incidents", "pdf_path")
    op.drop_column("incidents", "ai_extraction")
    op.drop_column("incidents", "citizen_contact")
    op.drop_column("incidents", "requested_assistance")
    op.drop_column("incidents", "immediate_hazards")
    op.drop_column("incidents", "vehicles_involved")
    op.drop_column("incidents", "injuries_description")
    op.drop_column("incidents", "casualties_count")
    op.drop_column("incidents", "english_translation")
    op.drop_column("incidents", "detected_language")
    op.drop_index("ix_incidents_idempotency_key", table_name="incidents")
    op.drop_column("incidents", "idempotency_key")
    op.drop_index("ix_incidents_case_id", table_name="incidents")
    op.drop_column("incidents", "case_id")

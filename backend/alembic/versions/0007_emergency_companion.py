"""TERA AI Emergency First-Aid Companion: Knowledge Base, Protocols, Sessions, and Outbound Callbacks."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0007"
down_revision = "0006"


def upgrade():
    bind = op.get_bind()

    # 1. Emergency Knowledge Sources
    op.create_table(
        "emergency_knowledge_sources",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False, unique=True),
        sa.Column("organization", sa.String(200), nullable=False),
        sa.Column("citation_url", sa.String(500), nullable=True),
        sa.Column("published_year", sa.Integer(), nullable=True),
        sa.Column("verified", sa.Boolean(), default=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # 2. Emergency Protocols
    op.create_table(
        "emergency_protocols",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("category", sa.String(40), nullable=False, index=True),
        sa.Column("subtype", sa.String(80), nullable=False),
        sa.Column("applicable_patient_group", sa.String(40), default="all"),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("recognition_criteria", sa.JSON(), default=list),
        sa.Column("immediate_danger_indicators", sa.JSON(), default=list),
        sa.Column("assessment_questions", sa.JSON(), default=list),
        sa.Column("contraindications", sa.JSON(), default=list),
        sa.Column("status", sa.String(24), default="draft", index=True),
        sa.Column("trusted_source_id", sa.String(36), sa.ForeignKey("emergency_knowledge_sources.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.CheckConstraint("status IN ('draft', 'in_review', 'approved', 'retired')"),
    )

    # 3. Emergency Protocol Versions
    op.create_table(
        "emergency_protocol_versions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("protocol_id", sa.String(64), sa.ForeignKey("emergency_protocols.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False, default=1),
        sa.Column("change_summary", sa.Text(), default="Initial version"),
        sa.Column("medical_approval_status", sa.String(24), default="draft", nullable=False),
        sa.Column("approved_by_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("review_due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("protocol_id", "version_number"),
        sa.CheckConstraint("medical_approval_status IN ('draft', 'in_review', 'approved', 'rejected', 'retired')"),
    )

    # 4. Emergency Protocol Steps
    op.create_table(
        "emergency_protocol_steps",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("version_id", sa.String(36), sa.ForeignKey("emergency_protocol_versions.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("step_number", sa.Integer(), nullable=False),
        sa.Column("instruction_title", sa.String(200), nullable=False),
        sa.Column("instruction_text", sa.Text(), nullable=False),
        sa.Column("expected_action", sa.Text(), nullable=False),
        sa.Column("danger_warning", sa.Text(), nullable=True),
        sa.Column("escalation_trigger", sa.Text(), nullable=True),
        sa.Column("next_step_number", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("version_id", "step_number"),
    )

    # 5. Emergency Protocol Translations
    op.create_table(
        "emergency_protocol_translations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("version_id", sa.String(36), sa.ForeignKey("emergency_protocol_versions.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("step_id", sa.String(36), sa.ForeignKey("emergency_protocol_steps.id", ondelete="CASCADE"), nullable=True),
        sa.Column("language", sa.String(10), nullable=False, index=True),
        sa.Column("translated_title", sa.String(200), nullable=False),
        sa.Column("translated_instruction", sa.Text(), nullable=False),
        sa.Column("reviewed_by", sa.String(160), nullable=True),
        sa.Column("medical_review_verified", sa.Boolean(), default=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("version_id", "step_id", "language"),
        sa.CheckConstraint("language IN ('en', 'te', 'hi', 'ta', 'kn', 'ml')"),
    )

    # 6. Emergency Protocol Reviews
    op.create_table(
        "emergency_protocol_reviews",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("version_id", sa.String(36), sa.ForeignKey("emergency_protocol_versions.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("reviewer_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("reviewer_medical_qualification", sa.String(200), nullable=False),
        sa.Column("decision", sa.String(32), nullable=False),
        sa.Column("comments", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.CheckConstraint("decision IN ('approved', 'rejected', 'revisions_requested')"),
    )

    # 7. Emergency Assistance Sessions
    op.create_table(
        "emergency_assistance_sessions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("incident_id", sa.String(36), sa.ForeignKey("incidents.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("citizen_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", sa.String(32), default="connecting", nullable=False, index=True),
        sa.Column("channel", sa.String(24), default="web_voice", nullable=False),
        sa.Column("selected_language", sa.String(10), default="en", nullable=False),
        sa.Column("current_protocol_id", sa.String(64), sa.ForeignKey("emergency_protocols.id", ondelete="SET NULL"), nullable=True),
        sa.Column("current_version_id", sa.String(36), sa.ForeignKey("emergency_protocol_versions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("current_step_id", sa.String(36), sa.ForeignKey("emergency_protocol_steps.id", ondelete="SET NULL"), nullable=True),
        sa.Column("current_step_number", sa.Integer(), default=0),
        sa.Column("sarvam_session_id", sa.String(100), nullable=True),
        sa.Column("sarvam_call_attempt_id", sa.String(100), nullable=True),
        sa.Column("human_operator_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("disconnected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.CheckConstraint(
            "status IN ('idle', 'connecting', 'initial_assessment', 'guidance_active', "
            "'awaiting_citizen_response', 'reassessment', 'escalation_required', "
            "'human_assistance_pending', 'human_takeover', 'professional_handover', "
            "'completed', 'disconnected', 'error')"
        ),
        sa.CheckConstraint("channel IN ('web_voice', 'phone_call', 'web_text')"),
        sa.CheckConstraint("selected_language IN ('en', 'te', 'hi', 'ta', 'kn', 'ml')"),
    )

    # 8. Emergency Conversation Messages
    op.create_table(
        "emergency_conversation_messages",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("session_id", sa.String(36), sa.ForeignKey("emergency_assistance_sessions.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("speaker", sa.String(20), nullable=False),
        sa.Column("language", sa.String(10), default="en", nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("audio_reference", sa.String(500), nullable=True),
        sa.Column("step_number", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.CheckConstraint("speaker IN ('ai', 'citizen', 'operator', 'system')"),
    )

    # 9. Emergency Assistance Actions
    op.create_table(
        "emergency_assistance_actions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("session_id", sa.String(36), sa.ForeignKey("emergency_assistance_sessions.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("step_id", sa.String(36), sa.ForeignKey("emergency_protocol_steps.id", ondelete="SET NULL"), nullable=True),
        sa.Column("step_number", sa.Integer(), nullable=False),
        sa.Column("instruction_delivered", sa.Text(), nullable=False),
        sa.Column("language", sa.String(10), default="en", nullable=False),
        sa.Column("status", sa.String(32), default="delivered", nullable=False, index=True),
        sa.Column("citizen_confirmation_text", sa.Text(), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.CheckConstraint(
            "status IN ('pending', 'delivered', 'acknowledged', 'completed_by_citizen', "
            "'not_completed', 'uncertain', 'escalated')"
        ),
    )

    # 10. Emergency Condition Updates
    op.create_table(
        "emergency_condition_updates",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("session_id", sa.String(36), sa.ForeignKey("emergency_assistance_sessions.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("reported_by", sa.String(20), nullable=False),
        sa.Column("condition_type", sa.String(40), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("severity_change", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # 11. AI Escalation Events
    op.create_table(
        "ai_escalation_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("session_id", sa.String(36), sa.ForeignKey("emergency_assistance_sessions.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("incident_id", sa.String(36), sa.ForeignKey("incidents.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("reason", sa.String(100), nullable=False),
        sa.Column("details", sa.Text(), nullable=False),
        sa.Column("escalation_level", sa.String(32), default="operator_alert", nullable=False),
        sa.Column("acknowledged_by", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.CheckConstraint("escalation_level IN ('operator_alert', 'urgent_dispatch', 'human_takeover')"),
    )

    # 12. AI Assistance Consents
    op.create_table(
        "ai_assistance_consents",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("incident_id", sa.String(36), sa.ForeignKey("incidents.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("phone_number", sa.String(32), nullable=False, index=True),
        sa.Column("callback_consented", sa.Boolean(), default=True),
        sa.Column("ai_disclosure_acknowledged", sa.Boolean(), default=True),
        sa.Column("recording_consented", sa.Boolean(), default=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(256), nullable=True),
        sa.Column("revoked", sa.Boolean(), default=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # 13. AI Callback Attempts
    op.create_table(
        "ai_callback_attempts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("session_id", sa.String(36), sa.ForeignKey("emergency_assistance_sessions.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("consent_id", sa.String(36), sa.ForeignKey("ai_assistance_consents.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("phone_number", sa.String(32), nullable=False),
        sa.Column("attempt_number", sa.Integer(), default=1),
        sa.Column("provider", sa.String(50), default="sarvam"),
        sa.Column("provider_attempt_id", sa.String(100), unique=True, nullable=True),
        sa.Column("status", sa.String(32), default="queued", nullable=False, index=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.CheckConstraint(
            "status IN ('queued', 'dialing', 'connected', 'no_answer', 'busy', 'failed', 'cancelled', 'completed')"
        ),
    )

    # 14. Emergency Handovers
    op.create_table(
        "emergency_handovers",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("session_id", sa.String(36), sa.ForeignKey("emergency_assistance_sessions.id", ondelete="CASCADE"), unique=True, nullable=False),
        sa.Column("incident_id", sa.String(36), sa.ForeignKey("incidents.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("responder_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("summary_markdown", sa.Text(), nullable=False),
        sa.Column("actions_completed_count", sa.Integer(), default=0),
        sa.Column("actions_uncompleted_count", sa.Integer(), default=0),
        sa.Column("condition_at_handover", sa.Text(), nullable=False),
        sa.Column("protocols_used", sa.JSON(), default=list),
        sa.Column("verified_by_responder", sa.Boolean(), default=False),
        sa.Column("handover_completed_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # Add Companion permissions
    COMPANION_PERMISSIONS = [
        {"action": "GET /api/v1/companion/health"},
        {"action": "POST /api/v1/companion/sessions"},
        {"action": "GET /api/v1/companion/sessions/{id}"},
        {"action": "POST /api/v1/companion/sessions/{id}/messages"},
        {"action": "POST /api/v1/companion/sessions/{id}/actions"},
        {"action": "POST /api/v1/companion/sessions/{id}/conditions"},
        {"action": "POST /api/v1/companion/sessions/{id}/escalate"},
        {"action": "POST /api/v1/companion/sessions/{id}/takeover"},
        {"action": "POST /api/v1/companion/sessions/{id}/handover"},
        {"action": "POST /api/v1/companion/callbacks"},
        {"action": "GET /api/v1/companion/protocols"},
        {"action": "POST /api/v1/companion/protocols"},
        {"action": "GET /api/v1/companion/protocols/{id}"},
        {"action": "POST /api/v1/companion/protocols/{id}/review"},
    ]

    for perm in COMPANION_PERMISSIONS:
        bind.execute(
            sa.text(
                "INSERT INTO permissions (action) VALUES (:action) "
                "ON CONFLICT (action) DO NOTHING"
            ),
            perm,
        )

    COMPANION_GRANTS = [
        # Admin gets full access
        {"role_id": "admin", "action": "GET /api/v1/companion/health"},
        {"role_id": "admin", "action": "POST /api/v1/companion/sessions"},
        {"role_id": "admin", "action": "GET /api/v1/companion/sessions/{id}"},
        {"role_id": "admin", "action": "POST /api/v1/companion/sessions/{id}/messages"},
        {"role_id": "admin", "action": "POST /api/v1/companion/sessions/{id}/actions"},
        {"role_id": "admin", "action": "POST /api/v1/companion/sessions/{id}/conditions"},
        {"role_id": "admin", "action": "POST /api/v1/companion/sessions/{id}/escalate"},
        {"role_id": "admin", "action": "POST /api/v1/companion/sessions/{id}/takeover"},
        {"role_id": "admin", "action": "POST /api/v1/companion/sessions/{id}/handover"},
        {"role_id": "admin", "action": "POST /api/v1/companion/callbacks"},
        {"role_id": "admin", "action": "GET /api/v1/companion/protocols"},
        {"role_id": "admin", "action": "POST /api/v1/companion/protocols"},
        {"role_id": "admin", "action": "GET /api/v1/companion/protocols/{id}"},
        {"role_id": "admin", "action": "POST /api/v1/companion/protocols/{id}/review"},
        # Operator permissions
        {"role_id": "operator", "action": "GET /api/v1/companion/health"},
        {"role_id": "operator", "action": "GET /api/v1/companion/sessions/{id}"},
        {"role_id": "operator", "action": "POST /api/v1/companion/sessions/{id}/takeover"},
        {"role_id": "operator", "action": "POST /api/v1/companion/sessions/{id}/handover"},
        {"role_id": "operator", "action": "GET /api/v1/companion/protocols"},
        {"role_id": "operator", "action": "GET /api/v1/companion/protocols/{id}"},
        # Responder permissions
        {"role_id": "responder", "action": "GET /api/v1/companion/sessions/{id}"},
        {"role_id": "responder", "action": "POST /api/v1/companion/sessions/{id}/handover"},
        # Citizen permissions
        {"role_id": "citizen", "action": "POST /api/v1/companion/sessions"},
        {"role_id": "citizen", "action": "GET /api/v1/companion/sessions/{id}"},
        {"role_id": "citizen", "action": "POST /api/v1/companion/sessions/{id}/messages"},
        {"role_id": "citizen", "action": "POST /api/v1/companion/sessions/{id}/actions"},
        {"role_id": "citizen", "action": "POST /api/v1/companion/sessions/{id}/conditions"},
        {"role_id": "citizen", "action": "POST /api/v1/companion/sessions/{id}/escalate"},
        {"role_id": "citizen", "action": "POST /api/v1/companion/callbacks"},
    ]

    for grant in COMPANION_GRANTS:
        bind.execute(
            sa.text(
                "INSERT INTO role_permissions (role_id, action) VALUES (:role_id, :action) "
                "ON CONFLICT DO NOTHING"
            ),
            grant,
        )


def downgrade():
    tables = [
        "emergency_handovers",
        "ai_callback_attempts",
        "ai_assistance_consents",
        "ai_escalation_events",
        "emergency_condition_updates",
        "emergency_assistance_actions",
        "emergency_conversation_messages",
        "emergency_assistance_sessions",
        "emergency_protocol_reviews",
        "emergency_protocol_translations",
        "emergency_protocol_steps",
        "emergency_protocol_versions",
        "emergency_protocols",
        "emergency_knowledge_sources",
    ]
    for tbl in tables:
        op.drop_table(tbl)


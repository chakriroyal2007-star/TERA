"""Workflow gaps: Mission cancel & reassign, START triage, geospatial duplicate merge, and hoax flagging.

Revision ID: 0020
Revises: 0019
Create Date: 2026-11-15
"""
from alembic import op
import sqlalchemy as sa

revision = '0020'
down_revision = '0019'


def upgrade():
    # 1. Mission cancellation fields
    op.add_column('missions', sa.Column('cancel_reason', sa.Text(), nullable=True))
    op.add_column('missions', sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True))

    # 2. Update missions status check constraint to include 'cancelled'
    op.drop_constraint('missions_status_check', 'missions', type_='check')
    op.create_check_constraint(
        'missions_status_check',
        'missions',
        "status IN ('assigned', 'acknowledged', 'en_route', 'on_scene', 'transporting', 'handover', 'completed', 'cancelled')"
    )

    # 3. Replace missions rigid incident unique constraint with partial unique index
    op.drop_constraint('missions_incident_id_key', 'missions', type_='unique')
    op.execute(
        "CREATE UNIQUE INDEX uq_active_mission_per_incident ON missions(incident_id) "
        "WHERE status NOT IN ('completed', 'cancelled')"
    )

    # 4. Update one_active_ambulance and one_active_responder to exclude 'cancelled'
    op.execute("DROP INDEX IF EXISTS one_active_ambulance")
    op.execute(
        "CREATE UNIQUE INDEX one_active_ambulance ON missions(ambulance_id) "
        "WHERE status NOT IN ('completed', 'cancelled')"
    )
    op.execute("DROP INDEX IF EXISTS one_active_responder")
    op.execute(
        "CREATE UNIQUE INDEX one_active_responder ON missions(responder_id) "
        "WHERE status NOT IN ('completed', 'cancelled')"
    )

    # 5. Incident fields for START triage, hoax flagging, and merge
    op.add_column('incidents', sa.Column('triage_summary', sa.JSON(), nullable=True, server_default='{}'))
    op.add_column('incidents', sa.Column('is_hoax', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.add_column('incidents', sa.Column('hoax_reason', sa.Text(), nullable=True))
    op.add_column('incidents', sa.Column('hoax_flagged_by_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True))
    op.add_column('incidents', sa.Column('merged_at', sa.DateTime(timezone=True), nullable=True))

    # 6. Patient START triage color
    op.add_column('patients', sa.Column('start_triage_color', sa.String(length=20), nullable=True, server_default='red'))

    # 7. RBAC Permissions
    actions = [
        "POST /api/v1/missions/{id}/cancel",
        "POST /api/v1/missions/{id}/reassign",
        "POST /api/v1/incidents/{id}/triage",
        "GET /api/v1/incidents/{id}/triage",
        "GET /api/v1/incidents/{id}/duplicates",
        "POST /api/v1/incidents/{id}/merge",
        "POST /api/v1/incidents/{id}/unmerge",
        "POST /api/v1/incidents/{id}/flag-hoax",
    ]
    for action in actions:
        op.execute(sa.text(f"INSERT INTO permissions (action) VALUES ('{action}') ON CONFLICT DO NOTHING"))

    role_perms = [
        ("operator", "POST /api/v1/missions/{id}/cancel"),
        ("admin", "POST /api/v1/missions/{id}/cancel"),
        ("operator", "POST /api/v1/missions/{id}/reassign"),
        ("admin", "POST /api/v1/missions/{id}/reassign"),
        ("operator", "POST /api/v1/incidents/{id}/triage"),
        ("admin", "POST /api/v1/incidents/{id}/triage"),
        ("responder", "POST /api/v1/incidents/{id}/triage"),
        ("operator", "GET /api/v1/incidents/{id}/triage"),
        ("admin", "GET /api/v1/incidents/{id}/triage"),
        ("responder", "GET /api/v1/incidents/{id}/triage"),
        ("hospital", "GET /api/v1/incidents/{id}/triage"),
        ("analyst", "GET /api/v1/incidents/{id}/triage"),
        ("operator", "GET /api/v1/incidents/{id}/duplicates"),
        ("admin", "GET /api/v1/incidents/{id}/duplicates"),
        ("operator", "POST /api/v1/incidents/{id}/merge"),
        ("admin", "POST /api/v1/incidents/{id}/merge"),
        ("operator", "POST /api/v1/incidents/{id}/unmerge"),
        ("admin", "POST /api/v1/incidents/{id}/unmerge"),
        ("operator", "POST /api/v1/incidents/{id}/flag-hoax"),
        ("admin", "POST /api/v1/incidents/{id}/flag-hoax"),
    ]
    for role_id, action in role_perms:
        op.execute(sa.text(f"INSERT INTO role_permissions (role_id, action) VALUES ('{role_id}', '{action}') ON CONFLICT DO NOTHING"))


def downgrade():
    op.execute(sa.text("DELETE FROM role_permissions WHERE action LIKE '%/missions/{id}/cancel%' OR action LIKE '%/missions/{id}/reassign%' OR action LIKE '%/incidents/{id}/triage%' OR action LIKE '%/incidents/{id}/duplicates%' OR action LIKE '%/incidents/{id}/merge%' OR action LIKE '%/incidents/{id}/unmerge%' OR action LIKE '%/incidents/{id}/flag-hoax%'"))
    op.execute(sa.text("DELETE FROM permissions WHERE action LIKE '%/missions/{id}/cancel%' OR action LIKE '%/missions/{id}/reassign%' OR action LIKE '%/incidents/{id}/triage%' OR action LIKE '%/incidents/{id}/duplicates%' OR action LIKE '%/incidents/{id}/merge%' OR action LIKE '%/incidents/{id}/unmerge%' OR action LIKE '%/incidents/{id}/flag-hoax%'"))

    op.drop_column('patients', 'start_triage_color')
    op.drop_column('incidents', 'merged_at')
    op.drop_column('incidents', 'hoax_flagged_by_id')
    op.drop_column('incidents', 'hoax_reason')
    op.drop_column('incidents', 'is_hoax')
    op.drop_column('incidents', 'triage_summary')

    op.execute("DROP INDEX IF EXISTS one_active_responder")
    op.execute(
        "CREATE UNIQUE INDEX one_active_responder ON missions(responder_id) "
        "WHERE status::text <> 'completed'::text"
    )
    op.execute("DROP INDEX IF EXISTS one_active_ambulance")
    op.execute(
        "CREATE UNIQUE INDEX one_active_ambulance ON missions(ambulance_id) "
        "WHERE status::text <> 'completed'::text"
    )
    op.execute("DROP INDEX IF EXISTS uq_active_mission_per_incident")
    op.create_unique_constraint('missions_incident_id_key', 'missions', ['incident_id'])

    op.drop_constraint('missions_status_check', 'missions', type_='check')
    op.create_check_constraint(
        'missions_status_check',
        'missions',
        "status::text = ANY (ARRAY['assigned'::character varying, 'acknowledged'::character varying, 'en_route'::character varying, 'on_scene'::character varying, 'transporting'::character varying, 'handover'::character varying, 'completed'::character varying]::text[])"
    )

    op.drop_column('missions', 'cancelled_at')
    op.drop_column('missions', 'cancel_reason')


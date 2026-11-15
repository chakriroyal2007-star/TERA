"""Add telemetry consent and ambulance telemetry history table.

Revision ID: 0018
Revises: 0017
Create Date: 2026-11-15
"""
from alembic import op
import sqlalchemy as sa

revision = '0018'
down_revision = '0017'


def upgrade():
    op.add_column('missions', sa.Column('telemetry_consent', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.create_table(
        'ambulance_telemetry_history',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('mission_id', sa.String(length=36), sa.ForeignKey('missions.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('ambulance_id', sa.String(length=36), sa.ForeignKey('ambulances.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('latitude', sa.Float(), nullable=False),
        sa.Column('longitude', sa.Float(), nullable=False),
        sa.Column('speed', sa.Float(), nullable=True),
        sa.Column('heading', sa.Float(), nullable=True),
        sa.Column('accuracy', sa.Float(), nullable=True),
        sa.Column('recorded_at', sa.DateTime(timezone=True), nullable=False, index=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_telemetry_mission_recorded', 'ambulance_telemetry_history', ['mission_id', 'recorded_at'])

    actions = [
        "POST /api/v1/missions/{id}/telemetry",
        "GET /api/v1/missions/{id}/telemetry",
        "GET /api/v1/missions/{id}/trail",
        "POST /api/v1/missions/{id}/advance",
    ]
    for action in actions:
        op.execute(sa.text(f"INSERT INTO permissions (action) VALUES ('{action}') ON CONFLICT DO NOTHING"))

    role_perms = [
        ("responder", "POST /api/v1/missions/{id}/telemetry"),
        ("operator", "POST /api/v1/missions/{id}/telemetry"),
        ("responder", "GET /api/v1/missions/{id}/telemetry"),
        ("operator", "GET /api/v1/missions/{id}/telemetry"),
        ("hospital", "GET /api/v1/missions/{id}/telemetry"),
        ("analyst", "GET /api/v1/missions/{id}/telemetry"),
        ("responder", "GET /api/v1/missions/{id}/trail"),
        ("operator", "GET /api/v1/missions/{id}/trail"),
        ("hospital", "GET /api/v1/missions/{id}/trail"),
        ("analyst", "GET /api/v1/missions/{id}/trail"),
        ("responder", "POST /api/v1/missions/{id}/advance"),
        ("operator", "POST /api/v1/missions/{id}/advance"),
    ]
    for role_id, action in role_perms:
        op.execute(sa.text(f"INSERT INTO role_permissions (role_id, action) VALUES ('{role_id}', '{action}') ON CONFLICT DO NOTHING"))


def downgrade():
    op.execute(sa.text("DELETE FROM role_permissions WHERE action LIKE '%/missions/{id}/telemetry%' OR action LIKE '%/missions/{id}/trail%' OR action LIKE '%/missions/{id}/advance%'"))
    op.execute(sa.text("DELETE FROM permissions WHERE action LIKE '%/missions/{id}/telemetry%' OR action LIKE '%/missions/{id}/trail%' OR action LIKE '%/missions/{id}/advance%'"))
    op.drop_index('ix_telemetry_mission_recorded', table_name='ambulance_telemetry_history')
    op.drop_table('ambulance_telemetry_history')
    op.drop_column('missions', 'telemetry_consent')

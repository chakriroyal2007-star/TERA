"""Add dispatch intelligence, hospital specialties, and ranking weights.

Revision ID: 0019
Revises: 0018
Create Date: 2026-11-15
"""
from alembic import op
import sqlalchemy as sa

revision = '0019'
down_revision = '0018'


def upgrade():
    # 1. Hospital specialties and status
    op.add_column('hospitals', sa.Column('specialties', sa.JSON(), nullable=True, server_default='["trauma", "emergency"]'))
    op.add_column('hospitals', sa.Column('diversion_status', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.add_column('hospitals', sa.Column('operating_hours', sa.String(length=100), nullable=True, server_default='24/7 Emergency'))

    # 2. Mission ranking score & override reason
    op.add_column('missions', sa.Column('ranking_score', sa.Float(), nullable=True))
    op.add_column('missions', sa.Column('ranking_breakdown', sa.JSON(), nullable=True))
    op.add_column('missions', sa.Column('override_reason', sa.Text(), nullable=True))

    # 3. Dispatch weights config table
    op.create_table(
        'dispatch_ranking_weights',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('organization_id', sa.String(length=36), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=True),
        sa.Column('eta_weight', sa.Float(), nullable=False, server_default='0.40'),
        sa.Column('capability_weight', sa.Float(), nullable=False, server_default='0.30'),
        sa.Column('readiness_weight', sa.Float(), nullable=False, server_default='0.20'),
        sa.Column('workload_fairness_weight', sa.Float(), nullable=False, server_default='0.10'),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_by_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
    )

    # 4. RBAC Permissions
    actions = [
        "GET /api/v1/dispatch/recommendations/{incident_id}",
        "GET /api/v1/dispatch/weights",
        "PATCH /api/v1/dispatch/weights",
        "PATCH /api/v1/hospitals/{id}/status",
    ]
    for action in actions:
        op.execute(sa.text(f"INSERT INTO permissions (action) VALUES ('{action}') ON CONFLICT DO NOTHING"))

    role_perms = [
        ("operator", "GET /api/v1/dispatch/recommendations/{incident_id}"),
        ("admin", "GET /api/v1/dispatch/recommendations/{incident_id}"),
        ("analyst", "GET /api/v1/dispatch/recommendations/{incident_id}"),
        ("admin", "GET /api/v1/dispatch/weights"),
        ("operator", "GET /api/v1/dispatch/weights"),
        ("admin", "PATCH /api/v1/dispatch/weights"),
        ("hospital", "PATCH /api/v1/hospitals/{id}/status"),
        ("admin", "PATCH /api/v1/hospitals/{id}/status"),
        ("operator", "PATCH /api/v1/hospitals/{id}/status"),
    ]
    for role_id, action in role_perms:
        op.execute(sa.text(f"INSERT INTO role_permissions (role_id, action) VALUES ('{role_id}', '{action}') ON CONFLICT DO NOTHING"))


def downgrade():
    op.execute(sa.text("DELETE FROM role_permissions WHERE action LIKE '%/dispatch/%' OR action LIKE '%/hospitals/{id}/status%'"))
    op.execute(sa.text("DELETE FROM permissions WHERE action LIKE '%/dispatch/%' OR action LIKE '%/hospitals/{id}/status%'"))
    op.drop_table('dispatch_ranking_weights')
    op.drop_column('missions', 'override_reason')
    op.drop_column('missions', 'ranking_breakdown')
    op.drop_column('missions', 'ranking_score')
    op.drop_column('hospitals', 'operating_hours')
    op.drop_column('hospitals', 'diversion_status')
    op.drop_column('hospitals', 'specialties')


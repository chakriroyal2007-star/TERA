"""Analytics: Golden-hour SLAs, accident hotspots, CSV export, and voice accuracy.

Revision ID: 0021
Revises: 0020
Create Date: 2026-11-16
"""
from alembic import op
import sqlalchemy as sa

revision = '0021'
down_revision = '0020'


def upgrade():
    actions = [
        "GET /api/v1/analytics/hotspots",
        "GET /api/v1/analytics/export/csv",
        "GET /api/v1/analytics/voice-accuracy",
        "GET /api/v1/analytics/sla-summary",
    ]
    for action in actions:
        op.execute(sa.text(f"INSERT INTO permissions (action) VALUES ('{action}') ON CONFLICT DO NOTHING"))

    roles = ["analyst", "admin", "operator"]
    for role in roles:
        for action in actions:
            op.execute(sa.text(f"INSERT INTO role_permissions (role_id, action) VALUES ('{role}', '{action}') ON CONFLICT DO NOTHING"))


def downgrade():
    op.execute(sa.text("DELETE FROM role_permissions WHERE action LIKE '%/analytics/hotspots%' OR action LIKE '%/analytics/export/csv%' OR action LIKE '%/analytics/voice-accuracy%' OR action LIKE '%/analytics/sla-summary%'"))
    op.execute(sa.text("DELETE FROM permissions WHERE action LIKE '%/analytics/hotspots%' OR action LIKE '%/analytics/export/csv%' OR action LIKE '%/analytics/voice-accuracy%' OR action LIKE '%/analytics/sla-summary%'"))


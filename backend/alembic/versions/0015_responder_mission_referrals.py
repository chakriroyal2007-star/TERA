"""Grant responder permissions to view referrals."""
from alembic import op
import sqlalchemy as sa

revision = '0015'
down_revision = '0014'


def upgrade():
    op.execute(
        sa.text(
            "INSERT INTO role_permissions (role_id, action) VALUES "
            "('responder', 'GET /api/v1/referrals') "
            "ON CONFLICT DO NOTHING"
        )
    )


def downgrade():
    op.execute(
        sa.text(
            "DELETE FROM role_permissions WHERE role_id = 'responder' AND action = 'GET /api/v1/referrals'"
        )
    )

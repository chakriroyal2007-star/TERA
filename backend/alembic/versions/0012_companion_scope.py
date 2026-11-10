"""Grant scoped companion lookup to operators."""
from alembic import op
import sqlalchemy as sa
revision = "0012"
down_revision = "0011"
action = "GET /api/v1/companion/incidents/{incident_id}/session"

def upgrade():
    op.execute(sa.text("INSERT INTO permissions(action) VALUES (:action) ON CONFLICT DO NOTHING").bindparams(action=action))
    op.execute(sa.text("INSERT INTO role_permissions(role_id,action) VALUES ('operator',:action) ON CONFLICT DO NOTHING").bindparams(action=action))

def downgrade():
    op.execute(sa.text("DELETE FROM role_permissions WHERE action=:action").bindparams(action=action))
    op.execute(sa.text("DELETE FROM permissions WHERE action=:action").bindparams(action=action))

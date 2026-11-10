"""Grant schema education endpoints to authorized staff."""
from alembic import op
import sqlalchemy as sa
revision = "0010"
down_revision = "0009"

def upgrade():
    for role in ("operator", "analyst"):
        for path in ("overview", "tables", "er-model", "relational-schema", "normalization/tables", "indexes", "documentation"):
            action = "GET /api/v1/dbms/" + path
            op.execute(sa.text("INSERT INTO permissions(action) VALUES (:action) ON CONFLICT DO NOTHING").bindparams(action=action))
            op.execute(sa.text("INSERT INTO role_permissions(role_id,action) VALUES (:role,:action) ON CONFLICT DO NOTHING").bindparams(role=role, action=action))
        for path in ("fd/closure", "fd/analyze"):
            action = "POST /api/v1/dbms/" + path
            op.execute(sa.text("INSERT INTO permissions(action) VALUES (:action) ON CONFLICT DO NOTHING").bindparams(action=action))
            op.execute(sa.text("INSERT INTO role_permissions(role_id,action) VALUES (:role,:action) ON CONFLICT DO NOTHING").bindparams(role=role, action=action))

def downgrade():
    op.execute("DELETE FROM role_permissions WHERE action LIKE '% /api/v1/dbms/%' AND role_id IN ('operator','analyst')")

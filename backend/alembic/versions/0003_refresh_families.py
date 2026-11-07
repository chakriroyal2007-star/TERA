"""Track refresh-token families and revoke descendants on token reuse."""

from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"


def upgrade():
    op.add_column("sessions", sa.Column("family_id", sa.String(36), nullable=True))
    op.execute("UPDATE sessions SET family_id=id")
    op.alter_column("sessions", "family_id", nullable=False)
    op.create_index("ix_sessions_family_id", "sessions", ["family_id"])


def downgrade():
    op.drop_index("ix_sessions_family_id", table_name="sessions")
    op.drop_column("sessions", "family_id")

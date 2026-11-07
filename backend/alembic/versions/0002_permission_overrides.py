"""Explicit per-user restrictions within the fixed six-role security boundaries."""

from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"


def upgrade():
    op.create_table(
        "permission_overrides",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("action", sa.String(200), nullable=False),
        sa.Column("denied", sa.Boolean(), nullable=False),
        sa.UniqueConstraint("user_id", "action"),
    )
    op.create_index("ix_permission_overrides_user_id", "permission_overrides", ["user_id"])


def downgrade():
    op.drop_table("permission_overrides")

"""Google profile confirmation and administrator-reviewed role requests."""
from alembic import op
import sqlalchemy as sa
revision = "0013"
down_revision = "0012"


def upgrade():
    op.add_column("users", sa.Column("onboarding_completed", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.create_table("role_requests",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False, unique=True),
        sa.Column("requested_role", sa.String(32), nullable=False),
        sa.Column("status", sa.String(24), nullable=False))


def downgrade():
    op.drop_table("role_requests")
    op.drop_column("users", "onboarding_completed")

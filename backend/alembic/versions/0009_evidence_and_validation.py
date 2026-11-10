"""Persist pending evidence and enforce casualty ranges."""
from alembic import op
import sqlalchemy as sa
revision = "0009"
down_revision = "0008"

def upgrade():
    op.alter_column("evidence", "incident_id", existing_type=sa.String(36), nullable=True)
    op.create_check_constraint("incident_casualties_nonnegative", "incidents", "casualties_count >= 0")

def downgrade():
    op.drop_constraint("incident_casualties_nonnegative", "incidents", type_="check")
    # Pending evidence must be associated before reverting to the old schema.
    op.alter_column("evidence", "incident_id", existing_type=sa.String(36), nullable=False)

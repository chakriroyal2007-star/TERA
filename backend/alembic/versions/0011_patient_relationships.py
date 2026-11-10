"""Enforce patient/referral relationships omitted by hospital onboarding migration."""
from alembic import op
import sqlalchemy as sa
revision = "0011"
down_revision = "0010"

def upgrade():
    inspector = sa.inspect(op.get_bind())
    for table, column, target in (("patients", "assigned_hospital_id", "hospitals"), ("patients", "referral_id", "referrals"), ("referrals", "patient_id", "patients")):
        existing = {tuple(fk["constrained_columns"]) for fk in inspector.get_foreign_keys(table)}
        if (column,) not in existing:
            op.create_foreign_key(f"{table}_{column}_fk", table, target, [column], ["id"])

def downgrade():
    for table, column in (("patients", "assigned_hospital_id"), ("patients", "referral_id"), ("referrals", "patient_id")):
        op.drop_constraint(f"{table}_{column}_fk", table, type_="foreignkey")

"""Dynamic hospital association for users, incidents, reports, and ambulances.

Revision ID: 0022
Revises: 0021
Create Date: 2026-11-17
"""
from alembic import op
import sqlalchemy as sa

revision = '0022'
down_revision = '0021'


def upgrade():
    # 1. Add hospital_id to users
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("hospital_id", sa.String(36), nullable=True))
        batch_op.create_foreign_key("fk_users_hospital_id", "hospitals", ["hospital_id"], ["id"], ondelete="SET NULL")
        batch_op.create_index("ix_users_hospital_id", ["hospital_id"])

    # 2. Add hospital_id to incidents
    with op.batch_alter_table("incidents") as batch_op:
        batch_op.add_column(sa.Column("hospital_id", sa.String(36), nullable=True))
        batch_op.create_foreign_key("fk_incidents_hospital_id", "hospitals", ["hospital_id"], ["id"], ondelete="SET NULL")
        batch_op.create_index("ix_incidents_hospital_id", ["hospital_id"])

    # 3. Add hospital_id to reports
    with op.batch_alter_table("reports") as batch_op:
        batch_op.add_column(sa.Column("hospital_id", sa.String(36), nullable=True))
        batch_op.create_foreign_key("fk_reports_hospital_id", "hospitals", ["hospital_id"], ["id"], ondelete="SET NULL")
        batch_op.create_index("ix_reports_hospital_id", ["hospital_id"])

    # 4. Add hospital_id to ambulances
    with op.batch_alter_table("ambulances") as batch_op:
        batch_op.add_column(sa.Column("hospital_id", sa.String(36), nullable=True))
        batch_op.create_foreign_key("fk_ambulances_hospital_id", "hospitals", ["hospital_id"], ["id"], ondelete="SET NULL")
        batch_op.create_index("ix_ambulances_hospital_id", ["hospital_id"])

    # 5. Add auth/hospital permissions
    actions = [
        "POST /api/v1/auth/set-hospital",
        "GET /api/v1/public/hospitals",
    ]
    for action in actions:
        op.execute(sa.text(f"INSERT INTO permissions (action) VALUES ('{action}') ON CONFLICT DO NOTHING"))

    roles = ["hospital", "responder", "operator", "admin", "analyst"]
    for role in roles:
        for action in actions:
            op.execute(sa.text(f"INSERT INTO role_permissions (role_id, action) VALUES ('{role}', '{action}') ON CONFLICT DO NOTHING"))


def downgrade():
    with op.batch_alter_table("ambulances") as batch_op:
        batch_op.drop_index("ix_ambulances_hospital_id")
        batch_op.drop_constraint("fk_ambulances_hospital_id", type_="foreignkey")
        batch_op.drop_column("hospital_id")

    with op.batch_alter_table("reports") as batch_op:
        batch_op.drop_index("ix_reports_hospital_id")
        batch_op.drop_constraint("fk_reports_hospital_id", type_="foreignkey")
        batch_op.drop_column("hospital_id")

    with op.batch_alter_table("incidents") as batch_op:
        batch_op.drop_index("ix_incidents_hospital_id")
        batch_op.drop_constraint("fk_incidents_hospital_id", type_="foreignkey")
        batch_op.drop_column("hospital_id")

    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_index("ix_users_hospital_id")
        batch_op.drop_constraint("fk_users_hospital_id", type_="foreignkey")
        batch_op.drop_column("hospital_id")

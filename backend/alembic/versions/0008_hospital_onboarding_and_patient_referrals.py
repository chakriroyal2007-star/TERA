"""Hospital Onboarding, Facilities, Bed Capacity Concurrency, and Patient Referrals."""

from alembic import op
import sqlalchemy as sa

revision = "0008"
down_revision = "0007"


def upgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)

    # 1. New columns for hospitals
    existing_hosp_cols = {c["name"] for c in insp.get_columns("hospitals")}
    hosp_cols = [
        ("hospital_type", sa.String(80)),
        ("reg_identifier", sa.String(80)),
        ("phone", sa.String(40)),
        ("email", sa.String(120)),
        ("address", sa.String(255)),
        ("city", sa.String(100)),
        ("state", sa.String(100)),
        ("postal_code", sa.String(20)),
        ("country", sa.String(100)),
        ("contact_person", sa.String(120)),
        ("contact_designation", sa.String(120)),
        ("emergency_phone", sa.String(40)),
        ("operating_status", sa.String(40)),
        ("verification_status", sa.String(40)),
        ("rejection_reason", sa.Text()),
        ("capabilities", sa.JSON()),
        ("last_capacity_update", sa.DateTime(timezone=True)),
    ]
    for col_name, col_type in hosp_cols:
        if col_name not in existing_hosp_cols:
            op.add_column("hospitals", sa.Column(col_name, col_type, nullable=True))

    # 2. New columns for departments
    existing_dept_cols = {c["name"] for c in insp.get_columns("departments")}
    dept_cols = [
        ("dept_type", sa.String(80)),
        ("status", sa.String(40)),
        ("contact_number", sa.String(40)),
        ("head_name", sa.String(120)),
        ("operating_hours", sa.String(80)),
    ]
    for col_name, col_type in dept_cols:
        if col_name not in existing_dept_cols:
            op.add_column("departments", sa.Column(col_name, col_type, nullable=True))

    # 3. New columns for capacities
    existing_cap_cols = {c["name"] for c in insp.get_columns("capacities")}
    if "out_of_service" not in existing_cap_cols:
        op.add_column("capacities", sa.Column("out_of_service", sa.Integer(), nullable=True, server_default="0"))
    try:
        op.drop_constraint("capacities_kind_check", "capacities", type_="check")
    except Exception:
        pass

    # 4. Create capacity_history table
    existing_tables = set(insp.get_table_names())
    if "capacity_history" not in existing_tables:
        op.create_table(
            "capacity_history",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("hospital_id", sa.String(36), sa.ForeignKey("hospitals.id", ondelete="CASCADE"), index=True, nullable=False),
            sa.Column("capacity_id", sa.String(36), sa.ForeignKey("capacities.id", ondelete="CASCADE"), index=True, nullable=False),
            sa.Column("previous_total", sa.Integer(), default=0),
            sa.Column("previous_occupied", sa.Integer(), default=0),
            sa.Column("previous_reserved", sa.Integer(), default=0),
            sa.Column("new_total", sa.Integer(), default=0),
            sa.Column("new_occupied", sa.Integer(), default=0),
            sa.Column("new_reserved", sa.Integer(), default=0),
            sa.Column("updated_by_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("reason", sa.String(255), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        )

    # 5. Create or upgrade patients table
    if "patients" not in existing_tables:
        op.create_table(
            "patients",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("incident_id", sa.String(36), sa.ForeignKey("incidents.id", ondelete="CASCADE"), index=True, nullable=False),
            sa.Column("name", sa.String(120), default="Unidentified Patient"),
            sa.Column("triage_priority", sa.String(24), default="immediate"),
            sa.Column("age", sa.Integer(), nullable=True),
            sa.Column("gender", sa.String(20), nullable=True),
            sa.Column("condition_summary", sa.Text(), nullable=True),
            sa.Column("requested_department", sa.String(100), nullable=True),
            sa.Column("required_bed_category", sa.String(40), nullable=True),
            sa.Column("assigned_hospital_id", sa.String(36), sa.ForeignKey("hospitals.id", ondelete="SET NULL"), nullable=True),
            sa.Column("referral_id", sa.String(36), nullable=True),
            sa.Column("arrival_status", sa.String(40), default="pending"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        )
    else:
        existing_pat_cols = {c["name"] for c in insp.get_columns("patients")}
        pat_cols = [
            ("triage_priority", sa.String(24)),
            ("age", sa.Integer()),
            ("gender", sa.String(20)),
            ("condition_summary", sa.Text()),
            ("requested_department", sa.String(100)),
            ("required_bed_category", sa.String(40)),
            ("assigned_hospital_id", sa.String(36)),
            ("referral_id", sa.String(36)),
            ("arrival_status", sa.String(40)),
        ]
        for col_name, col_type in pat_cols:
            if col_name not in existing_pat_cols:
                op.add_column("patients", sa.Column(col_name, col_type, nullable=True))
        for col_name in ["local_identifier", "triage_level", "observations", "allergies"]:
            if col_name in existing_pat_cols:
                try:
                    op.alter_column("patients", col_name, nullable=True)
                except Exception:
                    pass

    # 6. New columns for referrals
    existing_ref_cols = {c["name"] for c in insp.get_columns("referrals")}
    ref_cols = [
        ("patient_id", sa.String(36)),
        ("priority", sa.String(24)),
        ("eta_minutes", sa.Integer()),
        ("notes", sa.Text()),
    ]
    for col_name, col_type in ref_cols:
        if col_name not in existing_ref_cols:
            op.add_column("referrals", sa.Column(col_name, col_type, nullable=True))
    try:
        op.drop_constraint("referrals_status_check", "referrals", type_="check")
        op.create_check_constraint(
            "referrals_status_check",
            "referrals",
            "status IN ('pending', 'accepted', 'rejected', 'arrived', 'handed_over')",
        )
    except Exception:
        pass

    # 7. Add permissions and role grants
    HOSP_ACTIONS = [
        "GET /api/v1/hospital/profile",
        "POST /api/v1/hospital/onboard",
        "GET /api/v1/hospital/capacity-history",
        "GET /api/v1/incidents/{id}/patients",
        "POST /api/v1/incidents/{id}/patients",
        "GET /api/v1/incidents/{id}/hospital-recommendations",
        "POST /api/v1/referrals/{id}/arrival",
        "POST /api/v1/admin/hospitals/{id}/verify",
    ]
    for act in HOSP_ACTIONS:
        bind.execute(
            sa.text("INSERT INTO permissions (action) VALUES (:action) ON CONFLICT DO NOTHING"),
            {"action": act},
        )

    GRANTS = [
        {"role_id": "hospital", "action": "GET /api/v1/hospital/profile"},
        {"role_id": "hospital", "action": "POST /api/v1/hospital/onboard"},
        {"role_id": "hospital", "action": "GET /api/v1/hospital/capacity-history"},
        {"role_id": "hospital", "action": "GET /api/v1/incidents/{id}/patients"},
        {"role_id": "hospital", "action": "POST /api/v1/referrals/{id}/arrival"},
        {"role_id": "operator", "action": "GET /api/v1/incidents/{id}/patients"},
        {"role_id": "operator", "action": "POST /api/v1/incidents/{id}/patients"},
        {"role_id": "operator", "action": "GET /api/v1/incidents/{id}/hospital-recommendations"},
        {"role_id": "operator", "action": "GET /api/v1/hospital/profile"},
        {"role_id": "responder", "action": "GET /api/v1/incidents/{id}/patients"},
    ]
    for g in GRANTS:
        bind.execute(
            sa.text("INSERT INTO role_permissions (role_id, action) VALUES (:role_id, :action) ON CONFLICT DO NOTHING"),
            g,
        )


def downgrade():
    pass

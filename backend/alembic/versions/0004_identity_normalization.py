"""Normalize identity scope and persist the six-role permission matrix."""

from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"

PERMISSIONS = [
    {"action": "GET /api/v1/ambulances"},
    {"action": "GET /api/v1/analytics"},
    {"action": "GET /api/v1/audit"},
    {"action": "GET /api/v1/departments"},
    {"action": "GET /api/v1/evidence/{id}"},
    {"action": "GET /api/v1/hospitals"},
    {"action": "GET /api/v1/incidents"},
    {"action": "GET /api/v1/incidents/{id}"},
    {"action": "GET /api/v1/incidents/{id}/evidence"},
    {"action": "GET /api/v1/incidents/{id}/suggestions"},
    {"action": "GET /api/v1/missions"},
    {"action": "GET /api/v1/notifications"},
    {"action": "GET /api/v1/organizations"},
    {"action": "GET /api/v1/permissions"},
    {"action": "GET /api/v1/referrals"},
    {"action": "GET /api/v1/responders"},
    {"action": "GET /api/v1/system"},
    {"action": "GET /api/v1/users"},
    {"action": "PATCH /api/v1/ambulances/{id}"},
    {"action": "PATCH /api/v1/capacities/{id}"},
    {"action": "PATCH /api/v1/hospitals/{id}"},
    {"action": "PATCH /api/v1/users/{id}"},
    {"action": "PATCH /api/v1/users/{id}/access"},
    {"action": "POST /api/v1/ambulances"},
    {"action": "POST /api/v1/capacities"},
    {"action": "POST /api/v1/departments"},
    {"action": "POST /api/v1/hospitals"},
    {"action": "POST /api/v1/incidents/{id}/close"},
    {"action": "POST /api/v1/incidents/{id}/dispatch"},
    {"action": "POST /api/v1/incidents/{id}/duplicate"},
    {"action": "POST /api/v1/incidents/{id}/priority"},
    {"action": "POST /api/v1/incidents/{id}/referrals"},
    {"action": "POST /api/v1/incidents/{id}/verify"},
    {"action": "POST /api/v1/invitations"},
    {"action": "POST /api/v1/missions/{id}/location"},
    {"action": "POST /api/v1/missions/{id}/progress"},
    {"action": "POST /api/v1/organizations"},
    {"action": "POST /api/v1/referrals/{id}/decision"},
    {"action": "POST /api/v1/referrals/{id}/handover"},
    {"action": "PUT /api/v1/permissions"},
]
GRANTS = [
    {"role_id": "admin", "action": "GET /api/v1/ambulances"},
    {"role_id": "analyst", "action": "GET /api/v1/ambulances"},
    {"role_id": "operator", "action": "GET /api/v1/ambulances"},
    {"role_id": "admin", "action": "GET /api/v1/analytics"},
    {"role_id": "analyst", "action": "GET /api/v1/analytics"},
    {"role_id": "operator", "action": "GET /api/v1/analytics"},
    {"role_id": "admin", "action": "GET /api/v1/audit"},
    {"role_id": "admin", "action": "GET /api/v1/departments"},
    {"role_id": "hospital", "action": "GET /api/v1/departments"},
    {"role_id": "admin", "action": "GET /api/v1/evidence/{id}"},
    {"role_id": "hospital", "action": "GET /api/v1/evidence/{id}"},
    {"role_id": "operator", "action": "GET /api/v1/evidence/{id}"},
    {"role_id": "responder", "action": "GET /api/v1/evidence/{id}"},
    {"role_id": "admin", "action": "GET /api/v1/hospitals"},
    {"role_id": "analyst", "action": "GET /api/v1/hospitals"},
    {"role_id": "hospital", "action": "GET /api/v1/hospitals"},
    {"role_id": "operator", "action": "GET /api/v1/hospitals"},
    {"role_id": "responder", "action": "GET /api/v1/hospitals"},
    {"role_id": "admin", "action": "GET /api/v1/incidents"},
    {"role_id": "analyst", "action": "GET /api/v1/incidents"},
    {"role_id": "hospital", "action": "GET /api/v1/incidents"},
    {"role_id": "operator", "action": "GET /api/v1/incidents"},
    {"role_id": "responder", "action": "GET /api/v1/incidents"},
    {"role_id": "admin", "action": "GET /api/v1/incidents/{id}"},
    {"role_id": "analyst", "action": "GET /api/v1/incidents/{id}"},
    {"role_id": "hospital", "action": "GET /api/v1/incidents/{id}"},
    {"role_id": "operator", "action": "GET /api/v1/incidents/{id}"},
    {"role_id": "responder", "action": "GET /api/v1/incidents/{id}"},
    {"role_id": "admin", "action": "GET /api/v1/incidents/{id}/evidence"},
    {"role_id": "hospital", "action": "GET /api/v1/incidents/{id}/evidence"},
    {"role_id": "operator", "action": "GET /api/v1/incidents/{id}/evidence"},
    {"role_id": "responder", "action": "GET /api/v1/incidents/{id}/evidence"},
    {"role_id": "admin", "action": "GET /api/v1/incidents/{id}/suggestions"},
    {"role_id": "operator", "action": "GET /api/v1/incidents/{id}/suggestions"},
    {"role_id": "admin", "action": "GET /api/v1/missions"},
    {"role_id": "analyst", "action": "GET /api/v1/missions"},
    {"role_id": "operator", "action": "GET /api/v1/missions"},
    {"role_id": "responder", "action": "GET /api/v1/missions"},
    {"role_id": "admin", "action": "GET /api/v1/notifications"},
    {"role_id": "analyst", "action": "GET /api/v1/notifications"},
    {"role_id": "hospital", "action": "GET /api/v1/notifications"},
    {"role_id": "operator", "action": "GET /api/v1/notifications"},
    {"role_id": "responder", "action": "GET /api/v1/notifications"},
    {"role_id": "admin", "action": "GET /api/v1/organizations"},
    {"role_id": "admin", "action": "GET /api/v1/permissions"},
    {"role_id": "admin", "action": "GET /api/v1/referrals"},
    {"role_id": "analyst", "action": "GET /api/v1/referrals"},
    {"role_id": "hospital", "action": "GET /api/v1/referrals"},
    {"role_id": "operator", "action": "GET /api/v1/referrals"},
    {"role_id": "admin", "action": "GET /api/v1/responders"},
    {"role_id": "operator", "action": "GET /api/v1/responders"},
    {"role_id": "admin", "action": "GET /api/v1/system"},
    {"role_id": "admin", "action": "GET /api/v1/users"},
    {"role_id": "admin", "action": "PATCH /api/v1/ambulances/{id}"},
    {"role_id": "admin", "action": "PATCH /api/v1/capacities/{id}"},
    {"role_id": "hospital", "action": "PATCH /api/v1/capacities/{id}"},
    {"role_id": "admin", "action": "PATCH /api/v1/hospitals/{id}"},
    {"role_id": "hospital", "action": "PATCH /api/v1/hospitals/{id}"},
    {"role_id": "admin", "action": "PATCH /api/v1/users/{id}"},
    {"role_id": "admin", "action": "PATCH /api/v1/users/{id}/access"},
    {"role_id": "admin", "action": "POST /api/v1/ambulances"},
    {"role_id": "admin", "action": "POST /api/v1/capacities"},
    {"role_id": "hospital", "action": "POST /api/v1/capacities"},
    {"role_id": "admin", "action": "POST /api/v1/departments"},
    {"role_id": "hospital", "action": "POST /api/v1/departments"},
    {"role_id": "admin", "action": "POST /api/v1/hospitals"},
    {"role_id": "admin", "action": "POST /api/v1/incidents/{id}/close"},
    {"role_id": "operator", "action": "POST /api/v1/incidents/{id}/close"},
    {"role_id": "admin", "action": "POST /api/v1/incidents/{id}/dispatch"},
    {"role_id": "operator", "action": "POST /api/v1/incidents/{id}/dispatch"},
    {"role_id": "admin", "action": "POST /api/v1/incidents/{id}/duplicate"},
    {"role_id": "operator", "action": "POST /api/v1/incidents/{id}/duplicate"},
    {"role_id": "admin", "action": "POST /api/v1/incidents/{id}/priority"},
    {"role_id": "operator", "action": "POST /api/v1/incidents/{id}/priority"},
    {"role_id": "admin", "action": "POST /api/v1/incidents/{id}/referrals"},
    {"role_id": "operator", "action": "POST /api/v1/incidents/{id}/referrals"},
    {"role_id": "admin", "action": "POST /api/v1/incidents/{id}/verify"},
    {"role_id": "operator", "action": "POST /api/v1/incidents/{id}/verify"},
    {"role_id": "admin", "action": "POST /api/v1/invitations"},
    {"role_id": "responder", "action": "POST /api/v1/missions/{id}/location"},
    {"role_id": "responder", "action": "POST /api/v1/missions/{id}/progress"},
    {"role_id": "admin", "action": "POST /api/v1/organizations"},
    {"role_id": "admin", "action": "POST /api/v1/referrals/{id}/decision"},
    {"role_id": "hospital", "action": "POST /api/v1/referrals/{id}/decision"},
    {"role_id": "admin", "action": "POST /api/v1/referrals/{id}/handover"},
    {"role_id": "hospital", "action": "POST /api/v1/referrals/{id}/handover"},
    {"role_id": "admin", "action": "PUT /api/v1/permissions"},
]


def upgrade():
    op.create_table(
        "roles", sa.Column("id", sa.String(24), primary_key=True), sa.Column("name", sa.String(80), nullable=False)
    )
    roles = sa.table("roles", sa.column("id"), sa.column("name"))
    op.bulk_insert(
        roles,
        [{"id": r, "name": r.title()} for r in ["citizen", "operator", "hospital", "responder", "analyst", "admin"]],
    )
    op.create_table(
        "memberships",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False, unique=True),
        sa.Column("role_id", sa.String(24), sa.ForeignKey("roles.id"), nullable=False),
        sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=True),
        sa.CheckConstraint("role_id = 'citizen' OR organization_id IS NOT NULL"),
    )
    op.create_index("ix_memberships_role_id", "memberships", ["role_id"])
    op.create_index("ix_memberships_organization_id", "memberships", ["organization_id"])
    op.execute(
        "INSERT INTO memberships (id,created_at,user_id,role_id,organization_id) SELECT id,created_at,id,role,organization_id FROM users"
    )
    op.drop_index("ix_users_organization_id", table_name="users")
    op.drop_column("users", "role")
    op.drop_column("users", "organization_id")
    op.create_table("permissions", sa.Column("action", sa.String(200), primary_key=True))
    op.bulk_insert(sa.table("permissions", sa.column("action")), PERMISSIONS)
    op.create_table(
        "role_permissions",
        sa.Column("role_id", sa.String(24), sa.ForeignKey("roles.id"), primary_key=True),
        sa.Column("action", sa.String(200), sa.ForeignKey("permissions.action"), primary_key=True),
    )
    op.bulk_insert(sa.table("role_permissions", sa.column("role_id"), sa.column("action")), GRANTS)
    op.create_foreign_key(
        "permission_override_action_fk", "permission_overrides", "permissions", ["action"], ["action"]
    )


def downgrade():
    op.drop_constraint("permission_override_action_fk", "permission_overrides", type_="foreignkey")
    op.drop_table("role_permissions")
    op.drop_table("permissions")
    op.add_column("users", sa.Column("role", sa.String(24), nullable=True))
    op.add_column(
        "users", sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=True)
    )
    op.execute(
        "UPDATE users SET role=m.role_id,organization_id=m.organization_id FROM memberships m WHERE users.id=m.user_id"
    )
    op.alter_column("users", "role", nullable=False)
    op.create_check_constraint(
        "users_role_check", "users", "role IN ('citizen','operator','hospital','responder','analyst','admin')"
    )
    op.create_index("ix_users_organization_id", "users", ["organization_id"])
    op.drop_table("memberships")
    op.drop_table("roles")

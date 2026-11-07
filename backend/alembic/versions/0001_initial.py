"""Initial relational schema. This revision's schema is frozen in schema_v1.py."""

from alembic import op
from app.schema_v1 import metadata

revision = "0001"
down_revision = None


def upgrade():
    metadata.create_all(op.get_bind())
    op.execute("""CREATE FUNCTION reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'Audit history is append-only'; END; $$""")
    for table in ("audit_logs", "events"):
        op.execute(
            f"CREATE TRIGGER immutable_{table} BEFORE UPDATE OR DELETE ON {table} FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation()"
        )


def downgrade():
    for table in ("audit_logs", "events"):
        op.execute(f"DROP TRIGGER immutable_{table} ON {table}")
    op.execute("DROP FUNCTION reject_audit_mutation()")
    metadata.drop_all(op.get_bind())

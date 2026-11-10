"""Persist companion extraction and source guidance alongside conversation messages."""
from alembic import op
import sqlalchemy as sa
revision = '0014'
down_revision = '0013'


def upgrade():
    op.add_column('emergency_assistance_sessions', sa.Column('context_json', sa.JSON(), nullable=False, server_default='{}'))


def downgrade():
    op.drop_column('emergency_assistance_sessions', 'context_json')

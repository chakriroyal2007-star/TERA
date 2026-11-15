"""Add phone to users and driver details to ambulances.

Revision ID: 0017
Revises: 0016
Create Date: 2026-11-15
"""
from alembic import op
import sqlalchemy as sa

revision = '0017'
down_revision = '0016'


def upgrade():
    op.add_column('users', sa.Column('phone', sa.String(length=40), nullable=True))
    op.add_column('ambulances', sa.Column('driver_name', sa.String(length=160), nullable=True))
    op.add_column('ambulances', sa.Column('driver_phone', sa.String(length=40), nullable=True))
    op.add_column('ambulances', sa.Column('vehicle_type', sa.String(length=50), nullable=True, server_default='Advanced Life Support (ALS)'))


def downgrade():
    op.drop_column('ambulances', 'vehicle_type')
    op.drop_column('ambulances', 'driver_phone')
    op.drop_column('ambulances', 'driver_name')
    op.drop_column('users', 'phone')


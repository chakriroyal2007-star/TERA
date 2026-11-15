"""Add route polyline, decision ETA, and prediction records for missions and referrals.

Revision ID: 0016
Revises: 0015
Create Date: 2026-11-15
"""
from alembic import op
import sqlalchemy as sa

revision = '0016'
down_revision = '0015'


def upgrade():
    # 1. Add route & decision ETA columns to missions
    op.add_column('missions', sa.Column('decision_eta_seconds', sa.Integer(), nullable=True))
    op.add_column('missions', sa.Column('decision_distance_meters', sa.Float(), nullable=True))
    op.add_column('missions', sa.Column('decision_route_polyline', sa.Text(), nullable=True))
    op.add_column('missions', sa.Column('decision_routing_provider', sa.String(length=50), nullable=True))
    op.add_column('missions', sa.Column('dispatched_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('missions', sa.Column('arrived_at', sa.DateTime(timezone=True), nullable=True))

    # 2. Add route & decision ETA columns to referrals
    op.add_column('referrals', sa.Column('decision_eta_seconds', sa.Integer(), nullable=True))
    op.add_column('referrals', sa.Column('decision_distance_meters', sa.Float(), nullable=True))
    op.add_column('referrals', sa.Column('decision_route_polyline', sa.Text(), nullable=True))
    op.add_column('referrals', sa.Column('decision_routing_provider', sa.String(length=50), nullable=True))
    op.add_column('referrals', sa.Column('referred_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('referrals', sa.Column('arrived_at', sa.DateTime(timezone=True), nullable=True))

    # 3. Create table eta_prediction_records for predicted vs actual arrival analytics
    op.create_table(
        'eta_prediction_records',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('target_type', sa.String(length=20), nullable=False),
        sa.Column('target_id', sa.String(length=36), nullable=False),
        sa.Column('incident_id', sa.String(length=36), sa.ForeignKey('incidents.id'), nullable=False),
        sa.Column('provider', sa.String(length=50), nullable=False),
        sa.Column('origin_lat', sa.Float(), nullable=False),
        sa.Column('origin_lng', sa.Float(), nullable=False),
        sa.Column('dest_lat', sa.Float(), nullable=False),
        sa.Column('dest_lng', sa.Float(), nullable=False),
        sa.Column('predicted_duration_seconds', sa.Integer(), nullable=True),
        sa.Column('predicted_distance_meters', sa.Float(), nullable=False),
        sa.Column('straight_line', sa.Boolean(), default=False, nullable=False),
        sa.Column('predicted_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('actual_arrived_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('actual_duration_seconds', sa.Integer(), nullable=True),
        sa.Column('error_seconds', sa.Integer(), nullable=True),
    )
    op.create_index('ix_eta_prediction_records_target_id', 'eta_prediction_records', ['target_id'])
    op.create_index('ix_eta_prediction_records_incident_id', 'eta_prediction_records', ['incident_id'])

    # 4. Add routing permission
    op.execute(
        sa.text(
            "INSERT INTO permissions (action) VALUES ('GET /api/v1/routing/directions') ON CONFLICT DO NOTHING"
        )
    )
    for role in ('admin', 'operator', 'responder', 'hospital', 'analyst', 'citizen'):
        op.execute(
            sa.text(
                f"INSERT INTO role_permissions (role_id, action) VALUES ('{role}', 'GET /api/v1/routing/directions') ON CONFLICT DO NOTHING"
            )
        )


def downgrade():
    # Remove routing permissions
    op.execute(
        sa.text(
            "DELETE FROM role_permissions WHERE action = 'GET /api/v1/routing/directions'"
        )
    )
    op.execute(
        sa.text(
            "DELETE FROM permissions WHERE action = 'GET /api/v1/routing/directions'"
        )
    )

    # Drop analytics table
    op.drop_index('ix_eta_prediction_records_incident_id', table_name='eta_prediction_records')
    op.drop_index('ix_eta_prediction_records_target_id', table_name='eta_prediction_records')
    op.drop_table('eta_prediction_records')

    # Remove columns from referrals
    op.drop_column('referrals', 'arrived_at')
    op.drop_column('referrals', 'referred_at')
    op.drop_column('referrals', 'decision_routing_provider')
    op.drop_column('referrals', 'decision_route_polyline')
    op.drop_column('referrals', 'decision_distance_meters')
    op.drop_column('referrals', 'decision_eta_seconds')

    # Remove columns from missions
    op.drop_column('missions', 'arrived_at')
    op.drop_column('missions', 'dispatched_at')
    op.drop_column('missions', 'decision_routing_provider')
    op.drop_column('missions', 'decision_route_polyline')
    op.drop_column('missions', 'decision_distance_meters')
    op.drop_column('missions', 'decision_eta_seconds')

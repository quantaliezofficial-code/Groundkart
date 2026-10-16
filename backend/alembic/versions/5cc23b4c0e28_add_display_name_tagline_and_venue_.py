"""Add display_name, tagline, and venue_content_blocks

Revision ID: 5cc23b4c0e28
Revises: de54777d9e8c
Create Date: 2026-10-02 20:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '5cc23b4c0e28'
down_revision: Union[str, None] = 'd2ccf855d85d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new columns to venues
    op.add_column('venues', sa.Column('display_name', sa.String(), nullable=True))
    op.add_column('venues', sa.Column('tagline', sa.String(), nullable=True))

    # Create venue_content_blocks table
    op.create_table('venue_content_blocks',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('venue_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('type', sa.String(), nullable=False),
        sa.Column('title', sa.String(), nullable=True),
        sa.Column('subtitle', sa.String(), nullable=True),
        sa.Column('body', sa.String(), nullable=True),
        sa.Column('media_reference', sa.String(), nullable=True),
        sa.Column('settings', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['venue_id'], ['venues.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_venue_content_blocks_venue_id_sort', 'venue_content_blocks', ['venue_id', 'sort_order'], unique=False)


def downgrade() -> None:
    op.drop_index('idx_venue_content_blocks_venue_id_sort', table_name='venue_content_blocks')
    op.drop_table('venue_content_blocks')
    op.drop_column('venues', 'tagline')
    op.drop_column('venues', 'display_name')

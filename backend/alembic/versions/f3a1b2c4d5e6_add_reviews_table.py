"""add reviews table

Revision ID: f3a1b2c4d5e6
Revises: da614e8551b0
Create Date: 2026-08-21 13:38:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f3a1b2c4d5e6'
down_revision: Union[str, Sequence[str], None] = '4a67399e1fbe'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the reviews table.

    One row per user-per-venue review. No unique constraint enforcing
    exactly one review per user per venue — Phase 1 allows multiple; a
    UNIQUE(venue_id, user_id) can always be added later if that policy
    changes, without touching any application code.
    """
    op.create_table(
        'reviews',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('venue_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('rating', sa.Integer(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('rating BETWEEN 1 AND 5', name='chk_review_rating_range'),
        sa.ForeignKeyConstraint(['venue_id'], ['venues.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_reviews_venue_id_created_at', 'reviews', ['venue_id', 'created_at'])


def downgrade() -> None:
    """Drop the reviews table."""
    op.drop_index('idx_reviews_venue_id_created_at', table_name='reviews')
    op.drop_table('reviews')

"""Add homepage_placements table for admin-curated homepage sections

Revision ID: a2b3c4d5e6f7
Revises: c7e6aecc0ffc
Create Date: 2026-10-01 17:00:00.000000

Rationale: Replaces the hardcoded `realVenues[0]` / `slice(0,4)` homepage
selection in App.tsx with a database-driven, admin-controlled placement
system. The table is purely additive — no existing columns are modified.

Each row says "venue X should appear in section Y at priority Z, with
optional scheduling, badge, and custom copy." A venue can appear in multiple
sections (UNIQUE on venue_id+section, not venue_id alone). Scheduling is
server-side enforced at query time; the client never decides visibility.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a2b3c4d5e6f7'
down_revision: Union[str, Sequence[str], None] = 'c7e6aecc0ffc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create homepage_placements table."""
    op.create_table(
        'homepage_placements',
        sa.Column(
            'id',
            sa.UUID(),
            server_default=sa.text('gen_random_uuid()'),
            nullable=False,
        ),
        sa.Column('venue_id', sa.UUID(), nullable=False),
        sa.Column('section', sa.String(50), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default=sa.text('TRUE')),
        sa.Column('priority', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('badge', sa.String(100), nullable=True),
        sa.Column('custom_title', sa.String(255), nullable=True),
        sa.Column('custom_description', sa.Text(), nullable=True),
        # Scheduling: NULL start_at = show immediately; NULL end_at = no expiry.
        # Stored as TIMESTAMPTZ so UTC comparisons are unambiguous.
        sa.Column('start_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('end_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ['venue_id'], ['venues.id'],
            ondelete='CASCADE',
            name='fk_homepage_placements_venue_id',
        ),
        sa.PrimaryKeyConstraint('id'),
        # A venue appears at most once per section — prevents duplicate cards
        # in a section. Same partial-unique-index pattern used throughout the
        # schema (uq_active_booking_per_unit, uq_one_cover_image_per_venue).
        sa.UniqueConstraint('venue_id', 'section', name='uq_venue_section'),
    )

    # Primary query index: homepage API fetches by section, filtered to
    # enabled=TRUE, ordered by priority ASC. Partial index on enabled keeps
    # it tiny — disabled placements don't appear in public queries.
    op.create_index(
        'idx_hp_section_priority',
        'homepage_placements',
        ['section', 'priority'],
        postgresql_where=sa.text('enabled = TRUE'),
    )

    # Secondary index for venue_id lookups: admin "what sections is this
    # venue in?" query, and CASCADE delete cleanup.
    op.create_index(
        'idx_hp_venue_id',
        'homepage_placements',
        ['venue_id'],
    )


def downgrade() -> None:
    """Drop homepage_placements table."""
    op.drop_index('idx_hp_venue_id', table_name='homepage_placements')
    op.drop_index(
        'idx_hp_section_priority',
        table_name='homepage_placements',
        postgresql_where=sa.text('enabled = TRUE'),
    )
    op.drop_table('homepage_placements')

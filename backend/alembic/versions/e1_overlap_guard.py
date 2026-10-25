"""add_overlap_guard

Revision ID: e1_overlap_guard
Revises: d1_media_cover_and_limits
Create Date: 2026-10-19

Phase 2 — Guide 11: Overlap guard for inventory units.
Enforces that no two occupied (held or booked) inventory units
for the same venue can overlap in time, using PostgreSQL's btree_gist
exclusion constraint over tsrange(starts_at, ends_at).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "e1_overlap_guard"
down_revision: Union[str, Sequence[str], None] = "d1_media_cover_and_limits"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Enable btree_gist extension for combining UUID equality with tsrange overlap
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist;")

    # 2. Add computed starts_at and ends_at timestamp columns
    op.execute(
        """
        ALTER TABLE inventory_units
          ADD COLUMN starts_at timestamp GENERATED ALWAYS AS (date + COALESCE(start_time, time '00:00')) STORED,
          ADD COLUMN ends_at timestamp GENERATED ALWAYS AS (CASE WHEN end_time IS NULL THEN (date + 1)::timestamp ELSE (date + end_time) END) STORED;
        """
    )

    # 3. Add exclusion constraint preventing overlapping occupied units per venue
    op.execute(
        """
        ALTER TABLE inventory_units
          ADD CONSTRAINT ex_no_overlapping_occupied
          EXCLUDE USING gist (venue_id WITH =, tsrange(starts_at, ends_at) WITH &&)
          WHERE (status IN ('held', 'booked'));
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE inventory_units DROP CONSTRAINT IF EXISTS ex_no_overlapping_occupied;")
    op.execute("ALTER TABLE inventory_units DROP COLUMN IF EXISTS ends_at;")
    op.execute("ALTER TABLE inventory_units DROP COLUMN IF EXISTS starts_at;")

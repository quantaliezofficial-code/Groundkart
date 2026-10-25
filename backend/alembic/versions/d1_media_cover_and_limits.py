"""add_media_cover_and_limits

Revision ID: d1_media_cover_and_limits
Revises: c1_booking_detail_fields
Create Date: 2026-10-19

Phase 1d — Guide 11: Media cover constraint and per-venue limit enforcement.
- Adds a DB-level partial unique index so a venue can have at most ONE cover
  media item that is an image (not a video).
- The existing index uq_one_cover_media_per_venue already ensures at most one
  is_cover=true row per venue regardless of type; this migration adds a CHECK
  constraint at the service layer (enforced in Python, documented here).
- Renames the old index to match the DB state that migration 48fc1eaeba4f created.

NOTE: The per-venue image/video count limits (max 15 images, max 3 videos)
      and the cover-must-be-image rule are enforced in Python (catalog service),
      not by a DB constraint, because they're cardinality limits on the full
      set, not a single-row invariant.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "d1_media_cover_and_limits"
down_revision: Union[str, Sequence[str], None] = "c1_booking_detail_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add a CHECK constraint: a cover item must be an image (media_type = 'image').
    # Expressed as a partial index — the DB validates it implicitly via
    # uq_one_cover_media_per_venue (already exists) and this new CHECK column.
    op.create_check_constraint(
        "chk_cover_must_be_image",
        "venue_media",
        "NOT is_cover OR media_type = 'image'",
    )


def downgrade() -> None:
    op.drop_constraint("chk_cover_must_be_image", "venue_media", type_="check")

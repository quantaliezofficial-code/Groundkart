"""add venues.pending_changes column

Revision ID: a1b2c3d4e5f6
Revises: f3a1b2c4d5e6
Create Date: 2026-08-23 13:09:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'f3a1b2c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add venues.pending_changes JSONB column.

    Stores a field-level diff of what the owner changed when they edited
    an active/draft venue and it re-entered 'pending_review'. Gives the
    admin a clear before/after snapshot to review instead of having to
    guess what changed. Shape: {"field": {"old": <old_value>, "new":
    <new_value>}} for scalar fields; {"amenities": {"old": [...],
    "new": [...]}} for amenity changes. NULL for brand-new venues that
    have never been edited post-approval (nothing to diff against).
    Cleared (set back to NULL) when the admin approves or rejects the
    venue, since at that point the pending state has been resolved.
    """
    op.add_column('venues', sa.Column('pending_changes', JSONB, nullable=True))


def downgrade() -> None:
    op.drop_column('venues', 'pending_changes')

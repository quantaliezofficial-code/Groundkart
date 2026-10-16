"""add_archived_to_venue_status

Revision ID: 8fc55303b103
Revises: 8f1cfb505b43
Create Date: 2026-08-28 11:50:00.278392

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8fc55303b103'
down_revision: Union[str, Sequence[str], None] = '8f1cfb505b43'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE venue_status ADD VALUE IF NOT EXISTS 'archived'")


def downgrade() -> None:
    """Downgrade schema."""
    # Postgres doesn't support removing an enum value easily
    pass

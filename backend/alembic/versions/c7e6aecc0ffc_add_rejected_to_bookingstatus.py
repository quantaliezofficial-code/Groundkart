"""Add rejected to BookingStatus

Revision ID: c7e6aecc0ffc
Revises: 76353382cbb1
Create Date: 2026-09-01 13:12:48.457251

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7e6aecc0ffc'
down_revision: Union[str, Sequence[str], None] = '76353382cbb1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'rejected'")


def downgrade() -> None:
    """Downgrade schema."""
    pass

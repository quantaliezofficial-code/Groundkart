"""add storage_key to venue_images

Revision ID: fdcf3408c813
Revises: b7f3a1c2d4e5
Create Date: 2026-08-31 21:32:29.607819

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fdcf3408c813'
down_revision: Union[str, Sequence[str], None] = 'b7f3a1c2d4e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('venue_images', sa.Column('storage_key', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('venue_images', 'storage_key')

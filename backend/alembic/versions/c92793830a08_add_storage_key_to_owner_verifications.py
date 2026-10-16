"""add storage_key to owner_verifications

Revision ID: c92793830a08
Revises: fdcf3408c813
Create Date: 2026-08-31 21:44:51.802629

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c92793830a08'
down_revision: Union[str, Sequence[str], None] = 'fdcf3408c813'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('owner_verifications', sa.Column('storage_key', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('owner_verifications', 'storage_key')

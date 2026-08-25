"""merge

Revision ID: 26e66de9fcf7
Revises: 46c135a0861d, a1b2c3d4e5f6
Create Date: 2026-08-24 15:05:10.878364

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '26e66de9fcf7'
down_revision: Union[str, Sequence[str], None] = ('46c135a0861d', 'a1b2c3d4e5f6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass

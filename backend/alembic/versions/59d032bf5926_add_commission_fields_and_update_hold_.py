"""add_commission_fields_and_update_hold_duration

Revision ID: 59d032bf5926
Revises: 513a554aa1ed
Create Date: 2026-10-16 14:17:05.028044

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '59d032bf5926'
down_revision: Union[str, Sequence[str], None] = '513a554aa1ed'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('payments', sa.Column('commission_rate', sa.Numeric(precision=5, scale=2), nullable=True))
    op.add_column('payments', sa.Column('commission_amount', sa.Numeric(precision=10, scale=2), nullable=True))
    op.execute("UPDATE system_configuration SET booking_hold_duration_minutes = 30 WHERE id = 1 AND booking_hold_duration_minutes = 1440")


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('payments', 'commission_amount')
    op.drop_column('payments', 'commission_rate')

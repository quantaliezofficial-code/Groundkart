"""nullable_token_hash_and_status

Revision ID: 513a554aa1ed
Revises: 5cc23b4c0e28
Create Date: 2026-10-15 13:28:16.502872

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '513a554aa1ed'
down_revision: Union[str, Sequence[str], None] = '5cc23b4c0e28'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column('password_reset_requests', 'token_hash', existing_type=sa.Text(), nullable=True)
    op.add_column('password_reset_requests', sa.Column('status', sa.String(length=32), server_default='pending', nullable=False))
    op.alter_column('password_reset_requests', 'expires_at', existing_type=sa.DateTime(timezone=True), nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column('password_reset_requests', 'expires_at', existing_type=sa.DateTime(timezone=True), nullable=False)
    op.drop_column('password_reset_requests', 'status')
    op.alter_column('password_reset_requests', 'token_hash', existing_type=sa.Text(), nullable=False)

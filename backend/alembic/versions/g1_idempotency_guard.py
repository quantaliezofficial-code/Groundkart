"""add partial unique index for guest idempotency keys

Revision ID: g1_idempotency_guard
Revises: f1_help_center
Create Date: 2026-10-22 12:15:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "g1_idempotency_guard"
down_revision: Union[str, Sequence[str], None] = "f1_help_center"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "uq_idemp_key_null_actor_op",
        "idempotency_keys",
        ["key", "operation"],
        unique=True,
        postgresql_where=sa.text("actor_id IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_idemp_key_null_actor_op", table_name="idempotency_keys")

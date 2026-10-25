"""add_venue_rental_options

Revision ID: a1_venue_rental_options
Revises: 48fc1eaeba4f
Create Date: 2026-10-19

Phase 1a — Guide 11: Flexible rental modes per venue.
One row per mode (hour | half_day | full_day) per venue.
Back-filled from venues.unit_type + venues.base_price so listing
cards and all existing code continue to work unchanged.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1_venue_rental_options"
down_revision: Union[str, Sequence[str], None] = "b69b95d77243"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "venue_rental_options",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("venue_id", sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("venues.id", ondelete="CASCADE"), nullable=False),
        sa.Column("mode", sa.String(20), nullable=False),   # hour | half_day | full_day
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
        sa.Column("open_time", sa.Time(), nullable=True),   # nullable = venue sets its own hours
        sa.Column("close_time", sa.Time(), nullable=True),
        sa.Column("slot_minutes", sa.Integer(), nullable=True),    # hourly only
        sa.Column("min_minutes", sa.Integer(), nullable=True),     # hourly only
        sa.Column("max_minutes", sa.Integer(), nullable=True),     # hourly only
        sa.Column("buffer_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("mode IN ('hour', 'half_day', 'full_day')", name="chk_rental_mode"),
        sa.CheckConstraint("price >= 0", name="chk_rental_price_non_negative"),
        sa.UniqueConstraint("venue_id", "mode", name="uq_venue_rental_mode"),
    )

    op.create_index("idx_venue_rental_options_venue_id", "venue_rental_options", ["venue_id"])

    # Back-fill: one rental option per existing venue, derived from unit_type + base_price.
    op.execute(
        sa.text(
            """
            INSERT INTO venue_rental_options (venue_id, mode, price, enabled)
            SELECT id, unit_type::text, base_price, true
            FROM venues
            WHERE deleted_at IS NULL
            ON CONFLICT (venue_id, mode) DO NOTHING
            """
        )
    )


def downgrade() -> None:
    op.drop_index("idx_venue_rental_options_venue_id", table_name="venue_rental_options")
    op.drop_table("venue_rental_options")

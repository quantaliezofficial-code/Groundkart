"""add_booking_detail_fields

Revision ID: c1_booking_detail_fields
Revises: b1_venue_purposes
Create Date: 2026-10-19

Phase 1c — Guide 11: Booking detail fields.
Adds purpose_id, rental_mode, guest_count, and customer_notes to the
bookings table so a booking carries the full context of what the customer
booked and for what purpose.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c1_booking_detail_fields"
down_revision: Union[str, Sequence[str], None] = "b1_venue_purposes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "bookings",
        sa.Column(
            "purpose_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("venue_purposes.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "bookings",
        sa.Column("rental_mode", sa.String(20), nullable=True),
    )
    op.add_column(
        "bookings",
        sa.Column("guest_count", sa.Integer(), nullable=True),
    )
    op.add_column(
        "bookings",
        sa.Column("customer_notes", sa.Text(), nullable=True),
    )

    op.create_index("idx_bookings_purpose_id", "bookings", ["purpose_id"])


def downgrade() -> None:
    op.drop_index("idx_bookings_purpose_id", table_name="bookings")
    op.drop_column("bookings", "customer_notes")
    op.drop_column("bookings", "guest_count")
    op.drop_column("bookings", "rental_mode")
    op.drop_column("bookings", "purpose_id")

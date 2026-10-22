"""add database resilience backstops (unique payments, null-safe unit slot, unique refunds)

Revision ID: h1_resilience_backstops
Revises: g1_idempotency_guard
Create Date: 2026-10-22 13:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "h1_resilience_backstops"
down_revision: Union[str, Sequence[str], None] = "g1_idempotency_guard"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Backfill / Conflict check: Ensure no duplicate active payments exist per booking
    conn = op.get_bind()
    dup_payments = conn.execute(
        sa.text(
            "SELECT booking_id, COUNT(*) FROM payments WHERE status IN ('success', 'refunded') GROUP BY booking_id HAVING COUNT(*) > 1"
        )
    ).fetchall()
    if dup_payments:
        print(f"WARNING: Found {len(dup_payments)} bookings with duplicate active payments during migration: {dup_payments}")
        # Retain earliest payment row, remove duplicates
        conn.execute(
            sa.text("""
                DELETE FROM payments
                WHERE id IN (
                    SELECT id FROM (
                        SELECT id, ROW_NUMBER() OVER (PARTITION BY booking_id ORDER BY created_at ASC) as rn
                        FROM payments
                        WHERE status IN ('success', 'refunded')
                    ) sub WHERE rn > 1
                )
            """)
        )

    # Partial unique index for one active payment per booking
    op.create_index(
        "uq_one_successful_payment_per_booking",
        "payments",
        ["booking_id"],
        unique=True,
        postgresql_where=sa.text("status IN ('success', 'refunded')"),
    )

    # 2. Backfill / Conflict check: Ensure no duplicate inventory units exist for same slot (including NULL times)
    dup_units = conn.execute(
        sa.text("""
            SELECT venue_id, date, COALESCE(start_time, '00:00:00'::time), COALESCE(end_time, '23:59:59'::time), COUNT(*)
            FROM inventory_units
            GROUP BY venue_id, date, COALESCE(start_time, '00:00:00'::time), COALESCE(end_time, '23:59:59'::time)
            HAVING COUNT(*) > 1
        """)
    ).fetchall()
    if dup_units:
        print(f"WARNING: Found {len(dup_units)} duplicate inventory unit slots: {dup_units}")
        conn.execute(
            sa.text("""
                DELETE FROM inventory_units
                WHERE id IN (
                    SELECT id FROM (
                        SELECT id, ROW_NUMBER() OVER (
                            PARTITION BY venue_id, date, COALESCE(start_time, '00:00:00'::time), COALESCE(end_time, '23:59:59'::time)
                            ORDER BY created_at ASC
                        ) as rn
                        FROM inventory_units
                    ) sub WHERE rn > 1
                )
            """)
        )

    # Unique index for null-safe inventory unit slots
    op.execute(
        "CREATE UNIQUE INDEX uq_inventory_unit_slot_nullsafe ON inventory_units "
        "(venue_id, date, COALESCE(start_time, '00:00:00'::time), COALESCE(end_time, '23:59:59'::time));"
    )

    # 3. Backfill / Conflict check: Ensure no duplicate processed refunds exist
    dup_refunds = conn.execute(
        sa.text("SELECT booking_id, COUNT(*) FROM refunds WHERE status = 'processed' GROUP BY booking_id HAVING COUNT(*) > 1")
    ).fetchall()
    if dup_refunds:
        print(f"WARNING: Found {len(dup_refunds)} duplicate processed refunds: {dup_refunds}")
        conn.execute(
            sa.text("""
                DELETE FROM refunds
                WHERE id IN (
                    SELECT id FROM (
                        SELECT id, ROW_NUMBER() OVER (PARTITION BY booking_id ORDER BY created_at ASC) as rn
                        FROM refunds
                        WHERE status = 'processed'
                    ) sub WHERE rn > 1
                )
            """)
        )

    op.create_index(
        "uq_one_processed_refund_per_booking",
        "refunds",
        ["booking_id"],
        unique=True,
        postgresql_where=sa.text("status = 'processed'"),
    )
    op.create_index(
        "uq_one_processed_refund_per_payment",
        "refunds",
        ["payment_id"],
        unique=True,
        postgresql_where=sa.text("status = 'processed'"),
    )


def downgrade() -> None:
    op.drop_index("uq_one_processed_refund_per_payment", table_name="refunds")
    op.drop_index("uq_one_processed_refund_per_booking", table_name="refunds")
    op.execute("DROP INDEX IF EXISTS uq_inventory_unit_slot_nullsafe;")
    op.drop_index("uq_one_successful_payment_per_booking", table_name="payments")

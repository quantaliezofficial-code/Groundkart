"""
Base declarative class + the native Postgres ENUM types from
06_Backend_Schema.md §3. create_type=False on every enum because the actual
CREATE TYPE statements run via Alembic migrations, not via
Base.metadata.create_all() — see 06_Backend_Schema.md §7 ("never run
Base.metadata.create_all() against a production database").
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Text
from sqlalchemy.dialects.postgresql import ENUM as PGEnum
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    # Every doc DDL column is TEXT, never VARCHAR(n), and every timestamp is
    # TIMESTAMPTZ, never the bare TIMESTAMP SQLAlchemy defaults to for a
    # plain `datetime` annotation — caught by introspecting the live schema
    # after the first migration, not by the Phase B DDL-compile check, which
    # only verified column *names*/constraints lined up, not every type
    # detail. TIMESTAMPTZ matters here specifically because
    # compute_grace_period_ends_at() compares timezone-aware datetimes —
    # silently storing naive timestamps would have been a real bug waiting
    # to surface as a confusing off-by-some-hours error later.
    type_annotation_map = {
        str: Text,
        datetime: DateTime(timezone=True),
    }


UserRole = PGEnum(
    "customer", "owner", "admin",
    name="user_role", create_type=False,
)

VenueCategory = PGEnum(
    "sports", "banquet_hall", "farmhouse", "corporate", "community_hall",
    name="venue_category", create_type=False,
)

VenueStatus = PGEnum(
    "draft", "pending_review", "active", "suspended",
    name="venue_status", create_type=False,
)

UnitType = PGEnum(
    "hour", "half_day", "full_day",
    name="unit_type", create_type=False,
)

InventoryStatus = PGEnum(
    "available", "held", "booked", "blocked",
    name="inventory_status", create_type=False,
)

BookingStatus = PGEnum(
    "pending_payment", "confirmed", "cancelled", "completed", "expired", "refunded",
    name="booking_status", create_type=False,
)

PaymentStatus = PGEnum(
    "initiated", "success", "failed", "refunded",
    name="payment_status", create_type=False,
)

# Decision Point C-2 (see PHASE_C3_SUMMARY.md): not in 06_Backend_Schema.md
# at all — that doc only has a single `users.is_verified` boolean, with no
# way to represent "pending review" or "rejected, can resubmit."
OwnerVerificationStatus = PGEnum(
    "pending", "approved", "rejected",
    name="owner_verification_status", create_type=False,
)

# Decision Point C-11 (see PHASE_C8_SUMMARY.md): 06_Backend_Schema.md §4
# lists `payouts.status` with no enum given at all, just the bare word
# "status". Two states is deliberately minimal, matching 01_PRD.md §5's
# "manual payout run acceptable for Phase 1" framing — a payout is computed
# (pending, money owed but not yet sent) and later marked paid once an
# admin has actually sent it, same two-step shape as offline payment
# confirmation. No `failed` state — Phase 1 has no automated transfer to
# fail.
PayoutStatus = PGEnum(
    "pending", "paid",
    name="payout_status", create_type=False,
)

IdempotencyStatus = PGEnum(
    "in_progress", "completed", "error",
    name="idempotency_status", create_type=False,
)

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


VenueStatus = PGEnum(
    "draft", "pending_review", "active", "suspended", "archived",
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
    "draft", "requested", "under_admin_review", "pending_payment", "confirmed",
    "upcoming", "in_progress", "completed", "cancelled", "expired", "refunded",
    "disputed", "suspended", "rejected",
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

BlockStatus = PGEnum(
    "active", "inactive",
    name="block_status", create_type=False,
)

OutboxEventStatus = PGEnum(
    "pending", "processed", "failed",
    name="outbox_event_status", create_type=False,
)


PricingRuleType = PGEnum(
    "weekday", "weekend", "peak_time", "seasonal", "special_event",
    name="pricing_rule_type", create_type=False,
)

PricingAdjustmentType = PGEnum(
    "percentage", "fixed",
    name="pricing_adjustment_type", create_type=False,
)

JobStatus = PGEnum(
    "pending", "running", "completed", "failed",
    name="job_status", create_type=False,
)

NotificationChannel = PGEnum(
    "in_app", "email", "sms",
    name="notification_channel", create_type=False,
)

DeliveryStatus = PGEnum(
    "queued", "sent", "delivered", "failed", "retrying",
    name="delivery_status", create_type=False,
)

TicketStatus = PGEnum(
    "open", "in_review", "waiting_customer", "resolved", "closed",
    name="ticket_status", create_type=False,
)

TicketCategory = PGEnum(
    "general", "billing", "venue_issue", "dispute", "help_request",
    name="ticket_category", create_type=False,
)

TicketPriority = PGEnum(
    "low", "medium", "high", "urgent",
    name="ticket_priority", create_type=False,
)

ActionType = PGEnum(
    "cancel", "modify", "reschedule", "payment_confirmation", 
    "payment_release", "refund_request", "refund_override", 
    "dispute", "owner_cancellation", "admin_cancellation",
    name="action_type", create_type=False,
)

RequestStatus = PGEnum(
    "pending", "approved", "rejected", "withdrawn", 
    "expired", "completed",
    name="request_status", create_type=False,
)

ActionReasonCode = PGEnum(
    "customer_changed_plans", "incorrect_booking", "unavailable", 
    "price_issue", "venue_issue", "payment_issue", "personal_reason", 
    "maintenance", "venue_emergency", "schedule_conflict", "duplicate", 
    "operational_issue", "weather", "policy_violation", "payment_failure", 
    "venue_suspended", "fraud_risk", "duplicate_booking", "customer_request", 
    "owner_request", "system_error", "force_majeure", "other",
    name="action_reason_code", create_type=False,
)

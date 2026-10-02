"""
The five safety-critical tables from 06_Backend_Schema.md §3, as typed
SQLAlchemy 2.0 models (Mapped/mapped_column, not legacy Column-only style —
per TRD §2's stated rationale: catches type mismatches at dev time).

Two deliberate deviations from the doc's literal DDL, both flagged in
PHASE_B_SUMMARY.md — search for "Decision Point" there for the full
reasoning. Everything else here is a direct, unmodified translation of the
hand-written DDL.
"""
from __future__ import annotations

import uuid
from datetime import date as date_, datetime, time
from decimal import Decimal

from sqlalchemy import Text, event
from sqlalchemy import (
    CheckConstraint,
    Column,
    ForeignKey,
    Index,
    Numeric,
    Table,
    UniqueConstraint,
    text,
    Text,
)
from sqlalchemy.dialects.postgresql import CITEXT, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import (
    Base,
    BookingStatus,
    InventoryStatus,
    OwnerVerificationStatus,
    PaymentStatus,
    PayoutStatus,
    UnitType,
    UserRole,
    VenueStatus,
    IdempotencyStatus,
    BlockStatus,
    OutboxEventStatus,
    NotificationChannel,
    DeliveryStatus,
    JobStatus,
    TicketStatus,
    TicketCategory,
    TicketPriority,
    PricingRuleType,
    PricingAdjustmentType,
    ActionType,
    RequestStatus,
    ActionReasonCode,
)


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    name: Mapped[str]
    email: Mapped[str | None] = mapped_column(CITEXT, unique=True, nullable=True)
    phone: Mapped[str] = mapped_column(unique=True, nullable=False)
    password_hash: Mapped[str]
    role: Mapped[str] = mapped_column(UserRole, default="customer")
    is_verified: Mapped[bool] = mapped_column(default=False)
    # Decision Point C-14 (see the phase summary doc for this slice): a new
    # field, not a reuse of deleted_at just above/below — deleted_at is
    # explicitly documented (06_Backend_Schema.md §1: "soft deletes where
    # it matters... a venue with booking history should never be
    # hard-deleted") as being about preserving referential integrity on
    # permanent-ish removal, a different concern from a temporary,
    # admin-reversible dispute suspension (01_PRD.md §5's "suspend a
    # listing or user"). login() below treats this exactly like
    # deleted_at — same generic "incorrect email or password" 401, not a
    # distinct "account suspended" message, for the same enumeration
    # reason deleted_at's own check is already merged with the
    # wrong-password case: a distinct message would let an attacker probe
    # which emails belong to suspended accounts.
    suspended_at: Mapped[datetime | None]
    suspension_reason: Mapped[str | None]
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    deleted_at: Mapped[datetime | None]

    venues: Mapped[list["Venue"]] = relationship(back_populates="owner")
    bookings: Mapped[list["Booking"]] = relationship(back_populates="customer")
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(back_populates="user")
    owner_verifications: Mapped[list["OwnerVerification"]] = relationship(
        back_populates="user", foreign_keys="OwnerVerification.user_id"
    )
    payouts: Mapped[list["Payout"]] = relationship(back_populates="owner")
    reviews: Mapped[list["Review"]] = relationship(back_populates="user")
    support_tickets: Mapped[list["SupportTicket"]] = relationship(
        back_populates="creator", foreign_keys="SupportTicket.creator_id"
    )


class Venue(Base):
    __tablename__ = "venues"
    __table_args__ = (
        CheckConstraint("capacity > 0", name="chk_capacity_positive"),
        CheckConstraint("base_price >= 0", name="chk_base_price_nonneg"),
        CheckConstraint("avg_rating BETWEEN 0 AND 5", name="chk_avg_rating_range"),
        Index(
            "idx_venues_city_category",
            "city",
            "category",
            postgresql_where=text("deleted_at IS NULL AND status = 'active'"),
        ),
        Index(
            "idx_venues_owner_active",
            "owner_id",
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    name: Mapped[str]
    slug: Mapped[str] = mapped_column(unique=True)
    category: Mapped[str] = mapped_column(Text)
    category_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("categories.id", ondelete="RESTRICT"))
    venue_type_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("venue_types.id", ondelete="RESTRICT"))
    description: Mapped[str | None]
    address: Mapped[str]
    city: Mapped[str]
    state: Mapped[str | None]
    pincode: Mapped[str | None]
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    capacity: Mapped[int | None]
    # Decision #2 (per-category pricing, resolved 2026-06-24): this column is
    # the entire fix — see 06_Backend_Schema.md §9. It already existed in the
    # schema; the gap was ReviewPay.tsx ignoring it, not a missing column.
    unit_type: Mapped[str] = mapped_column(UnitType)
    base_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    status: Mapped[str] = mapped_column(VenueStatus, default="draft")
    # Decision Point C-3 (see PHASE_C4_SUMMARY.md): not in
    # 06_Backend_Schema.md — venue_status has no 'rejected' value at all
    # (only draft/pending_review/active/suspended), and there's nowhere to
    # record *why* an admin rejected a listing, even though
    # 05_App_Flow.md §3/§4 explicitly requires "Owner notified with reason,
    # can edit & resubmit." Rejection targets 'draft' (editable, not
    # publicly visible) rather than a new enum value — editing a draft and
    # having PATCH re-enter 'pending_review' on a real content change *is*
    # the resubmission flow, with no separate endpoint needed for it.
    rejection_reason: Mapped[str | None]
    # Decision Point C-15 (see the phase summary doc for this slice):
    # venue_status already has 'suspended' as a valid value (line 118's
    # comment above notes it, quoting the original enum) — it's been
    # sitting there unused since the very first migration. A separate
    # column from rejection_reason, not a reuse of it: rejection is a
    # content-review outcome that clears on resubmission (PATCH re-entering
    # pending_review), suspension is an admin dispute action with its own,
    # independent lifecycle (suspend/reactivate, no content review
    # involved) — conflating the two reason fields would make either
    # action's audit trail ambiguous about which flow produced it.
    suspension_reason: Mapped[str | None]
    # Captures the field-level diff from the most recent owner edit that
    # caused the venue to re-enter 'pending_review'. Shape:
    #   {"field": {"old": <old_value>, "new": <new_value>}, ...}
    # for scalar content fields, plus an "amenities" key when amenity
    # names changed. NULL for venues entering pending_review for the first
    # time (nothing to diff against). Cleared back to NULL by approve_venue/
    # reject_venue once the admin acts — the pending state is resolved.
    pending_changes: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    avg_rating: Mapped[Decimal] = mapped_column(Numeric(3, 2), default=0)
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    deleted_at: Mapped[datetime | None]

    owner: Mapped["User"] = relationship(back_populates="venues")
    venue_category_rel: Mapped["Category | None"] = relationship(foreign_keys=[category_id])
    venue_type: Mapped["VenueType | None"] = relationship(foreign_keys=[venue_type_id])
    use_cases: Mapped[list["UseCase"]] = relationship(secondary="venue_use_cases", back_populates="venues")
    media: Mapped[list["VenueMedia"]] = relationship(
        back_populates="venue", order_by="VenueMedia.sort_order", cascade="all, delete-orphan"
    )
    amenities: Mapped[list["Amenity"]] = relationship(
        secondary="venue_amenities", back_populates="venues"
    )
    inventory_units: Mapped[list["InventoryUnit"]] = relationship(back_populates="venue")
    reviews: Mapped[list["Review"]] = relationship(
        back_populates="venue", cascade="all, delete-orphan", order_by="desc(Review.created_at)"
    )
    pricing_rules: Mapped[list["PricingRule"]] = relationship(
        back_populates="venue", cascade="all, delete-orphan"
    )
    homepage_placements: Mapped[list["HomepagePlacement"]] = relationship(
        back_populates="venue", cascade="all, delete-orphan"
    )


class InventoryUnit(Base):
    __tablename__ = "inventory_units"
    __table_args__ = (
        CheckConstraint(
            "start_time IS NULL OR end_time IS NULL OR start_time < end_time",
            name="chk_time_range",
        ),
        UniqueConstraint("venue_id", "date", "start_time", "end_time", name="uq_unit_slot"),
        CheckConstraint("price >= 0", name="chk_price_nonneg"),
        Index(
            "idx_inventory_venue_date",
            "venue_id",
            "date",
            postgresql_where=text("status = 'available'"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    venue_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("venues.id", ondelete="CASCADE"))
    date: Mapped[date_]
    # NULL for half_day/full_day units (the whole day is the block) — see
    # Decision Point B-1 in PHASE_B_SUMMARY.md for why this matters to the
    # grace-period calculation specifically.
    start_time: Mapped[time | None]
    end_time: Mapped[time | None]
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    status: Mapped[str] = mapped_column(InventoryStatus, default="available")
    hold_expires_at: Mapped[datetime | None]
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

    venue: Mapped["Venue"] = relationship(back_populates="inventory_units")
    bookings: Mapped[list["Booking"]] = relationship(back_populates="inventory_unit")


class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = (
        CheckConstraint(
            "customer_id IS NOT NULL OR (guest_name IS NOT NULL AND guest_email IS NOT NULL)",
            name="chk_customer_or_guest",
        ),
        CheckConstraint("amount >= 0", name="chk_amount_nonneg"),
        # The hard backstop against double-booking — enforced by the
        # database, independent of whatever the application code does or
        # fails to do. See 06_Backend_Schema.md §3/§6.
        Index(
            "uq_active_booking_per_unit",
            "inventory_unit_id",
            unique=True,
            postgresql_where=text("status IN ('pending_payment', 'confirmed')"),
        ),
        Index("idx_bookings_customer_id", "customer_id"),
        Index("idx_bookings_venue_status", "venue_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )

    # Decision #3 (guest checkout, resolved 2026-06-24): customer_id is
    # nullable. A logged-in customer gets customer_id; a guest gets
    # guest_name/guest_email instead.
    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    guest_name: Mapped[str | None]
    guest_email: Mapped[str | None] = mapped_column(CITEXT)
    guest_phone: Mapped[str | None]

    # Decision Point B-2 (flagged in PHASE_B_SUMMARY.md): the doc specifies
    # `manage_token TEXT UNIQUE` storing the raw token. This stores a SHA-256
    # hash instead — same pattern as password_hash, for the same reason: the
    # token IS this guest's entire authentication (07_design.md §5.6), so it
    # shouldn't sit in the database in a form that's directly usable if the
    # DB is ever read by anyone who shouldn't have it. The raw token exists
    # only in the emailed link, never persisted. See
    # app/modules/booking/service.py for the hash/lookup functions.
    manage_token_hash: Mapped[str | None] = mapped_column(unique=True)

    venue_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("venues.id", ondelete="RESTRICT"))
    # Snapshotted at creation time so booking history is unaffected by a
    # venue being renamed/recategorized/deleted later.
    venue_name: Mapped[str]
    venue_category: Mapped[str] = mapped_column(Text)
    inventory_unit_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("inventory_units.id", ondelete="RESTRICT")
    )

    status: Mapped[str] = mapped_column(BookingStatus, default="pending_payment")
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    base_amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    currency: Mapped[str] = mapped_column(default="INR", server_default="INR")
    pricing_snapshot: Mapped[dict | None] = mapped_column(JSONB)

    # Decision #1 (instant confirm + owner grace window, resolved
    # 2026-06-24): set together when payment succeeds. See
    # app/modules/booking/service.py for how grace_period_ends_at is
    # computed — including Decision Point B-1's resolution for
    # half_day/full_day units with no start_time.
    confirmed_at: Mapped[datetime | None]
    grace_period_ends_at: Mapped[datetime | None]
    owner_flagged_at: Mapped[datetime | None]

    cancellation_reason: Mapped[str | None]
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    cancelled_at: Mapped[datetime | None]

    customer: Mapped["User | None"] = relationship(back_populates="bookings")
    venue: Mapped["Venue"] = relationship()
    inventory_unit: Mapped["InventoryUnit"] = relationship(back_populates="bookings")
    payments: Mapped[list["Payment"]] = relationship(back_populates="booking")
    events: Mapped[list["BookingEvent"]] = relationship(
        back_populates="booking", cascade="all, delete-orphan", order_by="BookingEvent.created_at"
    )
    action_requests: Mapped[list["BookingActionRequest"]] = relationship(
        back_populates="booking", cascade="all, delete-orphan", order_by="BookingActionRequest.created_at"
    )
    review: Mapped["Review | None"] = relationship(back_populates="booking", uselist=False)

    # A real gap found while starting frontend integration (Phase D):
    # BookingDetail had no way to show *when* a booking is actually for —
    # unlike venue_name/venue_category, the slot date/time was never
    # snapshotted onto Booking itself, only reachable via inventory_unit.
    # These properties, not new columns, since the slot is immutable once
    # a booking exists against it (no rescheduling flow exists anywhere
    # in this codebase) — a live join reflects reality exactly as well as
    # a snapshot would, without a second copy of the same fact to keep in
    # sync. Callers MUST eager-load inventory_unit first (selectinload/
    # joinedload) — accessing these without it would lazy-load outside an
    # async greenlet context, the exact MissingGreenlet shape
    # PHASE_C4_SUMMARY.md already found and fixed once for venue.images.
    @property
    def slot_date(self) -> date_:
        return self.inventory_unit.date

    @property
    def slot_start_time(self) -> time | None:
        return self.inventory_unit.start_time

    @property
    def reviewed_at(self) -> datetime | None:
        # Requires eager-loading self.review
        return self.review.created_at if self.review else None

    @property
    def slot_end_time(self) -> time | None:
        return self.inventory_unit.end_time

    @property
    def hold_expires_at(self) -> datetime | None:
        """Added for the Admin dashboard's Bookings screen: without this, an
        admin has no way to see which pending_payment bookings are already
        past their hold window (they'd otherwise just sit there forever —
        there's no sweep job that clears them automatically). None once the
        booking is confirmed/cancelled (inventory_unit.hold_expires_at is
        cleared at that point, same lifecycle as everywhere else it's set)."""
        return self.inventory_unit.hold_expires_at


class BookingEvent(Base):
    """Event history for the booking lifecycle (what happened to this booking?)."""

    __tablename__ = "booking_events"
    __table_args__ = (
        Index("idx_booking_events_booking_id_created_at", "booking_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    booking_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("bookings.id", ondelete="CASCADE"))
    event_type: Mapped[str]
    correlation_id: Mapped[str | None] = mapped_column(Text)
    actor_type: Mapped[str | None]
    actor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    extra_data: Mapped[dict | None] = mapped_column("metadata", JSONB)
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

    booking: Mapped["Booking"] = relationship(back_populates="events")
    actor: Mapped["User | None"] = relationship()


class BookingActionRequest(Base):
    """Admin control lifecycle request for important booking state changes."""
    __tablename__ = "booking_action_requests"
    __table_args__ = (
        Index("idx_booking_actions_booking", "booking_id", "status"),
        Index("idx_booking_actions_requested_at", "requested_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    booking_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("bookings.id", ondelete="CASCADE"))
    action_type: Mapped[str] = mapped_column(ActionType)
    requested_by_type: Mapped[str] = mapped_column(UserRole)
    requested_by_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    requested_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    reason: Mapped[str | None] = mapped_column(ActionReasonCode)
    notes: Mapped[str | None]
    metadata_json: Mapped[dict | None] = mapped_column("metadata", JSONB)
    status: Mapped[str] = mapped_column(RequestStatus, default="pending")
    assigned_admin_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    reviewed_by_admin_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    reviewed_at: Mapped[datetime | None]
    admin_decision: Mapped[str | None]
    decision_reason: Mapped[str | None]
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

    booking: Mapped["Booking"] = relationship(back_populates="action_requests")
    requested_by_user: Mapped["User | None"] = relationship(foreign_keys=[requested_by_user_id])
    assigned_admin: Mapped["User | None"] = relationship(foreign_keys=[assigned_admin_id])
    reviewed_by_admin: Mapped["User | None"] = relationship(foreign_keys=[reviewed_by_admin_id])


class Payment(Base):
    __tablename__ = "payments"
    __table_args__ = (
        Index("idx_payments_booking_id", "booking_id"),
        Index("idx_payments_payout_id", "payout_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    booking_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("bookings.id", ondelete="RESTRICT"))
    gateway: Mapped[str] = mapped_column(default="razorpay")
    gateway_payment_id: Mapped[str | None] = mapped_column(unique=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    currency: Mapped[str] = mapped_column(default="INR")
    method: Mapped[str | None]
    status: Mapped[str] = mapped_column(PaymentStatus, default="initiated")
    # Decision Point C-9 (see the phase summary doc for this slice): no doc
    # models a partial refund anywhere - payment_status is binary
    # (success/refunded) and `amount` is fixed at collection time. Added so
    # "refunded" can mean anything from 0% to 100% of `amount`, populated
    # by both flag_booking (always == amount, for consistency - see the
    # same summary) and the new customer-initiated cancellation path
    # (Decision Point C-7's tiers). NULL until a refund is actually
    # recorded against this payment.
    refund_amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    # Decision Point C-12 (see the phase summary doc for this slice): the
    # ERD in 06_Backend_Schema.md §2 has no relationship at all from
    # payments/bookings to payouts — a payout is modeled purely as an
    # owner-level aggregate. NULL until this payment has been included in
    # a payout run; set once, never cleared, so a payment can never be
    # double-counted across payout runs regardless of what period dates an
    # admin types in — a structural backstop, not reliance on the caller
    # choosing non-overlapping periods correctly (same "backstop, not just
    # trusting application logic" philosophy as uq_active_booking_per_unit).
    payout_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("payouts.id", ondelete="RESTRICT"))
    raw_payload: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

    booking: Mapped["Booking"] = relationship(back_populates="payments")
    payout: Mapped["Payout | None"] = relationship(back_populates="payments")


class RefreshToken(Base):
    """
    Decision Point C-1 (flag for sign-off — see PHASE_C2_SUMMARY.md):
    06_Backend_Schema.md §3/§4 never specifies a table for this.
    TRD §4 requires "every refresh issues a new refresh token and
    invalidates the old one" and reuse-detection — that needs *some*
    persistent, queryable record of issued tokens; a stateless JWT-only
    refresh token can't be individually revoked or checked for reuse.

    Resolved here as a real table rather than a Redis key for the same
    reason 06_Backend_Schema.md §6 already gives for bookings: "Postgres is
    the source of truth, Redis is the UX layer." Applying that same
    principle to auth sessions — Redis eviction under memory pressure would
    force-logout every user with no warning, which is a worse failure mode
    than one extra indexed table. This also naturally supports multiple
    concurrent sessions per user (phone + desktop), which a single
    current-token-on-the-user-row design would not.
    """

    __tablename__ = "refresh_tokens"
    __table_args__ = (
        Index(
            "idx_refresh_tokens_active_by_user",
            "user_id",
            postgresql_where=text("revoked_at IS NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    token_hash: Mapped[str] = mapped_column(unique=True)
    expires_at: Mapped[datetime]
    revoked_at: Mapped[datetime | None]
    # Self-referential: when a token is rotated, the new token's id is
    # recorded on the old one. If a revoked token is ever presented again
    # (replay of a stolen token), that's the reuse-detection signal — see
    # app/modules/auth/service.py's rotate_refresh_token().
    replaced_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("refresh_tokens.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

    user: Mapped["User"] = relationship(back_populates="refresh_tokens", foreign_keys=[user_id])


class OwnerVerification(Base):
    """
    Decision Point C-2 (flag for sign-off — see PHASE_C3_SUMMARY.md):
    06_Backend_Schema.md has only `users.is_verified BOOLEAN`. That's
    enough to gate "can this user list a venue," but not enough to
    represent the actual workflow 05_App_Flow.md §3 / PRD §5 describe:
    pending review, rejection with a reason, and resubmission after a
    rejection. A boolean can't distinguish "never applied" from "applied
    and waiting" from "rejected, fix this and try again."

    Resolved as a new table rather than extra columns on `users`: a
    resubmission after rejection should create a NEW row, not overwrite
    the old one — the rejection history (who reviewed it, what the reason
    was, when) is exactly the kind of thing an admin reviewing a second
    attempt needs to see, and exactly the kind of thing TRD §7's audit
    requirements care about.

    `users.is_verified` is left as-is and unmodified — it stays the simple
    "is this user currently allowed to list venues" gate. This table is
    the history/workflow behind it; approval here is what flips that flag.
    """

    __tablename__ = "owner_verifications"
    __table_args__ = (
        # At most one PENDING submission per user at a time — same pattern
        # as uq_active_booking_per_unit, applied here so a double-click on
        # "submit" can't create two pending rows for an admin to
        # accidentally review inconsistently.
        Index(
            "uq_one_pending_verification_per_user",
            "user_id",
            unique=True,
            postgresql_where=text("status = 'pending'"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    document_url: Mapped[str]
    storage_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    identification_type: Mapped[str | None]
    identification_number: Mapped[str | None]
    business_name: Mapped[str | None]
    status: Mapped[str] = mapped_column(OwnerVerificationStatus, default="pending")
    rejection_reason: Mapped[str | None]
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    reviewed_at: Mapped[datetime | None]
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

    user: Mapped["User"] = relationship(back_populates="owner_verifications", foreign_keys=[user_id])
    reviewer: Mapped["User | None"] = relationship(foreign_keys=[reviewed_by])


class Notification(Base):
    """New table, added for the Admin dashboard's follow-up work: an
    in-app notification so an owner/user finds out when an admin acts on
    something of theirs (venue approved/rejected/suspended/reactivated,
    verification approved/rejected, their own account suspended/
    reactivated) without asking support or happening to notice it
    themselves. Deliberately in-app only, not email/SMS — this sandbox has
    no route to any external delivery service (handoff.md's environment
    notes), and a real email pipeline (provider, templates,
    deliverability) is a separate, larger decision than this pass covers.
    `type` is a free-form string identifying which action triggered this
    (e.g. 'venue_approved', 'user_suspended') rather than an enum — new
    notification types are expected to be added over time as more admin
    actions get wired up, without a schema migration each time."""

    __tablename__ = "notifications"
    __table_args__ = (Index("ix_notifications_user_id_created_at", "user_id", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    type: Mapped[str]
    message: Mapped[str]
    entity_type: Mapped[str | None]
    entity_id: Mapped[uuid.UUID | None]
    read_at: Mapped[datetime | None]
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

    user: Mapped["User"] = relationship()
    deliveries: Mapped[list["NotificationDelivery"]] = relationship(back_populates="notification", cascade="all, delete-orphan")


class NotificationDelivery(Base):
    __tablename__ = "notification_deliveries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    notification_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("notifications.id", ondelete="CASCADE"))
    channel: Mapped[str] = mapped_column(NotificationChannel)
    status: Mapped[str] = mapped_column(DeliveryStatus, default="queued")
    provider_response: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

    notification: Mapped["Notification"] = relationship(back_populates="deliveries")


class AuditLog(Base):
    """06_Backend_Schema.md §4 (summary table, no full DDL given) — TRD §7:
    'sensitive actions (listing approval/rejection, payouts, role changes)
    are written to an audit_logs table.' Immutable by convention: no
    `updated_at`, no update path anywhere in this codebase — a row, once
    written, is never changed, only ever read."""

    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("idx_audit_logs_entity", "entity_type", "entity_id", "created_at"),
        Index("idx_audit_logs_actor", "actor_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    actor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    action: Mapped[str]
    correlation_id: Mapped[str | None] = mapped_column(Text)
    entity_type: Mapped[str]
    entity_id: Mapped[uuid.UUID | None]
    # Python attribute is `extra_data`, not `metadata` — SQLAlchemy's
    # DeclarativeBase already reserves `metadata` for Base.metadata (the
    # MetaData object itself); using it as a column attribute name would
    # shadow that. The actual database column is still named `metadata`,
    # matching 06_Backend_Schema.md §4's literal field name.
    extra_data: Mapped[dict | None] = mapped_column("metadata", JSONB)
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))


# Plain Table, not a mapped class — 06_Backend_Schema.md §4 describes this
# as a composite-PK join table with no columns of its own beyond the two
# FKs, so there's no row identity worth giving its own ORM class.
venue_amenities = Table(
    "venue_amenities",
    Base.metadata,
    Column("venue_id", ForeignKey("venues.id", ondelete="CASCADE"), primary_key=True),
    Column("amenity_id", ForeignKey("amenities.id", ondelete="CASCADE"), primary_key=True),
)


class Amenity(Base):
    """06_Backend_Schema.md §4 (summary only, no full DDL). Phase 1 doesn't
    have an admin-curated master list anywhere in the docs, so amenities
    are get-or-created by name when a venue references one — see
    app/modules/catalog/service.py. That's a deliberate simplicity choice,
    not a doc requirement; a fixed taxonomy is one migration away if
    free-text tags turn out to fragment too much in practice (e.g. "wifi"
    vs "WiFi" vs "Wi-Fi" becoming three different rows)."""

    __tablename__ = "amenities"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    name: Mapped[str] = mapped_column(unique=True)

    venues: Mapped[list["Venue"]] = relationship(secondary=venue_amenities, back_populates="amenities")


class VenueMedia(Base):
    """06_Backend_Schema.md §4: 'partial unique index ensures only one
    is_cover = true per venue' — implemented exactly as the doc's summary
    describes, same partial-unique-index pattern used everywhere else in
    this schema (uq_active_booking_per_unit, uq_one_pending_verification_per_user)."""

    __tablename__ = "venue_media"
    __table_args__ = (
        Index(
            "uq_one_cover_image_per_venue",
            "venue_id",
            unique=True,
            postgresql_where=text("is_cover = true"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    venue_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("venues.id", ondelete="CASCADE"))
    url: Mapped[str]
    storage_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_cover: Mapped[bool] = mapped_column(default=False)
    sort_order: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

    venue: Mapped["Venue"] = relationship(back_populates="media")


class LoginRateLimit(Base):
    """Replaces the original Redis INCR+EXPIRE fixed-window counter (see
    the phase summary doc for this slice — Redis removed from the project
    entirely per explicit client direction, Postgres-only going forward).
    One row per rate-limited key (today: f"ratelimit:login:{email}"),
    upserted atomically by check_login_rate_limit() in
    app/modules/auth/service.py — see that function's docstring for the
    UPSERT itself. No relationship to any other table; this is pure
    infrastructure bookkeeping, not domain data, which is also why it's a
    plain primary-key-on-the-key-string table rather than a UUID id."""

    __tablename__ = "login_rate_limits"

    key: Mapped[str] = mapped_column(primary_key=True)
    window_start: Mapped[datetime]
    attempt_count: Mapped[int] = mapped_column(default=1)


class Payout(Base):
    """06_Backend_Schema.md §4/§2: listed only as a one-line summary
    (`owner_id`, `period_start/end`, `gross_amount`, `commission_amount`,
    `net_amount`, `status`) plus an ERD edge (`USERS ||--o{ PAYOUTS :
    receives`) — no full DDL, no status enum, no commission rate, and
    critically no relationship at all back to bookings/payments, even
    though "one row per owner per settlement period" (07_design.md §4)
    necessarily aggregates many of them. Built out exactly the way
    owner_verifications/audit_logs were before this same gap in each of
    them (see PHASE_C3_SUMMARY.md). Decision Points C-10/C-11/C-12 in the
    phase summary doc for this slice cover the reasoning in full —
    gross_amount is defined here as the amount actually *retained* by the
    platform per payment (amount minus any refund_amount), not the
    pre-refund booking price, which is what makes a partially-refunded
    booking contribute the right, non-zero amount without any special-case
    branching.
    """

    __tablename__ = "payouts"
    __table_args__ = (
        CheckConstraint("period_start <= period_end", name="chk_payout_period_valid"),
        CheckConstraint("gross_amount >= 0", name="chk_payout_gross_nonneg"),
        Index("idx_payouts_owner_period", "owner_id", "period_start"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    period_start: Mapped[date_]
    period_end: Mapped[date_]
    gross_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    commission_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    net_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    status: Mapped[str] = mapped_column(PayoutStatus, default="pending")
    paid_at: Mapped[datetime | None]
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

    owner: Mapped["User"] = relationship(back_populates="payouts")
    payments: Mapped[list["Payment"]] = relationship(back_populates="payout")


class Review(Base):
    """User-submitted review for a venue. Any authenticated user may submit
    a review — no booking-verified restriction in Phase 1. Admins can delete
    inappropriate reviews via DELETE /api/v1/admin/reviews/{id}.

    avg_rating on Venue is recalculated in-app (not a DB trigger) every time
    a review is created or deleted — a simple AVG query is fast enough for
    Phase 1 volumes and avoids the trigger-maintenance overhead."""

    __tablename__ = "reviews"
    __table_args__ = (
        CheckConstraint("rating BETWEEN 1 AND 5", name="chk_review_rating_range"),
        Index("idx_reviews_venue_id_created_at", "venue_id", "created_at"),
        UniqueConstraint("booking_id", name="uq_reviews_booking_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    venue_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("venues.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    booking_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("bookings.id", ondelete="SET NULL"))
    rating: Mapped[int]
    content: Mapped[str]
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

    venue: Mapped["Venue"] = relationship(back_populates="reviews")
    user: Mapped["User"] = relationship(back_populates="reviews")
    booking: Mapped["Booking"] = relationship(back_populates="review")


class IdempotencyKey(Base):
    """Stores information for ensuring operations are idempotent."""
    __tablename__ = "idempotency_keys"
    __table_args__ = (
        UniqueConstraint("key", "actor_id", "operation", name="uq_idemp_key_actor_op"),
        Index("idx_idempotency_keys_expires_at", "expires_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    key: Mapped[str]
    actor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    operation: Mapped[str]
    request_hash: Mapped[str | None]
    status: Mapped[str] = mapped_column(IdempotencyStatus, default="in_progress")
    response_code: Mapped[int | None]
    response_body: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    expires_at: Mapped[datetime]


class SystemConfiguration(Base):
    """
    Singleton typed settings table for core business values previously hardcoded.
    Preserves exact production behavior with seed values.
    """
    __tablename__ = "system_configuration"
    __table_args__ = (
        CheckConstraint("id = 1", name="chk_singleton_config"),
        CheckConstraint("booking_hold_duration_minutes > 0", name="chk_hold_duration_positive"),
        CheckConstraint("booking_grace_period_hours >= 0", name="chk_grace_period_nonneg"),
        CheckConstraint("cancellation_full_refund_hours >= cancellation_partial_refund_hours", name="chk_refund_hours_order"),
        CheckConstraint("cancellation_partial_refund_percent BETWEEN 0 AND 100", name="chk_refund_percent_range"),
        CheckConstraint("platform_commission_percent BETWEEN 0 AND 100", name="chk_commission_percent_range"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_hold_duration_minutes: Mapped[int] = mapped_column(default=1440)
    booking_grace_period_hours: Mapped[int] = mapped_column(default=2)
    cancellation_full_refund_hours: Mapped[int] = mapped_column(default=48)
    cancellation_partial_refund_hours: Mapped[int] = mapped_column(default=24)
    cancellation_partial_refund_percent: Mapped[int] = mapped_column(default=50)
    platform_commission_percent: Mapped[int] = mapped_column(default=10)

    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(server_default=text("now()"))


class Block(Base):
    """Temporary or maintenance blocking windows for a venue or specific inventory unit."""
    __tablename__ = "blocks"
    __table_args__ = (
        CheckConstraint("start_time < end_time", name="chk_block_time_range"),
        Index(
            "idx_blocks_venue_active",
            "venue_id",
            postgresql_where=text("status = 'active'"),
        ),
        Index("idx_blocks_venue_time", "venue_id", "start_time"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    venue_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("venues.id", ondelete="CASCADE"))
    inventory_unit_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("inventory_units.id", ondelete="CASCADE"))
    start_time: Mapped[datetime]
    end_time: Mapped[datetime]
    reason: Mapped[str]
    status: Mapped[str] = mapped_column(BlockStatus, default="active")
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

    venue: Mapped["Venue"] = relationship()
    inventory_unit: Mapped["InventoryUnit | None"] = relationship()
    creator: Mapped["User"] = relationship()

class OutboxEvent(Base):
    """Transactional outbox pattern for reliable side-effects"""
    __tablename__ = "outbox_events"
    __table_args__ = (
        Index(
            "idx_outbox_events_pending",
            "status",
            "next_attempt_at",
            postgresql_where=text("status = 'pending'"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    event_type: Mapped[str]
    correlation_id: Mapped[str | None] = mapped_column(Text)
    aggregate_type: Mapped[str]
    aggregate_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    payload: Mapped[dict] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(OutboxEventStatus, default="pending")
    attempts: Mapped[int] = mapped_column(default=0)
    next_attempt_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    processed_at: Mapped[datetime | None]
    error_details: Mapped[str | None]


class Job(Base):
    """Unified background jobs model."""
    __tablename__ = "jobs"
    __table_args__ = (
        Index(
            "idx_jobs_pending",
            "status",
            "next_attempt_at",
            postgresql_where=text("status IN ('pending', 'running')"),
        ),
        Index(
            "idx_jobs_correlation",
            "job_type",
            "correlation_id",
            unique=True,
            postgresql_where=text("status IN ('pending', 'running')"),
        ),
    )
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    job_type: Mapped[str] = mapped_column(Text)
    correlation_id: Mapped[str | None] = mapped_column(Text)
    payload: Mapped[dict | None] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(JobStatus, default="pending")
    attempts: Mapped[int] = mapped_column(default=0)
    max_attempts: Mapped[int] = mapped_column(default=3)
    error_details: Mapped[str | None] = mapped_column(Text)
    next_attempt_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    started_at: Mapped[datetime | None]
    completed_at: Mapped[datetime | None]

class SupportTicket(Base):
    """Lightweight support/dispute model — reuses existing bookings, users,
    venues, audit logs, and notifications rather than building a separate CRM.

    category="dispute" requires a non-null booking_id. Dispute resolution
    records outcomes in TicketEvent metadata but cannot bypass booking/payment
    invariants — any refund or status change on the booking itself must go
    through the existing booking service endpoints."""

    __tablename__ = "support_tickets"
    __table_args__ = (
        Index("idx_support_tickets_creator", "creator_id", "created_at"),
        Index(
            "idx_support_tickets_venue_status",
            "venue_id",
            "status",
            postgresql_where=text("venue_id IS NOT NULL"),
        ),
        Index("idx_support_tickets_status", "status", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    subject: Mapped[str]
    description: Mapped[str]
    status: Mapped[str] = mapped_column(TicketStatus, default="open")
    category: Mapped[str] = mapped_column(TicketCategory, default="general")
    priority: Mapped[str] = mapped_column(TicketPriority, default="medium")
    creator_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    assignee_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    booking_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("bookings.id", ondelete="SET NULL")
    )
    venue_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("venues.id", ondelete="SET NULL")
    )
    resolved_at: Mapped[datetime | None]
    closed_at: Mapped[datetime | None]
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

    creator: Mapped["User"] = relationship(
        back_populates="support_tickets", foreign_keys=[creator_id]
    )
    assignee: Mapped["User | None"] = relationship(foreign_keys=[assignee_id])
    booking: Mapped["Booking | None"] = relationship()
    venue: Mapped["Venue | None"] = relationship()
    events: Mapped[list["TicketEvent"]] = relationship(
        back_populates="ticket",
        cascade="all, delete-orphan",
        order_by="TicketEvent.created_at",
    )


class TicketEvent(Base):
    """Immutable event log for a support ticket — mirrors BookingEvent's
    pattern. Rows with internal=True are admin-only notes hidden from
    customers and venue owners."""

    __tablename__ = "ticket_events"
    __table_args__ = (
        Index("idx_ticket_events_ticket", "ticket_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    ticket_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("support_tickets.id", ondelete="CASCADE")
    )
    event_type: Mapped[str]
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    old_status: Mapped[str | None]
    new_status: Mapped[str | None]
    comment: Mapped[str | None]
    internal: Mapped[bool] = mapped_column(default=False)
    extra_data: Mapped[dict | None] = mapped_column("metadata", JSONB)
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

    ticket: Mapped["SupportTicket"] = relationship(back_populates="events")
    actor: Mapped["User | None"] = relationship()


from app.modules.core.logging import request_id_ctx

@event.listens_for(BookingEvent, "before_insert")
def receive_before_insert_booking_event(mapper, connection, target):
    if target.correlation_id is None:
        target.correlation_id = request_id_ctx.get()

@event.listens_for(AuditLog, "before_insert")
def receive_before_insert_audit_log(mapper, connection, target):
    if target.correlation_id is None:
        target.correlation_id = request_id_ctx.get()
class PricingRule(Base):
    __tablename__ = "pricing_rules"
    __table_args__ = (
        Index("idx_pricing_rules_venue_active", "venue_id", postgresql_where=text("is_active = true")),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    venue_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("venues.id", ondelete="CASCADE"))
    name: Mapped[str]
    rule_type: Mapped[str] = mapped_column(PricingRuleType)
    adjustment_type: Mapped[str] = mapped_column(PricingAdjustmentType)
    adjustment_value: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    
    start_date: Mapped[date_ | None]
    end_date: Mapped[date_ | None]
    start_time: Mapped[time | None]
    end_time: Mapped[time | None]
    days_of_week: Mapped[list[int] | None] = mapped_column(JSONB)
    
    priority: Mapped[int] = mapped_column(default=0)
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

    venue: Mapped["Venue"] = relationship(back_populates="pricing_rules")


class HomepagePlacement(Base):
    """Admin-curated homepage section placement.

    Each row says "venue X should appear in section Y at position Z."
    The homepage API enforces venue.status='active' + scheduling at query
    time — this table only stores the admin's intent, not a visibility
    guarantee. The client never decides which venues appear publicly; all
    filtering is server-side.

    Sections (fixed string set, no enum — avoids a migration per new section):
      featured | trending | popular | recommended | new

    Scheduling:
      start_at IS NULL  → show immediately
      end_at   IS NULL  → no expiry
      Both set          → only visible within that UTC window
    """

    __tablename__ = "homepage_placements"
    __table_args__ = (
        # A venue appears at most once per section — prevents duplicate cards.
        UniqueConstraint("venue_id", "section", name="uq_venue_section"),
        # Primary query index: homepage API fetches by section + enabled,
        # ordered by priority ASC. Partial on enabled keeps the index tiny.
        Index(
            "idx_hp_section_priority",
            "section",
            "priority",
            postgresql_where=text("enabled = TRUE"),
        ),
        # Secondary index for venue-level admin queries.
        Index("idx_hp_venue_id", "venue_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    venue_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("venues.id", ondelete="CASCADE", name="fk_homepage_placements_venue_id")
    )
    section: Mapped[str] = mapped_column(nullable=False)
    enabled: Mapped[bool] = mapped_column(default=True)
    priority: Mapped[int] = mapped_column(default=0)
    badge: Mapped[str | None] = mapped_column(nullable=True)
    custom_title: Mapped[str | None] = mapped_column(nullable=True)
    custom_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Scheduling — UTC datetimes. NULL = show immediately / no expiry.
    start_at: Mapped[datetime | None] = mapped_column(nullable=True)
    end_at: Mapped[datetime | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

    venue: Mapped["Venue"] = relationship(back_populates="homepage_placements")


class Category(Base):
    __tablename__ = "categories"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    name: Mapped[str] = mapped_column(unique=True)

class VenueType(Base):
    __tablename__ = "venue_types"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    category_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("categories.id", ondelete="CASCADE"))
    name: Mapped[str]
    category: Mapped["Category"] = relationship()

class UseCase(Base):
    __tablename__ = "use_cases"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    name: Mapped[str] = mapped_column(unique=True)
    venues: Mapped[list["Venue"]] = relationship(secondary="venue_use_cases", back_populates="use_cases")

venue_use_cases = Table(
    "venue_use_cases",
    Base.metadata,
    Column("venue_id", ForeignKey("venues.id", ondelete="CASCADE"), primary_key=True),
    Column("use_case_id", ForeignKey("use_cases.id", ondelete="CASCADE"), primary_key=True),
)

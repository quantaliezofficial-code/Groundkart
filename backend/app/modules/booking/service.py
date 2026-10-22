"""
Booking Engine service functions — 07_design.md §5.1, §5.5, §5.6 made concrete.

Payment confirmation model, as of this revision (see Decision Point C-5/C-6
in PHASE_C6_SUMMARY.md): the client confirms payment offline and an admin
marks it confirmed — confirm_booking_by_admin() is the real, currently-used
path. confirm_booking_from_webhook() still exists (Phase B built it against
07_design.md §5.2's Razorpay-webhook design) but nothing calls it through
real HTTP right now; it's dormant, not deleted, in case gateway
integration is revisited later. Both share one transition helper
(_apply_payment_confirmation) so "how was payment verified" never causes
the confirmed_at/grace_period_ends_at/unit-status logic to drift between
the two paths.

Five things in here are worth reading the comments on, not just the code:
1. create_booking() — the concurrency-safe hold, per 06_Backend_Schema.md §6,
   extended with manage_token hashing (Decision Point B-2). HOLD_DURATION
   is now a config value, not a hardcoded 10 minutes — see Decision Point C-5.
2. compute_grace_period_ends_at() — Decision Point B-1: what "cap at slot
   start" means for a half_day/full_day unit that has no start_time.
3. confirm_booking_by_admin() — the actual payment-confirmation path in
   use today; records a real Payment row and an audit_logs entry
   regardless of payment happening off-platform.
4. flag_booking() — 07_design.md §5.5's sequence diagram, plus the
   bookings.status: cancelled -> refunded completion that diagram omits
   (05_App_Flow.md §5's state diagram requires it; flagged in
   PHASE_B_SUMMARY.md as a doc inconsistency, not a product decision).
5. compute_refund_fraction() / cancel_booking_as_customer() /
   cancel_booking_by_manage_token() — the customer-initiated cancellation
   path flagged as missing since PHASE_C5_SUMMARY.md. Decision Point C-7:
   no doc specifies the actual refund-tier cutoffs/percentages, only one
   hedged example in 03_Implementation_Plan.md. Decision Point C-8: this
   path is atomic (compute the tier, cancel, mark refunded in one
   transaction) rather than a second admin-confirmed step mirroring
   confirm_booking_by_admin — deliberately matching flag_booking's
   existing, tested, atomic precedent instead of introducing a second
   refund-execution shape for the same concept. See the phase summary doc
   for this slice for the full reasoning on both.
"""
from __future__ import annotations

import hashlib
import re
import secrets
import uuid
from datetime import date as date_
from datetime import datetime, time, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.models.core import Review, AuditLog, Booking, BookingActionRequest, BookingEvent, InventoryUnit, Payment, Venue, VenuePurpose
from app.modules.core.outbox import create_outbox_event
from app.modules.notifications.service import notify
from app.modules.booking.domain import transition_booking_status
# Decision Point B-3 (flag this for explicit sign-off — see
# PHASE_B_SUMMARY.md): inventory_units.date/start_time are
# DATE/TIME WITHOUT TIME ZONE columns (06_Backend_Schema.md §3) — naive
# values with no timezone attached at the database level. Nothing in the
# docs states what timezone they're meant to represent. Treating them as
# UTC (the easy default) would silently shift every grace-period
# calculation by 5.5 hours for a single-city India pilot (01_PRD.md §9).
# Assumed here: every inventory_unit's date/start_time is the venue's local
# wall-clock time, i.e. IST — correct for a single-region Phase 1, wrong the
# moment multi-timezone expansion happens (out of scope per PRD §6/§9, but
# worth a one-line note in 06_Backend_Schema.md if this assumption is
# confirmed, so the next person doesn't have to re-derive it from a
# booking-engine bug report).
VENUE_LOCAL_TZ = ZoneInfo("Asia/Kolkata")


def hash_manage_token(raw_token: str) -> str:
    """SHA-256 hex digest. The raw token lives only in the emailed link —
    never in the database, never in logs. See Decision Point B-2."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


async def create_booking(
    session: AsyncSession,
    inventory_unit_id: uuid.UUID,
    customer_id: uuid.UUID | None = None,
    guest_name: str | None = None,
    guest_email: str | None = None,
    guest_phone: str | None = None,
    purpose_id: uuid.UUID | None = None,
    rental_mode: str | None = None,
    guest_count: int | None = None,
    customer_notes: str | None = None,
) -> tuple[Booking, str | None]:
    """Returns (booking, raw_manage_token). raw_manage_token is None for an
    account checkout — only guest bookings get one. The caller (the
    notifications module) puts the raw token in the confirmation email and
    then discards it; only the hash is ever persisted.

    "held" no longer means "mid-checkout on a payment gateway" — see the
    module docstring. It now typically means "requested, payment being
    arranged/confirmed offline, released automatically only if
    HOLD_DURATION passes with no admin action" — see
    confirm_booking_by_admin and cancel_pending_booking below for how a
    held slot actually resolves in practice today.
    """
    if customer_id is None and not (guest_name and guest_email):
        raise HTTPException(status_code=422, detail="Provide a customer_id or guest details")
    if customer_id is not None and (guest_name or guest_email):
        raise HTTPException(
            status_code=422,
            detail="A logged-in booking cannot also include guest_name/guest_email",
        )
    if guest_phone is not None:
        clean_phone = re.sub(r"[\s\-\(\)]", "", guest_phone)
        if clean_phone.startswith("+91"):
            clean_phone = clean_phone[3:]
        elif clean_phone.startswith("91") and len(clean_phone) == 12:
            clean_phone = clean_phone[2:]
        elif clean_phone.startswith("0") and len(clean_phone) == 11:
            clean_phone = clean_phone[1:]
        if not re.match(r"^[6-9]\d{9}$", clean_phone):
            raise HTTPException(
                status_code=422,
                detail="Invalid phone number: must be a valid 10-digit Indian mobile number",
            )
        guest_phone = clean_phone

    async with session.begin():
        from app.modules.core.config_service import get_system_config
        config = await get_system_config(session)

        # Check active unconfirmed holds limit (Finding B7: maximum 3 active reservation holds)
        active_holds_query = select(func.count(Booking.id)).where(
            Booking.status == "pending_payment"
        )
        if customer_id is not None:
            active_holds_query = active_holds_query.where(Booking.customer_id == customer_id)
        else:
            active_holds_query = active_holds_query.where(Booking.guest_email == guest_email)
        active_holds_count = (await session.execute(active_holds_query)).scalar_one()
        if active_holds_count >= 3:
            raise HTTPException(
                status_code=429,
                detail="Maximum 3 active reservation holds allowed. Please complete or release existing reservations before booking again.",
            )

        hold_duration = timedelta(minutes=config.booking_hold_duration_minutes)

        # 1. Fetch initial unit to determine venue and bounds, locking it immediately
        initial_res = await session.execute(
            select(InventoryUnit)
            .options(joinedload(InventoryUnit.venue))
            .where(InventoryUnit.id == inventory_unit_id)
            .with_for_update(of=InventoryUnit)
        )
        unit = initial_res.scalar_one_or_none()
        if unit is None:
            raise HTTPException(status_code=404, detail="Slot not found")
        if unit.status != "available":
            if unit.status == "held":
                # Check if this exact customer or guest already holds this unit in pending_payment (e.g. double click)
                stmt = select(Booking).where(
                    Booking.inventory_unit_id == unit.id,
                    Booking.status == "pending_payment",
                )
                if customer_id is not None:
                    stmt = stmt.where(Booking.customer_id == customer_id)
                elif guest_email is not None:
                    stmt = stmt.where(Booking.guest_email == guest_email)
                    if guest_phone:
                        stmt = stmt.where(Booking.guest_phone == guest_phone)
                existing = (await session.execute(stmt)).scalar_one_or_none()
                if existing:
                    return existing, None
            raise HTTPException(status_code=409, detail="This slot is no longer available")

        # Purpose validation & optional price override
        base_price_override: Decimal | None = None
        if purpose_id is not None:
            purpose = (
                await session.execute(
                    select(VenuePurpose).where(
                        VenuePurpose.id == purpose_id,
                        VenuePurpose.venue_id == unit.venue_id,
                    )
                )
            ).scalar_one_or_none()
            if not purpose or not purpose.enabled:
                raise HTTPException(status_code=422, detail="Selected purpose is not offered by this venue")
            if purpose.use_case_id is None and not purpose.is_custom_approved:
                raise HTTPException(status_code=422, detail="Selected custom purpose is pending admin approval")
            if rental_mode and purpose.allowed_modes and rental_mode not in purpose.allowed_modes:
                raise HTTPException(
                    status_code=422,
                    detail=f"Rental mode '{rental_mode}' is not allowed for this purpose",
                )
            if guest_count is not None:
                if purpose.max_guests and guest_count > purpose.max_guests:
                    raise HTTPException(
                        status_code=422,
                        detail=f"Guest count {guest_count} exceeds purpose maximum of {purpose.max_guests}",
                    )
                if unit.venue.capacity and guest_count > unit.venue.capacity:
                    raise HTTPException(
                        status_code=422,
                        detail=f"Guest count {guest_count} exceeds venue capacity of {unit.venue.capacity}",
                    )
            if purpose.price_override is not None:
                base_price_override = purpose.price_override

        # 2. Lock other overlapping units for this venue in deterministic ID order
        unit_start_ts = unit.starts_at or datetime.combine(unit.date, unit.start_time or time.min)
        unit_end_ts = unit.ends_at or (datetime.combine(unit.date, unit.end_time) if unit.end_time else datetime.combine(unit.date + timedelta(days=1), time.min))

        overlap_query = (
            select(InventoryUnit)
            .where(
                InventoryUnit.venue_id == unit.venue_id,
                InventoryUnit.id != unit.id,
                func.coalesce(InventoryUnit.starts_at, InventoryUnit.date + func.coalesce(InventoryUnit.start_time, time(0, 0))) < unit_end_ts,
                func.coalesce(InventoryUnit.ends_at, InventoryUnit.date + timedelta(days=1)) > unit_start_ts,
            )
            .order_by(InventoryUnit.id.asc())
            .with_for_update()
        )
        other_locked_units = list((await session.execute(overlap_query)).scalars().all())

        # Check for any overlapping unit that is held or booked
        for other in other_locked_units:
            if other.status in ("held", "booked"):
                raise HTTPException(
                    status_code=409,
                    detail="This slot conflicts with an existing reservation or booking for this venue",
                )

        # 3. Check for active maintenance blocks that overlap this slot.
        from app.models.core import Block
        unit_start = datetime.combine(unit.date, unit.start_time) if unit.start_time else datetime.combine(unit.date, time.min)
        unit_end = datetime.combine(unit.date, unit.end_time) if unit.end_time else datetime.combine(unit.date, time.max)
        unit_start_aware = unit_start.replace(tzinfo=VENUE_LOCAL_TZ)
        unit_end_aware = unit_end.replace(tzinfo=VENUE_LOCAL_TZ)

        block_result = await session.execute(
            select(Block).where(
                Block.venue_id == unit.venue_id,
                Block.status == "active",
            )
        )
        active_blocks = block_result.scalars().all()
        for block in active_blocks:
            b_start = block.start_time if block.start_time.tzinfo else block.start_time.replace(tzinfo=VENUE_LOCAL_TZ)
            b_end = block.end_time if block.end_time.tzinfo else block.end_time.replace(tzinfo=VENUE_LOCAL_TZ)
            if max(unit_start_aware, b_start) < min(unit_end_aware, b_end):
                raise HTTPException(
                    status_code=409,
                    detail="This slot is blocked for maintenance. Please choose another slot."
                )

        unit.status = "held"
        unit.hold_expires_at = datetime.now(timezone.utc) + hold_duration

        raw_manage_token: str | None = None
        manage_token_hash: str | None = None
        if customer_id is None:
            raw_manage_token = secrets.token_urlsafe(32)
            manage_token_hash = hash_manage_token(raw_manage_token)

        from app.modules.booking.pricing_service import calculate_booking_price
        price_snapshot = await calculate_booking_price(session, unit, base_price_override=base_price_override)

        booking = Booking(
            customer_id=customer_id,
            guest_name=guest_name,
            guest_email=guest_email,
            guest_phone=guest_phone,
            purpose_id=purpose_id,
            rental_mode=rental_mode,
            guest_count=guest_count,
            customer_notes=customer_notes,
            manage_token_hash=manage_token_hash,
            venue_id=unit.venue_id,
            venue_name=unit.venue.name,
            venue_category=unit.venue.category,
            inventory_unit_id=unit.id,
            status="pending_payment",
            amount=price_snapshot.final_amount,
            base_amount=price_snapshot.base_amount,
            currency=price_snapshot.currency,
            pricing_snapshot=price_snapshot.to_dict(),
        )
        session.add(booking)
        try:
            await session.flush()
        except IntegrityError:
            raise HTTPException(
                status_code=409,
                detail="This slot was just booked by another user",
            )
        
        session.add(BookingEvent(booking_id=booking.id, event_type="created", actor_type="customer" if customer_id else "guest", actor_id=customer_id))
        
        # Notify owner
        notification_records = notify(
            user_id=unit.venue.owner_id,
            type="booking_requested",
            message=f"New booking request for '{unit.venue.name}' on {unit.date}. Please check your dashboard.",
            entity_type="booking",
            entity_id=booking.id,
        )
        session.add_all(notification_records)
        
        await create_outbox_event(
            session,
            event_type="booking_created",
            aggregate_type="booking",
            aggregate_id=booking.id,
            payload={
                "venue_id": str(unit.venue_id),
                "customer_id": str(customer_id) if customer_id else None,
                "amount": str(price_snapshot.final_amount)
            }
        )

    return booking, raw_manage_token  # transaction committed — lock released


def compute_grace_period_ends_at(confirmed_at: datetime, unit: InventoryUnit, grace_period_hours: int) -> datetime:
    """Decision Point B-1 (flag this for explicit sign-off — see
    PHASE_B_SUMMARY.md): 06_Backend_Schema.md §9 defines
    grace_period_ends_at = min(confirmed_at + 2h, slot start time). That's
    unambiguous for an hourly inventory_unit, which always has a
    start_time. A half_day/full_day unit has start_time = NULL (the whole
    `date` is the block, per the schema) — there is no "slot start" to cap
    against.

    Resolution implemented here: the cap exists so the grace window can't
    outlive the moment the customer is already on-site for an hourly
    booking. A half_day/full_day booking is typically made days or weeks
    before the event, so that risk doesn't apply — the grace period is a
    flat duration with no cap. If the intent was actually different (e.g. a
    cap at the start of the booked *date*, regardless of unit_type),
    that's a one-line change here, but it should be a deliberate choice,
    not a SQL NULL silently producing an unbounded grace window.
    """
    flat_duration = timedelta(hours=grace_period_hours)
    if unit.start_time is not None:
        slot_start_naive = datetime.combine(unit.date, unit.start_time)
        slot_start = slot_start_naive.replace(tzinfo=VENUE_LOCAL_TZ)
        return min(confirmed_at + flat_duration, slot_start)
    return confirmed_at + flat_duration


def _event_start_ist(unit: InventoryUnit) -> datetime:
    """Shared reference-point logic with compute_grace_period_ends_at
    (Decision Point B-1) but not literally reused from it: that function's
    "no start_time -> flat duration, no cap" resolution is shaped around an
    hours-long grace window with nothing to cap against, not a days-out
    cancellation policy that needs an actual instant to count backward
    from. For a half_day/full_day unit (start_time IS NULL), local
    midnight IST at the start of `date` is that instant — the same
    "there's no natural intra-day start moment for these" reasoning as
    B-1, applied to a different problem."""
    if unit.start_time is not None:
        naive = datetime.combine(unit.date, unit.start_time)
    else:
        naive = datetime.combine(unit.date, time.min)
    return naive.replace(tzinfo=VENUE_LOCAL_TZ)


def compute_refund_fraction(now: datetime, unit: InventoryUnit, config) -> tuple[Decimal, str]:
    """Decision Point C-7 (flag for explicit sign-off — see the phase
    summary doc for this slice): every doc references "the standard
    distance-from-event refund tiers" as though defined elsewhere, but none
    of them actually give the tier count, cutoffs, or percentages — the
    only concrete anchor anywhere is one hedged example in
    03_Implementation_Plan.md ("e.g., free cancellation > 48h before,
    partial refund inside that window"), and 05_App_Flow.md's state diagram
    implies a third, no-refund tier without naming where it starts. The
    three settings below (app/config.py) are a defensible, industry-common
    placeholder shape — not a confirmed business number — deliberately
    read live from settings rather than cached, so correcting them is a
    .env change, not a redeploy or a code change.

    Returns (refund_fraction, tier_label) — e.g. (Decimal("1.00"),
    "full_refund"). A past event (now already at or after the reference
    instant — e.g. a customer trying to cancel after the slot's start time
    has gone by, which can happen today since no completed-status sweep
    job exists yet) clamps to the no-refund tier rather than erroring or
    extrapolating a nonsensical negative percentage.
    """
    event_start = _event_start_ist(unit)
    hours_until_event = (event_start - now).total_seconds() / 3600

    if hours_until_event >= config.cancellation_full_refund_hours:
        return Decimal("1.00"), "full_refund"
    if hours_until_event >= config.cancellation_partial_refund_hours:
        fraction = Decimal(config.cancellation_partial_refund_percent) / Decimal(100)
        return fraction, "partial_refund"
    return Decimal("0.00"), "no_refund"


def _apply_payment_confirmation(session: AsyncSession, booking: Booking, config, actor_id: uuid.UUID | None, actor_type: str | None) -> Booking:
    """Shared by confirm_booking_from_webhook (Razorpay path, currently
    dormant — see module docstring) and confirm_booking_by_admin (the
    offline path actually in use today). Both need identical
    confirmed_at/grace_period_ends_at/unit-status semantics regardless of
    HOW payment was verified — only the verification mechanism differs,
    and that difference belongs in the caller, not here.

    Caller must already hold the booking row lock (FOR UPDATE), have
    booking.inventory_unit loaded, and be inside an open transaction —
    this function doesn't open one and doesn't re-check status itself
    (callers have different idempotency needs: a webhook redelivery should
    quietly no-op, an admin double-click should 409 — see each caller).
    """
    now = datetime.now(timezone.utc)
    transition_booking_status(session, booking, "confirmed", actor_id, actor_type)
    booking.confirmed_at = now
    booking.grace_period_ends_at = compute_grace_period_ends_at(
        now, booking.inventory_unit, config.booking_grace_period_hours
    )
    booking.inventory_unit.status = "booked"
    # Found while adding BookingDetail.hold_expires_at for the Admin
    # dashboard: every OTHER terminal transition in this module
    # (cancel_pending_booking, flag_booking, cancel_booking_as_customer)
    # clears this: this was the one that didn't. Harmless while nothing
    # ever read it, but a confirmed booking would otherwise misleadingly
    # still show a "hold expires at" timestamp once that field became
    # externally visible.
    booking.inventory_unit.hold_expires_at = None
    return booking


async def confirm_booking_from_webhook(session: AsyncSession, booking_id: uuid.UUID) -> Booking:
    """07_design.md §5.2. DORMANT — see module docstring. Kept, not
    deleted, in case real gateway integration is revisited; nothing in
    app/main.py currently routes an HTTP request here. Called only after
    webhook signature verification — that check would happen one layer up,
    in the webhook route handler, never here, so this function could never
    be reached by an unverified caller if it were wired up."""
    async with session.begin():
        from app.modules.core.config_service import get_system_config
        config = await get_system_config(session)
        result = await session.execute(
            select(Booking)
            .options(joinedload(Booking.inventory_unit), selectinload(Booking.review))
            .where(Booking.id == booking_id)
            .with_for_update(of=Booking)
        )
        booking = result.scalar_one()

        # Idempotency: a webhook can legitimately be delivered more than
        # once (07_design.md §7's webhook idempotency test). If this
        # booking is already confirmed, do nothing and return it as-is —
        # don't recompute confirmed_at/grace_period_ends_at a second time.
        if booking.status == "confirmed":
            return booking

        _apply_payment_confirmation(session, booking, config, None, "system")

    return booking


async def confirm_booking_by_admin(
    session: AsyncSession,
    booking_id: uuid.UUID,
    admin_id: uuid.UUID,
    amount: Decimal,
    method: str,
    reference: str | None = None,
    notes: str | None = None,
) -> Booking:
    """The real payment-confirmation path in use today: the client
    confirms payment happened offline, an admin records it here. Creates
    a real Payment row (gateway='offline', no gateway_payment_id — there's
    no gateway) so `payments` stays the single source of truth for money
    movement regardless of mechanism, which matters for the still-unbuilt
    payout ledger later. Every confirmation is also audit-logged — this is
    money being marked as received without a machine having verified it,
    exactly the kind of action TRD §7 has in mind for audit_logs.

    Unlike the webhook path's quiet idempotency (redelivery is a normal
    gateway behavior), a second confirm attempt here 409s instead of
    no-op'ing: this is a human clicking a button, and a double-click
    silently succeeding twice would create two Payment rows for one
    booking with no signal anything was wrong. Requiring status ==
    'pending_payment' before proceeding rejects that outright.
    """
    async with session.begin():
        from app.modules.core.config_service import get_system_config
        config = await get_system_config(session)
        result = await session.execute(
            select(Booking)
            .options(joinedload(Booking.inventory_unit), selectinload(Booking.review))
            .where(Booking.id == booking_id)
            .with_for_update(of=Booking)
        )
        booking = result.scalar_one_or_none()
        if booking is None:
            raise HTTPException(status_code=404, detail="Booking not found")
        if booking.status != "pending_payment":
            raise HTTPException(
                status_code=409,
                detail=f"This booking is '{booking.status}', not awaiting payment confirmation",
            )
        if amount != booking.amount:
            raise HTTPException(
                status_code=422,
                detail=f"Amount {amount} does not match the booking total {booking.amount}",
            )

        comm_rate = Decimal(config.platform_commission_percent)
        comm_amount = (amount * (comm_rate / Decimal(100))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        payment = Payment(
            booking_id=booking.id,
            gateway="offline",
            amount=amount,
            currency="INR",
            method=method,
            status="success",
            commission_rate=comm_rate,
            commission_amount=comm_amount,
            raw_payload={
                "reference": reference,
                "notes": notes,
                "confirmed_by_admin_id": str(admin_id),
            },
        )
        session.add(payment)
        await session.flush()

        from app.modules.ledger import service as ledger_service
        await ledger_service.record_payment_confirmation(session, payment, booking, admin_id)

        _apply_payment_confirmation(session, booking, config, admin_id, "admin")

        session.add(
            AuditLog(
                actor_id=admin_id,
                action="booking.payment_confirmed_offline",
                entity_type="booking",
                entity_id=booking.id,
                extra_data={"amount": str(amount), "method": method, "reference": reference},
            )
        )

        await create_outbox_event(
            session,
            event_type="booking_payment_confirmed",
            aggregate_type="booking",
            aggregate_id=booking.id,
            payload={
                "amount": str(amount),
                "method": method
            }
        )

    return booking


async def cancel_pending_booking(
    session: AsyncSession, booking_id: uuid.UUID, actor_id: uuid.UUID, reason: str
) -> Booking:
    """Manual escape hatch for a pending_payment booking that isn't going
    to be paid — the offline deal fell through, the customer went quiet,
    etc. Direct consequence of Decision Point C-5: since HOLD_DURATION is
    now long and deal-dependent rather than a short checkout timer (and
    there is still no sweep job — see PHASE_C5_SUMMARY.md's remaining-work
    list), waiting out the timer isn't a realistic way to free up a slot
    someone actually wants to book. This is that release valve: immediate,
    admin-triggered, no need to wait out whatever HOLD_DURATION happens to
    be configured to.

    Deliberately only valid on 'pending_payment' — a booking that's
    already 'confirmed' has its own cancellation paths (flag_booking for
    the owner-initiated grace-window case; the customer-initiated
    refund-tier path is still unbuilt, flagged in PHASE_C5_SUMMARY.md).
    Mixing "cancel a request that was never paid for" and "cancel a
    booking real money was already collected for" into one function would
    blur two very different operations — one has no refund to process at
    all, the other always does.
    """
    async with session.begin():
        result = await session.execute(
            select(Booking)
            .options(joinedload(Booking.inventory_unit), selectinload(Booking.review))
            .where(Booking.id == booking_id)
            .with_for_update(of=Booking)
        )
        booking = result.scalar_one_or_none()
        if booking is None:
            raise HTTPException(status_code=404, detail="Booking not found")
        if booking.status != "pending_payment":
            raise HTTPException(
                status_code=409,
                detail=f"This booking is '{booking.status}', not a pending request",
            )

        now = datetime.now(timezone.utc)
        transition_booking_status(session, booking, "cancelled", actor_id, "system" if actor_id is None else "admin")
        booking.cancellation_reason = reason
        booking.cancelled_at = now
        booking.inventory_unit.status = "available"
        booking.inventory_unit.hold_expires_at = None

        session.add(
            AuditLog(
                actor_id=actor_id,
                action="booking.pending_request_cancelled",
                entity_type="booking",
                entity_id=booking.id,
                extra_data={"reason": reason},
            )
        )

    return booking


async def sweep_expired_holds(session: AsyncSession) -> list[Booking]:
    """The automation cancel_pending_booking's own docstring already
    flagged as missing (PHASE_C5_SUMMARY.md's remaining-work list):
    releases every pending_payment booking whose hold has actually
    expired, without a human having to notice and manually cancel it.
    Reuses cancel_pending_booking's exact state transition — same
    status -> 'cancelled', same unit release, same audit log shape —
    with actor_id=None (this is system-triggered, not a specific admin's
    action; AuditLog.actor_id is nullable specifically for cases like
    this, already rendered as '· system' in the Admin dashboard's audit
    log view). Each swept booking gets its own transaction (via
    cancel_pending_booking's own session.begin() block) rather than one
    giant transaction for the whole batch, so one row failing a
    concurrency check can't roll back every other legitimate release in
    the same pass. Called both by the background loop (app/main.py's
    lifespan) on a timer and by the manual admin-triggered endpoint (POST
    /api/v1/admin/bookings/sweep-expired-holds) — same function either
    way, "automatic" and "on demand" aren't two different implementations.

    The initial SELECT is wrapped in its own session.begin() block
    deliberately, even though it's read-only: AsyncSession auto-begins a
    transaction on first use, and leaving that one open would collide
    with cancel_pending_booking's own session.begin() the moment the loop
    below calls it — "A transaction is already begun on this Session,"
    a real error this hit during testing, not a hypothetical one."""
    now = datetime.now(timezone.utc)
    async with session.begin():
        result = await session.execute(
            select(Booking.id)
            .join(InventoryUnit, Booking.inventory_unit_id == InventoryUnit.id)
            .where(
                Booking.status == "pending_payment",
                InventoryUnit.hold_expires_at.is_not(None),
                InventoryUnit.hold_expires_at < now,
            )
        )
        expired_ids = [row[0] for row in result.all()]

    swept: list[Booking] = []
    for booking_id in expired_ids:
        try:
            booking = await cancel_pending_booking(
                session=session,
                booking_id=booking_id,
                actor_id=None,
                reason="Hold expired — automatically released",
            )
            swept.append(booking)
        except HTTPException:
            # Already handled by the time we got to it — a concurrent
            # sweep, or an admin manually confirmed/cancelled it in the
            # gap between the SELECT above and this row's own
            # with_for_update lock. Not a real failure, just stale.
            continue
    return swept


async def flag_booking(
    session: AsyncSession,
    booking_id: uuid.UUID,
    owner_id: uuid.UUID,
    reason: str,
) -> Booking:
    """07_design.md §5.5, with one completion the sequence diagram itself
    doesn't show: after the refund succeeds, bookings.status moves
    cancelled -> refunded, matching the state diagram in 05_App_Flow.md §5.
    The diagram in §5.5 stops at 'cancelled' with payments.status =
    'refunded' — read literally, bookings.status would never reach the
    'refunded' value the enum defines for it. Treated as a diagram gap, not
    a product decision, and resolved by completing the transition here.
    """
    async with session.begin():
        result = await session.execute(
            select(Booking)
            .options(
                joinedload(Booking.inventory_unit), selectinload(Booking.review),
                selectinload(Booking.payments),
                joinedload(Booking.venue),
            )
            .where(Booking.id == booking_id)
            .with_for_update(of=Booking)
        )
        booking = result.scalar_one_or_none()
        if booking is None:
            raise HTTPException(status_code=404, detail="Booking not found", headers={"code": "not_found"})
        if booking.venue.owner_id != owner_id:
            raise HTTPException(status_code=403, detail="Not your venue", headers={"code": "forbidden"})

        now = datetime.now(timezone.utc)
        if booking.grace_period_ends_at is None or now >= booking.grace_period_ends_at:
            raise HTTPException(
                status_code=410,
                detail="The grace window has closed — use the admin dispute process instead.",
                headers={"code": "grace_period_expired"},
            )

        # Move to under_admin_review and create a BookingActionRequest for admin review (Finding B6)
        transition_booking_status(session, booking, "under_admin_review", owner_id, "owner")
        booking.owner_flagged_at = now
        booking.cancellation_reason = reason

        action_req = BookingActionRequest(
            booking_id=booking.id,
            action_type="cancel",
            requested_by_type="owner",
            requested_by_user_id=owner_id,
            reason="owner_request",
            notes=reason,
            status="pending",
        )
        session.add(action_req)
        await session.flush()

        session.add(
            AuditLog(
                actor_id=owner_id,
                action="booking.owner_flagged_for_review",
                entity_type="booking",
                entity_id=booking.id,
                extra_data={"reason": reason, "action_request_id": str(action_req.id)},
            )
        )

    return booking


async def _apply_customer_cancellation(
    session: AsyncSession, booking: Booking, reason: str | None, now: datetime, config, actor_id: uuid.UUID | None, actor_type: str | None
) -> tuple[Booking, Decimal, str]:
    fraction, tier = compute_refund_fraction(now, booking.inventory_unit, config)

    transition_booking_status(session, booking, "cancelled", actor_id, actor_type)
    booking.cancellation_reason = reason
    booking.cancelled_at = now
    booking.inventory_unit.status = "available"
    booking.inventory_unit.hold_expires_at = None

    total_refund = Decimal("0.00")
    for payment in booking.payments:
        if payment.status == "success":
            refund = (payment.amount * fraction).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            payment.status = "refunded"
            payment.refund_amount = refund
            total_refund += refund

            if refund > Decimal("0.00"):
                from app.models.core import Refund
                from app.modules.ledger import service as ledger_service
                refund_obj = Refund(
                    payment_id=payment.id,
                    booking_id=booking.id,
                    amount=refund,
                    currency=payment.currency,
                    reason=reason or f"Cancelled via tier {tier}",
                    status="processed",
                    mode="offline_manual",
                    reference=f"REF-{uuid.uuid4().hex[:8].upper()}",
                    requested_by_id=actor_id if actor_type == "customer" else None,
                    processed_by_id=actor_id if actor_type == "admin" else None,
                    processed_at=now,
                )
                session.add(refund_obj)
                await session.flush()
                await ledger_service.record_refund(session, refund_obj, payment, actor_id)

    transition_booking_status(session, booking, "refunded", actor_id, actor_type)

    return booking, total_refund, tier


async def cancel_booking_as_customer(
    session: AsyncSession,
    booking_id: uuid.UUID,
    customer_id: uuid.UUID,
    reason: str | None = None,
) -> tuple[Booking, Decimal, str]:
    """POST /bookings/{id}/cancel — the account-holder half of the
    customer-initiated cancellation path flagged as missing since
    PHASE_C5_SUMMARY.md. 07_design.md §3.3 specifies this as
    `DELETE /api/v1/bookings/{id}`; implemented here as POST .../cancel
    instead, matching every other state-changing booking action already
    in this codebase (flag, confirm-payment, cancel-pending — all POST,
    never DELETE) including the doc's own guest-side equivalent for this
    exact operation, which is itself POST .../cancel, not DELETE. A small,
    reasoned deviation for internal consistency, not a product decision.

    Deliberately scoped to the booking's own customer only — not
    admin-inclusive like get_booking_for_viewer. An admin cancelling on a
    customer's behalf over a support call is a real, plausible future
    need, but a different one; adding it later is a `require_role`
    dependency away, reusing _apply_customer_cancellation unchanged. Not
    built now — see the phase summary doc for this slice.

    404, not 403, for "this booking exists but isn't yours" or "this
    booking doesn't exist at all" — same PII-leak-avoidance property
    get_booking_for_viewer already established for the read path,
    Implementation Plan Phase 0 item #3.

    Only valid on status == 'confirmed' — matches cancel_pending_booking's
    own stated boundary (a pending_payment booking has its own, separate
    cancellation path; a booking real money was collected for always
    has a refund to compute, even if that refund is ₹0).
    """
    async with session.begin():
        from app.modules.core.config_service import get_system_config
        config = await get_system_config(session)
        result = await session.execute(
            select(Booking)
            .options(joinedload(Booking.inventory_unit), selectinload(Booking.review), selectinload(Booking.payments))
            .where(Booking.id == booking_id)
            .with_for_update(of=Booking)
        )
        booking = result.scalar_one_or_none()

        not_found = HTTPException(status_code=404, detail="Booking not found")
        if booking is None:
            raise not_found
        if booking.customer_id is None or booking.customer_id != customer_id:
            raise not_found
        if booking.status != "confirmed":
            raise HTTPException(
                status_code=409,
                detail=f"This booking is '{booking.status}', not a confirmed booking that can be cancelled",
            )

        now = datetime.now(timezone.utc)
        booking, refund, tier = await _apply_customer_cancellation(session, booking, reason, now, config, customer_id, "customer")
        if refund > 0:
            session.add(BookingEvent(booking_id=booking.id, event_type="refund_created", actor_type="customer", actor_id=customer_id))
        return booking, refund, tier


async def cancel_booking_by_manage_token(
    session: AsyncSession, raw_token: str, reason: str | None = None
) -> tuple[Booking, Decimal, str]:
    """POST /bookings/manage/{token}/cancel — the guest half of the same
    operation as cancel_booking_as_customer, sharing
    _apply_customer_cancellation so the two entry points can't drift on
    the actual state-transition/refund logic. Same token-is-the-entire-
    authentication reasoning as get_booking_by_manage_token (Decision
    Point B-2) — possessing the correct raw token is sufficient, no other
    identity check needed or possible for a guest.
    """
    token_hash = hash_manage_token(raw_token)
    async with session.begin():
        from app.modules.core.config_service import get_system_config
        config = await get_system_config(session)
        result = await session.execute(
            select(Booking)
            .options(joinedload(Booking.inventory_unit), selectinload(Booking.review), selectinload(Booking.payments))
            .where(Booking.manage_token_hash == token_hash)
            .with_for_update(of=Booking)
        )
        booking = result.scalar_one_or_none()
        if booking is None:
            raise HTTPException(status_code=404, detail="Booking not found")
        if booking.status != "confirmed":
            raise HTTPException(
                status_code=409,
                detail=f"This booking is '{booking.status}', not a confirmed booking that can be cancelled",
            )

        now = datetime.now(timezone.utc)
        booking, refund, tier = await _apply_customer_cancellation(session, booking, reason, now, config, None, "guest")
        if refund > 0:
            session.add(BookingEvent(booking_id=booking.id, event_type="refund_created", actor_type="guest", actor_id=None))
        return booking, refund, tier


async def get_booking_for_viewer(
    session: AsyncSession, booking_id: uuid.UUID, viewer_id: uuid.UUID, viewer_role: str
) -> Booking:
    """GET /bookings/{id}. Visible to the customer who made it, or an
    admin — deliberately NOT to the venue's owner. An owner needing to see
    bookings against their venue is a different shape of need (a
    calendar/dashboard view across all of one venue's bookings, not a
    single-booking-by-id lookup) — out of scope here, flagged in
    PHASE_C5_SUMMARY.md as the natural next gap.

    A guest booking (customer_id IS NULL) is reachable here for an admin
    (is_admin grants access unconditionally, no guest-exclusion clause) —
    confirmed by test_admin_can_view_a_guest_booking_via_this_route after
    this docstring was found to claim the opposite (stale, not accurate;
    left behind from an earlier version of this function that didn't have
    the is_admin clause at all). For anyone who ISN'T the account holder or
    an admin, a guest booking is unreachable through this route — see
    get_booking_by_manage_token for the only other path to one.

    404, not 403, for "this booking exists but isn't yours" — Implementation
    Plan Phase 0 item #3 named exactly this category of bug (the original
    unauthenticated GET /bookings/by-date leaking every customer's name and
    payment status) as a top-priority fix; this route is deliberately
    careful not to reintroduce a milder version of the same leak by
    confirming a stranger's booking even exists.
    """
    result = await session.execute(
        select(Booking).options(joinedload(Booking.inventory_unit), selectinload(Booking.review)).where(Booking.id == booking_id)
    )
    booking = result.scalar_one_or_none()

    not_found = HTTPException(status_code=404, detail="Booking not found")
    if booking is None:
        raise not_found

    is_owner = booking.customer_id is not None and booking.customer_id == viewer_id
    is_admin = viewer_role == "admin"
    if not (is_owner or is_admin):
        raise not_found

    return booking


async def list_bookings_for_owner(
    session: AsyncSession,
    owner_id: uuid.UUID,
    venue_id: uuid.UUID | None = None,
    status: str | None = None,
    date_from: date_ | None = None,
    date_to: date_ | None = None,
) -> list[Booking]:
    """GET /api/v1/owner/bookings — the gap get_booking_for_viewer's own
    docstring names directly: 'a calendar/dashboard view across all of
    one venue's bookings... out of scope here, flagged in
    PHASE_C5_SUMMARY.md as the natural next gap.' This is that view,
    extended to all of an owner's venues rather than just one, since an
    owner with several venues wants one dashboard, not one per venue.

    Deliberately returns BookingDetail-serializable rows only — no
    customer_id/guest_name/guest_email are selected or exposed anywhere
    in this function or the route that calls it. BookingDetail (see
    schemas/booking.py) has no field for customer identity at all; this
    function doesn't fetch it, so there's nothing to accidentally leak
    later. Showing an owner who booked their slot — as opposed to just
    that a slot is booked, for how much, in what state — is a real,
    separate product decision (what to show, whether to mask an email,
    etc.) that hasn't been made anywhere in the docs, so it isn't made
    silently here either. Flagged as an open question, not resolved by
    building around it.

    date_from/date_to filter on the inventory unit's *slot date*, not
    booking creation time — the same choice run_payout() (payout/service.py)
    already made for period membership, for the same reason: an owner
    thinking about "this week's bookings" means slot dates, not whenever
    the booking record happened to be created.
    """
    query = (
        select(Booking)
        .join(Venue, Booking.venue_id == Venue.id)
        .options(joinedload(Booking.inventory_unit), selectinload(Booking.review))
        .where(Venue.owner_id == owner_id)
    )
    if venue_id is not None:
        query = query.where(Booking.venue_id == venue_id)
    if status is not None:
        query = query.where(Booking.status == status)
    if date_from is not None:
        query = query.where(
            Booking.inventory_unit_id.in_(
                select(InventoryUnit.id).where(InventoryUnit.date >= date_from)
            )
        )
    if date_to is not None:
        query = query.where(
            Booking.inventory_unit_id.in_(
                select(InventoryUnit.id).where(InventoryUnit.date <= date_to)
            )
        )
    query = query.order_by(Booking.created_at.desc())

    result = await session.execute(query)
    return list(result.scalars().all())


async def list_bookings_for_admin(
    session: AsyncSession,
    status: str | None = None,
    venue_id: uuid.UUID | None = None,
    date_from: date_ | None = None,
    date_to: date_ | None = None,
    *,
    limit: int = 50,
    offset: int = 0,
) -> list[Booking]:
    """GET /api/v1/admin/bookings — the same gap as list_venues_for_admin/
    list_users_for_admin/list_verifications_for_admin: list_bookings_for_owner
    just above is scoped to Venue.owner_id == owner_id, so an admin calling
    it sees nothing (an admin owns no venues). Without this, admin/bookings/
    {id}/confirm-payment and cancel-pending — both already existed and were
    already tested by ID — had no way to be reached from a real admin
    session; there was no way to discover which booking IDs need action.
    Same no-customer-identity guarantee as list_bookings_for_owner (see its
    docstring): this only ever selects Booking columns that BookingDetail
    exposes, nothing that would leak who booked. limit/offset added later,
    same convention as get_audit_log."""
    query = select(Booking).options(
        joinedload(Booking.inventory_unit), selectinload(Booking.review),
        joinedload(Booking.customer),
        joinedload(Booking.venue).joinedload(Venue.owner)
    ).limit(limit).offset(offset)
    if venue_id is not None:
        query = query.where(Booking.venue_id == venue_id)
    if status is not None:
        query = query.where(Booking.status == status)
    if date_from is not None:
        query = query.where(
            Booking.inventory_unit_id.in_(select(InventoryUnit.id).where(InventoryUnit.date >= date_from))
        )
    if date_to is not None:
        query = query.where(
            Booking.inventory_unit_id.in_(select(InventoryUnit.id).where(InventoryUnit.date <= date_to))
        )
    query = query.order_by(Booking.created_at.desc())

    result = await session.execute(query)
    return list(result.scalars().all())


async def get_booking_for_admin(session: AsyncSession, booking_id: uuid.UUID) -> Booking:
    result = await session.execute(
        select(Booking).options(
            joinedload(Booking.inventory_unit), selectinload(Booking.review),
            joinedload(Booking.customer),
            joinedload(Booking.venue).joinedload(Venue.owner)
        ).where(Booking.id == booking_id)
    )
    booking = result.scalar_one_or_none()
    if booking is None:
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking



async def list_bookings_for_customer(session: AsyncSession, customer_id: uuid.UUID) -> list[Booking]:
    """GET /bookings — 'My Bookings' for an account holder. Guest bookings
    (customer_id IS NULL) never appear here even if made from the same
    email address — guest checkout deliberately has no account-level
    identity to aggregate against; that's the entire point of it being a
    separate, no-login path (01_PRD.md §5)."""
    result = await session.execute(
        select(Booking)
        .options(joinedload(Booking.inventory_unit), selectinload(Booking.review))
        .where(Booking.customer_id == customer_id)
        .order_by(Booking.created_at.desc())
    )
    return list(result.scalars().all())


async def get_booking_by_manage_token(session: AsyncSession, raw_token: str) -> Booking:
    """GET /bookings/manage/{token} — the guest's only path to their own
    booking, per Decision Point B-2: the token IS the guest's
    authentication, so possessing the correct raw token (which hashes to a
    stored manage_token_hash) is sufficient, no other identity check
    needed or possible for a guest."""
    token_hash = hash_manage_token(raw_token)
    result = await session.execute(
        select(Booking).options(joinedload(Booking.inventory_unit), selectinload(Booking.review)).where(Booking.manage_token_hash == token_hash)
    )
    booking = result.scalar_one_or_none()
    if booking is None:
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking


from app.models.core import BookingActionRequest

async def request_booking_action(
    session: AsyncSession,
    booking_id: uuid.UUID,
    actor_id: uuid.UUID | None,
    actor_type: str,
    action_type: str,
    reason_code: str,
    notes: str | None = None,
    metadata_json: dict | None = None,
) -> BookingActionRequest:
    async with session.begin():
        result = await session.execute(
            select(Booking).where(Booking.id == booking_id)
        )
        booking = result.scalar_one_or_none()
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")

        # Basic state check
        if booking.status not in ["confirmed", "upcoming"]:
            raise HTTPException(
                status_code=409, 
                detail=f"Cannot request {action_type} for a booking in {booking.status} state"
            )

        req = BookingActionRequest(
            booking_id=booking.id,
            action_type=action_type,
            requested_by_type=actor_type,
            requested_by_user_id=actor_id,
            reason=reason_code,
            notes=notes,
            metadata_json=metadata_json,
            status="pending"
        )
        session.add(req)
        
        # We also create an event for traceability
        session.add(BookingEvent(
            booking_id=booking.id,
            event_type=f"action_requested_{action_type}",
            actor_type=actor_type,
            actor_id=actor_id,
            extra_data={"reason_code": reason_code, "notes": notes, "metadata": metadata_json}
        ))

    return req

async def process_booking_action_request(
    session: AsyncSession,
    action_request_id: uuid.UUID,
    admin_id: uuid.UUID,
    decision: str,
    decision_reason: str | None,
    config=None,
) -> BookingActionRequest:
    tx = session.begin_nested() if session.in_transaction() else session.begin()
    async with tx:
        if config is None:
            from app.modules.core.config_service import get_system_config
            config = await get_system_config(session)
        result = await session.execute(
            select(BookingActionRequest).options(
                joinedload(BookingActionRequest.booking).joinedload(Booking.inventory_unit), 
                joinedload(BookingActionRequest.booking).selectinload(Booking.payments)
            ).where(BookingActionRequest.id == action_request_id)
            .with_for_update(of=BookingActionRequest)
        )
        req = result.scalar_one_or_none()
        if not req:
            raise HTTPException(status_code=404, detail="Action request not found")

        if req.status != "pending":
            raise HTTPException(status_code=409, detail=f"Request is already {req.status}")

        now = datetime.now(timezone.utc)
        req.status = decision
        req.reviewed_at = now
        req.admin_decision = decision
        req.decision_reason = decision_reason
        
        session.add(BookingEvent(
            booking_id=req.booking_id,
            event_type=f"action_request_{decision}",
            actor_type="admin",
            actor_id=admin_id,
            extra_data={"request_id": str(req.id), "reason": decision_reason}
        ))

        if decision == "approved" and req.action_type == "cancel":
            booking = req.booking
            if booking.status in ["confirmed", "upcoming", "under_admin_review"]:
                if req.requested_by_type in ["customer", "guest"]:
                    await _apply_customer_cancellation(session, booking, req.reason, now, config, admin_id, "admin")
                elif req.requested_by_type == "owner":
                    transition_booking_status(session, booking, "cancelled", admin_id, "admin")
                    booking.cancellation_reason = req.reason
                    booking.cancelled_at = now
                    booking.inventory_unit.status = "available"
                    booking.inventory_unit.hold_expires_at = None
                    for payment in booking.payments:
                        if payment.status == "success":
                            payment.status = "refunded"
                            payment.refund_amount = payment.amount
                            from app.models.core import Refund
                            from app.modules.ledger import service as ledger_service
                            refund_obj = Refund(
                                payment_id=payment.id,
                                booking_id=booking.id,
                                amount=payment.amount,
                                currency=payment.currency,
                                reason=req.reason or "Owner cancellation approved by admin",
                                status="processed",
                                mode="offline_manual",
                                reference=f"REF-{uuid.uuid4().hex[:8].upper()}",
                                requested_by_id=req.requested_by_user_id,
                                processed_by_id=admin_id,
                                processed_at=now,
                            )
                            session.add(refund_obj)
                            await session.flush()
                            await ledger_service.record_refund(session, refund_obj, payment, admin_id)
                    transition_booking_status(session, booking, "refunded", admin_id, "admin")

        elif decision == "rejected":
            booking = req.booking
            if booking.status == "under_admin_review":
                transition_booking_status(session, booking, "confirmed", admin_id, "admin")

        elif decision == "approved" and req.action_type == "reschedule":
            booking = req.booking
            if booking.status in ["confirmed", "upcoming"]:
                new_inventory_unit_id = req.metadata_json.get("new_inventory_unit_id") if req.metadata_json else None
                if not new_inventory_unit_id:
                    raise HTTPException(status_code=400, detail="Missing new_inventory_unit_id in metadata")
                
                from app.models.core import InventoryUnit
                result_new_unit = await session.execute(
                    select(InventoryUnit).where(InventoryUnit.id == new_inventory_unit_id).with_for_update()
                )
                new_unit = result_new_unit.scalar_one_or_none()
                if not new_unit:
                    raise HTTPException(status_code=404, detail="New inventory unit not found")
                
                if new_unit.status != "available":
                    raise HTTPException(status_code=409, detail=f"New inventory unit is {new_unit.status}, not available")
                
                old_unit = booking.inventory_unit
                old_unit.status = "available"
                old_unit.hold_expires_at = None
                
                new_unit.status = "booked"
                booking.inventory_unit_id = new_inventory_unit_id
                
                session.add(BookingEvent(
                    booking_id=booking.id,
                    event_type="booking_rescheduled",
                    actor_type="admin",
                    actor_id=admin_id,
                    extra_data={"old_unit_id": str(old_unit.id), "new_unit_id": str(new_unit.id)}
                ))

    return req

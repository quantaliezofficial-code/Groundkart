"""
Owner payout ledger — HANDOFF.md §7's #1 remaining item after
PHASE_C7_SUMMARY.md resolved customer-initiated cancellation.
06_Backend_Schema.md §4/§2 lists `payouts` as a one-line summary
(`owner_id`, `period_start/end`, `gross_amount`, `commission_amount`,
`net_amount`, `status`) with an ERD edge from users only — no full DDL, no
status enum, no commission rate, and no relationship at all back to
bookings/payments despite 07_design.md §4 describing it as "one row per
owner per settlement period" (necessarily an aggregate of many).

Three things in here are worth reading the comments on, not just the code:

1. compute_payout_split() — Decision Point C-10: no doc gives a
   commission percentage anywhere.
2. run_payout() — Decision Point C-11: what "gross" is computed from,
   what date anchors period membership, and why eligibility requires the
   slot date to have already passed. The most load-bearing reasoning in
   this file — see its own docstring.
3. Payment.payout_id (app/models/core.py) — Decision Point C-12: the
   structural backstop against double-counting a payment across payout
   runs.

See the phase summary doc for this slice for the full reasoning on all
three; the comments here summarize rather than repeat it.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import ROUND_HALF_UP, Decimal

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.core import AuditLog, Booking, InventoryUnit, Payment, Payout, Venue
from app.modules.booking.service import VENUE_LOCAL_TZ
from app.modules.notifications.service import notify


def compute_payout_split(gross_amount: Decimal, config) -> tuple[Decimal, Decimal]:
    """Decision Point C-10 (flag for explicit sign-off — see the phase
    summary doc for this slice): 01_PRD.md/03_Implementation_Plan.md both
    name "gross, commission, net" as the shape of the payout ledger
    without ever giving the commission rate itself. 10% (app/config.py) is
    a defensible marketplace-commission placeholder, not a confirmed
    business number — same env-configurable treatment as Decision Points
    C-5/C-7.

    Returns (commission_amount, net_amount). net is the exact remainder
    after commission is rounded, not independently rounded, so
    commission + net always reconstitutes gross exactly — the property
    that actually matters for a financial ledger, not just "close enough."
    """
    rate = Decimal(config.platform_commission_percent) / Decimal(100)
    commission = (gross_amount * rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    net = gross_amount - commission
    return commission, net


async def run_payout(
    session: AsyncSession,
    admin_id: uuid.UUID,
    owner_id: uuid.UUID,
    period_start: date,
    period_end: date,
) -> Payout:
    """Decision Point C-11 (flag for explicit sign-off — see the phase
    summary doc for this slice; more foundational than C-10's single
    number). Three interacting design calls the docs never make, all
    needed to give "one row per owner per settlement period"
    (07_design.md §4) an actual, correct implementation:

    - "Gross" is the amount the platform actually *retained* per payment
      (payment.amount - COALESCE(refund_amount, 0)), not the pre-refund
      booking price. One formula covers never-refunded (retained ==
      amount), partially-refunded (retained == the kept fraction), and
      fully-refunded (retained == 0) alike — no special-case branching,
      and it falls straight out of Decision Point C-9's refund_amount
      column from the previous slice.
    - Period membership is keyed on the inventory unit's *slot date*, not
      the payment's confirmation date — an owner thinks of "July's
      payout" as bookings for July dates, not as whichever day customers
      happened to pay.
    - Eligibility additionally requires the slot date to already be in
      the past (period_end must be strictly before today). Not just
      caution: compute_refund_fraction (Decision Point C-7) already
      clamps to the 0%-refund tier once an event's start has passed, so
      once a slot's date is behind us, its payment's retained amount can
      never change again — a cancellation attempt after the fact
      computes a 0% refund and leaves retained untouched. Restricting
      payouts to already-past slot dates is what makes that guarantee
      hold, and is what lets Phase 1 skip building a clawback mechanism
      entirely rather than needing one.

    payments.payout_id (Decision Point C-12) is the actual mechanism
    preventing a payment from being counted twice — set once here inside
    this same locked transaction, never cleared, checked via
    `payout_id IS NULL` — not reliance on an admin's chosen period dates
    never overlapping across runs. SELECT ... FOR UPDATE on the matched
    payments means two concurrent runs for the same owner can't both
    select and pay out the same payment; the second blocks, then
    re-evaluates against the first's committed result, the same
    read-committed-plus-row-lock pattern the booking concurrency
    guarantee (test_concurrency.py) already relies on.

    Raises 422 if period_end isn't strictly in the past, or if nothing
    eligible is found — a pointless ₹0 payout more likely means a mistake
    in owner_id/dates than a genuine empty period, so this surfaces that
    rather than silently recording it.
    """
    today = datetime.now(VENUE_LOCAL_TZ).date()
    if period_start > period_end:
        raise HTTPException(status_code=422, detail="period_start must not be after period_end")
    if period_end >= today:
        raise HTTPException(
            status_code=422,
            detail="period_end must be strictly in the past — a payout can only cover slots that have already happened",
        )

    async with session.begin():
        from app.modules.core.config_service import get_system_config
        config = await get_system_config(session)
        result = await session.execute(
            select(Payment)
            .join(Booking, Payment.booking_id == Booking.id)
            .join(Venue, Booking.venue_id == Venue.id)
            .join(InventoryUnit, Booking.inventory_unit_id == InventoryUnit.id)
            .where(
                Venue.owner_id == owner_id,
                Payment.status.in_(("success", "refunded")),
                Payment.payout_id.is_(None),
                InventoryUnit.date >= period_start,
                InventoryUnit.date <= period_end,
            )
            .with_for_update(of=Payment)
        )
        eligible_payments = result.scalars().all()

        if not eligible_payments:
            raise HTTPException(
                status_code=422, detail="No eligible bookings found for this owner in the given period",
            )

        gross_amount = Decimal("0.00")
        for payment in eligible_payments:
            retained = payment.amount - (payment.refund_amount or Decimal("0.00"))
            gross_amount += retained

        commission_amount, net_amount = compute_payout_split(gross_amount, config)

        payout = Payout(
            owner_id=owner_id,
            period_start=period_start,
            period_end=period_end,
            gross_amount=gross_amount,
            commission_amount=commission_amount,
            net_amount=net_amount,
            status="pending",
        )
        session.add(payout)
        await session.flush()  # need payout.id before stamping it onto payments below

        for payment in eligible_payments:
            payment.payout_id = payout.id

        session.add(
            AuditLog(
                actor_id=admin_id,
                action="payout.run",
                entity_type="payout",
                entity_id=payout.id,
                extra_data={
                    "owner_id": str(owner_id),
                    "period_start": str(period_start),
                    "period_end": str(period_end),
                    "gross_amount": str(gross_amount),
                    "payment_count": len(eligible_payments),
                },
            )
        )

    return payout


async def mark_payout_paid(session: AsyncSession, payout_id: uuid.UUID, admin_id: uuid.UUID) -> Payout:
    """The manual-payout-run completion — 01_PRD.md §5: "manual payout run
    acceptable for Phase 1, automated bank transfer is Phase 2." Same
    two-step shape as confirm_booking_by_admin: run_payout() computes and
    records what's owed; this records that a human has actually sent it.

    Unlike Decision Point C-8's choice for customer refunds (atomic, no
    second admin-confirmed step, to match flag_booking's existing
    precedent), payouts get the two-step treatment on their own merits —
    there's no existing atomic precedent to stay consistent with here,
    and "a human is about to send real money out of the platform's
    account" is exactly the case confirm_booking_by_admin's split already
    exists for. A second mark-paid attempt gets a firm 409, not a silent
    no-op — a human double-clicking "mark paid" is a mistake worth
    surfacing, not a redelivered webhook that should quietly no-op.
    """
    async with session.begin():
        result = await session.execute(select(Payout).where(Payout.id == payout_id).with_for_update(of=Payout))
        payout = result.scalar_one_or_none()
        if payout is None:
            raise HTTPException(status_code=404, detail="Payout not found")
        if payout.status != "pending":
            raise HTTPException(status_code=409, detail=f"Payout is '{payout.status}', not pending")

        payout.status = "paid"
        payout.paid_at = datetime.now(timezone.utc)

        session.add(
            AuditLog(
                actor_id=admin_id,
                action="payout.marked_paid",
                entity_type="payout",
                entity_id=payout.id,
                extra_data={"net_amount": str(payout.net_amount)},
            )
        )
        session.add(
            notify(
                payout.owner_id,
                "payout_paid",
                f"Your payout of ₹{payout.net_amount} for {payout.period_start}–{payout.period_end} has been paid.",
                entity_type="payout",
                entity_id=payout.id,
            )
        )

    return payout


async def list_payouts_for_owner(session: AsyncSession, owner_id: uuid.UUID) -> list[Payout]:
    """GET /api/v1/owner/payouts — most-recent-period-first, matching how
    an owner naturally thinks about "my earnings history.\""""
    result = await session.execute(
        select(Payout).where(Payout.owner_id == owner_id).order_by(Payout.period_start.desc())
    )
    return list(result.scalars().all())


async def list_payouts_for_admin(
    session: AsyncSession, status: str | None = None, *, limit: int = 50, offset: int = 0
) -> list[Payout]:
    """GET /api/v1/admin/payouts — same gap as list_bookings_for_admin:
    list_payouts_for_owner just above is scoped to owner_id, so an admin
    calling it sees nothing. Without this, mark_payout_paid (already
    existed, already tested by ID) had no discovery path, and there was no
    way to see which owners are actually due a payout run in the first
    place. Most-recent-period-first, same convention as
    list_payouts_for_owner. Eager-loads owner so AdminPayoutView can show
    a real name instead of a bare owner_id. limit/offset added later, same
    convention as get_audit_log."""
    query = (
        select(Payout)
        .options(selectinload(Payout.owner))
        .order_by(Payout.period_start.desc())
        .limit(limit)
        .offset(offset)
    )
    if status is not None:
        query = query.where(Payout.status == status)
    result = await session.execute(query)
    return list(result.scalars().all())

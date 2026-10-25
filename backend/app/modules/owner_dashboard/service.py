import uuid
from datetime import date, datetime, time, timedelta, timezone
date_ = date
from decimal import Decimal
from zoneinfo import ZoneInfo
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.core import (
    Booking, InventoryUnit, OwnerVerification, Payment, Payout, Review, Venue
)
from app.modules.catalog.service import venue_submission_problems
from app.modules.core.config_service import get_system_config
from app.schemas.owner_dashboard import (
    OwnerAttentionItem,
    OwnerBookingStages,
    OwnerCounters,
    OwnerListingStage,
    OwnerOverviewResponse,
    OwnerUpcomingEvent,
    OwnerVenueStats,
)

IST = ZoneInfo("Asia/Kolkata")


async def get_owner_overview(
    session: AsyncSession,
    owner_id: uuid.UUID,
) -> OwnerOverviewResponse:
    today = date_.today()
    now_ist = datetime.now(IST).replace(tzinfo=None)

    # 1. Fetch all venues of this owner
    venue_stmt = (
        select(Venue)
        .where(Venue.owner_id == owner_id, Venue.deleted_at.is_(None))
        .order_by(Venue.created_at.desc())
    )
    venues = list((await session.execute(venue_stmt)).scalars().all())
    venue_ids = [v.id for v in venues]

    # 2. Build Listing Stages & check for rejected venues
    listing_stages: list[OwnerListingStage] = []
    attention_items: list[OwnerAttentionItem] = []

    for v in venues:
        problems = await venue_submission_problems(session, v)
        if v.status in ("active", "live"):
            progress_pct = 100
        elif v.status == "pending_review":
            progress_pct = 90
        elif v.status == "rejected":
            progress_pct = 60
            attention_items.append(
                OwnerAttentionItem(
                    type="rejected_venue",
                    venue_id=v.id,
                    venue_name=v.name,
                    title="Venue Listing Rejected",
                    message=v.rejection_reason or "Review notes require your attention.",
                    action_url=f"/owner/venues/{v.id}",
                )
            )
        else:
            total_checks = 6
            done_checks = max(0, total_checks - len(problems))
            progress_pct = max(10, int((done_checks / total_checks) * 80))

        listing_stages.append(
            OwnerListingStage(
                venue_id=v.id,
                name=v.name,
                status=v.status,
                progress_pct=progress_pct,
                missing_items=problems,
            )
        )

    # 3. Check Owner Verification
    verif_stmt = (
        select(OwnerVerification)
        .where(OwnerVerification.user_id == owner_id)
        .order_by(OwnerVerification.created_at.desc())
        .limit(1)
    )
    verif = (await session.execute(verif_stmt)).scalar_one_or_none()
    if not verif or verif.status != "approved":
        attention_items.append(
            OwnerAttentionItem(
                type="verification_pending",
                title="Identity Verification Required",
                message="Submit or verify documents to receive payouts.",
                action_url="/owner/account",
            )
        )

    # 4. Check Payouts
    payout_stmt = select(Payout).where(Payout.owner_id == owner_id)
    all_payouts = list((await session.execute(payout_stmt)).scalars().all())
    pending_payouts = [p for p in all_payouts if p.status == "pending"]
    pending_payout_amount = sum((p.net_amount for p in pending_payouts), Decimal("0.00"))
    if pending_payout_amount > Decimal("0.00"):
        attention_items.append(
            OwnerAttentionItem(
                type="payout_ready",
                title="Payout Ready for Processing",
                amount=pending_payout_amount,
                message=f"INR {pending_payout_amount} ready in pending payouts.",
                action_url="/owner/payouts",
            )
        )

    if not venue_ids:
        return OwnerOverviewResponse(
            attention_items=attention_items,
            counters=OwnerCounters(
                earnings_this_month=Decimal("0.00"),
                events_next_7_days=0,
                pending_requests=0,
                next_payout_amount=pending_payout_amount,
            ),
            booking_stages=OwnerBookingStages(
                requested=0,
                awaiting_payment=0,
                confirmed=0,
                completed=0,
                paid_out=0,
            ),
            listing_stages=listing_stages,
            upcoming_events=[],
        )

    # 5. Fetch Bookings for owner's venues
    booking_stmt = (
        select(Booking)
        .options(
            selectinload(Booking.inventory_unit),
            selectinload(Booking.purpose),
            selectinload(Booking.payments).selectinload(Payment.payout),
        )
        .where(Booking.venue_id.in_(venue_ids))
        .order_by(Booking.created_at.desc())
    )
    bookings = list((await session.execute(booking_stmt)).scalars().all())

    # Count booking stages
    requested_count = 0
    awaiting_payment_count = 0
    confirmed_count = 0
    completed_count = 0
    paid_out_count = 0

    first_day_of_month = date(today.year, today.month, 1)
    earnings_this_month = Decimal("0.00")
    events_next_7_days = 0
    today_events_count = 0

    upcoming_events_list: list[OwnerUpcomingEvent] = []
    fourteen_days_later = today + timedelta(days=14)
    seven_days_later = today + timedelta(days=7)

    config = await get_system_config(session)
    comm_rate = Decimal(config.platform_commission_percent) / Decimal(100)

    for b in bookings:
        unit = b.inventory_unit
        if not unit:
            continue

        unit_end_naive = datetime.combine(unit.date, unit.end_time) if unit.end_time else datetime.combine(unit.date, time.max)
        unit_start_naive = datetime.combine(unit.date, unit.start_time) if unit.start_time else datetime.combine(unit.date, time.min)
        has_ended = unit_end_naive < now_ist

        # Check payout state
        is_paid_out = any(
            p.payout and p.payout.status == "paid"
            for p in b.payments
        )

        if b.status == "requested":
            requested_count += 1
        elif b.status == "pending_payment":
            awaiting_payment_count += 1
        elif is_paid_out:
            paid_out_count += 1
        elif b.status in ("confirmed", "upcoming", "completed"):
            if has_ended:
                completed_count += 1
            else:
                confirmed_count += 1
                if today <= unit.date <= seven_days_later:
                    events_next_7_days += 1
                if unit.date == today:
                    today_events_count += 1

        # Calculate monthly earnings
        if b.status in ("confirmed", "upcoming", "completed") and unit.date >= first_day_of_month:
            for p in b.payments:
                if p.status in ("success", "refunded"):
                    net_p = (p.amount - (p.refund_amount or Decimal("0.00")))
                    if net_p > Decimal("0.00"):
                        p_comm = (net_p * comm_rate)
                        earnings_this_month += (net_p - p_comm)

        # Upcoming events (next 14 days)
        if b.status in ("confirmed", "upcoming", "completed") and today <= unit.date <= fourteen_days_later:
            payment_status = "pending"
            for p in b.payments:
                if p.status == "success":
                    payment_status = "paid"
                    break
                elif p.status == "refunded":
                    payment_status = "refunded"

            purpose_name = None
            if b.purpose:
                purpose_name = b.purpose.custom_name or (b.purpose.use_case.name if getattr(b.purpose, "use_case", None) else None)
            if not purpose_name:
                purpose_name = b.rental_mode or "Event"

            upcoming_events_list.append(
                OwnerUpcomingEvent(
                    id=b.id,
                    booking_id=b.id,
                    date=unit.date,
                    venue_id=b.venue_id,
                    venue_name=b.venue_name,
                    purpose=purpose_name,
                    guest_count=b.guest_count,
                    customer_name=b.guest_name or "Guest",
                    payment_status=payment_status,
                    booking_status=b.status,
                    starts_at=unit_start_naive,
                    ends_at=unit_end_naive,
                )
            )

    upcoming_events_list.sort(key=lambda x: (x.date, x.starts_at or datetime.min))

    # Attention items for pending requests & today's events
    pending_total = requested_count + awaiting_payment_count
    if pending_total > 0:
        attention_items.append(
            OwnerAttentionItem(
                type="new_booking_request",
                title="Action Required: Booking Requests",
                count=pending_total,
                message=f"{pending_total} booking request(s) awaiting completion or confirmation.",
                action_url="/owner/bookings?status=pending",
            )
        )

    if today_events_count > 0:
        attention_items.append(
            OwnerAttentionItem(
                type="booking_today",
                title="Events Starting Today",
                count=today_events_count,
                message=f"{today_events_count} event(s) scheduled for today.",
                action_url="/owner/bookings?date=today",
            )
        )

    return OwnerOverviewResponse(
        attention_items=attention_items,
        counters=OwnerCounters(
            earnings_this_month=earnings_this_month.quantize(Decimal("0.01")),
            events_next_7_days=events_next_7_days,
            pending_requests=pending_total,
            next_payout_amount=pending_payout_amount.quantize(Decimal("0.01")),
        ),
        booking_stages=OwnerBookingStages(
            requested=requested_count,
            awaiting_payment=awaiting_payment_count,
            confirmed=confirmed_count,
            completed=completed_count,
            paid_out=paid_out_count,
        ),
        listing_stages=listing_stages,
        upcoming_events=upcoming_events_list,
    )


async def get_owner_venue_stats(
    session: AsyncSession,
    venue_id: uuid.UUID,
    owner_id: uuid.UUID,
) -> OwnerVenueStats:
    venue = (
        await session.execute(
            select(Venue).where(Venue.id == venue_id, Venue.deleted_at.is_(None))
        )
    ).scalar_one_or_none()
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    if venue.owner_id != owner_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this venue's stats")

    today = date_.today()
    thirty_days_ago = today - timedelta(days=30)

    # Bookings in last 30 days
    b_stmt = (
        select(Booking)
        .options(
            selectinload(Booking.inventory_unit),
            selectinload(Booking.payments),
        )
        .where(Booking.venue_id == venue_id)
    )
    bookings = list((await session.execute(b_stmt)).scalars().all())

    config = await get_system_config(session)
    comm_rate = Decimal(config.platform_commission_percent) / Decimal(100)

    revenue_30 = Decimal("0.00")
    recent_bookings_count = 0
    upcoming_events = 0

    for b in bookings:
        unit = b.inventory_unit
        if not unit:
            continue

        if unit.date >= thirty_days_ago:
            recent_bookings_count += 1
            if b.status in ("confirmed", "upcoming", "completed"):
                for p in b.payments:
                    if p.status in ("success", "refunded"):
                        net_p = (p.amount - (p.refund_amount or Decimal("0.00")))
                        if net_p > Decimal("0.00"):
                            revenue_30 += net_p - (net_p * comm_rate)

        if b.status in ("confirmed", "upcoming") and unit.date >= today:
            upcoming_events += 1

    rev_count_stmt = select(func.count(Review.id)).where(Review.venue_id == venue_id)
    review_count = (await session.execute(rev_count_stmt)).scalar_one() or 0

    return OwnerVenueStats(
        venue_id=venue.id,
        name=venue.name,
        revenue_last_30_days=revenue_30.quantize(Decimal("0.01")),
        events_upcoming=upcoming_events,
        recent_bookings_count=recent_bookings_count,
        avg_rating=venue.avg_rating or Decimal("0.00"),
        total_reviews=review_count,
    )

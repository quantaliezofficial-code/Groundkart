import uuid
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy import select, func, case, distinct, and_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.core import Booking, Payment, Payout, InventoryUnit, Venue
from app.modules.core.config_service import get_system_config
from app.schemas.analytics import AnalyticsMetrics, AnalyticsFilter

async def get_analytics_metrics(
    session: AsyncSession, filter: AnalyticsFilter
) -> AnalyticsMetrics:
    # 1. Base conditions
    booking_conditions = [
        InventoryUnit.date >= filter.start_date,
        InventoryUnit.date <= filter.end_date,
    ]
    if filter.venue_id:
        booking_conditions.append(Booking.venue_id == filter.venue_id)
    if filter.owner_id:
        booking_conditions.append(Venue.owner_id == filter.owner_id)

    # 2. Aggregations from Bookings and Payments
    stmt = (
        select(
            func.count(distinct(Booking.id)).label("booking_count"),
            func.sum(
                case(
                    (Payment.status.in_(["success", "refunded"]), Payment.amount),
                    else_=Decimal("0.00")
                )
            ).label("gross_payment_amount"),
            func.sum(
                case(
                    (Payment.status.in_(["success", "refunded"]), func.coalesce(Payment.refund_amount, Decimal("0.00"))),
                    else_=Decimal("0.00")
                )
            ).label("refund_amount"),
            func.count(
                case(
                    (Booking.status == "cancelled", 1),
                    else_=None
                )
            ).label("cancelled_count")
        )
        .select_from(Booking)
        .join(InventoryUnit, Booking.inventory_unit_id == InventoryUnit.id)
        .join(Venue, Booking.venue_id == Venue.id)
        .outerjoin(Payment, Booking.id == Payment.booking_id)
        .where(and_(*booking_conditions))
    )

    result = await session.execute(stmt)
    row = result.first()

    booking_count = row.booking_count or 0
    gross_payment_amount = row.gross_payment_amount or Decimal("0.00")
    refund_amount = row.refund_amount or Decimal("0.00")
    cancelled_count = row.cancelled_count or 0

    retained_gmv = gross_payment_amount - refund_amount
    cancellation_rate = float(cancelled_count) / booking_count if booking_count > 0 else 0.0
    average_booking_value = gross_payment_amount / Decimal(booking_count) if booking_count > 0 else Decimal("0.00")

    # 3. Calculate Platform Revenue and Owner Payout
    # Since Payout is aggregated per owner, we apportion it per payment to support venue-level filtering,
    # or fallback to current config for unpaid payments.
    config = await get_system_config(session)
    current_rate = Decimal(config.platform_commission_percent) / Decimal(100)

    payments_stmt = (
        select(Payment, Payout)
        .select_from(Payment)
        .join(Booking, Payment.booking_id == Booking.id)
        .join(InventoryUnit, Booking.inventory_unit_id == InventoryUnit.id)
        .join(Venue, Booking.venue_id == Venue.id)
        .outerjoin(Payout, Payment.payout_id == Payout.id)
        .where(and_(*booking_conditions, Payment.status.in_(["success", "refunded"])))
    )
    
    payments_result = await session.execute(payments_stmt)
    
    platform_revenue = Decimal("0.00")
    owner_payout_total = Decimal("0.00")
    
    for payment, payout in payments_result:
        retained = payment.amount - (payment.refund_amount or Decimal("0.00"))
        
        if payout and payout.gross_amount > 0:
            # Historically accurate proportion from Payout
            proportion = retained / payout.gross_amount
            comm = (payout.commission_amount * proportion).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            net = (payout.net_amount * proportion).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            platform_revenue += comm
            owner_payout_total += net
        else:
            # Unpaid or 0 gross payout - use current config rate
            comm = (retained * current_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            net = retained - comm
            platform_revenue += comm
            owner_payout_total += net

    # 4. Repeat rate and Utilization
    # Repeat rate: % of bookings made by repeat customers (customers with >1 bookings in the system)
    # We first find all customer IDs for bookings in this range. Then count how many have multiple bookings overall?
    # Or just "customers who had a previous booking before this one"?
    # The requirement says "Percentage of bookings made by repeat customers."
    repeat_rate = 0.0
    if booking_conditions:
        # A bit expensive, maybe we should just count total bookings per customer who appear in our range
        repeat_customers_stmt = (
            select(Booking.customer_id)
            .select_from(Booking)
            .where(Booking.customer_id.is_not(None))
            .group_by(Booking.customer_id)
            .having(func.count(Booking.id) > 1)
        )
        repeat_customers = set((await session.execute(repeat_customers_stmt)).scalars().all())
        
        # Now count how many bookings in our current range belong to these repeat customers
        if repeat_customers and booking_count > 0:
            repeat_booking_stmt = (
                select(func.count(distinct(Booking.id)))
                .select_from(Booking)
                .join(InventoryUnit, Booking.inventory_unit_id == InventoryUnit.id)
                .join(Venue, Booking.venue_id == Venue.id)
                .where(and_(*booking_conditions, Booking.customer_id.in_(repeat_customers)))
            )
            repeat_count = (await session.execute(repeat_booking_stmt)).scalar() or 0
            repeat_rate = float(repeat_count) / booking_count

    # Utilization: booked capacity vs total capacity in period
    # To compute total capacity, we need all InventoryUnits matching the venue/owner and date range.
    util_stmt = (
        select(
            func.count(InventoryUnit.id).label("total_units"),
            func.count(case((InventoryUnit.status == "booked", 1), else_=None)).label("booked_units")
        )
        .select_from(InventoryUnit)
        .join(Venue, InventoryUnit.venue_id == Venue.id)
        .where(and_(*booking_conditions)) # Wait, booking_conditions has Booking conditions?
    )
    # No, we must redefine conditions for InventoryUnit without Booking
    unit_conditions = [
        InventoryUnit.date >= filter.start_date,
        InventoryUnit.date <= filter.end_date,
    ]
    if filter.venue_id:
        unit_conditions.append(InventoryUnit.venue_id == filter.venue_id)
    if filter.owner_id:
        unit_conditions.append(Venue.owner_id == filter.owner_id)

    util_stmt = (
        select(
            func.count(InventoryUnit.id).label("total_units"),
            func.count(case((InventoryUnit.status == "booked", 1), else_=None)).label("booked_units")
        )
        .select_from(InventoryUnit)
        .join(Venue, InventoryUnit.venue_id == Venue.id)
        .where(and_(*unit_conditions))
    )
    util_row = (await session.execute(util_stmt)).first()
    total_units = util_row.total_units or 0
    booked_units = util_row.booked_units or 0
    utilization = float(booked_units) / total_units if total_units > 0 else 0.0

    return AnalyticsMetrics(
        gmv=gross_payment_amount,
        retained_gmv=retained_gmv,
        refunds=refund_amount,
        platform_revenue=platform_revenue,
        owner_payout=owner_payout_total,
        booking_count=booking_count,
        utilization=utilization,
        cancellation_rate=cancellation_rate,
        average_booking_value=average_booking_value,
        repeat_rate=repeat_rate
    )

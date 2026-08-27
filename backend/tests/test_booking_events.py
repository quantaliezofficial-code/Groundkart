from datetime import datetime, timedelta, timezone
from decimal import Decimal
import uuid

import pytest
from sqlalchemy import select

from app.models.core import BookingEvent, Booking, AuditLog, Payment, Payout
from app.modules.booking.service import (
    create_booking,
    confirm_booking_by_admin,
    cancel_pending_booking,
    cancel_booking_as_customer,
    flag_booking
)
from app.modules.payout.service import run_payout, mark_payout_paid


@pytest.fixture
async def db_session(test_session_factory):
    async with test_session_factory() as session:
        yield session


@pytest.mark.asyncio
async def test_booking_event_lifecycle(db_session, seeded_owner_with_unit, seeded_customer, seeded_admin):
    """Test that events are appended sequentially across the booking lifecycle."""
    owner_id, owner_email, unit_id = seeded_owner_with_unit
    customer_id = seeded_customer
    admin_id = seeded_admin

    # 1. Create (customer path)
    booking, _ = await create_booking(
        session=db_session,
        inventory_unit_id=unit_id,
        customer_id=customer_id,
    )
    booking_id = booking.id
    
    # 2. Confirm Payment
    await confirm_booking_by_admin(
        session=db_session,
        booking_id=booking_id,
        admin_id=admin_id,
        amount=booking.amount,
        method="cash",
    )
    
    # Verify events
    result = await db_session.execute(
        select(BookingEvent)
        .where(BookingEvent.booking_id == booking_id)
        .order_by(BookingEvent.created_at.asc(), BookingEvent.event_type.asc())
    )
    events = list(result.scalars().all())
    
    assert len(events) == 2
    
    assert events[0].event_type == "created"
    assert events[0].actor_type == "customer"
    assert events[0].actor_id == customer_id

    assert events[1].event_type == "payment_confirmed"
    assert events[1].actor_type == "admin"
    assert events[1].actor_id == admin_id

@pytest.mark.asyncio
async def test_booking_event_transactional_consistency(db_session, seeded_owner_with_unit, seeded_customer, seeded_admin):
    """Test that a failed state change leaves no event behind."""
    owner_id, owner_email, unit_id = seeded_owner_with_unit
    customer_id = seeded_customer
    admin_id = seeded_admin

    # Create a booking
    booking, _ = await create_booking(
        session=db_session,
        inventory_unit_id=unit_id,
        customer_id=customer_id,
    )
    booking_id = booking.id
    booking_amount = booking.amount
    
    # Intentionally fail payment confirmation by providing wrong amount
    from fastapi import HTTPException
    with pytest.raises(HTTPException):
        await confirm_booking_by_admin(
            session=db_session,
            booking_id=booking_id,
            admin_id=admin_id,
            amount=Decimal("999999.99"), # wrong amount, should 422
            method="cash",
        )
    
    # Ensure no 'payment_confirmed' event was left behind
    result = await db_session.execute(
        select(BookingEvent).where(BookingEvent.booking_id == booking_id)
    )
    events = list(result.scalars().all())
    assert len(events) == 1
    assert events[0].event_type == "created"


@pytest.mark.asyncio
async def test_cancellation_events(db_session, seeded_owner_with_unit, seeded_customer, seeded_admin):
    owner_id, owner_email, unit_id = seeded_owner_with_unit
    customer_id = seeded_customer
    admin_id = seeded_admin

    booking, _ = await create_booking(
        session=db_session,
        inventory_unit_id=unit_id,
        customer_id=customer_id,
    )
    booking_id = booking.id
    
    await confirm_booking_by_admin(
        session=db_session,
        booking_id=booking_id,
        admin_id=admin_id,
        amount=booking.amount,
        method="cash",
    )
    
    from app.modules.auth.dependencies import CurrentUser
    await cancel_booking_as_customer(
        session=db_session,
        booking_id=booking_id,
        customer_id=customer_id,
        reason="Test cancel"
    )
    
    result = await db_session.execute(
        select(BookingEvent)
        .where(BookingEvent.booking_id == booking_id)
        .order_by(BookingEvent.created_at.asc())
    )
    events = list(result.scalars().all())
    
    assert len(events) == 4
    
    types = [e.event_type for e in events]
    assert "created" in types
    assert "payment_confirmed" in types
    assert "cancelled" in types
    assert "refund_created" in types

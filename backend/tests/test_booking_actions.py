import uuid
from datetime import datetime, timezone
import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.models.core import Booking, BookingActionRequest, BookingEvent, InventoryUnit
from app.modules.booking.service import request_booking_action, process_booking_action_request

@pytest.fixture
async def db_session(test_session_factory):
    async with test_session_factory() as session:
        yield session

async def test_request_booking_action(db_session, seeded_customer, seeded_owner_with_unit):
    # Setup booking
    owner_id, owner_email, unit_id = seeded_owner_with_unit
    result = await db_session.execute(select(InventoryUnit.venue_id).where(InventoryUnit.id == unit_id))
    venue_id = result.scalar_one()
    
    booking = Booking(
        id=uuid.uuid4(),
        customer_id=seeded_customer,
        venue_id=venue_id,
        venue_name="Test Venue",
        venue_category="sports",
        inventory_unit_id=unit_id,
        status="confirmed",
        amount=100.0,
        currency="INR"
    )
    db_session.add(booking)
    await db_session.commit()

    # Request action
    req = await request_booking_action(
        db_session,
        booking.id,
        seeded_customer,
        "customer",
        "cancel",
        "customer_changed_plans",
        "Need to cancel"
    )
    
    assert req.action_type == "cancel"
    assert req.status == "pending"
    assert req.reason == "customer_changed_plans"
    
    # Verify event
    result = await db_session.execute(select(BookingEvent).where(BookingEvent.booking_id == booking.id))
    events = result.scalars().all()
    assert any(e.event_type == "action_requested_cancel" for e in events)

async def test_request_booking_action_invalid_state(db_session, seeded_customer, seeded_owner_with_unit):
    owner_id, owner_email, unit_id = seeded_owner_with_unit
    result = await db_session.execute(select(InventoryUnit.venue_id).where(InventoryUnit.id == unit_id))
    venue_id = result.scalar_one()

    booking = Booking(
        id=uuid.uuid4(),
        customer_id=seeded_customer,
        venue_id=venue_id,
        venue_name="Test Venue",
        venue_category="sports",
        inventory_unit_id=unit_id,
        status="cancelled", # Invalid state for action
        amount=100.0,
        currency="INR"
    )
    db_session.add(booking)
    await db_session.commit()

    with pytest.raises(HTTPException) as exc:
        await request_booking_action(
            db_session,
            booking.id,
            seeded_customer,
            "customer",
            "cancel",
            "customer_changed_plans",
        )
    assert exc.value.status_code == 409

async def test_process_booking_action_request_approve_cancellation(db_session, seeded_customer, seeded_admin, seeded_owner_with_unit):
    owner_id, owner_email, unit_id = seeded_owner_with_unit
    
    # Mark unit as booked
    result = await db_session.execute(select(InventoryUnit).where(InventoryUnit.id == unit_id))
    unit = result.scalar_one()
    unit.status = "booked"
    venue_id = unit.venue_id
    
    booking = Booking(
        id=uuid.uuid4(),
        customer_id=seeded_customer,
        venue_id=venue_id,
        venue_name="Test Venue",
        venue_category="sports",
        inventory_unit_id=unit_id,
        status="confirmed",
        amount=100.0,
        currency="INR"
    )
    db_session.add(booking)
    
    req = BookingActionRequest(
        id=uuid.uuid4(),
        booking_id=booking.id,
        action_type="cancel",
        requested_by_type="customer",
        requested_by_user_id=seeded_customer,
        reason="customer_changed_plans",
        status="pending"
    )
    db_session.add(req)
    await db_session.commit()

    # Create dummy config
    class MockConfig:
        customer_cancellation_allowed = True
        cancellation_grace_period_hours = 24
        platform_fee_rate = 0.1
        cancellation_full_refund_hours = 48
        cancellation_partial_refund_hours = 24
        cancellation_partial_refund_percent = 50

    await process_booking_action_request(
        db_session,
        req.id,
        seeded_admin,
        "approved",
        "Approved by admin",
        MockConfig()
    )
    
    # Assertions
    await db_session.refresh(req)
    await db_session.refresh(booking)
    await db_session.refresh(unit)
    
    assert req.status == "approved"
    assert req.admin_decision == "approved"
    assert booking.status in ("cancelled", "refunded")
    assert unit.status == "available"

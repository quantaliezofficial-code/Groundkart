import uuid
import pytest
from fastapi import HTTPException
from app.modules.booking.domain import transition_booking_status

class MockBooking:
    def __init__(self, status):
        self.status = status
        self.id = uuid.uuid4()

class MockSession:
    def add(self, obj):
        pass

def test_transition_booking_status_valid():
    booking = MockBooking("pending_payment")
    session = MockSession()
    actor_id = uuid.uuid4()
    
    # Valid transitions from pending_payment
    transition_booking_status(session, booking, "confirmed", actor_id, "admin")
    assert booking.status == "confirmed"
    
    booking.status = "pending_payment"
    transition_booking_status(session, booking, "expired", actor_id, "admin")
    assert booking.status == "expired"
    
    booking.status = "pending_payment"
    transition_booking_status(session, booking, "cancelled", actor_id, "admin")
    assert booking.status == "cancelled"

    # Valid transitions from confirmed
    booking.status = "confirmed"
    transition_booking_status(session, booking, "cancelled", actor_id, "admin")
    assert booking.status == "cancelled"
    
    booking.status = "confirmed"
    transition_booking_status(session, booking, "refunded", actor_id, "admin")
    assert booking.status == "refunded"
    
    booking.status = "confirmed"
    transition_booking_status(session, booking, "completed", actor_id, "admin")
    assert booking.status == "completed"

    # Valid transition from cancelled
    booking.status = "cancelled"
    transition_booking_status(session, booking, "refunded", actor_id, "admin")
    assert booking.status == "refunded"

def test_transition_booking_status_duplicate_request():
    booking = MockBooking("pending_payment")
    session = MockSession()
    actor_id = uuid.uuid4()
    with pytest.raises(HTTPException) as exc:
        transition_booking_status(session, booking, "pending_payment", actor_id, "admin")
    assert exc.value.status_code == 409
    
    booking.status = "confirmed"
    with pytest.raises(HTTPException) as exc:
        transition_booking_status(session, booking, "confirmed", actor_id, "admin")
    assert exc.value.status_code == 409

def test_transition_booking_status_invalid():
    # pending_payment invalid transitions
    booking = MockBooking("pending_payment")
    session = MockSession()
    actor_id = uuid.uuid4()
    with pytest.raises(HTTPException) as exc:
        transition_booking_status(session, booking, "completed", actor_id, "admin")
    assert exc.value.status_code == 409
    
    with pytest.raises(HTTPException) as exc:
        transition_booking_status(session, booking, "refunded", actor_id, "admin")
    assert exc.value.status_code == 409

    # confirmed invalid transitions
    booking = MockBooking("confirmed")
    with pytest.raises(HTTPException) as exc:
        transition_booking_status(session, booking, "pending_payment", actor_id, "admin")
    assert exc.value.status_code == 409
    
    with pytest.raises(HTTPException) as exc:
        transition_booking_status(session, booking, "expired", actor_id, "admin")
    assert exc.value.status_code == 409

    # terminal states (cancelled, expired, refunded, completed) shouldn't allow any transition except cancelled->refunded
    terminal_states = ["expired", "refunded", "completed"]
    for state in terminal_states:
        booking = MockBooking(state)
        with pytest.raises(HTTPException) as exc:
            transition_booking_status(session, booking, "confirmed", actor_id, "admin")
        assert exc.value.status_code == 409

    # Test exact error message matching requirements
    booking = MockBooking("cancelled")
    with pytest.raises(HTTPException) as exc:
        transition_booking_status(session, booking, "confirmed", actor_id, "admin")
    assert exc.value.status_code == 409
    assert exc.value.detail == "Invalid transition: Cannot change booking status from 'cancelled' to 'confirmed'"

    booking = MockBooking("pending_payment")
    with pytest.raises(HTTPException) as exc:
        transition_booking_status(session, booking, "refunded", actor_id, "admin")
    assert exc.value.status_code == 409
    assert exc.value.detail == "Invalid transition: Cannot change booking status from 'pending_payment' to 'refunded'"

def test_transition_booking_lifecycle_new_states():
    # Test draft -> requested -> under_admin_review -> pending_payment -> confirmed -> upcoming -> in_progress -> completed
    session = MockSession()
    actor_id = uuid.uuid4()
    
    # 1. draft -> requested
    booking = MockBooking("draft")
    transition_booking_status(session, booking, "requested", actor_id, "customer")
    assert booking.status == "requested"
    
    # 2. requested -> under_admin_review
    transition_booking_status(session, booking, "under_admin_review", actor_id, "admin")
    assert booking.status == "under_admin_review"
    
    # 3. under_admin_review -> pending_payment
    transition_booking_status(session, booking, "pending_payment", actor_id, "admin")
    assert booking.status == "pending_payment"
    
    # 4. pending_payment -> confirmed
    transition_booking_status(session, booking, "confirmed", actor_id, "customer")
    assert booking.status == "confirmed"
    
    # 5. confirmed -> upcoming
    transition_booking_status(session, booking, "upcoming", actor_id, "system")
    assert booking.status == "upcoming"
    
    # 6. upcoming -> in_progress
    transition_booking_status(session, booking, "in_progress", actor_id, "system")
    assert booking.status == "in_progress"
    
    # 7. in_progress -> completed
    transition_booking_status(session, booking, "completed", actor_id, "system")
    assert booking.status == "completed"

def test_transition_booking_lifecycle_invalid():
    session = MockSession()
    actor_id = uuid.uuid4()
    
    # draft cannot go to confirmed
    booking = MockBooking("draft")
    with pytest.raises(HTTPException) as exc:
        transition_booking_status(session, booking, "confirmed", actor_id, "customer")
    assert exc.value.status_code == 409
    
    # requested cannot go to upcoming
    booking = MockBooking("requested")
    with pytest.raises(HTTPException) as exc:
        transition_booking_status(session, booking, "upcoming", actor_id, "admin")
    assert exc.value.status_code == 409
    
    # confirmed cannot go to requested
    booking = MockBooking("confirmed")
    with pytest.raises(HTTPException) as exc:
        transition_booking_status(session, booking, "requested", actor_id, "customer")
    assert exc.value.status_code == 409

import pytest
from fastapi import HTTPException
from app.modules.booking.domain import transition_booking_status

class MockBooking:
    def __init__(self, status):
        self.status = status

def test_transition_booking_status_valid():
    booking = MockBooking("pending_payment")
    
    # Valid transitions from pending_payment
    transition_booking_status(booking, "confirmed")
    assert booking.status == "confirmed"
    
    booking.status = "pending_payment"
    transition_booking_status(booking, "expired")
    assert booking.status == "expired"
    
    booking.status = "pending_payment"
    transition_booking_status(booking, "cancelled")
    assert booking.status == "cancelled"

    # Valid transitions from confirmed
    booking.status = "confirmed"
    transition_booking_status(booking, "cancelled")
    assert booking.status == "cancelled"
    
    booking.status = "confirmed"
    transition_booking_status(booking, "refunded")
    assert booking.status == "refunded"
    
    booking.status = "confirmed"
    transition_booking_status(booking, "completed")
    assert booking.status == "completed"

    # Valid transition from cancelled
    booking.status = "cancelled"
    transition_booking_status(booking, "refunded")
    assert booking.status == "refunded"

def test_transition_booking_status_duplicate_request():
    booking = MockBooking("pending_payment")
    with pytest.raises(HTTPException) as exc:
        transition_booking_status(booking, "pending_payment")
    assert exc.value.status_code == 409
    
    booking.status = "confirmed"
    with pytest.raises(HTTPException) as exc:
        transition_booking_status(booking, "confirmed")
    assert exc.value.status_code == 409

def test_transition_booking_status_invalid():
    # pending_payment invalid transitions
    booking = MockBooking("pending_payment")
    with pytest.raises(HTTPException) as exc:
        transition_booking_status(booking, "completed")
    assert exc.value.status_code == 409
    
    with pytest.raises(HTTPException) as exc:
        transition_booking_status(booking, "refunded")
    assert exc.value.status_code == 409

    # confirmed invalid transitions
    booking = MockBooking("confirmed")
    with pytest.raises(HTTPException) as exc:
        transition_booking_status(booking, "pending_payment")
    assert exc.value.status_code == 409
    
    with pytest.raises(HTTPException) as exc:
        transition_booking_status(booking, "expired")
    assert exc.value.status_code == 409

    # terminal states (cancelled, expired, refunded, completed) shouldn't allow any transition except cancelled->refunded
    terminal_states = ["expired", "refunded", "completed"]
    for state in terminal_states:
        booking = MockBooking(state)
        with pytest.raises(HTTPException) as exc:
            transition_booking_status(booking, "confirmed")
        assert exc.value.status_code == 409

    # Test exact error message matching requirements
    booking = MockBooking("cancelled")
    with pytest.raises(HTTPException) as exc:
        transition_booking_status(booking, "confirmed")
    assert exc.value.status_code == 409
    assert exc.value.detail == "This booking is 'cancelled', not a pending request"

    booking = MockBooking("pending_payment")
    with pytest.raises(HTTPException) as exc:
        transition_booking_status(booking, "refunded")
    assert exc.value.status_code == 409
    assert exc.value.detail == "This booking is 'pending_payment', not a confirmed booking that can be cancelled"

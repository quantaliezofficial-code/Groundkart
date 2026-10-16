import uuid
from typing import Dict, Set
from fastapi import HTTPException
from app.models.core import BookingEvent

# Formal state machine for booking status transitions
ALLOWED_BOOKING_TRANSITIONS: Dict[str, Set[str]] = {
    "draft": {"requested", "cancelled", "expired"},
    "requested": {"under_admin_review", "pending_payment", "cancelled", "rejected", "expired"},
    "under_admin_review": {"pending_payment", "cancelled", "rejected"},
    "pending_payment": {"confirmed", "expired", "cancelled"},
    "confirmed": {"upcoming", "in_progress", "completed", "cancelled", "refunded"},
    "upcoming": {"in_progress", "completed", "cancelled"},
    "in_progress": {"completed", "cancelled"},
    "cancelled": {"refunded"},
    "rejected": set(),
    "expired": set(),
    "refunded": set(),
    "completed": set(),
    "disputed": {"refunded", "cancelled", "completed"},
    "suspended": {"cancelled", "refunded"},
}

def transition_booking_status(
    db_session, 
    booking, 
    next_status: str, 
    actor_id: uuid.UUID | None, 
    actor_type: str | None, 
    correlation_id: str | None = None,
    extra_data: dict | None = None
) -> None:
    """
    Validates and performs a formal state transition for a booking.
    Raises HTTPException 409 if the transition is invalid.
    Records a BookingEvent in the same session.
    """
    current_status = booking.status

    allowed_next_states = ALLOWED_BOOKING_TRANSITIONS.get(current_status, set())
    if next_status not in allowed_next_states:
        raise HTTPException(
            status_code=409,
            detail=f"Invalid transition: Cannot change booking status from '{current_status}' to '{next_status}'",
        )
    
    booking.status = next_status
    
    event = BookingEvent(
        booking_id=booking.id,
        event_type=f"booking_{next_status}",
        actor_type=actor_type,
        actor_id=actor_id,
        correlation_id=correlation_id,
        extra_data=extra_data or {}
    )
    db_session.add(event)

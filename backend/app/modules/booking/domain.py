from typing import Dict, Set
from fastapi import HTTPException

# Formal state machine for booking status transitions
ALLOWED_BOOKING_TRANSITIONS: Dict[str, Set[str]] = {
    "pending_payment": {"confirmed", "expired", "cancelled"},
    "confirmed": {"cancelled", "refunded", "completed"},
    "cancelled": {"refunded"},
    "expired": set(),
    "refunded": set(),
    "completed": set(),
}

def transition_booking_status(booking: any, next_status: str) -> None:
    """
    Validates and performs a formal state transition for a booking.
    Raises HTTPException 409 if the transition is invalid.
    """
    current_status = booking.status

    allowed_next_states = ALLOWED_BOOKING_TRANSITIONS.get(current_status, set())
    if next_status not in allowed_next_states:
        # Match existing project error pattern exactly
        if next_status in ("confirmed", "expired") and current_status != "pending_payment":
            raise HTTPException(
                status_code=409,
                detail=f"This booking is '{current_status}', not a pending request",
            )
        elif next_status in ("cancelled", "refunded") and current_status != "confirmed":
            raise HTTPException(
                status_code=409,
                detail=f"This booking is '{current_status}', not a confirmed booking that can be cancelled",
            )
        else:
            raise HTTPException(
                status_code=409,
                detail=f"Invalid transition: Cannot change booking status from '{current_status}' to '{next_status}'",
            )
    
    booking.status = next_status

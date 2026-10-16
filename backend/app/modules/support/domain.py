"""
Formal state machine for support ticket status transitions — mirrors
app/modules/booking/domain.py's pattern exactly.
"""
from typing import Dict, Set

from fastapi import HTTPException

ALLOWED_TICKET_TRANSITIONS: Dict[str, Set[str]] = {
    "open": {"in_review", "closed"},
    "in_review": {"waiting_customer", "resolved", "closed"},
    "waiting_customer": {"in_review", "closed"},
    "resolved": {"closed"},
    "closed": set(),
}


def transition_ticket_status(ticket, next_status: str) -> None:
    """Validates and performs a formal state transition for a support ticket.
    Raises HTTPException 409 if the transition is invalid."""
    current_status = ticket.status
    allowed_next = ALLOWED_TICKET_TRANSITIONS.get(current_status, set())
    if next_status not in allowed_next:
        raise HTTPException(
            status_code=409,
            detail=f"Invalid transition: Cannot change ticket status from '{current_status}' to '{next_status}'",
        )
    ticket.status = next_status

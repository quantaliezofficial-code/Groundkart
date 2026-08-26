from __future__ import annotations
import uuid
from typing import TYPE_CHECKING
from fastapi import HTTPException

if TYPE_CHECKING:
    from app.modules.auth.dependencies import CurrentUser
    from app.models.core import Venue, InventoryUnit, Booking, Payout, OwnerVerification, Notification, User

def authorize_venue_modify(user: CurrentUser, venue: Venue) -> None:
    if user.role == "admin":
        return
    if user.role == "owner" and venue.owner_id == user.id:
        return
    raise HTTPException(status_code=403, detail="Not your venue")

def authorize_venue_view(user: CurrentUser | None, venue: Venue) -> None:
    if venue.status == "active":
        return
    if user is not None:
        if user.role == "admin":
            return
        if user.role == "owner" and venue.owner_id == user.id:
            return
    raise HTTPException(status_code=404, detail="Venue not found")

def authorize_inventory_modify(user: CurrentUser, venue: Venue) -> None:
    if user.role == "admin":
        return
    if user.role == "owner" and venue.owner_id == user.id:
        return
    raise HTTPException(status_code=403, detail="Not your inventory")

def authorize_booking_view(user: CurrentUser, booking: Booking) -> None:
    if user.role == "admin":
        return
    if user.role == "customer" and booking.customer_id == user.id:
        return
    raise HTTPException(status_code=404, detail="Booking not found")

def authorize_booking_cancel_as_customer(user: CurrentUser, booking: Booking) -> None:
    if user.role == "admin":
        return
    if user.role == "customer" and booking.customer_id == user.id:
        return
    raise HTTPException(status_code=403, detail="Not your booking")

def authorize_booking_flag_as_owner(user: CurrentUser, venue: Venue) -> None:
    if user.role == "admin":
        return
    if user.role == "owner" and venue.owner_id == user.id:
        return
    raise HTTPException(status_code=403, detail="Not your venue", headers={"code": "forbidden"})

def authorize_payout_view(user: CurrentUser, venue: Venue) -> None:
    if user.role == "admin":
        return
    if user.role == "owner" and venue.owner_id == user.id:
        return
    raise HTTPException(status_code=403, detail="Not your payout")

def authorize_verification_view(user: CurrentUser, verification: OwnerVerification) -> None:
    if user.role == "admin":
        return
    if user.role == "owner" and verification.owner_id == user.id:
        return
    raise HTTPException(status_code=403, detail="Not your verification")

def authorize_notification_access(user: CurrentUser, notification: Notification) -> None:
    if notification.user_id == user.id:
        return
    raise HTTPException(status_code=404, detail="Notification not found")

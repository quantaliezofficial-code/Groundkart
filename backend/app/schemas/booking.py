"""
Request/response schemas for the endpoints in 07_design.md §3.3/§3.4 that the
three resolved decisions actually touch: POST /bookings (guest-or-account),
the webhook, the owner flag action, and the guest manage-link view.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, time
from decimal import Decimal

from pydantic import BaseModel, EmailStr, Field, model_validator


class BookingCreateRequest(BaseModel):
    """POST /api/v1/bookings — 07_design.md §3.3.

    customer_id is deliberately NOT a field here: a logged-in request gets
    it from the access token (via a dependency), never from the body, so a
    customer can't pass someone else's customer_id. A request with no auth
    header must supply guest_name + guest_email instead — enforced below,
    mirroring the DB's chk_customer_or_guest constraint so the bad request
    gets a clean 422 instead of reaching the database at all.
    """

    inventory_unit_id: uuid.UUID
    guest_name: str | None = Field(default=None, max_length=255)
    guest_email: EmailStr | None = None
    guest_phone: str | None = Field(default=None, max_length=50)

    @model_validator(mode="after")
    def guest_fields_come_together(self) -> "BookingCreateRequest":
        if (self.guest_name is None) != (self.guest_email is None):
            raise ValueError("guest_name and guest_email must be provided together")
        return self


class BookingCreateResponse(BaseModel):
    booking_id: uuid.UUID
    amount: Decimal
    # No default — Decision Point C-5 made this value config-driven
    # (app.config.settings.booking_hold_duration_minutes), not a fixed 10
    # minutes. Requiring the caller to pass it explicitly (see
    # app/main.py's create_booking_route) means a future refactor that
    # forgets to set it fails loudly (a missing required field) instead of
    # silently serving a stale hardcoded number again.
    expires_in: int
    # Present only for a guest booking — the raw token, exactly once, to be
    # placed in the confirmation email and never returned by any other
    # endpoint or stored anywhere after this response is sent.
    manage_token: str | None = None


class BookingFlagRequest(BaseModel):
    """POST /api/v1/bookings/{id}/flag — 07_design.md §5.5."""

    reason: str = Field(min_length=1, max_length=1000)


class BookingDetail(BaseModel):
    """Shared shape for GET /bookings/{id} and the guest manage-link view
    (GET /bookings/manage/{token}) — same fields either way, since a guest
    booking and an account booking carry the same information once you have
    the right to see it at all.

    venue_id/slot_date/slot_start_time/slot_end_time added while starting
    frontend integration (Phase D) — without them there was no way for a
    caller to show *when* a booking is actually for, or to link back to
    the venue. Booking.slot_date etc. are properties over the eager-loaded
    inventory_unit relationship (app/models/core.py) — every route
    returning this schema must eager-load inventory_unit first.
    """

    id: uuid.UUID
    venue_id: uuid.UUID
    venue_name: str
    venue_category: str
    slot_date: date
    slot_start_time: time | None
    slot_end_time: time | None
    status: str
    amount: Decimal
    confirmed_at: datetime | None
    grace_period_ends_at: datetime | None
    cancellation_reason: str | None
    # Added for the Admin dashboard's Bookings screen — see Booking.
    # hold_expires_at's own docstring (app/models/core.py) for why. None
    # once confirmed/cancelled, same as everywhere else this is cleared.
    hold_expires_at: datetime | None

    model_config = {"from_attributes": True}


class BookingCancelRequest(BaseModel):
    """POST /api/v1/bookings/{id}/cancel (account holder) and
    POST /api/v1/bookings/manage/{token}/cancel (guest) — the
    customer-initiated cancellation path flagged as missing since
    PHASE_C5_SUMMARY.md. Both routes share this one schema since they're
    the same operation with two different auth entry points (see
    cancel_booking_as_customer / cancel_booking_by_manage_token in
    app/modules/booking/service.py).

    This class used to be GuestBookingCancelRequest — an intentionally
    empty body, kept only so "a future field... has somewhere to land
    without changing the route signature," per its own original
    docstring. `reason` is that field, added now that the route it was
    waiting for is actually being built. Optional, not required: unlike
    flag_booking/cancel_pending_booking (an owner or admin exercising
    authority over someone *else's* booking, where a mandatory
    justification makes sense), this is a customer or guest cancelling
    their own — there's no one else they owe an explanation to.
    """

    reason: str | None = Field(default=None, max_length=1000)


class BookingCancelResponse(BaseModel):
    """Response for both cancellation routes above. Deliberately its own
    shape rather than reusing BookingDetail: the entire point of this
    endpoint is telling the caller how much they're getting back and
    why, which BookingDetail has no fields for (see the phase summary doc
    for this slice — not extended to expose historical refund amounts on
    GET /bookings/{id} too, kept out of scope for this round)."""

    id: uuid.UUID
    status: str
    cancellation_reason: str | None
    refund_amount: Decimal
    # "full_refund" | "partial_refund" | "no_refund" — Decision Point C-7.
    refund_tier: str


class PaymentWebhookPayload(BaseModel):
    """POST /api/v1/payments/webhook — 07_design.md §5.2. DORMANT, same as
    confirm_booking_from_webhook in the service layer — no route currently
    uses this schema. Kept for the same reason: not deleted, in case
    gateway integration is revisited. Deliberately permissive
    (extra='allow'): the gateway's payload shape is whatever Razorpay
    sends, and the *signature*, not the schema, is what makes this
    trustworthy. Re-validate signature before touching any field here."""

    event: str
    payload: dict

    model_config = {"extra": "allow"}


class AdminConfirmPaymentRequest(BaseModel):
    """POST /api/v1/admin/bookings/{id}/confirm-payment. The offline
    equivalent of a verified gateway webhook — see Decision Point C-5/C-6.
    amount is required and checked against the booking's total server-side
    (booking_service.confirm_booking_by_admin) so a typo here can't
    silently confirm a booking for the wrong amount; method/reference/notes
    are free text since the actual payment channels (cash, UPI, bank
    transfer, cheque) aren't enumerated in any doc and standardizing them
    prematurely would just mean rejecting a real payment method the client
    actually uses."""

    amount: Decimal = Field(gt=0)
    method: str = Field(min_length=1, max_length=100)
    reference: str | None = Field(default=None, max_length=255)
    notes: str | None = Field(default=None, max_length=1000)


class AdminCancelPendingBookingRequest(BaseModel):
    """POST /api/v1/admin/bookings/{id}/cancel-pending — releasing a
    pending_payment slot before HOLD_DURATION elapses on its own. See
    booking_service.cancel_pending_booking's docstring for why this exists
    now specifically (Decision Point C-5 made the hold long; this is the
    manual counterweight to that)."""

    reason: str = Field(min_length=1, max_length=1000)

import uuid
from datetime import date as date_, datetime
from decimal import Decimal
from pydantic import BaseModel


class OwnerAttentionItem(BaseModel):
    type: str  # 'new_booking_request', 'rejected_venue', 'verification_pending', 'payout_ready', 'booking_today'
    venue_id: uuid.UUID | None = None
    venue_name: str | None = None
    title: str
    message: str | None = None
    count: int | None = None
    amount: Decimal | None = None
    action_url: str | None = None


class OwnerCounters(BaseModel):
    earnings_this_month: Decimal
    events_next_7_days: int
    pending_requests: int
    next_payout_amount: Decimal


class OwnerBookingStages(BaseModel):
    requested: int
    awaiting_payment: int
    confirmed: int
    completed: int
    paid_out: int


class OwnerListingStage(BaseModel):
    venue_id: uuid.UUID
    name: str
    status: str
    progress_pct: int
    missing_items: list[str]


class OwnerUpcomingEvent(BaseModel):
    id: uuid.UUID
    booking_id: uuid.UUID
    date: date_
    venue_id: uuid.UUID
    venue_name: str
    purpose: str | None = None
    guest_count: int | None = None
    customer_name: str
    payment_status: str
    booking_status: str
    starts_at: datetime | None = None
    ends_at: datetime | None = None


class OwnerOverviewResponse(BaseModel):
    attention_items: list[OwnerAttentionItem]
    counters: OwnerCounters
    booking_stages: OwnerBookingStages
    listing_stages: list[OwnerListingStage]
    upcoming_events: list[OwnerUpcomingEvent]


class OwnerVenueStats(BaseModel):
    venue_id: uuid.UUID
    name: str
    revenue_last_30_days: Decimal
    events_upcoming: int
    recent_bookings_count: int
    avg_rating: Decimal
    total_reviews: int

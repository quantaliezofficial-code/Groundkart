import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.catalog import VenueMediaResponse
from app.schemas.booking import BookingDetail


class SuspendRequest(BaseModel):
    """Shared by both POST .../venues/{id}/suspend and
    .../users/{id}/suspend — structurally identical, and an admin
    exercising authority over someone else's listing or account, same
    reasoning as BookingFlagRequest, gets a required reason, not an
    optional one (contrast with BookingCancelRequest, where the *customer*
    is acting on their own booking)."""

    reason: str = Field(min_length=1, max_length=1000)


class AuditLogEntry(BaseModel):
    id: uuid.UUID
    actor_id: uuid.UUID | None
    action: str
    entity_type: str
    entity_id: uuid.UUID | None
    extra_data: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminUserView(BaseModel):
    """Response for POST .../users/{id}/suspend and /reactivate.
    Deliberately not UserMeResponse — that schema has no suspended_at/
    suspension_reason fields at all, which is exactly the information an
    admin needs confirmed back after either action."""

    id: uuid.UUID
    name: str
    email: str
    phone: str | None = None
    role: str
    suspended_at: datetime | None
    suspension_reason: str | None

    model_config = {"from_attributes": True}


class AdminOwnerVerificationView(BaseModel):
    """GET /api/v1/admin/owner-verifications — deliberately NOT
    OwnerVerificationResponse (app/schemas/owner_verification.py), which is
    shaped for "check my own application's status" and has no user_id,
    document_url, or applicant name/email at all. An admin reviewing a
    queue of submissions needs exactly those three things: who submitted
    it, and a link to the actual document to review. This is not the same
    privacy question as customer-identity-on-bookings (see
    list_bookings_for_owner's docstring) — identity verification is the
    entire point of this flow; the applicant knowingly submitted a
    government/business document specifically for an admin to review it."""

    id: uuid.UUID
    user_id: uuid.UUID
    applicant_name: str
    applicant_email: str
    applicant_phone: str | None = None
    document_url: str | None = None
    identification_type: str | None = None
    business_name: str | None
    pan: str | None = None
    gstin: str | None = None
    status: str
    rejection_reason: str | None
    created_at: datetime
    reviewed_at: datetime | None

    @classmethod
    def from_verification(cls, verification) -> "AdminOwnerVerificationView":
        return cls(
            id=verification.id,
            user_id=verification.user_id,
            applicant_name=verification.user.name,
            applicant_email=verification.user.email,
            applicant_phone=verification.user.phone if verification.user else None,
            document_url=verification.document_url,
            identification_type=verification.identification_type,
            identification_number=verification.identification_number,
            business_name=verification.business_name,
            pan=getattr(verification, "pan", None),
            gstin=getattr(verification, "gstin", None),
            status=verification.status,
            rejection_reason=verification.rejection_reason,
            created_at=verification.created_at,
            reviewed_at=verification.reviewed_at,
        )


class AdminVenueView(BaseModel):
    """GET /api/v1/admin/venues — same shape as VenueResponse (backend/app/
    schemas/catalog.py) plus owner_name/owner_email. Deliberately a
    separate schema rather than adding those fields to VenueResponse
    itself: VenueResponse is also the public-facing shape (GET /venues),
    and there's no reason a public listing should ever expose an owner's
    contact details. Requires Venue.owner eager-loaded (selectinload) —
    see list_venues_for_admin's own docstring."""

    id: uuid.UUID
    owner_id: uuid.UUID
    owner_name: str
    owner_email: str
    owner_phone: str | None = None
    name: str
    slug: str
    category: str
    description: str | None
    address: str
    city: str
    state: str | None
    pincode: str | None
    capacity: int | None
    unit_type: str
    base_price: Decimal
    status: str
    rejection_reason: str | None
    suspension_reason: str | None
    avg_rating: Decimal
    media: list[VenueMediaResponse] = []
    amenities: list[str] = []
    created_at: datetime

    @classmethod
    def from_venue(cls, venue) -> "AdminVenueView":
        return cls(
            id=venue.id,
            owner_id=venue.owner_id,
            owner_name=venue.owner.name,
            owner_email=venue.owner.email,
            owner_phone=venue.owner.phone if venue.owner else None,
            name=venue.name,
            slug=venue.slug,
            category=venue.category,
            description=venue.description,
            address=venue.address,
            city=venue.city,
            state=venue.state,
            pincode=venue.pincode,
            capacity=venue.capacity,
            unit_type=venue.unit_type,
            base_price=venue.base_price,
            status=venue.status,
            rejection_reason=venue.rejection_reason,
            suspension_reason=venue.suspension_reason,
            avg_rating=venue.avg_rating,
            media=[VenueMediaResponse.model_validate(i) for i in getattr(venue, "media", [])],
            amenities=[a.name for a in venue.amenities],
            created_at=venue.created_at,
        )


class AdminPayoutView(BaseModel):
    """GET /api/v1/admin/payouts — same shape as PayoutDetail (backend/app/
    schemas/payout.py) plus owner_name/owner_email, same reasoning as
    AdminVenueView above. Requires Payout.owner eager-loaded — see
    list_payouts_for_admin's own docstring."""

    id: uuid.UUID
    owner_id: uuid.UUID
    owner_name: str
    owner_email: str
    owner_phone: str | None = None
    period_start: date
    period_end: date
    gross_amount: Decimal
    commission_amount: Decimal
    net_amount: Decimal
    status: str
    paid_at: datetime | None

    @classmethod
    def from_payout(cls, payout) -> "AdminPayoutView":
        return cls(
            id=payout.id,
            owner_id=payout.owner_id,
            owner_name=payout.owner.name,
            owner_email=payout.owner.email,
            owner_phone=payout.owner.phone if payout.owner else None,
            period_start=payout.period_start,
            period_end=payout.period_end,
            gross_amount=payout.gross_amount,
            commission_amount=payout.commission_amount,
            net_amount=payout.net_amount,
            status=payout.status,
            paid_at=payout.paid_at,
        )


class AdminBookingView(BookingDetail):
    """GET /api/v1/admin/bookings — same shape as BookingDetail plus
    user_name/user_email/user_phone/owner_name/owner_email/owner_phone, so the
    admin dashboard can render both side contact and account details."""
    
    user_name: str | None
    user_email: str | None
    user_phone: str | None = None
    owner_name: str
    owner_email: str
    owner_phone: str | None = None

    @classmethod
    def from_booking(cls, booking) -> "AdminBookingView":
        user_name = booking.customer.name if booking.customer else booking.guest_name
        user_email = booking.customer.email if booking.customer else booking.guest_email
        user_phone = booking.customer.phone if booking.customer else booking.guest_phone
        owner_name = booking.venue.owner.name if booking.venue and booking.venue.owner else "Unknown"
        owner_email = booking.venue.owner.email if booking.venue and booking.venue.owner else "Unknown"
        owner_phone = booking.venue.owner.phone if booking.venue and booking.venue.owner else None

        return cls(
            id=booking.id,
            venue_id=booking.venue_id,
            venue_name=booking.venue_name,
            venue_category=booking.venue_category,
            slot_date=booking.slot_date,
            slot_start_time=booking.slot_start_time,
            slot_end_time=booking.slot_end_time,
            status=booking.status,
            amount=booking.amount,
            confirmed_at=booking.confirmed_at,
            grace_period_ends_at=booking.grace_period_ends_at,
            cancellation_reason=booking.cancellation_reason,
            hold_expires_at=booking.hold_expires_at,
            user_name=user_name,
            user_email=user_email,
            user_phone=user_phone,
            owner_name=owner_name,
            owner_email=owner_email,
            owner_phone=owner_phone,
        )


class PlatformOverview(BaseModel):
    """GET /api/v1/admin/overview — 01_PRD.md §5's "View platform-wide
    bookings and GMV." `gmv` is deliberately a *different* sense of
    "gross" than the payout ledger's `gross_amount` (Decision Point
    C-11, PHASE_C8_SUMMARY.md) — see get_platform_overview()'s docstring
    (Decision Point C-13) for why."""

    total_bookings: int
    bookings_by_status: dict[str, int]
    gmv: Decimal
    total_commission_collected: Decimal
    active_venues: int
    pending_venue_approvals: int
    pending_owner_verifications: int

class AdminHealthResponse(BaseModel):
    api_live: bool
    db_connected: bool
    active_users: int
    uptime_percent: float
    latency_ms: int
    web_server_health: float
    db_server_health: float


class AdminReviewView(BaseModel):
    """GET /api/v1/admin/reviews — same shape as ReviewResponse but adds
    venue_name so the admin dashboard can render exactly what was reviewed
    without a separate lookup."""
    id: uuid.UUID
    venue_id: uuid.UUID
    venue_name: str
    user_id: uuid.UUID
    user_name: str
    rating: int
    content: str
    created_at: datetime

    @classmethod
    def from_review(cls, review) -> "AdminReviewView":
        return cls(
            id=review.id,
            venue_id=review.venue_id,
            venue_name=review.venue.name,
            user_id=review.user_id,
            user_name=review.user.name,
            rating=review.rating,
            content=review.content,
            created_at=review.created_at,
        )



class DashboardMetrics(BaseModel):
    gmv: Decimal
    total_bookings: int
    active_venues: int
    active_users: int
    total_commission_collected: Decimal

class AttentionItem(BaseModel):
    type: str
    count: int
    label: str
    action_label: str
    action_link: str

class LiveOperationBooking(BaseModel):
    id: uuid.UUID
    venue_name: str
    category: str
    start_time: datetime
    end_time: datetime
    customer_name: str
    status: str

class LiveOperations(BaseModel):
    currently_booked: int
    available: int
    pending: int
    cancelled_today: int
    active_bookings: list[LiveOperationBooking]

class BookingActivityStats(BaseModel):
    total_today: int
    confirmed_today: int
    pending_today: int
    cancelled_today: int
    completed_today: int

class RecentBooking(BaseModel):
    id: uuid.UUID
    time: datetime
    venue_name: str
    customer_name: str
    status: str
    amount: Decimal

class BookingActivity(BaseModel):
    stats: BookingActivityStats
    recent: list[RecentBooking]

class RevenueStats(BaseModel):
    this_month: Decimal
    this_week: Decimal
    today: Decimal
    chart_data: list[dict]

class VenueHealthStats(BaseModel):
    approved: int
    pending_approval: int
    incomplete: int
    inactive: int
    suspended: int

class TopVenue(BaseModel):
    id: uuid.UUID
    name: str
    bookings_count: int
    gmv: Decimal

class CategoryStats(BaseModel):
    category: str
    percentage: float
    count: int

class SupportStats(BaseModel):
    open_tickets: int
    high_priority: int
    waiting_for_owner: int
    waiting_for_customer: int

class NotificationStats(BaseModel):
    sent_today: int
    failed: int
    unread_alerts: int

class RecentActivityItem(BaseModel):
    id: uuid.UUID
    event: str
    entity_name: str
    actor_name: str
    timestamp: datetime
    amount: Decimal | None

class DashboardOverview(BaseModel):
    metrics: DashboardMetrics
    attention: list[AttentionItem]
    live_operations: LiveOperations
    booking_activity: BookingActivity
    revenue: RevenueStats
    venue_health: VenueHealthStats
    top_venues: list[TopVenue]
    category_performance: list[CategoryStats]
    support: SupportStats
    notifications: NotificationStats
    recent_activity: list[RecentActivityItem]


from typing import Literal

class AdminPasswordResetRequest(BaseModel):
    method: Literal["link", "temporary", "force"]
    reason: str
    notes: str | None = None
    source_type: str | None = None
    source_id: str | None = None

class AdminPasswordResetResponse(BaseModel):
    message: str
    # Full frontend reset URL (e.g. https://app.example.com/reset-password?token=…).
    # Not a raw token — the complete link the admin copies and shares with the user.
    # Treated as a one-time secret: must not be logged, stored, or re-exposed.
    reset_url: str | None = None
    temp_password: str | None = None


class AdminPasswordResetRequestView(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    contact: str
    created_at: datetime
    status: str


class CancelPasswordResetRequest(BaseModel):
    reason: str | None = "Cancelled by administrator"


class SystemSettingsResponse(BaseModel):
    booking_hold_duration_minutes: int
    booking_grace_period_hours: int
    cancellation_full_refund_hours: int
    cancellation_partial_refund_hours: int
    cancellation_partial_refund_percent: int
    platform_commission_percent: int
    payout_holdback_days: int = 3
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SystemSettingsUpdateRequest(BaseModel):
    booking_hold_duration_minutes: int | None = Field(default=None, ge=1, le=10080)
    booking_grace_period_hours: int | None = Field(default=None, ge=0, le=168)
    cancellation_full_refund_hours: int | None = Field(default=None, ge=0, le=720)
    cancellation_partial_refund_hours: int | None = Field(default=None, ge=0, le=720)
    cancellation_partial_refund_percent: int | None = Field(default=None, ge=0, le=100)
    platform_commission_percent: int | None = Field(default=None, ge=0, le=100)
    payout_holdback_days: int | None = Field(default=None, ge=0, le=90)


class BookingActionProcessRequest(BaseModel):
    decision: Literal["approved", "rejected"]
    decision_reason: str | None = None


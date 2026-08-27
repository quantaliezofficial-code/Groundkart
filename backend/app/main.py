import asyncio
import logging
import uuid
from contextlib import asynccontextmanager
from datetime import date as date_
from datetime import datetime, time, timezone
from decimal import Decimal

from fastapi import Body, Depends, FastAPI, File, Form, HTTPException, Query, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.db import SessionLocal, get_db
from app.models.core import Review, Venue
from app.modules.admin import service as admin_service
from app.modules.auth import service as auth_service
from app.modules.auth.dependencies import (
    CurrentUser,
    get_current_user,
    get_current_user_optional,
    get_current_user_row,
    require_role,
)
from app.modules.auth.security import create_access_token
from app.modules.booking import service as booking_service
from app.modules.catalog import service as catalog_service
from app.modules.notifications import service as notifications_service
from app.modules.owner_onboarding import service as onboarding_service
from app.modules.payout import service as payout_service
from app.modules.storage.base import UnsupportedFileError
from app.schemas.admin import (
    AdminOwnerVerificationView,
    AdminPayoutView,
    AdminUserView,
    AdminVenueView,
    AdminBookingView,
    AdminReviewView,
    AuditLogEntry,
    PlatformOverview,
    SuspendRequest,
    AdminHealthResponse,
)
from app.schemas.auth import (
    AccessTokenResponse, 
    LoginRequest, 
    SignupRequest, 
    UserMeResponse,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)
from app.schemas.booking import (
    AdminCancelPendingBookingRequest,
    AdminConfirmPaymentRequest,
    BookingCancelRequest,
    BookingCancelResponse,
    BookingCreateRequest,
    BookingCreateResponse,
    BookingDetail,
    BookingFlagRequest,
)
from app.schemas.catalog import (
    InventoryUnitBatchCreateRequest,
    InventoryUnitResponse,
    ReviewCreateRequest,
    ReviewResponse,
    VenueCreateRequest,
    VenueListResponse,
    VenueRejectRequest,
    VenueResponse,
    VenueUpdateRequest,
    BlockCreateRequest,
    BlockResponse,
)
from app.schemas.notifications import NotificationResponse, UnreadCountResponse
from app.schemas.owner_verification import OwnerVerificationResponse, RejectVerificationRequest
from app.schemas.payout import PayoutDetail, PayoutRunRequest
from app.storage_client import get_file_storage

logger = logging.getLogger("groundbooking.hold_sweep")
# Found during live verification: without this, the sweep's own log.info
# calls go nowhere — Python's default logging level is WARNING and there's
# no handler attached to this logger otherwise. Configured narrowly (this
# logger only) rather than a global logging.basicConfig(), so it doesn't
# fight with uvicorn's own logging setup.
logger.setLevel(logging.INFO)
if not logger.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("%(asctime)s %(name)s %(levelname)s %(message)s"))
    logger.addHandler(_handler)


async def _hold_sweep_loop() -> None:
    """The actual automation — cancel_pending_booking's own docstring
    flagged this as still-missing (PHASE_C5_SUMMARY.md's remaining-work
    list): a stale pending_payment booking used to just sit there forever
    unless an admin happened to notice it and manually cancel-pending it.
    Runs sweep_expired_holds on a timer (hold_sweep_interval_minutes,
    default 5) using its own session (SessionLocal directly, not
    Depends(get_db) — there's no request to depend on out here).

    Deliberately wrapped in try/except per iteration rather than letting
    one bad pass kill the loop for the rest of the process's lifetime — a
    transient DB hiccup on one sweep shouldn't mean holds never get swept
    again until the next deploy."""
    interval_seconds = settings.hold_sweep_interval_minutes * 60
    while True:
        try:
            async with SessionLocal() as session:
                swept = await booking_service.sweep_expired_holds(session)
                if swept:
                    logger.info("hold sweep released %d expired booking(s)", len(swept))
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("hold sweep pass failed — will retry next interval")
        await asyncio.sleep(interval_seconds)


async def _outbox_sweep_loop() -> None:
    interval_seconds = 5  # polling interval
    while True:
        try:
            async with SessionLocal() as session:
                from app.modules.core.outbox_worker import process_outbox_events
                await process_outbox_events(session)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("outbox sweep pass failed — will retry next interval")
        await asyncio.sleep(interval_seconds)

@asynccontextmanager
async def lifespan(_app: FastAPI):
    sweep_task = asyncio.create_task(_hold_sweep_loop())
    outbox_task = asyncio.create_task(_outbox_sweep_loop())
    try:
        yield
    finally:
        sweep_task.cancel()
        outbox_task.cancel()
        try:
            await asyncio.gather(sweep_task, outbox_task, return_exceptions=True)
        except asyncio.CancelledError:
            pass


app = FastAPI(title="GroundBooking API", version="0.1.0", lifespan=lifespan)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    response.headers["Content-Security-Policy"] = "default-src 'self'"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# A real, necessary prerequisite found while starting frontend integration
# (Phase D) — no CORS configuration existed anywhere before this. Without
# it, a browser running the frontend on a different origin can't reach
# this API at all, regardless of whether any given request is otherwise
# correct. allow_credentials=True because the refresh token travels as an
# httpOnly cookie (see _set_refresh_cookie below) — CORS forbids pairing
# that with a wildcard origin, which is why cors_allowed_origins
# (app/config.py) is an explicit list, not "*".
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_allowed_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# A real, necessary fix found while wiring the owner dashboard's image
# upload to real data (see app/modules/storage/base.py's LocalFileStorage
# for the other half of this): without this mount, the URL LocalFileStorage
# returns points at nothing an HTTP client can reach, dev/test only, same
# scope as LocalFileStorage itself — a real S3/R2 deployment serves images
# from the provider directly and would not need this mount at all.
import os as _os

_uploads_dir = "/tmp/groundbooking-uploads"
_os.makedirs(_uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=_uploads_dir), name="uploads")

REFRESH_COOKIE_NAME = "refresh_token"
REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30  # 30 days, matches REFRESH_TOKEN_TTL


def _set_refresh_cookie(response: Response, raw_token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=raw_token,
        httponly=True,
        secure=settings.environment != "dev",  # plain HTTP only tolerated in local dev
        samesite="lax",
        max_age=REFRESH_COOKIE_MAX_AGE,
        path="/api/v1/auth",
    )


@app.get("/healthz")
async def healthz() -> dict:
    return {"status": "ok"}


@app.post("/api/v1/auth/signup", status_code=201)
async def signup_route(body: SignupRequest, db: AsyncSession = Depends(get_db)) -> dict:
    await auth_service.check_login_rate_limit(db, f"ratelimit:signup:{body.phone}")
    user = await auth_service.signup(db, body.name, body.phone, body.password, body.email)
    return {"id": str(user.id), "phone": user.phone}


@app.post("/api/v1/auth/forgot-password")
async def forgot_password_route(body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)) -> dict:
    token = await auth_service.forgot_password(db, body.email)
    return {"message": "If an account exists, a reset token was generated.", "token": token}


@app.post("/api/v1/auth/reset-password")
async def reset_password_route(body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)) -> dict:
    await auth_service.reset_password(db, body.token, body.new_password)
    return {"message": "Password reset successfully."}


@app.post("/api/v1/auth/login", response_model=AccessTokenResponse)
async def login_route(
    body: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> AccessTokenResponse:
    await auth_service.check_login_rate_limit(db, f"ratelimit:login:{body.login_id}")
    _, access_token, raw_refresh = await auth_service.login(db, body.login_id, body.password)
    _set_refresh_cookie(response, raw_refresh)
    return AccessTokenResponse(access_token=access_token)


@app.post("/api/v1/auth/refresh", response_model=AccessTokenResponse)
async def refresh_route(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> AccessTokenResponse:
    raw_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if raw_token is None:
        raise HTTPException(status_code=401, detail="No refresh token presented")

    new_raw_refresh, user = await auth_service.rotate_refresh_token(db, raw_token)
    _set_refresh_cookie(response, new_raw_refresh)
    return AccessTokenResponse(access_token=create_access_token(user.id, user.role))


@app.post("/api/v1/auth/logout", status_code=204)
async def logout_route(
    request: Request, response: Response, db: AsyncSession = Depends(get_db)
) -> None:
    raw_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if raw_token is not None:
        await auth_service.logout(db, raw_token)
    response.delete_cookie(REFRESH_COOKIE_NAME, path="/api/v1/auth")


from app.modules.core.idempotency import idempotency
from app.db import get_idem_db

@app.post("/api/v1/bookings", response_model=BookingCreateResponse, status_code=201)
async def create_booking_route(
    request: Request,
    body: BookingCreateRequest,
    db: AsyncSession = Depends(get_db),
    idem_db: AsyncSession = Depends(get_idem_db),
    current_user: CurrentUser | None = Depends(get_current_user_optional),
) -> BookingCreateResponse:
    """07_design.md A 3.3/A 5.1. A valid Authorization header makes this an
    account booking — customer_id comes from the verified token, never
    from the request body (so a customer can't pass someone else's
    customer_id). No header, or an invalid/expired one, falls through to
    guest checkout — booking-as-guest must never require login per
    01_PRD.md A 5, so an invalid token degrades to anonymous rather than
    401ing a route that's supposed to be open to guests."""
    idem_key = request.headers.get("Idempotency-Key")
    async with idempotency(idem_db, idem_key, current_user.id if current_user else None, "create_booking", body) as idem:
        if idem.is_replaying:
            if idem.response_code and idem.response_code >= 400:
                raise HTTPException(status_code=idem.response_code, detail=idem.response_body.get("detail", "Error"))
            return BookingCreateResponse(**idem.response_body)

        try:
            booking, raw_token = await booking_service.create_booking(
                session=db,
                inventory_unit_id=body.inventory_unit_id,
                customer_id=current_user.id if current_user else None,
                guest_name=body.guest_name,
                guest_email=body.guest_email,
                guest_phone=body.guest_phone,
            )
        except HTTPException as e:
            await idem.complete({"detail": e.detail}, e.status_code)
            raise

        from app.modules.core.config_service import get_system_config
        config = await get_system_config(db)

        resp = BookingCreateResponse(
            booking_id=booking.id,
            amount=booking.amount,
            expires_in=config.booking_hold_duration_minutes * 60,
            manage_token=raw_token,
        )
        await idem.complete(resp, 201)
        return resp


@app.get("/api/v1/bookings/manage/{token}", response_model=BookingDetail)
async def get_booking_by_manage_token_route(
    token: str, db: AsyncSession = Depends(get_db)
) -> BookingDetail:
    """Registered before /bookings/{booking_id} below — not load-bearing
    given booking_id is typed uuid.UUID (a non-UUID path segment like a
    token never matches that route regardless of order), but it's the more
    readable ordering: more specific path before more general one."""
    booking = await booking_service.get_booking_by_manage_token(db, token)
    return BookingDetail.model_validate(booking)


@app.get("/api/v1/bookings", response_model=list[BookingDetail])
async def list_my_bookings_route(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[BookingDetail]:
    bookings = await booking_service.list_bookings_for_customer(db, current_user.id)
    return [BookingDetail.model_validate(b) for b in bookings]


@app.get("/api/v1/bookings/{booking_id}", response_model=BookingDetail)
async def get_booking_route(
    booking_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> BookingDetail:
    booking = await booking_service.get_booking_for_viewer(
        session=db, booking_id=booking_id, viewer_id=current_user.id, viewer_role=current_user.role
    )
    return BookingDetail.model_validate(booking)


@app.post("/api/v1/bookings/{booking_id}/flag")
async def flag_booking_route(
    booking_id: uuid.UUID,
    body: BookingFlagRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("owner", "admin")),
) -> dict:
    """07_design.md §5.5. This is flag_booking()'s first real caller —
    Phase B wrote the function and its owner-authorization check
    (booking.venue.owner_id != owner_id) with no way to actually get an
    authenticated owner_id from an HTTP request. Now there is one."""
    booking = await booking_service.flag_booking(
        session=db,
        booking_id=booking_id,
        owner_id=current_user.id,
        reason=body.reason,
    )
    return {"id": str(booking.id), "status": booking.status}


@app.post("/api/v1/bookings/{booking_id}/cancel", response_model=BookingCancelResponse)
async def cancel_booking_route(
    booking_id: uuid.UUID,
    body: BookingCancelRequest = BookingCancelRequest(),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("customer")),
) -> BookingCancelResponse:
    """Customer-initiated cancellation of a *confirmed* booking — the gap
    flagged as missing since PHASE_C5_SUMMARY.md. 07_design.md §3.3 specs
    this as DELETE; implemented as POST .../cancel instead, matching every
    other state-changing booking route in this file (flag, confirm-payment,
    cancel-pending are all POST) — see cancel_booking_as_customer's
    docstring for the full reasoning.

    require_role("customer") rather than get_current_user: an owner or
    admin token gets a flat 403 from the role gate itself, before this
    route body even runs — matching flag_booking/confirm-payment/
    cancel-pending's existing pattern for state-changing actions. A
    *different* customer's token passes this gate fine and then gets 404
    from the service layer's ownership check (see
    cancel_booking_as_customer's docstring for why that one is 404, not
    403 — a different property from this role gate, tested separately in
    test_booking_cancellation.py).
    """
    booking, refund_amount, refund_tier = await booking_service.cancel_booking_as_customer(
        session=db, booking_id=booking_id, customer_id=current_user.id, reason=body.reason,
    )
    return BookingCancelResponse(
        id=booking.id,
        status=booking.status,
        cancellation_reason=booking.cancellation_reason,
        refund_amount=refund_amount,
        refund_tier=refund_tier,
    )


@app.post("/api/v1/bookings/manage/{token}/cancel", response_model=BookingCancelResponse)
async def cancel_booking_by_manage_token_route(
    token: str,
    body: BookingCancelRequest = BookingCancelRequest(),
    db: AsyncSession = Depends(get_db),
) -> BookingCancelResponse:
    """Guest half of the same operation as cancel_booking_route above — no
    auth dependency at all, same as get_booking_by_manage_token_route: the
    token in the path is this guest's entire authentication."""
    booking, refund_amount, refund_tier = await booking_service.cancel_booking_by_manage_token(
        session=db, raw_token=token, reason=body.reason,
    )
    return BookingCancelResponse(
        id=booking.id,
        status=booking.status,
        cancellation_reason=booking.cancellation_reason,
        refund_amount=refund_amount,
        refund_tier=refund_tier,
    )


@app.get("/api/v1/admin/bookings", response_model=list[AdminBookingView])
async def list_bookings_for_admin_route(
    status: str | None = Query(default=None),
    venue_id: uuid.UUID | None = Query(default=None),
    date_from: date_ | None = Query(default=None),
    date_to: date_ | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin")),
) -> list[AdminBookingView]:
    """A real gap found completing the Admin dashboard: confirm-payment/
    cancel-pending just below already existed and were already tested by
    ID, but GET /owner/bookings only ever returns bookings for the
    caller's own venues — an admin has none, so there was no discovery
    path at all. Same no-customer-identity guarantee as GET /owner/
    bookings (see list_bookings_for_admin's own docstring)."""
    bookings = await booking_service.list_bookings_for_admin(
        db, status=status, venue_id=venue_id, date_from=date_from, date_to=date_to, limit=limit, offset=offset
    )
    return [AdminBookingView.from_booking(b) for b in bookings]


@app.get("/api/v1/admin/bookings/{booking_id}", response_model=AdminBookingView)
async def get_booking_for_admin_route(
    booking_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin")),
) -> AdminBookingView:
    booking = await booking_service.get_booking_for_admin(db, booking_id)
    return AdminBookingView.from_booking(booking)



@app.post("/api/v1/admin/bookings/{booking_id}/confirm-payment", response_model=BookingDetail)
async def admin_confirm_payment_route(
    booking_id: uuid.UUID,
    body: AdminConfirmPaymentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin")),
) -> BookingDetail:
    """Decision Point C-5/C-6 (see PHASE_C6_SUMMARY.md): the client
    confirms payment offline; this route is admin marking that in the
    system. This is the real trigger for 'instant confirmation' today —
    not a Razorpay webhook, which is explicitly out of scope for now."""
    booking = await booking_service.confirm_booking_by_admin(
        session=db,
        booking_id=booking_id,
        admin_id=current_user.id,
        amount=body.amount,
        method=body.method,
        reference=body.reference,
        notes=body.notes,
    )
    return BookingDetail.model_validate(booking)


@app.post("/api/v1/admin/bookings/{booking_id}/cancel-pending", response_model=BookingDetail)
async def admin_cancel_pending_booking_route(
    booking_id: uuid.UUID,
    body: AdminCancelPendingBookingRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin")),
) -> BookingDetail:
    """Releases a pending_payment slot immediately rather than waiting out
    HOLD_DURATION — see cancel_pending_booking's docstring in the service
    layer for why this matters more now that the hold is long/deal-
    dependent instead of a short checkout timer."""
    booking = await booking_service.cancel_pending_booking(
        session=db, booking_id=booking_id, actor_id=current_user.id, reason=body.reason
    )
    return BookingDetail.model_validate(booking)


@app.post("/api/v1/admin/bookings/sweep-expired-holds")
async def sweep_expired_holds_route(
    db: AsyncSession = Depends(get_db), current_user: CurrentUser = Depends(require_role("admin"))
) -> dict[str, int]:
    """The manual/on-demand trigger for the automation that runs on a
    timer in the background (app/main.py's lifespan) — same
    sweep_expired_holds function either way, see its own docstring. Lets
    an admin release stale holds immediately rather than waiting for the
    next scheduled pass, and gives the Admin dashboard something to call
    for an immediate "sweep now" action."""
    swept = await booking_service.sweep_expired_holds(db)
    return {"swept": len(swept)}


@app.get("/api/v1/users/me", response_model=UserMeResponse)
async def get_me_route(user=Depends(get_current_user_row)) -> UserMeResponse:
    """07_design.md §3.1: 'Returns current user profile + role +
    verification status.' The frontend's owner-onboarding screens need this
    to know which of the pending/verified/rejected states to show."""
    return UserMeResponse(
        id=str(user.id), name=user.name, email=user.email, phone=user.phone, role=user.role, is_verified=user.is_verified
    )


@app.get("/api/v1/notifications", response_model=list[NotificationResponse])
async def list_notifications_route(
    unread_only: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[NotificationResponse]:
    """Any authenticated user's own notifications — owner, admin, or
    customer alike. Always scoped to the caller; there's no "list someone
    else's notifications" concept anywhere, admin included."""
    notifications = await notifications_service.list_notifications_for_user(
        db, current_user.id, unread_only=unread_only, limit=limit, offset=offset
    )
    return [NotificationResponse.model_validate(n) for n in notifications]


@app.get("/api/v1/notifications/unread-count", response_model=UnreadCountResponse)
async def get_unread_notification_count_route(
    db: AsyncSession = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)
) -> UnreadCountResponse:
    count = await notifications_service.count_unread_notifications(db, current_user.id)
    return UnreadCountResponse(unread_count=count)


@app.post("/api/v1/notifications/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read_route(
    notification_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> NotificationResponse:
    notification = await notifications_service.mark_notification_read(db, current_user, notification_id)
    return NotificationResponse.model_validate(notification)


@app.post("/api/v1/notifications/read-all")
async def mark_all_notifications_read_route(
    db: AsyncSession = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)
) -> dict[str, int]:
    count = await notifications_service.mark_all_notifications_read(db, current_user.id)
    return {"marked_read": count}


@app.delete("/api/v1/notifications/{notification_id}")
async def delete_notification_route(
    notification_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    await notifications_service.delete_notification(db, current_user, notification_id)
    return Response(status_code=204)


@app.delete("/api/v1/notifications")
async def delete_all_notifications_route(
    db: AsyncSession = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)
):
    await notifications_service.delete_all_notifications(db, current_user.id)
    return Response(status_code=204)


@app.post("/api/v1/owner/verification", response_model=OwnerVerificationResponse, status_code=201)
async def submit_owner_verification_route(
    document: UploadFile = File(...),
    business_name: str | None = Form(default=None),
    identification_type: str | None = Form(default=None),
    identification_number: str | None = Form(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
    storage=Depends(get_file_storage),
) -> OwnerVerificationResponse:
    """05_App_Flow.md §3. Any logged-in user can submit one of these — it's
    what turns a customer account into a pending owner application.
    Approval (admin-only, below) is the only thing that actually changes
    the role."""
    content = await document.read()
    try:
        document_url = await storage.save(
            content, document.content_type, key_prefix=f"owner-verifications/{current_user.id}"
        )
    except UnsupportedFileError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    verification = await onboarding_service.submit_verification(
        session=db,
        user_id=current_user.id,
        document_url=document_url,
        business_name=business_name,
        identification_type=identification_type,
        identification_number=identification_number,
    )
    return OwnerVerificationResponse.model_validate(verification)


@app.get("/api/v1/owner/verification", response_model=OwnerVerificationResponse | None)
async def get_my_verification_route(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> OwnerVerificationResponse | None:
    """A real gap found while wiring the owner dashboard: submit_owner_
    verification_route (POST, above) returns the created row exactly
    once, at submission time. Nothing let a user check their own
    application's status afterward — on a reload, or in a new session
    entirely, there was no way to tell 'pending' from 'never applied'
    from 'rejected, resubmit' without re-deriving it from memory of the
    one response the POST returned. get_current_user, not require_role —
    a customer who hasn't been approved yet is exactly who needs this
    most, and they are by definition not yet an 'owner'."""
    verification = await onboarding_service.get_latest_verification_for_user(db, current_user.id)
    return OwnerVerificationResponse.model_validate(verification) if verification else None


@app.post(
    "/api/v1/admin/owner-verifications/{verification_id}/approve",
    response_model=OwnerVerificationResponse,
)
async def approve_owner_verification_route(
    verification_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin")),
) -> OwnerVerificationResponse:
    verification = await onboarding_service.approve_verification(
        session=db, verification_id=verification_id, admin_id=current_user.id
    )
    return OwnerVerificationResponse.model_validate(verification)


@app.post(
    "/api/v1/admin/owner-verifications/{verification_id}/reject",
    response_model=OwnerVerificationResponse,
)
async def reject_owner_verification_route(
    verification_id: uuid.UUID,
    body: RejectVerificationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin")),
) -> OwnerVerificationResponse:
    verification = await onboarding_service.reject_verification(
        session=db, verification_id=verification_id, admin_id=current_user.id, reason=body.reason
    )
    return OwnerVerificationResponse.model_validate(verification)


@app.get("/api/v1/admin/owner-verifications", response_model=list[AdminOwnerVerificationView])
async def list_owner_verifications_for_admin_route(
    status: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin")),
) -> list[AdminOwnerVerificationView]:
    """A real gap found wiring the Admin dashboard: GET /owner/verification
    just above is scoped to the caller's own latest submission — there was
    no route returning every applicant's verifications for an admin to
    review. See AdminOwnerVerificationView's own docstring for why this
    response shape includes the applicant's name/email/document_url where
    OwnerVerificationResponse deliberately doesn't."""
    verifications = await onboarding_service.list_verifications_for_admin(
        db, status=status, limit=limit, offset=offset
    )
    return [AdminOwnerVerificationView.from_verification(v) for v in verifications]


@app.post("/api/v1/venues", response_model=VenueResponse, status_code=201)
async def create_venue_route(
    body: VenueCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("owner", "admin")),
) -> VenueResponse:
    """07_design.md §3.2. owner-only (or admin) — RBAC fixes the original
    gap TRD §7 names directly: 'any logged-in user can currently create
    venues.' Always lands in 'pending_review', never live immediately."""
    venue = await catalog_service.create_venue(
        session=db,
        owner_id=current_user.id,
        name=body.name,
        category=body.category,
        address=body.address,
        city=body.city,
        unit_type=body.unit_type,
        base_price=body.base_price,
        description=body.description,
        state=body.state,
        pincode=body.pincode,
        capacity=body.capacity,
        amenity_names=body.amenity_names,
    )
    return VenueResponse.from_venue(venue)


@app.get("/api/v1/venues", response_model=VenueListResponse)
async def list_venues_route(
    city: str | None = Query(default=None),
    category: str | None = Query(default=None),
    available_on: date_ | None = Query(default=None),
    price_max: Decimal | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> VenueListResponse:
    """07_design.md §3.2 search/filter — public, no auth. Only ever returns
    'active' listings (catalog.service.list_venues' own invariant)."""
    venues, total = await catalog_service.list_venues(
        session=db,
        city=city,
        category=category,
        available_on=available_on,
        price_max=price_max,
        limit=limit,
        offset=offset,
    )
    return VenueListResponse(
        data=[VenueResponse.from_venue(v) for v in venues], total=total, limit=limit, offset=offset
    )


@app.get("/api/v1/owner/venues", response_model=list[VenueResponse])
async def list_my_venues_route(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("owner", "admin")),
) -> list[VenueResponse]:
    """A real gap found while wiring the owner dashboard: GET /venues
    (list_venues_route, below) only ever returns 'active' listings — an
    owner has no way to see their own draft/pending_review/suspended
    venues anywhere. Registered before /venues/{venue_id} — not
    load-bearing given venue_id is a typed uuid.UUID path param ('venues'
    would never parse as one), but the more readable ordering, same
    reasoning as get_booking_by_manage_token_route's placement above."""
    venues = await catalog_service.list_venues_for_owner(db, current_user.id)
    return [VenueResponse.from_venue(v) for v in venues]


@app.get("/api/v1/admin/venues", response_model=list[AdminVenueView])
async def list_venues_for_admin_route(
    status: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin")),
) -> list[AdminVenueView]:
    """A real gap found wiring the Admin dashboard: GET /owner/venues just
    above is scoped to the caller's own owner_id, so an admin calling it
    sees only venues they themselves own (normally none) — it does not
    become "every venue" just because the role is 'admin'. This is the
    actual platform-wide list, powering both the approval queue
    (?status=pending_review) and the listings-moderation view (no filter =
    every status, so a suspended venue is still reachable to reactivate).
    Uses AdminVenueView, not VenueResponse — see that schema's own
    docstring for why an admin-facing view includes owner_name/owner_email
    where the public one doesn't."""
    venues = await catalog_service.list_venues_for_admin(db, status=status, limit=limit, offset=offset)
    return [AdminVenueView.from_venue(v) for v in venues]


@app.get("/api/v1/venues/{venue_id}", response_model=VenueResponse)
async def get_venue_route(
    venue_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser | None = Depends(get_current_user_optional),
) -> VenueResponse:
    """The endpoint TRD §3 explicitly calls out as missing from the
    original backend ('GET /venues/{id} is a new endpoint; it does not
    exist in the current backend'). Public for an active listing;
    previewable by its owner/an admin otherwise — see
    catalog.service.get_venue's visibility rule."""
    venue = await catalog_service.get_venue(db, venue_id, current_user)
    return VenueResponse.from_venue(venue)


@app.patch("/api/v1/venues/{venue_id}", response_model=VenueResponse)
async def update_venue_route(
    venue_id: uuid.UUID,
    body: VenueUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("owner", "admin")),
) -> VenueResponse:
    venue = await catalog_service.update_venue(
        session=db,
        venue_id=venue_id,
        viewer=current_user,
        changes=body.model_dump(exclude_unset=True),
    )
    # Re-fetch with images/amenities loaded — update_venue's own query
    # doesn't eager-load them, and VenueResponse.from_venue needs both.
    refreshed = await catalog_service.get_venue(db, venue_id, current_user)
    return VenueResponse.from_venue(refreshed)


@app.post("/api/v1/venues/{venue_id}/images", response_model=VenueResponse, status_code=201)
async def upload_venue_image_route(
    venue_id: uuid.UUID,
    image: UploadFile = File(...),
    is_cover: bool = Form(default=False),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("owner", "admin")),
    storage=Depends(get_file_storage),
) -> VenueResponse:
    content = await image.read()
    await catalog_service.upload_venue_image(
        session=db,
        venue_id=venue_id,
        viewer=current_user,
        content=content,
        content_type=image.content_type,
        storage=storage,
        is_cover=is_cover,
    )
    refreshed = await catalog_service.get_venue(db, venue_id, current_user)
    return VenueResponse.from_venue(refreshed)


@app.post(
    "/api/v1/venues/{venue_id}/inventory-units",
    response_model=list[InventoryUnitResponse],
    status_code=201,
)
async def add_inventory_units_route(
    venue_id: uuid.UUID,
    body: InventoryUnitBatchCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("owner", "admin")),
) -> list[InventoryUnitResponse]:
    units = await catalog_service.add_inventory_units(
        session=db,
        venue_id=venue_id,
        viewer=current_user,
        units=[u.model_dump() for u in body.units],
    )
    return [InventoryUnitResponse.model_validate(u) for u in units]


@app.get("/api/v1/venues/{venue_id}/inventory-units", response_model=list[InventoryUnitResponse])
async def list_inventory_units_route(
    venue_id: uuid.UUID,
    date_from: date_ | None = None,
    date_to: date_ | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser | None = Depends(get_current_user_optional),
) -> list[InventoryUnitResponse]:
    """A real gap found while starting frontend integration — POST (owner
    creates slots) existed with no GET for anyone, including a browsing
    customer, to actually see them. Same public-if-active/owner-admin-
    preview-otherwise visibility rule as GET /venues/{id} — see
    list_inventory_units_for_venue's docstring."""
    units = await catalog_service.list_inventory_units_for_venue(
        db, venue_id, current_user, date_from=date_from, date_to=date_to,
    )
    return [InventoryUnitResponse.model_validate(u) for u in units]

@app.post("/api/v1/venues/{venue_id}/blocks", response_model=BlockResponse, status_code=201)
async def create_venue_block(
    venue_id: uuid.UUID,
    payload: BlockCreateRequest,
    viewer: CurrentUser = Depends(require_role("owner", "admin")),
    db: AsyncSession = Depends(get_db)
):
    block = await catalog_service.create_block(
        session=db,
        venue_id=venue_id,
        viewer=viewer,
        start_time=payload.start_time,
        end_time=payload.end_time,
        reason=payload.reason,
        inventory_unit_id=payload.inventory_unit_id,
    )
    return BlockResponse.model_validate(block)

@app.get("/api/v1/venues/{venue_id}/blocks", response_model=list[BlockResponse])
async def list_venue_blocks(
    venue_id: uuid.UUID,
    viewer: CurrentUser = Depends(require_role("owner", "admin")),
    db: AsyncSession = Depends(get_db)
):
    blocks = await catalog_service.list_blocks(db, venue_id, viewer)
    return [BlockResponse.model_validate(b) for b in blocks]

@app.patch("/api/v1/venues/{venue_id}/blocks/{block_id}", response_model=BlockResponse)
async def update_venue_block(
    venue_id: uuid.UUID,
    block_id: uuid.UUID,
    status: str = Body(..., embed=True),
    viewer: CurrentUser = Depends(require_role("owner", "admin")),
    db: AsyncSession = Depends(get_db)
):
    block = await catalog_service.update_block(db, venue_id, block_id, viewer, status)
    return BlockResponse.model_validate(block)


@app.post("/api/v1/admin/venues/{venue_id}/approve", response_model=VenueResponse)
async def approve_venue_route(
    venue_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin")),
) -> VenueResponse:
    await catalog_service.approve_venue(db, venue_id, current_user.id)
    refreshed = await catalog_service.get_venue(db, venue_id, current_user)
    return VenueResponse.from_venue(refreshed)


@app.post("/api/v1/admin/venues/{venue_id}/reject", response_model=VenueResponse)
async def reject_venue_route(
    venue_id: uuid.UUID,
    body: VenueRejectRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin")),
) -> VenueResponse:
    await catalog_service.reject_venue(db, venue_id, current_user.id, body.reason)
    refreshed = await catalog_service.get_venue(db, venue_id, current_user)
    return VenueResponse.from_venue(refreshed)


@app.get("/api/v1/admin/payouts", response_model=list[AdminPayoutView])
async def list_payouts_for_admin_route(
    status: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin")),
) -> list[AdminPayoutView]:
    """A real gap found completing the Admin dashboard: mark-paid just
    below already existed and was already tested by ID, but GET /owner/
    payouts only ever returns the caller's own payouts — an admin has
    none. Without this there was also no way to see which owners are
    actually due a payout run in the first place. Uses AdminPayoutView,
    not PayoutDetail — see that schema's own docstring for why."""
    payouts = await payout_service.list_payouts_for_admin(db, status=status, limit=limit, offset=offset)
    return [AdminPayoutView.from_payout(p) for p in payouts]


@app.post("/api/v1/admin/payouts/run", response_model=PayoutDetail)
async def run_payout_route(
    body: PayoutRunRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin")),
) -> PayoutDetail:
    """The owner payout ledger — HANDOFF.md §7's #1 remaining item after
    PHASE_C7_SUMMARY.md. See run_payout()'s docstring for Decision Point
    C-11's full reasoning on eligibility and what "gross" means here."""
    payout = await payout_service.run_payout(
        session=db, admin_id=current_user.id, owner_id=body.owner_id,
        period_start=body.period_start, period_end=body.period_end,
    )
    return PayoutDetail.model_validate(payout)


@app.post("/api/v1/admin/payouts/{payout_id}/mark-paid", response_model=PayoutDetail)
async def mark_payout_paid_route(
    payout_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin")),
) -> PayoutDetail:
    payout = await payout_service.mark_payout_paid(session=db, payout_id=payout_id, admin_id=current_user.id)
    return PayoutDetail.model_validate(payout)


@app.get("/api/v1/owner/payouts", response_model=list[PayoutDetail])
async def list_my_payouts_route(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("owner")),
) -> list[PayoutDetail]:
    payouts = await payout_service.list_payouts_for_owner(db, current_user.id)
    return [PayoutDetail.model_validate(p) for p in payouts]


@app.get("/api/v1/owner/bookings", response_model=list[BookingDetail])
async def list_owner_bookings_route(
    venue_id: uuid.UUID | None = None,
    status: str | None = None,
    date_from: date_ | None = None,
    date_to: date_ | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("owner", "admin")),
) -> list[BookingDetail]:
    """The gap get_booking_for_viewer's own docstring names directly: 'a
    calendar/dashboard view across all of one venue's bookings... the
    natural next gap.' date_from/date_to filter on slot date, matching
    /admin/audit-log's date_from/date_to just below (an owner's/admin's
    natural unit is a plain date, not a UTC instant) — but unlike that
    route, no UTC-datetime conversion is needed here: InventoryUnit.date
    is already a plain DATE column (06_Backend_Schema.md §3), compared
    directly, not combined with a time-of-day boundary."""
    bookings = await booking_service.list_bookings_for_owner(
        db, current_user.id, venue_id=venue_id, status=status, date_from=date_from, date_to=date_to,
    )
    return [BookingDetail.model_validate(b) for b in bookings]


@app.get("/api/v1/admin/audit-log", response_model=list[AuditLogEntry])
async def get_audit_log_route(
    actor_id: uuid.UUID | None = None,
    entity_type: str | None = None,
    entity_id: uuid.UUID | None = None,
    date_from: date_ | None = None,
    date_to: date_ | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin")),
) -> list[AuditLogEntry]:
    """07_design.md §4: "Filterable by actor/entity/date." audit_logs has
    been write-only since PHASE_C3_SUMMARY.md built it — this is its first
    real read path. date_from/date_to are plain dates (an admin's natural
    unit); converted to UTC datetime bounds here rather than in the
    service layer, which works in real datetimes throughout."""
    datetime_from = datetime.combine(date_from, time.min, tzinfo=timezone.utc) if date_from else None
    datetime_to = datetime.combine(date_to, time.max, tzinfo=timezone.utc) if date_to else None
    entries = await admin_service.get_audit_log(
        db, actor_id=actor_id, entity_type=entity_type, entity_id=entity_id,
        date_from=datetime_from, date_to=datetime_to, limit=limit, offset=offset,
    )
    return [AuditLogEntry.model_validate(e) for e in entries]


@app.get("/api/v1/admin/overview", response_model=PlatformOverview)
async def get_platform_overview_route(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin")),
) -> PlatformOverview:
    """01_PRD.md §5: "View platform-wide bookings and GMV." See
    get_platform_overview()'s docstring for Decision Point C-13 — GMV here
    is a deliberately different sense of "gross" than the payout ledger's
    gross_amount."""
    overview = await admin_service.get_platform_overview(db)
    return PlatformOverview(**overview)


@app.post("/api/v1/admin/venues/{venue_id}/suspend", response_model=VenueResponse)
async def suspend_venue_route(
    venue_id: uuid.UUID,
    body: SuspendRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin")),
) -> VenueResponse:
    await admin_service.suspend_venue(db, current_user.id, venue_id, body.reason)
    refreshed = await catalog_service.get_venue(db, venue_id, current_user)
    return VenueResponse.from_venue(refreshed)


@app.post("/api/v1/admin/venues/{venue_id}/reactivate", response_model=VenueResponse)
async def reactivate_venue_route(
    venue_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin")),
) -> VenueResponse:
    await admin_service.reactivate_venue(db, current_user.id, venue_id)
    refreshed = await catalog_service.get_venue(db, venue_id, current_user)
    return VenueResponse.from_venue(refreshed)


@app.get("/api/v1/admin/users", response_model=list[AdminUserView])
async def list_users_for_admin_route(
    role: str | None = Query(default=None),
    suspended: bool | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin")),
) -> list[AdminUserView]:
    """A real gap found wiring the Admin dashboard: suspend_user/
    reactivate_user just below already existed and were already tested by
    ID, but nothing let an admin discover which user IDs exist to act on —
    there was no user-listing route anywhere in this codebase."""
    users = await admin_service.list_users_for_admin(
        db, role=role, suspended_only=suspended, limit=limit, offset=offset
    )
    return [AdminUserView.model_validate(u) for u in users]


@app.post("/api/v1/admin/users/{user_id}/suspend", response_model=AdminUserView)
async def suspend_user_route(
    user_id: uuid.UUID,
    body: SuspendRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin")),
) -> AdminUserView:
    user = await admin_service.suspend_user(db, current_user.id, user_id, body.reason)
    return AdminUserView.model_validate(user)


@app.post("/api/v1/admin/users/{user_id}/reactivate", response_model=AdminUserView)
async def reactivate_user_route(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin")),
) -> AdminUserView:
    user = await admin_service.reactivate_user(db, current_user.id, user_id)
    return AdminUserView.model_validate(user)

@app.get("/api/v1/admin/health", response_model=AdminHealthResponse)
async def get_admin_health_route(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin")),
) -> AdminHealthResponse:
    health = await admin_service.get_admin_health(db)
    return AdminHealthResponse(**health)


# ---------------------------------------------------------------------------
# Reviews — POST (create, any auth'd user), GET (public), DELETE (admin only)
# ---------------------------------------------------------------------------

@app.post("/api/v1/venues/{venue_id}/reviews", response_model=ReviewResponse, status_code=201)
async def create_review_route(
    venue_id: uuid.UUID,
    body: ReviewCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> ReviewResponse:
    """Any authenticated user (customer, owner, or admin) may leave a review.
    avg_rating on the venue is recalculated via AVG after insert so it stays
    in sync without a DB trigger."""
    # Verify venue exists and is active (anyone browsing can only see active venues)
    venue_result = await db.execute(select(Venue).where(Venue.id == venue_id, Venue.deleted_at.is_(None)))
    venue = venue_result.scalar_one_or_none()
    if venue is None:
        raise HTTPException(status_code=404, detail="Venue not found.")

    review = Review(
        venue_id=venue_id,
        user_id=current_user.id,
        rating=body.rating,
        content=body.content,
    )
    db.add(review)
    await db.flush()  # get review.id before the avg query

    # Recalculate avg_rating on venue
    avg_result = await db.execute(
        select(func.avg(Review.rating)).where(Review.venue_id == venue_id)
    )
    new_avg = avg_result.scalar() or Decimal("0")
    venue.avg_rating = round(Decimal(str(new_avg)), 2)

    await db.commit()
    await db.refresh(review)

    # eager-load user so we can fill user_name
    result = await db.execute(
        select(Review).where(Review.id == review.id).options(selectinload(Review.user))
    )
    review = result.scalar_one()
    return ReviewResponse(
        id=review.id,
        venue_id=review.venue_id,
        user_id=review.user_id,
        user_name=review.user.name,
        rating=review.rating,
        content=review.content,
        created_at=review.created_at,
    )


@app.get("/api/v1/venues/{venue_id}/reviews", response_model=list[ReviewResponse])
async def list_reviews_route(
    venue_id: uuid.UUID,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> list[ReviewResponse]:
    """Public endpoint — no auth required."""
    result = await db.execute(
        select(Review)
        .where(Review.venue_id == venue_id)
        .options(selectinload(Review.user))
        .order_by(Review.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    reviews = result.scalars().all()
    return [
        ReviewResponse(
            id=r.id,
            venue_id=r.venue_id,
            user_id=r.user_id,
            user_name=r.user.name,
            rating=r.rating,
            content=r.content,
            created_at=r.created_at,
        )
        for r in reviews
    ]


@app.delete("/api/v1/admin/reviews/{review_id}", status_code=204)
async def admin_delete_review_route(
    review_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin")),
) -> None:
    """Admin-only review moderation endpoint. Recalculates venue avg_rating
    after deletion so the rating stays accurate."""
    result = await db.execute(
        select(Review).where(Review.id == review_id).options(selectinload(Review.venue))
    )
    review = result.scalar_one_or_none()
    if review is None:
        raise HTTPException(status_code=404, detail="Review not found.")

    venue_id = review.venue_id
    await db.execute(delete(Review).where(Review.id == review_id))

    # Recalculate avg_rating after deletion
    avg_result = await db.execute(
        select(func.avg(Review.rating)).where(Review.venue_id == venue_id)
    )
    new_avg = avg_result.scalar() or Decimal("0")
    venue_result = await db.execute(select(Venue).where(Venue.id == venue_id))
    venue = venue_result.scalar_one_or_none()
    if venue:
        venue.avg_rating = round(Decimal(str(new_avg)), 2)

    await db.commit()


@app.get("/api/v1/admin/reviews", response_model=list[AdminReviewView])
async def list_all_reviews_admin_route(
    venue_id: uuid.UUID | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin")),
) -> list[AdminReviewView]:
    """Admin-only endpoint to fetch all reviews globally, optionally filtered by venue,
    for the admin moderation panel. Includes the venue name to give the admin context."""
    stmt = select(Review).options(selectinload(Review.user), selectinload(Review.venue))
    if venue_id:
        stmt = stmt.where(Review.venue_id == venue_id)
    stmt = stmt.order_by(Review.created_at.desc()).limit(limit).offset(offset)
    
    result = await db.execute(stmt)
    reviews = result.scalars().all()
    return [AdminReviewView.from_review(r) for r in reviews]

from pydantic import BaseModel
import asyncio
import logging
import uuid
from contextlib import asynccontextmanager
from datetime import date as date_
from datetime import datetime, time, timezone
from decimal import Decimal

from fastapi import Body, Depends, FastAPI, File, Form, HTTPException, Query, Request, Response, UploadFile
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.db import SessionLocal, get_db
from app.models.core import Notification, Review, Venue, User, PasswordResetRequest, OwnerVerification
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

from app.modules.admin import passwords_service as admin_passwords_service
from app.schemas.admin import (
    AdminPasswordResetRequest,
    AdminPasswordResetResponse,
    AdminPasswordResetRequestView,
    CancelPasswordResetRequest,
)
from app.schemas.admin import (
    AdminOwnerVerificationView,
    AdminPayoutView,
    AdminUserView,
    AdminVenueView,
    AdminBookingView,
    AdminReviewView,
    AuditLogEntry,
    PlatformOverview,
    DashboardOverview,
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
    BookingActionRequestCreate,
    BookingActionRequestResponse,
    BookingRescheduleRequest,
)
from app.schemas.catalog import (
    InventoryUnitBatchCreateRequest,
    CategoryResponse, VenueTypeResponse, UseCaseResponse, InventoryUnitResponse,
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
from app.schemas.owner_verification import ApproveOwnerVerificationRequest, OwnerVerificationResponse, RejectVerificationRequest
from app.schemas.payout import PayoutDetail, PayoutRunRequest

from app.schemas.homepage import (
    HomepagePlacementCreate,
    HomepagePlacementUpdate,
    HomepagePlacementResponse,
    HomepageResponse,
    SectionReorderRequest,
)
from app.modules.homepage import service as homepage_service
from app.schemas.catalog import VenueMediaResponse

from app.storage_client import get_file_storage, get_private_file_storage

logger = logging.getLogger("groundkart.hold_sweep")
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
    import os
    is_test = os.environ.get("TESTING", "0") == "1"
    
    sweep_task = None
    outbox_task = None
    
    if not is_test:
        sweep_task = asyncio.create_task(_hold_sweep_loop())
        outbox_task = asyncio.create_task(_outbox_sweep_loop())
        
    try:
        yield
    finally:
        if sweep_task:
            sweep_task.cancel()
            try:
                await sweep_task
            except asyncio.CancelledError:
                pass
                
        if outbox_task:
            outbox_task.cancel()
            try:
                await outbox_task
            except asyncio.CancelledError:
                pass


app = FastAPI(title="GroundKart API", version="0.1.0", lifespan=lifespan)

from app.modules.core.logging import setup_logging
setup_logging()

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    from app.modules.core.logging import request_id_ctx
    req_id = request_id_ctx.get() or request.headers.get("X-Request-ID") or "unknown"
    logging.getLogger("groundkart.errors").exception(
        f"Unhandled server error on {request.method} {request.url.path} [req_id={req_id}]: {exc}"
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "request_id": req_id},
        headers={"X-Request-ID": req_id} if req_id != "unknown" else {},
    )

@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    from app.modules.core.logging import request_id_ctx
    req_id = request.headers.get("X-Request-ID")
    if not req_id:
        req_id = str(uuid.uuid4())
    token = request_id_ctx.set(req_id)
    try:
        response = await call_next(request)
        response.headers["X-Request-ID"] = req_id
        return response
    finally:
        request_id_ctx.reset(token)

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
cors_regex = settings.cors_origin_regex
if not cors_regex and settings.environment.lower() not in ("prod", "production"):
    cors_regex = r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_allowed_origins.split(",") if o.strip()],
    allow_origin_regex=cors_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# A real, necessary fix found while wiring the owner dashboard's image
# upload to real data (see app/modules/storage/base.py's LocalFileStorage
# for the other half of this): without this mount, the URL LocalFileStorage
# returns points at nothing an HTTP client can reach, dev/test only, same
# scope as LocalFileStorage itself — a real S3/R2 deployment serves images
# from the provider directly and would not need this mount at all.
import os as _os

if settings.storage_backend == "local":
    _os.makedirs(settings.uploads_dir, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=settings.uploads_dir), name="uploads")

REFRESH_COOKIE_NAME = "refresh_token"
REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30  # 30 days, matches REFRESH_TOKEN_TTL


def _set_refresh_cookie(response: Response, raw_token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=raw_token,
        httponly=True,
        secure=settings.environment.lower() in ("prod", "production"),  # plain HTTP only tolerated in local dev
        samesite="lax",
        max_age=REFRESH_COOKIE_MAX_AGE,
        path="/api/v1/auth",
    )


@app.get("/healthz")
@app.get("/api/v1/health")
async def healthz() -> dict:
    return {"status": "ok"}


@app.get("/robots.txt", response_class=Response)
async def robots_txt_route() -> Response:
    base_url = settings.public_app_url.rstrip("/")
    content = f"""# GroundKart robots.txt — {base_url}/robots.txt
User-agent: *
Allow: /

# Allow public API endpoints needed for search engine rendering & catalog discovery
Allow: /api/v1/venues
Allow: /api/v1/homepage
Allow: /api/v1/categories
Allow: /api/v1/venue-types
Allow: /api/v1/use-cases

# Disallow private administrative, owner, transactional, and authentication endpoints
Disallow: /admin
Disallow: /owner
Disallow: /checkout
Disallow: /my-bookings
Disallow: /support
Disallow: /reset-password
Disallow: /api/v1/admin/
Disallow: /api/v1/owner/
Disallow: /api/v1/auth/
Disallow: /api/v1/bookings/manage/

# Canonical XML Sitemap
Sitemap: {base_url}/sitemap.xml
"""
    return Response(content=content, media_type="text/plain")


@app.get("/sitemap.xml", response_class=Response)
async def dynamic_sitemap_xml_route(db: AsyncSession = Depends(get_db)) -> Response:
    base_url = settings.public_app_url.rstrip("/")
    # Query all active, non-deleted venues from authoritative PostgreSQL storage
    stmt = (
        select(Venue.slug, Venue.updated_at)
        .where(Venue.status == "active", Venue.deleted_at.is_(None))
        .order_by(Venue.updated_at.desc())
    )
    result = await db.execute(stmt)
    rows = result.all()

    # Determine latest modification date
    latest_venue_dt = rows[0][1] if rows and rows[0][1] else datetime.now(timezone.utc)
    latest_date_str = latest_venue_dt.strftime("%Y-%m-%d")

    xml_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        '  <!-- Homepage -->',
        '  <url>',
        f'    <loc>{base_url}/</loc>',
        f'    <lastmod>{latest_date_str}</lastmod>',
        '    <changefreq>daily</changefreq>',
        '    <priority>1.0</priority>',
        '  </url>',
        '  <!-- Search & Catalog Hub -->',
        '  <url>',
        f'    <loc>{base_url}/search</loc>',
        f'    <lastmod>{latest_date_str}</lastmod>',
        '    <changefreq>daily</changefreq>',
        '    <priority>0.8</priority>',
        '  </url>',
        '  <!-- Categories -->',
        '  <url>',
        f'    <loc>{base_url}/categories/sports</loc>',
        f'    <lastmod>{latest_date_str}</lastmod>',
        '    <changefreq>daily</changefreq>',
        '    <priority>0.8</priority>',
        '  </url>',
        '  <url>',
        f'    <loc>{base_url}/categories/banquet-halls</loc>',
        f'    <lastmod>{latest_date_str}</lastmod>',
        '    <changefreq>daily</changefreq>',
        '    <priority>0.8</priority>',
        '  </url>',
        '  <url>',
        f'    <loc>{base_url}/categories/farmhouses</loc>',
        f'    <lastmod>{latest_date_str}</lastmod>',
        '    <changefreq>daily</changefreq>',
        '    <priority>0.8</priority>',
        '  </url>',
        '  <url>',
        f'    <loc>{base_url}/categories/corporate</loc>',
        f'    <lastmod>{latest_date_str}</lastmod>',
        '    <changefreq>daily</changefreq>',
        '    <priority>0.8</priority>',
        '  </url>',
        '  <url>',
        f'    <loc>{base_url}/categories/community-halls</loc>',
        f'    <lastmod>{latest_date_str}</lastmod>',
        '    <changefreq>weekly</changefreq>',
        '    <priority>0.7</priority>',
        '  </url>',
        '  <!-- Informational Pages -->',
        '  <url>',
        f'    <loc>{base_url}/about</loc>',
        '    <lastmod>2026-10-15</lastmod>',
        '    <changefreq>monthly</changefreq>',
        '    <priority>0.5</priority>',
        '  </url>',
        '  <url>',
        f'    <loc>{base_url}/contact</loc>',
        '    <lastmod>2026-10-15</lastmod>',
        '    <changefreq>monthly</changefreq>',
        '    <priority>0.5</priority>',
        '  </url>',
        '  <url>',
        f'    <loc>{base_url}/terms</loc>',
        '    <lastmod>2026-10-15</lastmod>',
        '    <changefreq>monthly</changefreq>',
        '    <priority>0.3</priority>',
        '  </url>',
        '  <url>',
        f'    <loc>{base_url}/privacy</loc>',
        '    <lastmod>2026-10-15</lastmod>',
        '    <changefreq>monthly</changefreq>',
        '    <priority>0.3</priority>',
        '  </url>',
        '  <!-- Active Published Venues from Database -->',
    ]

    for slug, updated_at in rows:
        venue_date = updated_at.strftime("%Y-%m-%d") if updated_at else latest_date_str
        xml_lines.extend([
            '  <url>',
            f'    <loc>{base_url}/venues/{slug}</loc>',
            f'    <lastmod>{venue_date}</lastmod>',
            '    <changefreq>weekly</changefreq>',
            '    <priority>0.9</priority>',
            '  </url>',
        ])

    xml_lines.append('</urlset>')
    xml_content = "\n".join(xml_lines)
    return Response(content=xml_content, media_type="application/xml")



@app.post("/api/v1/auth/signup", status_code=201)
@app.post("/auth/signup", status_code=201, include_in_schema=True, tags=["Auth"], deprecated=True)
async def signup_route(body: SignupRequest, db: AsyncSession = Depends(get_db)) -> dict:
    await auth_service.check_login_rate_limit(db, f"ratelimit:signup:{body.phone}")
    user = await auth_service.signup(db, body.name, body.phone, body.password, body.email)
    return {"id": str(user.id), "phone": user.phone}


@app.post("/api/v1/auth/forgot-password")
@app.post("/auth/forgot-password", include_in_schema=True, tags=["Auth"], deprecated=True)
async def forgot_password_route(body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)) -> dict:
    await auth_service.check_login_rate_limit(db, f"ratelimit:forgot:{body.login_id}")
    await auth_service.forgot_password(db, body.login_id)
    return {"message": "If an account exists, our support team will contact you to complete the reset."}


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
    idem_db: AsyncSession | None = Depends(get_idem_db),
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


@app.post("/api/v1/bookings/{booking_id}/cancellation-requests", response_model=BookingActionRequestResponse, status_code=201)
async def request_booking_cancellation_route(
    booking_id: uuid.UUID,
    body: BookingActionRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("customer")),
) -> BookingActionRequestResponse:
    req = await booking_service.request_booking_action(
        session=db,
        booking_id=booking_id,
        actor_id=current_user.id,
        actor_type="customer",
        action_type="cancel",
        reason_code=body.reason_code,
        notes=body.notes,
        metadata_json=body.metadata_json,
    )
    return BookingActionRequestResponse.model_validate(req)


@app.post("/api/v1/bookings/{booking_id}/reschedule-requests", response_model=BookingActionRequestResponse, status_code=201)
async def request_booking_reschedule_route(
    booking_id: uuid.UUID,
    body: BookingRescheduleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("customer")),
) -> BookingActionRequestResponse:
    req = await booking_service.request_booking_action(
        session=db,
        booking_id=booking_id,
        actor_id=current_user.id,
        actor_type="customer",
        action_type="reschedule",
        reason_code=body.reason_code,
        notes=body.notes,
        metadata_json={"new_inventory_unit_id": str(body.new_inventory_unit_id)},
    )
    return BookingActionRequestResponse.model_validate(req)


@app.post("/api/v1/bookings/manage/{token}/cancellation-requests", response_model=BookingActionRequestResponse, status_code=201)
async def request_booking_cancellation_by_manage_token_route(
    token: str,
    body: BookingActionRequestCreate,
    db: AsyncSession = Depends(get_db),
) -> BookingActionRequestResponse:
    from app.modules.booking.service import hash_manage_token
    token_hash = hash_manage_token(token)
    result = await db.execute(select(Booking).where(Booking.manage_token_hash == token_hash))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    req = await booking_service.request_booking_action(
        session=db,
        booking_id=booking.id,
        actor_id=None,
        actor_type="customer",
        action_type="cancel",
        reason_code=body.reason_code,
        notes=body.notes,
        metadata_json=body.metadata_json,
    )
    return BookingActionRequestResponse.model_validate(req)



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
    storage=Depends(get_private_file_storage),
) -> OwnerVerificationResponse:
    """05_App_Flow.md §3. Any logged-in user can submit one of these — it's
    what turns a customer account into a pending owner application.
    Approval (admin-only, below) is the only thing that actually changes
    the role."""
    content = await document.read()
    try:
        _, storage_key = await storage.save(
            content, document.content_type, key_prefix=f"owner-verifications/{current_user.id}"
        )
    except UnsupportedFileError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    verification = await onboarding_service.submit_verification(
        session=db,
        user_id=current_user.id,
        document_url="",
        storage_key=storage_key,
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
    body: ApproveOwnerVerificationRequest | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin")),
) -> OwnerVerificationResponse:
    verification = await onboarding_service.approve_verification(
        session=db, verification_id=verification_id, admin_id=current_user.id
    )
    
    if body and body.password_action:
        if body.password_action == "link":
            await admin_passwords_service.admin_generate_reset_link(
                db, current_user.id, verification.user_id, "Owner Approval Account Setup", "owner_verification", str(verification_id)
            )
        elif body.password_action == "force":
            await admin_passwords_service.admin_force_password_reset(
                db, current_user.id, verification.user_id, "Owner Approval Account Setup", "owner_verification", str(verification_id)
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


@app.get("/api/v1/admin/owner-verifications/{verification_id}/document")
async def get_owner_verification_document_route(
    verification_id: uuid.UUID,
    presigned: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin")),
    storage=Depends(get_private_file_storage),
):
    """Admin-only: stream verification document or return short-lived presigned URL (5 minutes)."""
    verification = (
        await db.execute(
            select(OwnerVerification).where(OwnerVerification.id == verification_id)
        )
    ).scalar_one_or_none()
    if not verification:
        raise HTTPException(status_code=404, detail="Verification not found")

    storage_key = verification.storage_key
    if not storage_key:
        raise HTTPException(status_code=404, detail="Document not found")

    if presigned and hasattr(storage, "get_presigned_url"):
        url = await storage.get_presigned_url(storage_key, expires_in=300)
        return {"url": url}

    try:
        content, content_type = await storage.get_object(storage_key)
        filename = storage_key.split("/")[-1]
        return Response(
            content=content,
            media_type=content_type,
            headers={"Content-Disposition": f'inline; filename="{filename}"'},
        )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Document file not found")


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
        display_name=body.display_name,
        tagline=body.tagline,
        category_id=body.category_id,
        venue_type_id=body.venue_type_id,
        use_case_ids=body.use_case_ids,
        description=body.description,
        state=body.state,
        pincode=body.pincode,
        capacity=body.capacity,
        amenity_names=body.amenity_names,
        content_blocks=[b.model_dump() for b in body.content_blocks] if body.content_blocks else None,
        status=body.status or ("draft" if body.save_as_draft else "pending_review"),
        save_as_draft=body.save_as_draft,
    )
    return VenueResponse.from_venue(venue)



@app.get("/api/v1/categories", response_model=list[CategoryResponse])
async def list_categories(db: AsyncSession = Depends(get_db)):
    cats = await catalog_service.list_categories(db)
    return [CategoryResponse.model_validate(c) for c in cats]

@app.get("/api/v1/venue-types", response_model=list[VenueTypeResponse])
async def list_venue_types(db: AsyncSession = Depends(get_db)):
    vtypes = await catalog_service.list_venue_types(db)
    return [VenueTypeResponse.model_validate(v) for v in vtypes]

@app.get("/api/v1/use-cases", response_model=list[UseCaseResponse])
async def list_use_cases(db: AsyncSession = Depends(get_db)):
    ucases = await catalog_service.list_use_cases(db)
    return [UseCaseResponse.model_validate(u) for u in ucases]

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
    venue_id: str,
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
async def upload_venue_media_route(
    venue_id: uuid.UUID,
    image: UploadFile = File(...),
    is_cover: bool = Form(default=False),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("owner", "admin")),
    storage=Depends(get_file_storage),
) -> VenueResponse:
    content = await image.read()
    await catalog_service.upload_venue_media(
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
    venue_id: str,
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


@app.post("/api/v1/owner/bookings/{booking_id}/cancellation-requests", response_model=BookingActionRequestResponse, status_code=201)
async def request_owner_booking_cancellation_route(
    booking_id: uuid.UUID,
    body: BookingActionRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("owner", "admin")),
) -> BookingActionRequestResponse:
    req = await booking_service.request_booking_action(
        session=db,
        booking_id=booking_id,
        actor_id=current_user.id,
        actor_type="owner",
        action_type="cancel",
        reason_code=body.reason_code,
        notes=body.notes,
        metadata_json=body.metadata_json,
    )
    return BookingActionRequestResponse.model_validate(req)



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
    search: str | None = Query(default=None),
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
        db, role=role, suspended_only=suspended, search=search, limit=limit, offset=offset
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

    if body.booking_id:
        from app.models.core import Booking
        booking_res = await db.execute(select(Booking).where(Booking.id == body.booking_id))
        booking = booking_res.scalar_one_or_none()
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found.")
        if booking.status != "completed":
            raise HTTPException(status_code=400, detail="Only completed bookings can be reviewed")
        
        existing_review = await db.execute(select(Review).where(Review.booking_id == body.booking_id))
        if existing_review.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Booking already reviewed.")

    review = Review(
        venue_id=venue_id,
        user_id=current_user.id,
        booking_id=body.booking_id,
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
        booking_id=review.booking_id,
        user_name=review.user.name,
        rating=review.rating,
        content=review.content,
        created_at=review.created_at,
    )


@app.get("/api/v1/venues/{venue_id}/reviews", response_model=list[ReviewResponse])
async def list_reviews_route(
    venue_id: str,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> list[ReviewResponse]:
    """Public endpoint — no auth required. Supports lookup by UUID or slug."""
    actual_id: uuid.UUID
    try:
        actual_id = uuid.UUID(venue_id)
    except ValueError:
        v_res = await db.execute(select(Venue.id).where(Venue.slug == venue_id, Venue.deleted_at.is_(None)))
        resolved = v_res.scalar_one_or_none()
        if resolved is None:
            raise HTTPException(status_code=404, detail="Venue not found")
        actual_id = resolved

    result = await db.execute(
        select(Review)
        .where(Review.venue_id == actual_id)
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
            booking_id=r.booking_id,
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


# ---------------------------------------------------------------------------
# Homepage Curation
# ---------------------------------------------------------------------------

@app.get("/api/v1/homepage", response_model=HomepageResponse)
async def get_homepage_route(
    db: AsyncSession = Depends(get_db),
) -> HomepageResponse:
    return await homepage_service.get_homepage(db)


@app.get("/api/v1/admin/homepage/placements", response_model=list[HomepagePlacementResponse])
async def list_admin_placements_route(
    section: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin")),
) -> list[HomepagePlacementResponse]:
    placements = await homepage_service.list_admin_placements(db, section=section)
    return [HomepagePlacementResponse.from_placement(p) for p in placements]


@app.post("/api/v1/admin/homepage/placements", response_model=HomepagePlacementResponse, status_code=201)
async def create_placement_route(
    body: HomepagePlacementCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin")),
) -> HomepagePlacementResponse:
    placement = await homepage_service.create_placement(
        session=db,
        venue_id=body.venue_id,
        section=body.section,
        enabled=body.enabled,
        priority=body.priority,
        badge=body.badge,
        custom_title=body.custom_title,
        custom_description=body.custom_description,
        start_at=body.start_at,
        end_at=body.end_at,
    )
    return HomepagePlacementResponse.from_placement(placement)


@app.patch("/api/v1/admin/homepage/placements/{placement_id}", response_model=HomepagePlacementResponse)
async def update_placement_route(
    placement_id: uuid.UUID,
    body: HomepagePlacementUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin")),
) -> HomepagePlacementResponse:
    placement = await homepage_service.update_placement(
        session=db,
        placement_id=placement_id,
        changes=body.model_dump(exclude_unset=True),
    )
    return HomepagePlacementResponse.from_placement(placement)


@app.delete("/api/v1/admin/homepage/placements/{placement_id}", status_code=204)
async def delete_placement_route(
    placement_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin")),
):
    await homepage_service.delete_placement(db, placement_id)
    return Response(status_code=204)


@app.patch("/api/v1/admin/homepage/sections/{section}/reorder", response_model=list[HomepagePlacementResponse])
async def reorder_section_route(
    section: str,
    body: SectionReorderRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin")),
) -> list[HomepagePlacementResponse]:
    placements = await homepage_service.reorder_section(
        session=db,
        section=section,
        ordered_ids=body.ordered_ids,
    )
    return [HomepagePlacementResponse.from_placement(p) for p in placements]


# ---------------------------------------------------------------------------
# Venue Image Management (Cover & Delete)
# ---------------------------------------------------------------------------

@app.patch("/api/v1/venues/{venue_id}/images/{image_id}/cover", response_model=VenueMediaResponse)
async def set_cover_image_route(
    venue_id: uuid.UUID,
    image_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("owner", "admin")),
) -> VenueMediaResponse:
    image = await homepage_service.set_cover_image(
        session=db,
        venue_id=venue_id,
        image_id=image_id,
        viewer=current_user,
    )
    return VenueMediaResponse.model_validate(image)


@app.delete("/api/v1/venues/{venue_id}", status_code=204)
async def delete_venue_route(
    venue_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    print(f"DELETE VENUE CALLED FOR {venue_id} BY {current_user.id}")
    venue = await catalog_service.get_venue(db, venue_id, current_user)
    if not venue:
        print("VENUE IS NONE")
        raise HTTPException(status_code=404, detail="Venue not found")
    print(f"VENUE FOUND: {venue.id} OWNER {venue.owner_id}")
    if venue.owner_id != current_user.id:
        print("NOT AUTHORIZED")
        raise HTTPException(status_code=403, detail="Not authorized")
    venue.status = "archived"
    await db.commit()
    print("VENUE ARCHIVED")
    return Response(status_code=204)

@app.delete("/api/v1/users/me", status_code=204)
async def delete_me_route(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_row),
):
    current_user.deleted_at = datetime.now(timezone.utc)
    # Also archive their active venues
    await db.execute(
        select(Venue).where(Venue.owner_id == current_user.id)
    ) # just to load? no need, just update
    
    await db.execute(
        func.current_timestamp() # dummy
    )
    # Better:
    from sqlalchemy import update
    await db.execute(
        update(Venue)
        .where(Venue.owner_id == current_user.id)
        .values(status="archived")
    )
    await db.commit()
    return Response(status_code=204)

@app.delete("/api/v1/venues/{venue_id}/images/{image_id}", status_code=204)
async def delete_image_route(
    venue_id: uuid.UUID,
    image_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("owner", "admin")),
):
    await homepage_service.delete_image(
        session=db,
        venue_id=venue_id,
        image_id=image_id,
        viewer=current_user,
    )
    return Response(status_code=204)


@app.exception_handler(Exception)
async def custom_exception_handler(request, exc):
    import traceback
    traceback.print_exc()
    from fastapi.responses import JSONResponse
    # Security: do NOT return str(exc) — that leaks internal details (SQL,
    # ORM class names, column names) to untrusted clients. Log server-side only.
    return JSONResponse(status_code=500, content={"detail": "An internal server error occurred."})


# -----------------------------------------------------------------------------
# Support Tickets & Admin Notifications (Appended)
# -----------------------------------------------------------------------------

from app.schemas.ticket import TicketCreateRequest, TicketResponse, TicketDetailResponse, TicketCommentRequest, TicketUpdateRequest
from app.modules.support import service as support_service

@app.get("/api/v1/admin/support/tickets", response_model=list[TicketResponse], dependencies=[Depends(require_role("admin"))])
async def list_admin_tickets_route(
    status: str | None = None,
    category: str | None = None,
    q: str | None = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    tickets = await support_service.list_tickets_for_admin(db, status=status, category=category, q=q, limit=limit, offset=offset)
    return [TicketResponse.from_ticket(t) for t in tickets]

@app.post("/api/v1/support/tickets", response_model=TicketResponse, status_code=201)
async def create_ticket_route(
    req: TicketCreateRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TicketResponse:
    ticket = await support_service.create_ticket(
        db, current_user.id, **req.model_dump()
    )
    return TicketResponse.from_ticket(ticket)

@app.get("/api/v1/support/tickets", response_model=list[TicketResponse])
async def list_tickets_route(
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[TicketResponse]:
    if current_user.role == "admin":
        tickets = await support_service.list_tickets_for_admin(db, status=status, limit=limit, offset=offset)
    elif current_user.role == "owner":
        tickets = await support_service.list_tickets_for_owner(db, current_user.id, status=status, limit=limit, offset=offset)
    else:
        tickets = await support_service.list_tickets_for_customer(db, current_user.id, status=status, limit=limit, offset=offset)
    return [TicketResponse.from_ticket(t) for t in tickets]

@app.get("/api/v1/support/tickets/{ticket_id}", response_model=TicketDetailResponse)
async def get_ticket_route(
    ticket_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TicketDetailResponse:
    ticket = await support_service.get_ticket(db, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    # Authorization
    if current_user.role != "admin" and ticket.creator_id != current_user.id:
        if ticket.venue_id:
            venue_result = await db.execute(select(Venue).where(Venue.id == ticket.venue_id))
            venue = venue_result.scalar_one_or_none()
            if not venue or venue.owner_id != current_user.id:
                raise HTTPException(status_code=404, detail="Ticket not found")
        else:
            raise HTTPException(status_code=404, detail="Ticket not found")
            
    events = ticket.events
    if current_user.role != "admin":
        events = [e for e in events if not e.internal]
        
    return TicketDetailResponse.from_ticket_with_events(ticket, events)

@app.patch("/api/v1/admin/support/tickets/{ticket_id}", response_model=TicketDetailResponse)
async def update_ticket_route(
    ticket_id: uuid.UUID,
    req: TicketUpdateRequest,
    current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> TicketDetailResponse:
    # Service layer update
    ticket = await support_service.update_ticket(
        db, current_user.id, ticket_id, **req.model_dump(exclude_unset=True)
    )
    # Re-fetch to get updated events
    ticket_with_events = await support_service.get_ticket(db, ticket_id)
    return TicketDetailResponse.from_ticket_with_events(ticket_with_events, ticket_with_events.events)

from app.schemas.ticket import TicketEventResponse

@app.post("/api/v1/support/tickets/{ticket_id}/comments", response_model=TicketEventResponse, status_code=201)
async def add_comment_route(
    ticket_id: uuid.UUID,
    req: TicketCommentRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TicketEventResponse:
    event = await support_service.add_comment(
        db, current_user.id, current_user.role, ticket_id, **req.model_dump()
    )
    return TicketEventResponse.from_event(event)

class AdminSendNotificationRequest(BaseModel):
    user_id: uuid.UUID
    type: str
    message: str
    entity_type: str | None = None
    entity_id: uuid.UUID | None = None

@app.post("/api/v1/admin/notifications/send", response_model=NotificationResponse)
async def admin_send_notification_route(
    req: AdminSendNotificationRequest,
    current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> NotificationResponse:
    objs = notifications_service.notify(
        req.user_id,
        req.type,
        req.message,
        req.entity_type,
        req.entity_id,
    )
    db.add_all(objs)
    notification = objs[0]
    
    from app.models.core import AuditLog
    audit = AuditLog(
        actor_id=current_user.id,
        action="notification.sent",
        entity_type="notification",
        entity_id=notification.id,
        extra_data={"recipient_id": str(req.user_id), "type": req.type}
    )
    db.add(audit)
    await db.commit()
    await db.refresh(notification)
    return NotificationResponse.model_validate(notification)

@app.get("/api/v1/admin/notifications", response_model=list[NotificationResponse])
async def list_all_notifications_route(
    limit: int = 50,
    offset: int = 0,
    current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> list[NotificationResponse]:
    query = select(Notification).order_by(Notification.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    notifications = list(result.scalars().all())
    return [NotificationResponse.model_validate(n) for n in notifications]


@app.post("/api/v1/admin/users/{user_id}/reset-password", response_model=AdminPasswordResetResponse)
async def admin_reset_password_route(
    user_id: uuid.UUID,
    body: AdminPasswordResetRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin")),
):
    if body.method == "link":
        reset_url = await admin_passwords_service.admin_generate_reset_link(
            db, current_user.id, user_id, body.reason, body.source_type, body.source_id
        )
        # reset_url is the full frontend URL — e.g. http://localhost:3000/reset-password?token=…
        # It is a one-time secret: it must not be logged or included in any
        # audit record beyond this single authorized response delivery.
        return AdminPasswordResetResponse(message="Reset link generated", reset_url=reset_url)
    elif body.method == "temporary":
        temp_pwd = await admin_passwords_service.admin_generate_temporary_password(
            db, current_user.id, user_id, body.reason, body.source_type, body.source_id
        )
        return AdminPasswordResetResponse(message="Temporary password generated", temp_password=temp_pwd)
    elif body.method == "force":
        await admin_passwords_service.admin_force_password_reset(
            db, current_user.id, user_id, body.reason, body.source_type, body.source_id
        )
        return AdminPasswordResetResponse(message="Forced password change on next login")
    raise HTTPException(status_code=400, detail="Invalid reset method")


def _mask_contact(phone: str | None, email: str | None) -> str:
    if phone:
        digits = "".join(ch for ch in phone if ch.isdigit())
        if len(digits) > 4:
            return digits[:3] + "****" + digits[-2:]
        return "****"
    if email:
        parts = email.split("@", 1)
        if len(parts) == 2:
            user_part, domain = parts
            if len(user_part) <= 2:
                masked_user = user_part[:1] + "***"
            else:
                masked_user = user_part[0] + "***" + user_part[-1]
            return f"{masked_user}@{domain}"
        return "***"
    return "Unknown"


@app.get("/api/v1/admin/password-reset-requests", response_model=list[AdminPasswordResetRequestView])
async def list_password_reset_requests_for_admin_route(
    status: str = Query(default="pending"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin")),
) -> list[AdminPasswordResetRequestView]:
    stmt = (
        select(PasswordResetRequest, User)
        .join(User, PasswordResetRequest.user_id == User.id)
        .where(PasswordResetRequest.status == status)
        .order_by(PasswordResetRequest.created_at.desc())
    )
    result = await db.execute(stmt)
    rows = result.all()

    views = []
    for req, user in rows:
        contact = _mask_contact(user.phone, user.email)
        views.append(
            AdminPasswordResetRequestView(
                id=req.id,
                user_id=req.user_id,
                name=user.name,
                contact=contact,
                created_at=req.created_at,
                status=req.status,
            )
        )
    return views


@app.post("/api/v1/admin/password-reset-requests/{request_id}/cancel")
@app.delete("/api/v1/admin/password-reset-requests/{request_id}")
async def cancel_password_reset_request_route(
    request_id: uuid.UUID,
    body: CancelPasswordResetRequest | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin")),
) -> dict:
    reason = body.reason if body and body.reason else "Cancelled by administrator"
    await admin_passwords_service.admin_cancel_password_reset_request(
        db, current_user.id, request_id, reason=reason
    )
    return {"message": "Password reset request cancelled"}


@app.get("/api/v1/admin/dashboard/overview", response_model=DashboardOverview)
async def get_dashboard_overview_route(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin")),
) -> dict:
    return await admin_service.get_dashboard_overview_v2(db)


from app.schemas.catalog import PricingRuleCreate, PricingRuleResponse

@app.post('/api/v1/venues/{venue_id}/pricing-rules', response_model=PricingRuleResponse, status_code=201)
async def create_pricing_rule_route(
    venue_id: uuid.UUID,
    rule: PricingRuleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role('owner', 'admin')),
):
    return await catalog_service.create_pricing_rule(db, venue_id, current_user, rule.model_dump())

@app.get('/api/v1/venues/{venue_id}/pricing-rules', response_model=list[PricingRuleResponse])
async def list_pricing_rules_route(
    venue_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role('owner', 'admin')),
):
    return await catalog_service.list_pricing_rules(db, venue_id, current_user)

@app.delete('/api/v1/venues/{venue_id}/pricing-rules/{rule_id}', status_code=204)
async def delete_pricing_rule_route(
    venue_id: uuid.UUID,
    rule_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role('owner', 'admin')),
):
    await catalog_service.delete_pricing_rule(db, venue_id, rule_id, current_user)
    return Response(status_code=204)



from app.schemas.catalog import PricingRuleUpdate

@app.patch('/api/v1/venues/{venue_id}/pricing-rules/{rule_id}', response_model=PricingRuleResponse)
async def update_pricing_rule_route(
    venue_id: uuid.UUID,
    rule_id: uuid.UUID,
    rule_update: PricingRuleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role('owner', 'admin')),
):
    return await catalog_service.update_pricing_rule(
        db, venue_id, rule_id, current_user, rule_update.model_dump(exclude_unset=True)
    )



from app.schemas.analytics import AnalyticsFilter, AnalyticsMetrics
from app.modules.analytics import service as analytics_service

@app.get("/api/v1/admin/analytics", response_model=AnalyticsMetrics)
async def get_admin_analytics_route(
    start_date: date_,
    end_date: date_,
    venue_id: uuid.UUID | None = None,
    category: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role('admin'))
):
    if (end_date - start_date).days > 366:
        raise HTTPException(status_code=400, detail="Date range cannot exceed 1 year")
    filter = AnalyticsFilter(
        start_date=start_date,
        end_date=end_date,
        venue_id=venue_id,
        category=category
    )
    return await analytics_service.get_analytics_metrics(db, filter)


@app.get("/api/v1/owner/analytics", response_model=AnalyticsMetrics)
async def get_owner_analytics_route(
    start_date: date_,
    end_date: date_,
    venue_id: uuid.UUID | None = None,
    category: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_role('owner'))
):
    if (end_date - start_date).days > 366:
        raise HTTPException(status_code=400, detail="Date range cannot exceed 1 year")
    
    filter = AnalyticsFilter(
        start_date=start_date,
        end_date=end_date,
        venue_id=venue_id,
        category=category,
        owner_id=current_user.id
    )
    return await analytics_service.get_analytics_metrics(db, filter)

"""
Three real gaps found while wiring the owner dashboard's frontend to real
data — each one flagged as a "natural next gap" by the very code it's
extending, not invented for this slice:

1. GET /api/v1/owner/venues — list_venues() (public search) only ever
   returns 'active' listings; an owner had no way to see their own
   draft/pending_review/suspended venues anywhere.
2. GET /api/v1/owner/bookings — get_booking_for_viewer's own docstring:
   "a calendar/dashboard view across all of one venue's bookings...
   out of scope here, flagged... as the natural next gap."
3. GET /api/v1/owner/verification — submit_owner_verification_route
   returns the created row once, at submission time; nothing let a user
   check their own application's status afterward.

Also covers the LocalFileStorage fix (local:// -> a URL the /uploads
static mount actually serves) via the existing image-upload route, since
that fix has no meaning unless the URL it returns is actually fetchable.
"""
import uuid
from datetime import date, timedelta
from decimal import Decimal

import httpx
import pytest
import pytest_asyncio

from app.db import get_db, get_idem_db
from app.main import app
from app.models.core import Booking, InventoryUnit, OwnerVerification, User, Venue
from app.modules.auth.security import create_access_token, hash_password
from app.modules.booking.service import confirm_booking_from_webhook, create_booking


@pytest_asyncio.fixture
async def client(test_session_factory):
    async def _override_get_db():
        async with test_session_factory() as session:
            try:
                yield session
            finally:
                if session.in_transaction():
                    await session.rollback()
                await session.close()

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_idem_db] = _override_get_db

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


async def _seeded_owner(test_session_factory, *, name="Ms. Rao"):
    """A fresh owner with no venues yet — callers add whatever venues/units
    a given test needs directly, since these tests are about the listing
    endpoints' scoping/visibility, not about exercising venue creation
    itself (already covered by test_catalog.py)."""
    email = f"owner-{uuid.uuid4().hex[:8]}@example.com"
    async with test_session_factory() as session:
        async with session.begin():
            owner = User(name=name, email=email, password_hash=hash_password("whatever-1"),
                phone=f"123{uuid.uuid4().hex[:7]}", role="owner")
            session.add(owner)
            await session.flush()
            owner_id = owner.id
    return owner_id


async def _venue(test_session_factory, owner_id, *, status="pending_review", **overrides):
    defaults = dict(
        owner_id=owner_id,
        name="Test Venue",
        slug=f"test-venue-{uuid.uuid4().hex[:8]}",
        category="sports",
        address="1 Test Road",
        city="Lucknow",
        unit_type="hour",
        base_price=Decimal("1000.00"),
        status=status,
    )
    defaults.update(overrides)
    async with test_session_factory() as session:
        async with session.begin():
            venue = Venue(**defaults)
            session.add(venue)
            await session.flush()
            venue_id = venue.id
    return venue_id


async def _confirmed_booking(test_session_factory, venue_id, *, slot_date: date):
    """Same shape as test_payout_ledger.py's _confirmed_booking_with_payment
    minus the Payment row — these tests don't need payment amounts, just a
    real Booking row with a real inventory_unit relationship (BookingDetail
    requires it eager-loadable)."""
    async with test_session_factory() as session:
        async with session.begin():
            unit = InventoryUnit(venue_id=venue_id, date=slot_date, start_time=None, end_time=None, price=Decimal("1000.00"))
            session.add(unit)
            await session.flush()
            unit_id = unit.id

        booking, _ = await create_booking(
            session=session, inventory_unit_id=unit_id,
            guest_name="Guest User", guest_email=f"guest-{uuid.uuid4().hex[:8]}@example.com",
        )
        booking_id = booking.id

    async with test_session_factory() as session:
        await confirm_booking_from_webhook(session, booking_id)

    return booking_id


# ---------------------------------------------------------------------------
# GET /api/v1/owner/venues
# ---------------------------------------------------------------------------

async def test_owner_sees_all_their_own_venues_regardless_of_status(client, test_session_factory):
    owner_id = await _seeded_owner(test_session_factory)
    await _venue(test_session_factory, owner_id, status="draft")
    await _venue(test_session_factory, owner_id, status="pending_review")
    await _venue(test_session_factory, owner_id, status="active")
    await _venue(test_session_factory, owner_id, status="suspended")

    token = create_access_token(owner_id, "owner")
    resp = await client.get("/api/v1/owner/venues", headers={"Authorization": f"Bearer {token}"})

    assert resp.status_code == 200
    statuses = {v["status"] for v in resp.json()}
    assert statuses == {"draft", "pending_review", "active", "suspended"}


async def test_owner_does_not_see_another_owners_venues(client, test_session_factory):
    owner_a = await _seeded_owner(test_session_factory, name="Owner A")
    owner_b = await _seeded_owner(test_session_factory, name="Owner B")
    await _venue(test_session_factory, owner_a, name="A's Venue")
    await _venue(test_session_factory, owner_b, name="B's Venue")

    token = create_access_token(owner_a, "owner")
    resp = await client.get("/api/v1/owner/venues", headers={"Authorization": f"Bearer {token}"})

    names = {v["name"] for v in resp.json()}
    assert names == {"A's Venue"}


async def test_owner_venues_excludes_soft_deleted(client, test_session_factory):
    from datetime import datetime, timezone

    owner_id = await _seeded_owner(test_session_factory)
    await _venue(test_session_factory, owner_id, status="active")
    async with test_session_factory() as session:
        async with session.begin():
            deleted = Venue(
                owner_id=owner_id, name="Deleted Venue", slug=f"deleted-{uuid.uuid4().hex[:8]}",
                category="sports", address="x", city="Lucknow", unit_type="hour",
                base_price=Decimal("500.00"), status="active", deleted_at=datetime.now(timezone.utc),
            )
            session.add(deleted)

    token = create_access_token(owner_id, "owner")
    resp = await client.get("/api/v1/owner/venues", headers={"Authorization": f"Bearer {token}"})
    names = {v["name"] for v in resp.json()}
    assert "Deleted Venue" not in names


async def test_list_my_venues_requires_owner_or_admin_role(client, seeded_customer):
    token = create_access_token(seeded_customer, "customer")
    resp = await client.get("/api/v1/owner/venues", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403


async def test_list_my_venues_anonymous_gets_401(client):
    resp = await client.get("/api/v1/owner/venues")
    assert resp.status_code == 401


async def test_admin_can_call_list_my_venues_too(client, seeded_admin):
    """require_role("owner", "admin") — same RBAC set as venue creation
    itself (POST /venues). An admin calling this sees their own (likely
    empty) venue list, not a platform-wide one — that's GET
    /admin/overview's job, not this route's."""
    token = create_access_token(seeded_admin, "admin")
    resp = await client.get("/api/v1/owner/venues", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json() == []


# ---------------------------------------------------------------------------
# GET /api/v1/owner/bookings
# ---------------------------------------------------------------------------

async def test_owner_sees_bookings_across_all_their_venues(client, test_session_factory):
    owner_id = await _seeded_owner(test_session_factory)
    venue_a = await _venue(test_session_factory, owner_id, status="active", name="Venue A")
    venue_b = await _venue(test_session_factory, owner_id, status="active", name="Venue B")
    booking_a = await _confirmed_booking(test_session_factory, venue_a, slot_date=date(2027, 9, 1))
    booking_b = await _confirmed_booking(test_session_factory, venue_b, slot_date=date(2027, 9, 2))

    token = create_access_token(owner_id, "owner")
    resp = await client.get("/api/v1/owner/bookings", headers={"Authorization": f"Bearer {token}"})

    assert resp.status_code == 200
    ids = {b["id"] for b in resp.json()}
    assert ids == {str(booking_a), str(booking_b)}


async def test_owner_does_not_see_another_owners_bookings(client, test_session_factory):
    owner_a = await _seeded_owner(test_session_factory, name="Owner A")
    owner_b = await _seeded_owner(test_session_factory, name="Owner B")
    venue_a = await _venue(test_session_factory, owner_a, status="active")
    venue_b = await _venue(test_session_factory, owner_b, status="active")
    await _confirmed_booking(test_session_factory, venue_a, slot_date=date(2027, 9, 1))
    booking_b = await _confirmed_booking(test_session_factory, venue_b, slot_date=date(2027, 9, 1))

    token = create_access_token(owner_a, "owner")
    resp = await client.get("/api/v1/owner/bookings", headers={"Authorization": f"Bearer {token}"})

    ids = {b["id"] for b in resp.json()}
    assert str(booking_b) not in ids


async def test_owner_bookings_filters_by_venue_id(client, test_session_factory):
    owner_id = await _seeded_owner(test_session_factory)
    venue_a = await _venue(test_session_factory, owner_id, status="active")
    venue_b = await _venue(test_session_factory, owner_id, status="active")
    booking_a = await _confirmed_booking(test_session_factory, venue_a, slot_date=date(2027, 9, 1))
    await _confirmed_booking(test_session_factory, venue_b, slot_date=date(2027, 9, 1))

    token = create_access_token(owner_id, "owner")
    resp = await client.get(
        "/api/v1/owner/bookings", params={"venue_id": str(venue_a)}, headers={"Authorization": f"Bearer {token}"}
    )
    ids = {b["id"] for b in resp.json()}
    assert ids == {str(booking_a)}


async def test_owner_bookings_filters_by_date_range(client, test_session_factory):
    owner_id = await _seeded_owner(test_session_factory)
    venue_id = await _venue(test_session_factory, owner_id, status="active")
    early = await _confirmed_booking(test_session_factory, venue_id, slot_date=date(2027, 9, 1))
    late = await _confirmed_booking(test_session_factory, venue_id, slot_date=date(2027, 9, 30))

    token = create_access_token(owner_id, "owner")
    resp = await client.get(
        "/api/v1/owner/bookings",
        params={"date_from": "2027-09-15", "date_to": "2027-09-30"},
        headers={"Authorization": f"Bearer {token}"},
    )
    ids = {b["id"] for b in resp.json()}
    assert ids == {str(late)}
    assert str(early) not in ids


async def test_owner_bookings_filters_by_status(client, test_session_factory):
    owner_id = await _seeded_owner(test_session_factory)
    venue_id = await _venue(test_session_factory, owner_id, status="active")
    confirmed = await _confirmed_booking(test_session_factory, venue_id, slot_date=date(2027, 9, 1))

    # An unconfirmed (pending_payment) booking, made directly against the
    # same venue's second unit — no confirm step, so it stays pending.
    async with test_session_factory() as session:
        async with session.begin():
            unit2 = InventoryUnit(venue_id=venue_id, date=date(2027, 9, 2), price=Decimal("1000.00"))
            session.add(unit2)
            await session.flush()
            unit2_id = unit2.id
        pending, _ = await create_booking(
            session=session, inventory_unit_id=unit2_id, guest_name="G", guest_email="g@example.com"
        )
        pending_id = pending.id

    token = create_access_token(owner_id, "owner")
    resp = await client.get(
        "/api/v1/owner/bookings", params={"status": "confirmed"}, headers={"Authorization": f"Bearer {token}"}
    )
    ids = {b["id"] for b in resp.json()}
    assert ids == {str(confirmed)}
    assert str(pending_id) not in ids


async def test_owner_bookings_response_has_no_customer_identity_fields(client, test_session_factory):
    """Deliberate, explicit test for the design choice documented in
    list_bookings_for_owner's docstring: an owner can see that a slot is
    booked, for how much, in what state — never who booked it. If a
    future change to BookingDetail ever added a customer-identity field,
    this test fails loudly rather than silently starting to leak it here."""
    owner_id = await _seeded_owner(test_session_factory)
    venue_id = await _venue(test_session_factory, owner_id, status="active")
    await _confirmed_booking(test_session_factory, venue_id, slot_date=date(2027, 9, 1))

    token = create_access_token(owner_id, "owner")
    resp = await client.get("/api/v1/owner/bookings", headers={"Authorization": f"Bearer {token}"})

    assert len(resp.json()) == 1
    keys = set(resp.json()[0].keys())
    leaky_fields = {"customer_id", "customer_name", "customer_email", "guest_name", "guest_email"}
    assert keys.isdisjoint(leaky_fields), f"owner-bookings response leaked identity field(s): {keys & leaky_fields}"


async def test_owner_bookings_requires_owner_or_admin_role(client, seeded_customer):
    token = create_access_token(seeded_customer, "customer")
    resp = await client.get("/api/v1/owner/bookings", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403


async def test_owner_bookings_anonymous_gets_401(client):
    resp = await client.get("/api/v1/owner/bookings")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# GET /api/v1/owner/verification
# ---------------------------------------------------------------------------

async def test_returns_null_when_never_submitted(client, seeded_customer):
    token = create_access_token(seeded_customer, "customer")
    resp = await client.get("/api/v1/owner/verification", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json() is None


async def test_returns_the_pending_submission(client, test_session_factory, seeded_customer):
    async with test_session_factory() as session:
        async with session.begin():
            session.add(OwnerVerification(
                user_id=seeded_customer, document_url="http://x/doc.pdf", business_name="Rao Sports Co",
            ))

    token = create_access_token(seeded_customer, "customer")
    resp = await client.get("/api/v1/owner/verification", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "pending"
    assert body["business_name"] == "Rao Sports Co"


async def test_returns_most_recent_after_rejection_and_resubmission(client, test_session_factory, seeded_customer):
    async with test_session_factory() as session:
        async with session.begin():
            session.add(OwnerVerification(
                user_id=seeded_customer, document_url="http://x/old.pdf", status="rejected",
                rejection_reason="Blurry document",
            ))
    async with test_session_factory() as session:
        async with session.begin():
            session.add(OwnerVerification(user_id=seeded_customer, document_url="http://x/new.pdf"))

    token = create_access_token(seeded_customer, "customer")
    resp = await client.get("/api/v1/owner/verification", headers={"Authorization": f"Bearer {token}"})
    body = resp.json()
    assert body["status"] == "pending"  # the newer row, not the rejected one


async def test_verification_status_anonymous_gets_401(client):
    resp = await client.get("/api/v1/owner/verification")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# LocalFileStorage fix: an uploaded image is actually fetchable, not just
# saved. See app/modules/storage/base.py's save() docstring for the bug
# this replaces (local:// — a scheme no browser understands).
# ---------------------------------------------------------------------------

async def test_uploaded_venue_image_url_is_actually_fetchable(client, test_session_factory, seeded_verified_owner):
    token = create_access_token(seeded_verified_owner, "owner")
    create_resp = await client.post(
        "/api/v1/venues",
        json={
            "name": "Fetchable Image Venue", "category": "sports", "address": "1 Road",
            "city": "Lucknow", "unit_type": "hour", "base_price": "1000.00",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    venue_id = create_resp.json()["id"]

    upload_resp = await client.post(
        f"/api/v1/venues/{venue_id}/images",
        files={"image": ("cover.jpg", b"\xff\xd8\xff fake jpeg bytes", "image/jpeg")},
        data={"is_cover": "true"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert upload_resp.status_code == 201
    image_url = upload_resp.json()["media"][0]["url"]

    # A real gap this fixes: this used to be "local://venues/{id}/xxx.jpg",
    # a scheme no HTTP client (browser or otherwise) can fetch at all.
    assert image_url.startswith("http"), f"image URL isn't a fetchable http(s) URL: {image_url}"
    assert "/uploads/" in image_url

    # Prove it's not just a plausible-looking URL — actually fetch it
    # through the same ASGI app (StaticFiles mount) and confirm the exact
    # bytes that were uploaded come back.
    fetch_resp = await client.get(image_url)
    assert fetch_resp.status_code == 200
    assert fetch_resp.content == b"\xff\xd8\xff fake jpeg bytes"

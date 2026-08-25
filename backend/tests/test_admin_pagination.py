"""
Pagination for the 5 admin list endpoints (venues, owner-verifications,
users, bookings, payouts) — none of them had it; every one just returned
everything. Added the same way audit-log already works: keyword-only
limit/offset (default 50, max 200), flat list response (no total-count
envelope) — matching that existing precedent exactly rather than
inventing a different shape for these five.
"""
import uuid
from datetime import date, timedelta
from decimal import Decimal

import httpx
import pytest

from app.db import get_db
from app.main import app
from app.models.core import InventoryUnit, OwnerVerification, Payout, User, Venue
from app.modules.auth.security import create_access_token, hash_password
from app.modules.booking.service import create_booking


@pytest.fixture
async def client(test_session_factory):
    async def _override_get_db():
        async with test_session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


def _admin_headers(admin_id):
    return {"Authorization": f"Bearer {create_access_token(admin_id, 'admin')}"}


async def _owner(test_session_factory, *, name=None):
    email = f"owner-{uuid.uuid4().hex[:8]}@example.com"
    name = name or f"Owner {uuid.uuid4().hex[:6]}"
    async with test_session_factory() as session:
        async with session.begin():
            owner = User(name=name, email=email, password_hash=hash_password("whatever-1"),
                phone=f"123{uuid.uuid4().hex[:7]}", role="owner")
            session.add(owner)
            await session.flush()
            owner_id = owner.id
    return owner_id


async def _venue(test_session_factory, owner_id, *, status="active"):
    async with test_session_factory() as session:
        async with session.begin():
            venue = Venue(
                owner_id=owner_id, name=f"Venue {uuid.uuid4().hex[:6]}", slug=f"venue-{uuid.uuid4().hex[:8]}",
                category="sports", address="1 Test Rd", city="Lucknow", unit_type="hour",
                base_price=Decimal("1000.00"), status=status,
            )
            session.add(venue)
            await session.flush()
            venue_id = venue.id
    return venue_id


async def _verification(test_session_factory, user_id, *, status="pending"):
    async with test_session_factory() as session:
        async with session.begin():
            verification = OwnerVerification(
                user_id=user_id, document_url="http://localhost:8000/uploads/doc.pdf",
                business_name="Test Co", status=status,
            )
            session.add(verification)
            await session.flush()
            verification_id = verification.id
    return verification_id


async def _payout(test_session_factory, owner_id, *, status="pending"):
    async with test_session_factory() as session:
        async with session.begin():
            payout = Payout(
                owner_id=owner_id, period_start=date.today() - timedelta(days=7), period_end=date.today(),
                gross_amount=Decimal("5000.00"), commission_amount=Decimal("500.00"),
                net_amount=Decimal("4500.00"), status=status,
            )
            session.add(payout)
            await session.flush()
            payout_id = payout.id
    return payout_id


async def _booking(test_session_factory, venue_id):
    slot_date = date.today() + timedelta(days=3 + uuid.uuid4().int % 500)
    async with test_session_factory() as session:
        async with session.begin():
            unit = InventoryUnit(venue_id=venue_id, date=slot_date, price=Decimal("1000.00"))
            session.add(unit)
            await session.flush()
            unit_id = unit.id
        booking, _ = await create_booking(
            session=session, inventory_unit_id=unit_id, guest_name="Guest",
            guest_email=f"guest-{uuid.uuid4().hex[:8]}@example.com",
        )
        booking_id = booking.id
    return booking_id


async def test_venues_pagination(client, test_session_factory, seeded_admin):
    owner_id = await _owner(test_session_factory)
    for _ in range(3):
        await _venue(test_session_factory, owner_id)

    page1 = await client.get("/api/v1/admin/venues", params={"limit": 2, "offset": 0}, headers=_admin_headers(seeded_admin))
    page2 = await client.get("/api/v1/admin/venues", params={"limit": 2, "offset": 2}, headers=_admin_headers(seeded_admin))
    assert len(page1.json()) == 2
    assert len(page2.json()) == 1
    assert {v["id"] for v in page1.json()}.isdisjoint({v["id"] for v in page2.json()})


async def test_users_pagination(client, test_session_factory, seeded_admin):
    for _ in range(3):
        await _owner(test_session_factory)

    page1 = await client.get("/api/v1/admin/users", params={"limit": 2, "offset": 0}, headers=_admin_headers(seeded_admin))
    page2 = await client.get("/api/v1/admin/users", params={"limit": 2, "offset": 2}, headers=_admin_headers(seeded_admin))
    assert len(page1.json()) == 2
    assert len(page2.json()) >= 1
    assert {u["id"] for u in page1.json()}.isdisjoint({u["id"] for u in page2.json()})


async def test_verifications_pagination(client, test_session_factory, seeded_admin):
    for _ in range(3):
        owner_id = await _owner(test_session_factory)
        await _verification(test_session_factory, owner_id)

    page1 = await client.get("/api/v1/admin/owner-verifications", params={"limit": 2, "offset": 0}, headers=_admin_headers(seeded_admin))
    page2 = await client.get("/api/v1/admin/owner-verifications", params={"limit": 2, "offset": 2}, headers=_admin_headers(seeded_admin))
    assert len(page1.json()) == 2
    assert len(page2.json()) == 1
    assert {v["id"] for v in page1.json()}.isdisjoint({v["id"] for v in page2.json()})


async def test_payouts_pagination(client, test_session_factory, seeded_admin):
    owner_id = await _owner(test_session_factory)
    for _ in range(3):
        await _payout(test_session_factory, owner_id)

    page1 = await client.get("/api/v1/admin/payouts", params={"limit": 2, "offset": 0}, headers=_admin_headers(seeded_admin))
    page2 = await client.get("/api/v1/admin/payouts", params={"limit": 2, "offset": 2}, headers=_admin_headers(seeded_admin))
    assert len(page1.json()) == 2
    assert len(page2.json()) == 1
    assert {p["id"] for p in page1.json()}.isdisjoint({p["id"] for p in page2.json()})


async def test_bookings_pagination(client, test_session_factory, seeded_admin):
    owner_id = await _owner(test_session_factory)
    venue_id = await _venue(test_session_factory, owner_id)
    for _ in range(3):
        await _booking(test_session_factory, venue_id)

    page1 = await client.get("/api/v1/admin/bookings", params={"limit": 2, "offset": 0}, headers=_admin_headers(seeded_admin))
    page2 = await client.get("/api/v1/admin/bookings", params={"limit": 2, "offset": 2}, headers=_admin_headers(seeded_admin))
    assert len(page1.json()) == 2
    assert len(page2.json()) == 1
    assert {b["id"] for b in page1.json()}.isdisjoint({b["id"] for b in page2.json()})


async def test_pagination_defaults_and_limits_enforced(client, seeded_admin):
    """limit is bounded (1-200) same as audit-log's own convention — a
    request for limit=0 or limit=1000 should be rejected, not silently
    clamped, since a silent clamp could mask a client bug."""
    resp_zero = await client.get("/api/v1/admin/venues", params={"limit": 0}, headers=_admin_headers(seeded_admin))
    assert resp_zero.status_code == 422

    resp_too_big = await client.get("/api/v1/admin/venues", params={"limit": 1000}, headers=_admin_headers(seeded_admin))
    assert resp_too_big.status_code == 422

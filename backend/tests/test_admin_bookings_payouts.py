"""
Two more of the same gap: GET /owner/bookings and GET /owner/payouts are
both scoped to "the caller's own venues"/"the caller's own owner_id" —
confirmed by reading list_bookings_for_owner/list_payouts_for_owner, not
assumed. An admin calling either sees nothing (they don't own venues).
Without a platform-wide list, admin/bookings/{id}/confirm-payment,
cancel-pending, and admin/payouts/{id}/mark-paid — all of which already
existed and were already tested by ID — had no way to be reached from a
real admin session at all. Found completing the Admin dashboard (Bookings/
Payouts screens weren't in this session's original four named areas, but
they're real admin routes that need real admin-facing UI before launch).
"""
import uuid
from datetime import date, timedelta
from decimal import Decimal

import httpx
import pytest

from app.db import get_db
from app.main import app
from app.models.core import InventoryUnit, Payout, User, Venue
from app.modules.auth.security import create_access_token, hash_password
from app.modules.booking.service import confirm_booking_from_webhook, create_booking


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


async def _owner(test_session_factory, *, name="Ms. Rao"):
    email = f"owner-{uuid.uuid4().hex[:8]}@example.com"
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
            session.add(venue)
            await session.flush()
            venue_id = venue.id
    return venue_id


async def _booking(test_session_factory, venue_id, *, status="pending_payment", slot_date=None):
    slot_date = slot_date or (date.today() + timedelta(days=3 + uuid.uuid4().int % 500))
    async with test_session_factory() as session:
        async with session.begin():
            unit = InventoryUnit(venue_id=venue_id, date=slot_date, price=Decimal("1000.00"))
            session.add(unit)
            await session.flush()
            unit_id = unit.id

        booking, _ = await create_booking(
            session=session,
            inventory_unit_id=unit_id,
            guest_name="Guest User",
            guest_email=f"guest-{uuid.uuid4().hex[:8]}@example.com",
        )
        booking_id = booking.id

    if status == "confirmed":
        async with test_session_factory() as session:
            await confirm_booking_from_webhook(session, booking_id)

    return booking_id


async def _payout(test_session_factory, owner_id, *, status="pending"):
    async with test_session_factory() as session:
        async with session.begin():
            payout = Payout(
                owner_id=owner_id,
                period_start=date.today() - timedelta(days=7),
                period_end=date.today(),
                gross_amount=Decimal("5000.00"),
                commission_amount=Decimal("500.00"),
                net_amount=Decimal("4500.00"),
                status=status,
            )
            session.add(payout)
            await session.flush()
            payout_id = payout.id
    return payout_id


# ---------------------------------------------------------------------------
# GET /api/v1/admin/bookings
# ---------------------------------------------------------------------------


async def test_admin_list_bookings_requires_admin_role(client, seeded_customer):
    token = create_access_token(seeded_customer, "customer")
    resp = await client.get("/api/v1/admin/bookings", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403


async def test_admin_list_bookings_spans_every_owner(client, test_session_factory, seeded_admin):
    """The gap, made concrete: GET /owner/bookings as an admin returns
    nothing (the admin owns no venues) — this route must span every
    owner's bookings."""
    owner_a = await _owner(test_session_factory, name="Owner A")
    owner_b = await _owner(test_session_factory, name="Owner B")
    venue_a = await _venue(test_session_factory, owner_a)
    venue_b = await _venue(test_session_factory, owner_b)
    booking_a = await _booking(test_session_factory, venue_a)
    booking_b = await _booking(test_session_factory, venue_b)

    resp = await client.get("/api/v1/admin/bookings", headers=_admin_headers(seeded_admin))
    assert resp.status_code == 200
    ids = {b["id"] for b in resp.json()}
    assert {str(booking_a), str(booking_b)} <= ids


async def test_admin_list_bookings_filters_by_status(client, test_session_factory, seeded_admin):
    owner_id = await _owner(test_session_factory)
    venue_id = await _venue(test_session_factory, owner_id)
    target_id = await _booking(test_session_factory, venue_id, status="pending_payment")
    await _booking(test_session_factory, venue_id, status="confirmed")

    resp = await client.get(
        "/api/v1/admin/bookings", params={"status": "pending_payment"}, headers=_admin_headers(seeded_admin)
    )
    assert resp.status_code == 200
    assert [b["id"] for b in resp.json()] == [str(target_id)]


async def test_admin_list_bookings_exposes_no_customer_identity(client, test_session_factory, seeded_admin):
    """The locked-in policy decision (list_bookings_for_owner's own
    docstring) applies here too — this is the same BookingDetail shape."""
    owner_id = await _owner(test_session_factory)
    venue_id = await _venue(test_session_factory, owner_id)
    await _booking(test_session_factory, venue_id)

    resp = await client.get("/api/v1/admin/bookings", headers=_admin_headers(seeded_admin))
    assert resp.status_code == 200
    body = resp.json()[0]
    assert "customer_id" not in body
    assert "guest_name" not in body
    assert "guest_email" not in body


async def test_admin_list_bookings_exposes_hold_expiry(client, test_session_factory, seeded_admin):
    """Without this, an admin has no way to see which pending_payment
    bookings are already past their hold window — there's no automatic
    sweep job that clears them, so this is the only visibility available."""
    owner_id = await _owner(test_session_factory)
    venue_id = await _venue(test_session_factory, owner_id)
    pending_id = await _booking(test_session_factory, venue_id, status="pending_payment")
    confirmed_id = await _booking(test_session_factory, venue_id, status="confirmed")

    resp = await client.get("/api/v1/admin/bookings", headers=_admin_headers(seeded_admin))
    assert resp.status_code == 200
    by_id = {b["id"]: b for b in resp.json()}

    assert by_id[str(pending_id)]["hold_expires_at"] is not None
    # Cleared once confirmed — same lifecycle as everywhere else in this
    # codebase that touches inventory_unit.hold_expires_at.
    assert by_id[str(confirmed_id)]["hold_expires_at"] is None


# ---------------------------------------------------------------------------
# GET /api/v1/admin/payouts
# ---------------------------------------------------------------------------


async def test_admin_list_payouts_requires_admin_role(client, seeded_customer):
    token = create_access_token(seeded_customer, "customer")
    resp = await client.get("/api/v1/admin/payouts", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403


async def test_admin_list_payouts_spans_every_owner(client, test_session_factory, seeded_admin):
    owner_a = await _owner(test_session_factory, name="Owner A")
    owner_b = await _owner(test_session_factory, name="Owner B")
    payout_a = await _payout(test_session_factory, owner_a)
    payout_b = await _payout(test_session_factory, owner_b)

    resp = await client.get("/api/v1/admin/payouts", headers=_admin_headers(seeded_admin))
    assert resp.status_code == 200
    ids = {p["id"] for p in resp.json()}
    assert {str(payout_a), str(payout_b)} <= ids


async def test_admin_list_payouts_filters_by_status(client, test_session_factory, seeded_admin):
    owner_id = await _owner(test_session_factory)
    pending_id = await _payout(test_session_factory, owner_id, status="pending")
    await _payout(test_session_factory, owner_id, status="paid")

    resp = await client.get(
        "/api/v1/admin/payouts", params={"status": "pending"}, headers=_admin_headers(seeded_admin)
    )
    assert resp.status_code == 200
    assert [p["id"] for p in resp.json()] == [str(pending_id)]


async def test_admin_list_payouts_includes_owner_identity(client, test_session_factory, seeded_admin):
    """Without this, an admin deciding who to run/mark-paid a payout for
    sees nothing but a UUID fragment — no real name to work from."""
    owner_id = await _owner(test_session_factory, name="Vikram Singh")
    await _payout(test_session_factory, owner_id)

    resp = await client.get("/api/v1/admin/payouts", headers=_admin_headers(seeded_admin))
    assert resp.status_code == 200
    body = resp.json()[0]
    assert body["owner_name"] == "Vikram Singh"
    assert "@" in body["owner_email"]

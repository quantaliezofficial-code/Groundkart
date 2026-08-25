"""
sweep_expired_holds: the automation cancel_pending_booking's own
docstring flagged as still-missing. Verifies:
1. A pending_payment booking past its hold gets released.
2. One still within its hold window is left alone.
3. A booking that's already confirmed/cancelled is left alone (only
   pending_payment is ever a sweep target).
4. The audit log entry has actor_id=None (system-triggered, not a
   specific admin).
5. The manual admin-triggered endpoint works and returns a count.
"""
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import httpx
import pytest

from app.db import get_db
from app.main import app
from app.models.core import AuditLog, Booking, InventoryUnit, User, Venue
from app.modules.auth.security import create_access_token, hash_password
from app.modules.booking.service import confirm_booking_from_webhook, create_booking, sweep_expired_holds
from sqlalchemy import select


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


async def _owner(test_session_factory):
    email = f"owner-{uuid.uuid4().hex[:8]}@example.com"
    async with test_session_factory() as session:
        async with session.begin():
            owner = User(name="Test Owner", email=email, password_hash=hash_password("whatever-1"),
                phone=f"123{uuid.uuid4().hex[:7]}", role="owner")
            session.add(owner)
            await session.flush()
            owner_id = owner.id
    return owner_id


async def _venue(test_session_factory, owner_id):
    async with test_session_factory() as session:
        async with session.begin():
            venue = Venue(
                owner_id=owner_id, name="Test Venue", slug=f"venue-{uuid.uuid4().hex[:8]}",
                category="sports", address="1 Test Rd", city="Lucknow", unit_type="hour",
                base_price=Decimal("1000.00"), status="active",
            )
            session.add(venue)
            await session.flush()
            venue_id = venue.id
    return venue_id


async def _booking_with_hold(test_session_factory, venue_id, *, hold_expires_at):
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

    # create_booking sets its own hold_expires_at (now + configured
    # duration) — overwrite it directly to simulate one that's already
    # expired or one that's comfortably still within its window.
    async with test_session_factory() as session:
        async with session.begin():
            result = await session.execute(select(InventoryUnit).where(InventoryUnit.id == unit_id))
            unit = result.scalar_one()
            unit.hold_expires_at = hold_expires_at
    return booking_id


async def test_sweep_releases_a_booking_past_its_hold(test_session_factory):
    owner_id = await _owner(test_session_factory)
    venue_id = await _venue(test_session_factory, owner_id)
    expired_id = await _booking_with_hold(
        test_session_factory, venue_id, hold_expires_at=datetime.now(timezone.utc) - timedelta(hours=1)
    )

    async with test_session_factory() as session:
        swept = await sweep_expired_holds(session)

    assert [b.id for b in swept] == [expired_id]

    async with test_session_factory() as session:
        result = await session.execute(select(Booking).where(Booking.id == expired_id))
        booking = result.scalar_one()
        assert booking.status == "cancelled"
        assert booking.cancellation_reason == "Hold expired — automatically released"


async def test_sweep_leaves_a_booking_still_within_its_hold_alone(test_session_factory):
    owner_id = await _owner(test_session_factory)
    venue_id = await _venue(test_session_factory, owner_id)
    still_pending_id = await _booking_with_hold(
        test_session_factory, venue_id, hold_expires_at=datetime.now(timezone.utc) + timedelta(hours=1)
    )

    async with test_session_factory() as session:
        swept = await sweep_expired_holds(session)

    assert swept == []

    async with test_session_factory() as session:
        result = await session.execute(select(Booking).where(Booking.id == still_pending_id))
        booking = result.scalar_one()
        assert booking.status == "pending_payment"


async def test_sweep_leaves_an_already_confirmed_booking_alone(test_session_factory):
    owner_id = await _owner(test_session_factory)
    venue_id = await _venue(test_session_factory, owner_id)
    booking_id = await _booking_with_hold(
        test_session_factory, venue_id, hold_expires_at=datetime.now(timezone.utc) - timedelta(hours=1)
    )
    async with test_session_factory() as session:
        await confirm_booking_from_webhook(session, booking_id)

    async with test_session_factory() as session:
        swept = await sweep_expired_holds(session)

    assert swept == []


async def test_sweep_audit_log_has_no_actor_system_triggered(test_session_factory):
    owner_id = await _owner(test_session_factory)
    venue_id = await _venue(test_session_factory, owner_id)
    expired_id = await _booking_with_hold(
        test_session_factory, venue_id, hold_expires_at=datetime.now(timezone.utc) - timedelta(hours=1)
    )

    async with test_session_factory() as session:
        await sweep_expired_holds(session)

    async with test_session_factory() as session:
        result = await session.execute(
            select(AuditLog).where(AuditLog.entity_id == expired_id, AuditLog.entity_type == "booking")
        )
        entry = result.scalar_one()
        assert entry.actor_id is None


async def test_manual_sweep_endpoint_requires_admin(client, seeded_customer):
    token = create_access_token(seeded_customer, "customer")
    resp = await client.post(
        "/api/v1/admin/bookings/sweep-expired-holds", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 403


async def test_manual_sweep_endpoint_returns_count(client, test_session_factory, seeded_admin):
    owner_id = await _owner(test_session_factory)
    venue_id = await _venue(test_session_factory, owner_id)
    await _booking_with_hold(
        test_session_factory, venue_id, hold_expires_at=datetime.now(timezone.utc) - timedelta(hours=1)
    )
    await _booking_with_hold(
        test_session_factory, venue_id, hold_expires_at=datetime.now(timezone.utc) - timedelta(hours=2)
    )
    await _booking_with_hold(
        test_session_factory, venue_id, hold_expires_at=datetime.now(timezone.utc) + timedelta(hours=1)
    )

    resp = await client.post("/api/v1/admin/bookings/sweep-expired-holds", headers=_admin_headers(seeded_admin))
    assert resp.status_code == 200
    assert resp.json()["swept"] == 2

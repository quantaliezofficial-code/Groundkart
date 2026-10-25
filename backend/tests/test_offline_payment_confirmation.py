"""
Decision Point C-5/C-6: payment is confirmed offline by an admin, not by a
Razorpay webhook (skipped entirely for now, per explicit client direction).
These tests exercise confirm_booking_by_admin and cancel_pending_booking
through real HTTP, plus the configurable HOLD_DURATION that replaced the
original hardcoded 10 minutes.
"""
import uuid
from datetime import datetime, timedelta, timezone

import httpx
import pytest
from sqlalchemy import select

from app.config import settings
from app.db import get_db, get_idem_db
from app.main import app
from app.models.core import AuditLog, InventoryUnit, Payment
from app.modules.auth.security import create_access_token


@pytest.fixture
async def client(test_session_factory):
    async def _override_get_db():
        async with test_session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_idem_db] = _override_get_db

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


async def _create_booking(client, unit_id) -> dict:
    resp = await client.post(
        "/api/v1/bookings",
        json={
            "inventory_unit_id": str(unit_id),
            "guest_name": "Raj Kumar",
            "guest_email": "raj@example.com",
        },
    )
    assert resp.status_code == 201
    return resp.json()


async def test_admin_confirms_offline_payment(
    client, test_session_factory, seeded_admin, seeded_unit
):
    created = await _create_booking(client, seeded_unit)
    admin_token = create_access_token(seeded_admin, "admin")

    resp = await client.post(
        f"/api/v1/admin/bookings/{created['booking_id']}/confirm-payment",
        json={"amount": "2000.00", "method": "upi", "reference": "UPI-TXN-123"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "confirmed"
    assert body["confirmed_at"] is not None
    assert body["grace_period_ends_at"] is not None

    async with test_session_factory() as session:
        payments = (
            await session.execute(
                select(Payment).where(Payment.booking_id == uuid.UUID(created["booking_id"]))
            )
        ).scalars().all()
        assert len(payments) == 1
        assert payments[0].gateway == "offline"
        assert payments[0].status == "success"
        assert payments[0].method == "upi"
        assert payments[0].gateway_payment_id is None

        unit = await session.get(InventoryUnit, seeded_unit)
        assert unit.status == "booked"

        logs = (
            await session.execute(
                select(AuditLog).where(AuditLog.entity_id == uuid.UUID(created["booking_id"]))
            )
        ).scalars().all()
        assert len(logs) == 1
        assert logs[0].action == "booking.payment_confirmed_offline"
        assert logs[0].actor_id == seeded_admin


async def test_non_admin_cannot_confirm_payment(client, seeded_owner_with_unit):
    owner_id, _, unit_id = seeded_owner_with_unit
    created = await _create_booking(client, unit_id)
    owner_token = create_access_token(owner_id, "owner")  # owner, not admin

    resp = await client.post(
        f"/api/v1/admin/bookings/{created['booking_id']}/confirm-payment",
        json={"amount": "2000.00", "method": "cash"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert resp.status_code == 403


async def test_wrong_amount_is_rejected(client, seeded_admin, seeded_unit):
    created = await _create_booking(client, seeded_unit)
    admin_token = create_access_token(seeded_admin, "admin")

    resp = await client.post(
        f"/api/v1/admin/bookings/{created['booking_id']}/confirm-payment",
        json={"amount": "1500.00", "method": "cash"},  # booking is 2000.00
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 422


async def test_confirming_twice_is_rejected_not_double_recorded(
    client, test_session_factory, seeded_admin, seeded_unit
):
    """A human double-clicking 'confirm' must not silently create two
    Payment rows for one booking."""
    created = await _create_booking(client, seeded_unit)
    admin_token = create_access_token(seeded_admin, "admin")

    first = await client.post(
        f"/api/v1/admin/bookings/{created['booking_id']}/confirm-payment",
        json={"amount": "2000.00", "method": "cash"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    second = await client.post(
        f"/api/v1/admin/bookings/{created['booking_id']}/confirm-payment",
        json={"amount": "2000.00", "method": "cash"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert first.status_code == 200
    assert second.status_code == 409

    async with test_session_factory() as session:
        payments = (
            await session.execute(
                select(Payment).where(Payment.booking_id == uuid.UUID(created["booking_id"]))
            )
        ).scalars().all()
        assert len(payments) == 1


async def test_confirming_a_cancelled_booking_is_rejected(
    client, seeded_admin, seeded_unit
):
    created = await _create_booking(client, seeded_unit)
    admin_token = create_access_token(seeded_admin, "admin")

    await client.post(
        f"/api/v1/admin/bookings/{created['booking_id']}/cancel-pending",
        json={"reason": "Deal fell through"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    resp = await client.post(
        f"/api/v1/admin/bookings/{created['booking_id']}/confirm-payment",
        json={"amount": "2000.00", "method": "cash"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 409


async def test_admin_cancel_pending_releases_the_slot(
    client, test_session_factory, seeded_admin, seeded_unit
):
    created = await _create_booking(client, seeded_unit)
    admin_token = create_access_token(seeded_admin, "admin")

    resp = await client.post(
        f"/api/v1/admin/bookings/{created['booking_id']}/cancel-pending",
        json={"reason": "Customer went quiet, releasing the slot"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"
    assert "went quiet" in resp.json()["cancellation_reason"]

    async with test_session_factory() as session:
        unit = await session.get(InventoryUnit, seeded_unit)
        assert unit.status == "available"
        assert unit.hold_expires_at is None

        logs = (
            await session.execute(
                select(AuditLog).where(AuditLog.entity_id == uuid.UUID(created["booking_id"]))
            )
        ).scalars().all()
        assert any(log.action == "booking.pending_request_cancelled" for log in logs)


async def test_cancel_pending_a_confirmed_booking_is_rejected(client, seeded_admin, seeded_unit):
    """Confirmed bookings have real money attached — they go through
    flag_booking (owner-initiated) or the still-unbuilt customer
    cancellation path, never this one."""
    created = await _create_booking(client, seeded_unit)
    admin_token = create_access_token(seeded_admin, "admin")
    await client.post(
        f"/api/v1/admin/bookings/{created['booking_id']}/confirm-payment",
        json={"amount": "2000.00", "method": "cash"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    resp = await client.post(
        f"/api/v1/admin/bookings/{created['booking_id']}/cancel-pending",
        json={"reason": "Trying to cancel an already-confirmed booking"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 409


async def test_non_admin_cannot_cancel_pending_booking(client, seeded_owner_with_unit):
    owner_id, _, unit_id = seeded_owner_with_unit
    created = await _create_booking(client, unit_id)
    owner_token = create_access_token(owner_id, "owner")

    resp = await client.post(
        f"/api/v1/admin/bookings/{created['booking_id']}/cancel-pending",
        json={"reason": "Not an admin"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert resp.status_code == 403


async def test_grace_period_computed_correctly_through_admin_confirm_path(
    client, test_session_factory, seeded_admin, seeded_unit
):
    """Proves the shared _apply_payment_confirmation helper actually gets
    exercised correctly through this new caller, not just through the
    dormant webhook path Phase B originally tested. seeded_unit's slot
    (2027-08-15) is roughly six weeks out from whenever this test actually
    runs — far past Decision Point B-1's 2-hour cap threshold — so the CAP
    should NOT bind here: min(confirmed_at + 2h, slot_start_6_weeks_away)
    is just confirmed_at + 2h. This is the real-world case for a booking
    made well ahead of its date; the cap-binds-when-close-to-slot-start
    case is the one Phase B's own validation already covered directly
    against compute_grace_period_ends_at() as a pure function — this test
    isn't re-proving that math, it's proving this new HTTP caller reaches
    the same shared function with the right arguments at all.
    """
    created = await _create_booking(client, seeded_unit)
    admin_token = create_access_token(seeded_admin, "admin")

    resp = await client.post(
        f"/api/v1/admin/bookings/{created['booking_id']}/confirm-payment",
        json={"amount": "2000.00", "method": "bank_transfer"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    body = resp.json()
    confirmed_at = datetime.fromisoformat(body["confirmed_at"])
    grace_ends = datetime.fromisoformat(body["grace_period_ends_at"])

    expected = confirmed_at + timedelta(hours=2)
    assert abs((grace_ends - expected).total_seconds()) < 1


async def test_hold_duration_is_configurable_not_hardcoded_ten_minutes(
    client, test_session_factory, seeded_unit
):
    """Decision Point C-5 & Phase 0 Hardening: HOLD_DURATION must reflect
    the system configuration default of 30 minutes (1800s), not the legacy 1440m or hardcoded 10m."""
    before = datetime.now(timezone.utc)
    created = await _create_booking(client, seeded_unit)
    assert created["expires_in"] == 30 * 60
    assert created["expires_in"] != 600, "expires_in must not silently be the old 10-minute default"

    async with test_session_factory() as session:
        unit = await session.get(InventoryUnit, seeded_unit)
        expected_expiry = before + timedelta(minutes=30)
        # Allow a few seconds of slack for test execution time.
        assert abs((unit.hold_expires_at - expected_expiry).total_seconds()) < 5

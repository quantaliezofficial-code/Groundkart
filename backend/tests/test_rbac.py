"""
The flag-booking route is flag_booking()'s first real caller (Phase B wrote
the function with no way to get an authenticated owner_id from an HTTP
request — see PHASE_C_SUMMARY.md). These tests exercise the full path:
real JWT -> require_role -> flag_booking()'s own venue-ownership check.
"""
from datetime import datetime, timezone

import pytest
import pytest_asyncio

from app.db import get_db, get_idem_db
from app.main import app
from app.modules.auth.security import create_access_token
from app.modules.booking.service import confirm_booking_from_webhook, create_booking


@pytest_asyncio.fixture
async def client(test_session_factory):
    async def _override_get_db():
        async with test_session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_idem_db] = _override_get_db

    import httpx

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


async def _confirmed_booking_id(test_session_factory, unit_id):
    """Helper: take a unit through create -> confirm, the same path a real
    payment webhook would, so the booking actually has confirmed_at/
    grace_period_ends_at set (flag_booking requires both)."""
    async with test_session_factory() as session:
        booking, _ = await create_booking(
            session=session,
            inventory_unit_id=unit_id,
            guest_name="Raj Kumar",
            guest_email="raj@example.com",
        )
        booking_id = booking.id

    async with test_session_factory() as session:
        await confirm_booking_from_webhook(session, booking_id)

    return booking_id


async def test_owner_can_flag_their_own_booking(client, test_session_factory, seeded_owner_with_unit):
    owner_id, owner_email, unit_id = seeded_owner_with_unit
    booking_id = await _confirmed_booking_id(test_session_factory, unit_id)

    token = create_access_token(owner_id, "owner")
    resp = await client.post(
        f"/api/v1/bookings/{booking_id}/flag",
        json={"reason": "Calendar sync error — this slot is actually double-booked offline."},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "under_admin_review"


async def test_a_different_owner_gets_403(client, test_session_factory, seeded_owner_with_unit):
    """The exact bug caught and fixed during Phase B: comparing venue_id to
    owner_id directly would have let ANY owner through. This proves the fix
    (comparing booking.venue.owner_id) actually rejects the wrong owner."""
    _, _, unit_id = seeded_owner_with_unit
    booking_id = await _confirmed_booking_id(test_session_factory, unit_id)

    import uuid

    someone_elses_owner_id = uuid.uuid4()
    token = create_access_token(someone_elses_owner_id, "owner")
    resp = await client.post(
        f"/api/v1/bookings/{booking_id}/flag",
        json={"reason": "Trying to flag a booking that isn't mine"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


async def test_customer_role_gets_403_before_even_reaching_the_booking(
    client, test_session_factory, seeded_owner_with_unit
):
    """require_role('owner', 'admin') should reject a customer token before
    flag_booking() is ever called — RBAC at the route layer, not just
    inside the service function."""
    _, _, unit_id = seeded_owner_with_unit
    booking_id = await _confirmed_booking_id(test_session_factory, unit_id)

    import uuid

    token = create_access_token(uuid.uuid4(), "customer")
    resp = await client.post(
        f"/api/v1/bookings/{booking_id}/flag",
        json={"reason": "A customer should never be able to do this"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


async def test_no_auth_header_gets_401(client, test_session_factory, seeded_owner_with_unit):
    _, _, unit_id = seeded_owner_with_unit
    booking_id = await _confirmed_booking_id(test_session_factory, unit_id)

    resp = await client.post(
        f"/api/v1/bookings/{booking_id}/flag",
        json={"reason": "No token at all"},
    )
    assert resp.status_code == 401


async def test_past_grace_window_returns_410(client, test_session_factory, seeded_owner_with_unit):
    owner_id, _, unit_id = seeded_owner_with_unit
    booking_id = await _confirmed_booking_id(test_session_factory, unit_id)

    # Force the grace window into the past, simulating time having passed —
    # exercises 07_design.md §5.5's "grace_period_expired" / 410 path.
    from sqlalchemy import update as sa_update

    from app.models.core import Booking

    async with test_session_factory() as session:
        async with session.begin():
            await session.execute(
                sa_update(Booking)
                .where(Booking.id == booking_id)
                .values(grace_period_ends_at=datetime.now(timezone.utc).replace(year=2020))
            )

    token = create_access_token(owner_id, "owner")
    resp = await client.post(
        f"/api/v1/bookings/{booking_id}/flag",
        json={"reason": "Too late now"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 410


async def test_flag_booking_now_also_records_refund_amount(
    client, test_session_factory, seeded_owner_with_unit, seeded_admin
):
    """Phase 0 hardening (Finding B6): flag_booking moves the booking to
    under_admin_review and creates a pending BookingActionRequest instead of
    executing an immediate unreviewed refund. When an admin processes and approves
    the action request, the refund is executed and payment.refund_amount is recorded."""
    from decimal import Decimal

    from sqlalchemy import select

    from app.models.core import Payment

    owner_id, _, unit_id = seeded_owner_with_unit
    booking_id = await _confirmed_booking_id(test_session_factory, unit_id)

    async with test_session_factory() as session:
        async with session.begin():
            session.add(Payment(booking_id=booking_id, amount=Decimal("2000.00"), status="success"))

    token = create_access_token(owner_id, "owner")
    resp = await client.post(
        f"/api/v1/bookings/{booking_id}/flag",
        json={"reason": "Owner double-booked this slot"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "under_admin_review"

    # Prior to admin approval, payment remains success
    async with test_session_factory() as session:
        payment = (
            await session.execute(select(Payment).where(Payment.booking_id == booking_id))
        ).scalar_one()
        assert payment.status == "success"

    # Admin lists pending booking action requests and processes this one
    admin_token = create_access_token(seeded_admin, "admin")
    actions_resp = await client.get(
        "/api/v1/admin/booking-actions?status=pending",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert actions_resp.status_code == 200
    actions = actions_resp.json()
    action = next(a for a in actions if a["booking_id"] == str(booking_id))
    assert action["action_type"] == "cancel"

    # Process and approve
    proc_resp = await client.post(
        f"/api/v1/admin/booking-actions/{action['id']}/process",
        json={"decision": "approved", "decision_reason": "Verified double booking"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert proc_resp.status_code == 200

    async with test_session_factory() as session:
        payment = (
            await session.execute(select(Payment).where(Payment.booking_id == booking_id))
        ).scalar_one()
        assert payment.status == "refunded"
        assert payment.refund_amount == Decimal("2000.00")


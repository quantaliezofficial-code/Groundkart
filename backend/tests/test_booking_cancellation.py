import uuid
"""
Customer-initiated cancellation of a *confirmed* booking — the gap named
explicitly in PHASE_C5_SUMMARY.md and PHASE_C6_SUMMARY.md's remaining-work
lists: flag_booking() (owner, always 100%) and cancel_pending_booking()
(admin, unpaid requests only) both existed; a customer cancelling a
booking they already paid for, with the standard distance-from-event
refund tiers, did not.

Decision Point C-7 (flag for explicit sign-off — see the phase summary
doc): no doc anywhere specifies the actual tier cutoffs/percentages, only
one hedged "e.g." example in 03_Implementation_Plan.md. The exhaustive,
deterministic tier-math tests live in test_refund_tiers.py; this file
proves the HTTP wiring — auth, ownership, status guards, the manage-token
guest path — reaches that math correctly end to end. Tier boundary cases
here use a real Postgres row forced to a time relative to "now" at
whatever moment the suite actually runs (see _force_unit_hours_from_now),
which is fine for proving the wiring reaches the right tier, but is not
where the exact-boundary proof lives — that's test_refund_tiers.py, on
purpose, for the same reason PHASE_C6_SUMMARY.md §4 cut a similarly-shaped
relative-time HTTP test for the grace period: constructing date/start_time
from one single consistent instant (as _force_unit_hours_from_now does
below) avoids the midnight-crossing fragility that test ran into, but
"prove the wiring reaches tier X" and "prove the exact boundary is at
hour Y" are still two different claims worth keeping in two different
places.
"""
from datetime import datetime, timedelta, timezone

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy import update as sa_update

from app.db import get_db, get_idem_db
from app.main import app
from app.models.core import Booking, InventoryUnit, Payment
from app.modules.auth.security import create_access_token
from app.modules.booking.service import VENUE_LOCAL_TZ, confirm_booking_from_webhook, create_booking


@pytest_asyncio.fixture
async def client(test_session_factory, clean_tables):
    async def _override_get_db():
        async with test_session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_idem_db] = _override_get_db

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


async def _confirmed_account_booking(test_session_factory, unit_id, customer_id):
    async with test_session_factory() as session:
        booking, _ = await create_booking(session=session, inventory_unit_id=unit_id, customer_id=customer_id)
        booking_id = booking.id
        amount = booking.amount
    async with test_session_factory() as session:
        await confirm_booking_from_webhook(session, booking_id)
    await _seed_successful_payment(test_session_factory, booking_id, amount)
    return booking_id


async def _confirmed_guest_booking(test_session_factory, unit_id) -> tuple:
    async with test_session_factory() as session:
        booking, raw_token = await create_booking(
            session=session, inventory_unit_id=unit_id,
            guest_name="Raj Kumar", guest_email="raj@example.com",
        )
        booking_id = booking.id
        amount = booking.amount
    async with test_session_factory() as session:
        await confirm_booking_from_webhook(session, booking_id)
    await _seed_successful_payment(test_session_factory, booking_id, amount)
    return booking_id, raw_token


async def _seed_successful_payment(test_session_factory, booking_id, amount):
    """confirm_booking_from_webhook is deliberately a bare status-flip
    shortcut (see its docstring — never took payment details to begin
    with), so it creates no Payment row. Real confirmed bookings always
    have one (confirm_booking_by_admin creates it as part of confirming);
    this fills that same gap for tests that — unlike test_rbac.py's
    existing flag_booking tests — actually need a real payment row to
    refund against."""
    async with test_session_factory() as session:
        async with session.begin():
            session.add(Payment(booking_id=booking_id, amount=amount, status="success"))


async def _force_unit_hours_from_now(test_session_factory, unit_id, hours_from_now: float):
    """Moves the unit's (date, start_time) so its IST start instant sits
    `hours_from_now` from the moment this executes, derived from one
    single instant so date/start_time can never disagree with each other
    around a midnight boundary. end_time is set to NULL rather than
    start_time + 1h specifically to avoid a second, independent
    midnight-crossing risk on the end side, which does not matter here —
    compute_refund_fraction never reads end_time."""
    target = datetime.now(VENUE_LOCAL_TZ) + timedelta(hours=hours_from_now)
    async with test_session_factory() as session:
        async with session.begin():
            await session.execute(
                sa_update(InventoryUnit)
                .where(InventoryUnit.id == unit_id)
                .values(date=target.date(), start_time=target.time().replace(microsecond=0), end_time=None)
            )


async def _payment_for(test_session_factory, booking_id) -> Payment:
    async with test_session_factory() as session:
        result = await session.execute(select(Payment).where(Payment.booking_id == booking_id))
        return result.scalar_one()


# ---------------------------------------------------------------------------
# Account-holder path: POST /api/v1/bookings/{id}/cancel
# ---------------------------------------------------------------------------

async def test_customer_cancels_own_confirmed_booking_full_refund(
    client, test_session_factory, seeded_customer, seeded_unit
):
    """seeded_unit defaults to 2027-08-15 — comfortably past the 48h
    cutoff no matter when this suite runs, so this is the "no forcing
    needed" full-refund case."""
    booking_id = await _confirmed_account_booking(test_session_factory, seeded_unit, seeded_customer)
    token = create_access_token(seeded_customer, "customer")

    resp = await client.post(
        f"/api/v1/bookings/{booking_id}/cancel",
        json={"reason": "Change of plans"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "refunded"
    assert body["refund_tier"] == "full_refund"
    assert body["refund_amount"] == "2000.00"
    assert body["cancellation_reason"] == "Change of plans"

    async with test_session_factory() as session:
        booking = (await session.execute(select(Booking).where(Booking.id == booking_id))).scalar_one()
        unit = (await session.execute(select(InventoryUnit).where(InventoryUnit.id == seeded_unit))).scalar_one()
        assert booking.status == "refunded"
        assert booking.cancelled_at is not None
        assert unit.status == "available"

    payment = await _payment_for(test_session_factory, booking_id)
    assert payment.status == "refunded"
    assert payment.refund_amount == body["refund_amount"] or str(payment.refund_amount) == "2000.00"


async def test_customer_cancel_partial_refund_tier(client, test_session_factory, seeded_customer, seeded_unit):
    await _force_unit_hours_from_now(test_session_factory, seeded_unit, 30)  # inside 24-48h window
    booking_id = await _confirmed_account_booking(test_session_factory, seeded_unit, seeded_customer)
    token = create_access_token(seeded_customer, "customer")

    resp = await client.post(
        f"/api/v1/bookings/{booking_id}/cancel",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["refund_tier"] == "partial_refund"
    assert body["refund_amount"] == "1000.00"  # 50% of the seeded 2000.00 unit price

    payment = await _payment_for(test_session_factory, booking_id)
    assert str(payment.refund_amount) == "1000.00"


async def test_customer_cancel_no_refund_tier_still_succeeds(
    client, test_session_factory, seeded_customer, seeded_unit
):
    """Zero refund is still a successful cancellation, not an error — the
    policy was applied, it just yielded ₹0. 05_App_Flow.md's state diagram
    has exactly one modeled path from cancelled, to refunded; there's no
    separate terminal state for "cancelled with nothing owed.\""""
    await _force_unit_hours_from_now(test_session_factory, seeded_unit, 10)  # inside the no-refund window
    booking_id = await _confirmed_account_booking(test_session_factory, seeded_unit, seeded_customer)
    token = create_access_token(seeded_customer, "customer")

    resp = await client.post(
        f"/api/v1/bookings/{booking_id}/cancel",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["refund_tier"] == "no_refund"
    assert body["refund_amount"] == "0.00"
    assert body["status"] == "refunded"  # still terminates here, per the docstring above

    payment = await _payment_for(test_session_factory, booking_id)
    assert payment.status == "refunded"
    assert str(payment.refund_amount) == "0.00"


async def test_different_customer_gets_404_not_403(client, test_session_factory, seeded_customer, seeded_unit):
    """Same PII-leak-avoidance property Implementation Plan Phase 0 item #3
    named, already tested for GET /bookings/{id} in
    test_booking_retrieval.py — applied again here on purpose, not by
    coincidence, per that file's own stated philosophy."""
    booking_id = await _confirmed_account_booking(test_session_factory, seeded_unit, seeded_customer)

    async with test_session_factory() as session:
        from app.models.core import User
        from app.modules.auth.security import hash_password
        stranger = User(
            name="Someone Else", email="stranger@example.com",
                phone=f"123{uuid.uuid4().hex[:7]}",
            password_hash=hash_password("whatever-password"), role="customer",
        )
        session.add(stranger)
        await session.flush()
        stranger_id = stranger.id
        await session.commit()

    token = create_access_token(stranger_id, "customer")
    resp = await client.post(
        f"/api/v1/bookings/{booking_id}/cancel",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


async def test_admin_token_gets_403_not_this_customer_route(
    client, test_session_factory, seeded_customer, seeded_unit, seeded_admin
):
    """Deliberate scope boundary, tested rather than left as a comment —
    same treatment PHASE_C5_SUMMARY.md gave the owner/customer-booking
    boundary. Role-gated at the route (require_role("customer"), matching
    flag/confirm-payment/cancel-pending's existing pattern for
    state-changing actions) rather than the read path's 404-not-403 —
    an admin already has read access to any booking via GET
    /bookings/{id}, so there's no enumeration concern left to hide behind
    a 404 here the way there is for a random guessing stranger. An admin
    cancelling on a customer's behalf over a support call is a real,
    reasonable future need, but a different one (and easy to add later on
    top of the same _apply_customer_cancellation helper); not built here."""
    booking_id = await _confirmed_account_booking(test_session_factory, seeded_unit, seeded_customer)
    token = create_access_token(seeded_admin, "admin")
    resp = await client.post(
        f"/api/v1/bookings/{booking_id}/cancel",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


async def test_cannot_cancel_a_pending_payment_booking_via_this_route(
    client, test_session_factory, seeded_customer, seeded_unit
):
    """Deliberately only valid on 'confirmed' — matches
    cancel_pending_booking()'s own docstring: mixing "cancel a request
    that was never paid for" and "cancel a booking real money was already
    collected for" blurs two different operations."""
    async with test_session_factory() as session:
        booking, _ = await create_booking(
            session=session, inventory_unit_id=seeded_unit, customer_id=seeded_customer
        )
        booking_id = booking.id

    token = create_access_token(seeded_customer, "customer")
    resp = await client.post(
        f"/api/v1/bookings/{booking_id}/cancel",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 409


async def test_cannot_cancel_an_already_cancelled_booking_twice(
    client, test_session_factory, seeded_customer, seeded_unit
):
    booking_id = await _confirmed_account_booking(test_session_factory, seeded_unit, seeded_customer)
    token = create_access_token(seeded_customer, "customer")

    first = await client.post(
        f"/api/v1/bookings/{booking_id}/cancel", headers={"Authorization": f"Bearer {token}"}
    )
    assert first.status_code == 200

    second = await client.post(
        f"/api/v1/bookings/{booking_id}/cancel", headers={"Authorization": f"Bearer {token}"}
    )
    assert second.status_code == 409


async def test_owner_flagged_booking_cannot_then_be_cancelled_by_customer(
    client, test_session_factory, seeded_customer, seeded_owner_with_unit
):
    """flag_booking() already took this booking to its terminal 'refunded'
    state; this route must not re-process it a second time through a
    different door."""
    from app.modules.booking.service import flag_booking

    owner_id, _, unit_id = seeded_owner_with_unit
    booking_id = await _confirmed_account_booking(test_session_factory, unit_id, seeded_customer)

    from app.modules.auth.dependencies import CurrentUser
    async with test_session_factory() as session:
        viewer = CurrentUser(id=owner_id, role="owner")
        await flag_booking(session, booking_id, owner_id, reason="Double-booked by mistake")

    token = create_access_token(seeded_customer, "customer")
    resp = await client.post(
        f"/api/v1/bookings/{booking_id}/cancel", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 409


async def test_anonymous_request_to_cancel_gets_401(client, test_session_factory, seeded_customer, seeded_unit):
    booking_id = await _confirmed_account_booking(test_session_factory, seeded_unit, seeded_customer)
    resp = await client.post(f"/api/v1/bookings/{booking_id}/cancel")
    assert resp.status_code == 401


async def test_reason_is_optional(client, test_session_factory, seeded_customer, seeded_unit):
    booking_id = await _confirmed_account_booking(test_session_factory, seeded_unit, seeded_customer)
    token = create_access_token(seeded_customer, "customer")
    resp = await client.post(
        f"/api/v1/bookings/{booking_id}/cancel", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200
    assert resp.json()["cancellation_reason"] is None


# ---------------------------------------------------------------------------
# Guest path: POST /api/v1/bookings/manage/{token}/cancel
# ---------------------------------------------------------------------------

async def test_guest_cancels_via_manage_token(client, test_session_factory, seeded_unit):
    booking_id, raw_token = await _confirmed_guest_booking(test_session_factory, seeded_unit)

    resp = await client.post(f"/api/v1/bookings/manage/{raw_token}/cancel", json={"reason": "No longer needed"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "refunded"
    assert body["refund_tier"] == "full_refund"
    assert body["refund_amount"] == "2000.00"

    async with test_session_factory() as session:
        booking = (await session.execute(select(Booking).where(Booking.id == booking_id))).scalar_one()
        assert booking.status == "refunded"


async def test_wrong_manage_token_gets_404(client, test_session_factory, seeded_unit):
    await _confirmed_guest_booking(test_session_factory, seeded_unit)
    resp = await client.post("/api/v1/bookings/manage/not-the-real-token/cancel")
    assert resp.status_code == 404


async def test_guest_cancel_route_requires_no_auth_header_at_all(client, test_session_factory, seeded_unit):
    """Same property test_booking_retrieval.py proves for the GET
    equivalent — the manage token itself is this guest's entire
    authentication; no Authorization header should ever be required."""
    booking_id, raw_token = await _confirmed_guest_booking(test_session_factory, seeded_unit)
    resp = await client.post(f"/api/v1/bookings/manage/{raw_token}/cancel")
    assert resp.status_code == 200


async def test_guest_cancel_reason_optional_empty_body(client, test_session_factory, seeded_unit):
    booking_id, raw_token = await _confirmed_guest_booking(test_session_factory, seeded_unit)
    resp = await client.post(f"/api/v1/bookings/manage/{raw_token}/cancel")
    assert resp.status_code == 200
    assert resp.json()["cancellation_reason"] is None

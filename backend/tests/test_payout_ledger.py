"""
Owner payout ledger — HANDOFF.md §7's #1 remaining item after
PHASE_C7_SUMMARY.md resolved customer-initiated cancellation.
06_Backend_Schema.md §4 lists `payouts` as a one-line summary
(`owner_id`, `period_start/end`, `gross_amount`, `commission_amount`,
`net_amount`, `status`) with no full DDL, no status enum, no commission
rate, and — per the ERD in §2 — no relationship at all back to
bookings/payments, despite 07_design.md §4 describing it as "one row per
owner per settlement period" (necessarily an aggregate of many). Decision
Points C-10/C-11/C-12 in the phase summary doc for this slice cover the
full reasoning; this file proves the HTTP wiring end to end.
"""
import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal

import httpx
import pytest

from app.db import get_db, get_idem_db
from app.main import app
from app.models.core import InventoryUnit, Payment, User, Venue
from app.modules.auth.security import create_access_token, hash_password
from app.modules.booking.service import VENUE_LOCAL_TZ, confirm_booking_from_webhook, create_booking

# The service validates period_end against the real current date (IST) —
# anchoring test dates on that same reference, not an arbitrary fixed
# date, avoids the "past" date turning out to still be in the future
# relative to whenever this suite actually runs.
TODAY = datetime.now(VENUE_LOCAL_TZ).date()


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


async def _seeded_owner(test_session_factory):
    """A fresh owner + one venue, no units yet — callers add whatever
    past-dated units/bookings/payments a given test needs. Deliberately
    not reusing conftest.py's seeded_owner_with_unit: that fixture's unit
    is fixed far in the future (2027-08-15), the opposite of what payout
    eligibility needs (Decision Point C-11 — only past-dated slots)."""
    owner_email = f"owner-{uuid.uuid4().hex[:8]}@example.com"
    async with test_session_factory() as session:
        async with session.begin():
            owner = User(name="Ms. Verma", email=owner_email, password_hash=hash_password("whatever-1"),
                phone=f"123{uuid.uuid4().hex[:7]}", role="owner")
            session.add(owner)
            await session.flush()
            venue = Venue(
                owner_id=owner.id, name="Verma Farmhouse", slug=f"verma-farmhouse-{uuid.uuid4().hex[:8]}",
                category="farmhouse", address="1 Canal Road", city="Lucknow",
                unit_type="full_day", base_price=Decimal("2000.00"), status="active",
            )
            session.add(venue)
            await session.flush()
            owner_id, venue_id = owner.id, venue.id
    return owner_id, venue_id


async def _confirmed_booking_with_payment(
    test_session_factory, venue_id, *, slot_date: date, amount=Decimal("2000.00"), refund_amount=None,
):
    """Creates a past-dated unit, books it as a guest, confirms it, and
    seeds a real Payment row — same _seed_successful_payment reasoning as
    test_booking_cancellation.py: confirm_booking_from_webhook is a bare
    status-flip shortcut that creates no Payment row on its own."""
    async with test_session_factory() as session:
        async with session.begin():
            unit = InventoryUnit(venue_id=venue_id, date=slot_date, start_time=None, end_time=None, price=amount)
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

    payment_status = "refunded" if refund_amount is not None else "success"
    async with test_session_factory() as session:
        async with session.begin():
            session.add(Payment(
                booking_id=booking_id, amount=amount, status=payment_status, refund_amount=refund_amount,
            ))
    return booking_id


def _run_payload(owner_id, days_start=30, days_end=1):
    return {
        "owner_id": str(owner_id),
        "period_start": str(TODAY - timedelta(days=days_start)),
        "period_end": str(TODAY - timedelta(days=days_end)),
    }


# ---------------------------------------------------------------------------
# POST /api/v1/admin/payouts/run
# ---------------------------------------------------------------------------

async def test_run_payout_aggregates_two_bookings_correctly(client, test_session_factory, seeded_admin):
    owner_id, venue_id = await _seeded_owner(test_session_factory)
    await _confirmed_booking_with_payment(
        test_session_factory, venue_id, slot_date=TODAY - timedelta(days=10), amount=Decimal("2000.00")
    )
    await _confirmed_booking_with_payment(
        test_session_factory, venue_id, slot_date=TODAY - timedelta(days=5), amount=Decimal("3000.00")
    )

    token = create_access_token(seeded_admin, "admin")
    resp = await client.post(
        "/api/v1/admin/payouts/run", json=_run_payload(owner_id), headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["gross_amount"] == "5000.00"
    assert body["commission_amount"] == "500.00"
    assert body["net_amount"] == "4500.00"
    assert body["status"] == "pending"
    assert body["owner_id"] == str(owner_id)


async def test_run_payout_uses_retained_amount_for_a_partial_refund(client, test_session_factory, seeded_admin):
    """Decision Point C-11's core claim: gross is what the platform
    actually retained (amount minus refund_amount), not the pre-refund
    booking price — otherwise a partially-refunded booking would either
    overpay the owner (counting the full price) or underpay them (0,
    treating any refund as disqualifying)."""
    owner_id, venue_id = await _seeded_owner(test_session_factory)
    await _confirmed_booking_with_payment(
        test_session_factory, venue_id, slot_date=TODAY - timedelta(days=10),
        amount=Decimal("2000.00"), refund_amount=Decimal("1000.00"),  # 50% partial refund
    )

    token = create_access_token(seeded_admin, "admin")
    resp = await client.post(
        "/api/v1/admin/payouts/run", json=_run_payload(owner_id), headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200
    assert resp.json()["gross_amount"] == "1000.00"  # retained, not the original 2000


async def test_run_payout_excludes_a_fully_refunded_booking_but_still_marks_it_processed(
    client, test_session_factory, seeded_admin
):
    owner_id, venue_id = await _seeded_owner(test_session_factory)
    zero_booking_id = await _confirmed_booking_with_payment(
        test_session_factory, venue_id, slot_date=TODAY - timedelta(days=10),
        amount=Decimal("2000.00"), refund_amount=Decimal("2000.00"),  # 100% refund, nothing retained
    )
    await _confirmed_booking_with_payment(
        test_session_factory, venue_id, slot_date=TODAY - timedelta(days=8), amount=Decimal("1000.00")
    )

    token = create_access_token(seeded_admin, "admin")
    resp = await client.post(
        "/api/v1/admin/payouts/run", json=_run_payload(owner_id), headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200
    payout_id = resp.json()["id"]
    assert resp.json()["gross_amount"] == "1000.00"  # only the non-refunded booking

    # The fully-refunded payment still gets swept in (payout_id set) even
    # though it contributed ₹0 — otherwise it would show up as "eligible"
    # forever in every future run for this owner.
    from sqlalchemy import select
    async with test_session_factory() as session:
        payment = (
            await session.execute(select(Payment).where(Payment.booking_id == zero_booking_id))
        ).scalar_one()
        assert str(payment.payout_id) == payout_id


async def test_run_payout_rejects_a_period_extending_into_the_future(client, test_session_factory, seeded_admin):
    owner_id, venue_id = await _seeded_owner(test_session_factory)
    await _confirmed_booking_with_payment(test_session_factory, venue_id, slot_date=TODAY - timedelta(days=1))

    token = create_access_token(seeded_admin, "admin")
    resp = await client.post(
        "/api/v1/admin/payouts/run",
        json={
            "owner_id": str(owner_id),
            "period_start": str(TODAY - timedelta(days=10)),
            "period_end": str(TODAY + timedelta(days=1)),  # extends into the future
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422


async def test_run_payout_rejects_period_start_after_period_end(client, test_session_factory, seeded_admin):
    owner_id, venue_id = await _seeded_owner(test_session_factory)
    token = create_access_token(seeded_admin, "admin")
    resp = await client.post(
        "/api/v1/admin/payouts/run",
        json={
            "owner_id": str(owner_id),
            "period_start": str(TODAY - timedelta(days=1)),  # after period_end below
            "period_end": str(TODAY - timedelta(days=10)),
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422


async def test_run_payout_rejects_when_nothing_eligible_found(client, test_session_factory, seeded_admin):
    owner_id, venue_id = await _seeded_owner(test_session_factory)
    # No bookings at all for this owner.
    token = create_access_token(seeded_admin, "admin")
    resp = await client.post(
        "/api/v1/admin/payouts/run", json=_run_payload(owner_id), headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 422


async def test_run_payout_excludes_a_payment_already_swept_into_a_prior_payout(
    client, test_session_factory, seeded_admin
):
    owner_id, venue_id = await _seeded_owner(test_session_factory)
    await _confirmed_booking_with_payment(test_session_factory, venue_id, slot_date=TODAY - timedelta(days=10))

    token = create_access_token(seeded_admin, "admin")
    first = await client.post(
        "/api/v1/admin/payouts/run", json=_run_payload(owner_id), headers={"Authorization": f"Bearer {token}"}
    )
    assert first.status_code == 200

    # Same owner, overlapping period, same (now already-swept) booking.
    second = await client.post(
        "/api/v1/admin/payouts/run", json=_run_payload(owner_id), headers={"Authorization": f"Bearer {token}"}
    )
    assert second.status_code == 422  # nothing left un-swept for this owner/period


async def test_run_payout_requires_admin_role(client, test_session_factory):
    owner_id, venue_id = await _seeded_owner(test_session_factory)
    token = create_access_token(owner_id, "owner")
    resp = await client.post(
        "/api/v1/admin/payouts/run", json=_run_payload(owner_id), headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 403


async def test_run_payout_anonymous_gets_401(client, test_session_factory):
    owner_id, venue_id = await _seeded_owner(test_session_factory)
    resp = await client.post("/api/v1/admin/payouts/run", json=_run_payload(owner_id))
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# POST /api/v1/admin/payouts/{id}/mark-paid
# ---------------------------------------------------------------------------

async def test_mark_payout_paid_flips_status_and_sets_paid_at(client, test_session_factory, seeded_admin):
    owner_id, venue_id = await _seeded_owner(test_session_factory)
    await _confirmed_booking_with_payment(test_session_factory, venue_id, slot_date=TODAY - timedelta(days=10))
    token = create_access_token(seeded_admin, "admin")
    run_resp = await client.post(
        "/api/v1/admin/payouts/run", json=_run_payload(owner_id), headers={"Authorization": f"Bearer {token}"}
    )
    payout_id = run_resp.json()["id"]

    resp = await client.post(
        f"/api/v1/admin/payouts/{payout_id}/mark-paid", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "paid"
    assert resp.json()["paid_at"] is not None


async def test_mark_payout_paid_twice_gets_409(client, test_session_factory, seeded_admin):
    owner_id, venue_id = await _seeded_owner(test_session_factory)
    await _confirmed_booking_with_payment(test_session_factory, venue_id, slot_date=TODAY - timedelta(days=10))
    token = create_access_token(seeded_admin, "admin")
    run_resp = await client.post(
        "/api/v1/admin/payouts/run", json=_run_payload(owner_id), headers={"Authorization": f"Bearer {token}"}
    )
    payout_id = run_resp.json()["id"]

    first = await client.post(
        f"/api/v1/admin/payouts/{payout_id}/mark-paid", headers={"Authorization": f"Bearer {token}"}
    )
    assert first.status_code == 200
    second = await client.post(
        f"/api/v1/admin/payouts/{payout_id}/mark-paid", headers={"Authorization": f"Bearer {token}"}
    )
    assert second.status_code == 409


async def test_mark_payout_paid_requires_admin_role(client, test_session_factory, seeded_admin):
    owner_id, venue_id = await _seeded_owner(test_session_factory)
    await _confirmed_booking_with_payment(test_session_factory, venue_id, slot_date=TODAY - timedelta(days=10))
    admin_token = create_access_token(seeded_admin, "admin")
    run_resp = await client.post(
        "/api/v1/admin/payouts/run", json=_run_payload(owner_id), headers={"Authorization": f"Bearer {admin_token}"}
    )
    payout_id = run_resp.json()["id"]

    owner_token = create_access_token(owner_id, "owner")
    resp = await client.post(
        f"/api/v1/admin/payouts/{payout_id}/mark-paid", headers={"Authorization": f"Bearer {owner_token}"}
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# GET /api/v1/owner/payouts
# ---------------------------------------------------------------------------

async def test_owner_can_list_their_own_payouts(client, test_session_factory, seeded_admin):
    owner_id, venue_id = await _seeded_owner(test_session_factory)
    await _confirmed_booking_with_payment(test_session_factory, venue_id, slot_date=TODAY - timedelta(days=10))
    admin_token = create_access_token(seeded_admin, "admin")
    await client.post(
        "/api/v1/admin/payouts/run", json=_run_payload(owner_id), headers={"Authorization": f"Bearer {admin_token}"}
    )

    owner_token = create_access_token(owner_id, "owner")
    resp = await client.get("/api/v1/owner/payouts", headers={"Authorization": f"Bearer {owner_token}"})
    assert resp.status_code == 200
    payouts = resp.json()
    assert len(payouts) == 1
    assert payouts[0]["gross_amount"] == "2000.00"
    # The invariant that actually matters for a financial ledger, checked
    # again here at the HTTP/persisted-row level, not just in the pure
    # compute_payout_split unit tests.
    assert Decimal(payouts[0]["commission_amount"]) + Decimal(payouts[0]["net_amount"]) == Decimal(
        payouts[0]["gross_amount"]
    )


async def test_owner_does_not_see_another_owners_payouts(client, test_session_factory, seeded_admin):
    owner_a, venue_a = await _seeded_owner(test_session_factory)
    owner_b, venue_b = await _seeded_owner(test_session_factory)
    await _confirmed_booking_with_payment(test_session_factory, venue_a, slot_date=TODAY - timedelta(days=10))
    admin_token = create_access_token(seeded_admin, "admin")
    await client.post(
        "/api/v1/admin/payouts/run", json=_run_payload(owner_a), headers={"Authorization": f"Bearer {admin_token}"}
    )

    token_b = create_access_token(owner_b, "owner")
    resp = await client.get("/api/v1/owner/payouts", headers={"Authorization": f"Bearer {token_b}"})
    assert resp.status_code == 200
    assert resp.json() == []


async def test_customer_cannot_access_owner_payouts_route(client, test_session_factory):
    async with test_session_factory() as session:
        async with session.begin():
            customer = User(
                name="A Customer", email=f"cust-{uuid.uuid4().hex[:8]}@example.com",
                phone=f"123{uuid.uuid4().hex[:7]}",
                password_hash=hash_password("whatever-1"), role="customer",
            )
            session.add(customer)
            await session.flush()
            customer_id = customer.id

    token = create_access_token(customer_id, "customer")
    resp = await client.get("/api/v1/owner/payouts", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403

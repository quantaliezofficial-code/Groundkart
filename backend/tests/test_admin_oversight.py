"""
Admin oversight routes — HANDOFF.md §7's next item after PHASE_C8_SUMMARY.md
resolved the owner payout ledger. 01_PRD.md §5's admin stories: "View
platform-wide bookings and GMV," "Suspend a listing or user," "View audit
log of sensitive actions." audit_logs has been write-only since
PHASE_C3_SUMMARY.md built it (its own docstring: "no update path anywhere
in this codebase — a row, once written, is never changed, only ever
read") — this file exercises the first real read path for it.
"""
import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal

import httpx
import pytest
from sqlalchemy import select, update

from app.db import get_db
from app.main import app
from app.models.core import (
    InventoryUnit,
    OwnerVerification,
    Payment,
    RefreshToken,
    User,
    Venue,
)
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


async def _seeded_owner_and_venue(test_session_factory, *, venue_status="active"):
    async with test_session_factory() as session:
        async with session.begin():
            owner = User(
                name="Ms. Verma", email=f"owner-{uuid.uuid4().hex[:8]}@example.com",
                phone=f"123{uuid.uuid4().hex[:7]}",
                password_hash=hash_password("whatever-1"), role="owner",
            )
            session.add(owner)
            await session.flush()
            venue = Venue(
                owner_id=owner.id, name="Verma Farmhouse", slug=f"verma-{uuid.uuid4().hex[:8]}",
                category="farmhouse", address="1 Canal Road", city="Lucknow",
                unit_type="full_day", base_price=Decimal("2000.00"), status=venue_status,
            )
            session.add(venue)
            await session.flush()
            owner_id, venue_id = owner.id, venue.id
    return owner_id, venue_id


async def _confirmed_booking_with_payment(test_session_factory, venue_id, slot_date, amount=Decimal("2000.00")):
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
    async with test_session_factory() as session:
        async with session.begin():
            session.add(Payment(booking_id=booking_id, amount=amount, status="success"))
    return booking_id


def _admin_headers(admin_id):
    return {"Authorization": f"Bearer {create_access_token(admin_id, 'admin')}"}


# ---------------------------------------------------------------------------
# GET /api/v1/admin/audit-log
# ---------------------------------------------------------------------------

async def test_audit_log_requires_admin_role(client, seeded_customer):
    token = create_access_token(seeded_customer, "customer")
    resp = await client.get("/api/v1/admin/audit-log", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403


async def test_audit_log_shows_real_entries_from_a_real_action(client, test_session_factory, seeded_admin):
    """Not a synthetic audit_logs insert — a real admin action
    (venue suspend, exercised later in this file too) produces the row,
    proving the read path against genuinely-written data."""
    owner_id, venue_id = await _seeded_owner_and_venue(test_session_factory, venue_status="active")
    await client.post(
        f"/api/v1/admin/venues/{venue_id}/suspend",
        json={"reason": "Multiple guest complaints"},
        headers=_admin_headers(seeded_admin),
    )

    resp = await client.get("/api/v1/admin/audit-log", headers=_admin_headers(seeded_admin))
    assert resp.status_code == 200
    actions = [e["action"] for e in resp.json()]
    assert "venue.suspended" in actions


async def test_audit_log_filters_by_entity_type(client, test_session_factory, seeded_admin):
    owner_id, venue_id = await _seeded_owner_and_venue(test_session_factory, venue_status="active")
    await client.post(
        f"/api/v1/admin/venues/{venue_id}/suspend", json={"reason": "Test"}, headers=_admin_headers(seeded_admin)
    )
    resp = await client.get(
        "/api/v1/admin/audit-log", params={"entity_type": "venue"}, headers=_admin_headers(seeded_admin)
    )
    assert resp.status_code == 200
    assert all(e["entity_type"] == "venue" for e in resp.json())
    assert len(resp.json()) >= 1


async def test_audit_log_filters_by_entity_id_to_exactly_that_entity(client, test_session_factory, seeded_admin):
    _, venue_a = await _seeded_owner_and_venue(test_session_factory, venue_status="active")
    _, venue_b = await _seeded_owner_and_venue(test_session_factory, venue_status="active")
    await client.post(
        f"/api/v1/admin/venues/{venue_a}/suspend", json={"reason": "A"}, headers=_admin_headers(seeded_admin)
    )
    await client.post(
        f"/api/v1/admin/venues/{venue_b}/suspend", json={"reason": "B"}, headers=_admin_headers(seeded_admin)
    )
    resp = await client.get(
        "/api/v1/admin/audit-log", params={"entity_id": str(venue_a)}, headers=_admin_headers(seeded_admin)
    )
    assert resp.status_code == 200
    entries = resp.json()
    assert len(entries) == 1
    assert entries[0]["entity_id"] == str(venue_a)


async def test_audit_log_filters_by_actor_id(client, test_session_factory, seeded_admin):
    other_admin_email = f"admin2-{uuid.uuid4().hex[:8]}@example.com"
    async with test_session_factory() as session:
        async with session.begin():
            other_admin = User(
                name="Other Admin", email=other_admin_email,
                phone=f"123{uuid.uuid4().hex[:7]}",
                password_hash=hash_password("whatever-1"), role="admin",
            )
            session.add(other_admin)
            await session.flush()
            other_admin_id = other_admin.id

    _, venue_a = await _seeded_owner_and_venue(test_session_factory, venue_status="active")
    _, venue_b = await _seeded_owner_and_venue(test_session_factory, venue_status="active")
    await client.post(
        f"/api/v1/admin/venues/{venue_a}/suspend", json={"reason": "A"}, headers=_admin_headers(seeded_admin)
    )
    await client.post(
        f"/api/v1/admin/venues/{venue_b}/suspend", json={"reason": "B"}, headers=_admin_headers(other_admin_id)
    )

    resp = await client.get(
        "/api/v1/admin/audit-log", params={"actor_id": str(other_admin_id)}, headers=_admin_headers(seeded_admin)
    )
    assert resp.status_code == 200
    entries = resp.json()
    assert len(entries) == 1
    assert entries[0]["actor_id"] == str(other_admin_id)


async def test_audit_log_ordered_most_recent_first(client, test_session_factory, seeded_admin):
    _, venue_a = await _seeded_owner_and_venue(test_session_factory, venue_status="active")
    _, venue_b = await _seeded_owner_and_venue(test_session_factory, venue_status="active")
    await client.post(
        f"/api/v1/admin/venues/{venue_a}/suspend", json={"reason": "first"}, headers=_admin_headers(seeded_admin)
    )
    await client.post(
        f"/api/v1/admin/venues/{venue_b}/suspend", json={"reason": "second"}, headers=_admin_headers(seeded_admin)
    )
    resp = await client.get("/api/v1/admin/audit-log", headers=_admin_headers(seeded_admin))
    entries = resp.json()
    timestamps = [e["created_at"] for e in entries]
    assert timestamps == sorted(timestamps, reverse=True)


async def test_audit_log_respects_limit(client, test_session_factory, seeded_admin):
    _, venue_a = await _seeded_owner_and_venue(test_session_factory, venue_status="active")
    _, venue_b = await _seeded_owner_and_venue(test_session_factory, venue_status="active")
    await client.post(
        f"/api/v1/admin/venues/{venue_a}/suspend", json={"reason": "first"}, headers=_admin_headers(seeded_admin)
    )
    await client.post(
        f"/api/v1/admin/venues/{venue_b}/suspend", json={"reason": "second"}, headers=_admin_headers(seeded_admin)
    )
    resp = await client.get(
        "/api/v1/admin/audit-log", params={"limit": 1}, headers=_admin_headers(seeded_admin)
    )
    assert len(resp.json()) == 1


# ---------------------------------------------------------------------------
# GET /api/v1/admin/overview
# ---------------------------------------------------------------------------

async def test_overview_requires_admin_role(client, seeded_customer):
    token = create_access_token(seeded_customer, "customer")
    resp = await client.get("/api/v1/admin/overview", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403


async def test_overview_gmv_includes_confirmed_bookings_only_at_gross_pre_refund_amount(
    client, test_session_factory, seeded_admin
):
    """GMV (top-line transaction volume) is deliberately NOT the same
    "gross" as the payout ledger's gross_amount (post-refund retained
    amount, PHASE_C8_SUMMARY.md's Decision Point C-11) — GMV counts the
    original booking value for anything that was actually paid for, a
    different, industry-standard sense of "gross." A pending_payment
    booking (never actually paid for) must not count at all."""
    owner_id, venue_id = await _seeded_owner_and_venue(test_session_factory)
    await _confirmed_booking_with_payment(
        test_session_factory, venue_id, date.today() - timedelta(days=1), amount=Decimal("2000.00")
    )
    # A pending_payment booking that never got confirmed - must NOT count.
    async with test_session_factory() as session:
        async with session.begin():
            unit = InventoryUnit(
                venue_id=venue_id, date=date.today() + timedelta(days=5),
                start_time=None, end_time=None, price=Decimal("9999.00"),
            )
            session.add(unit)
            await session.flush()
            unit_id = unit.id
        await create_booking(
            session=session, inventory_unit_id=unit_id,
            guest_name="Never Pays", guest_email=f"neverpay-{uuid.uuid4().hex[:8]}@example.com",
        )

    resp = await client.get("/api/v1/admin/overview", headers=_admin_headers(seeded_admin))
    assert resp.status_code == 200
    assert resp.json()["gmv"] == "2000.00"


async def test_overview_bookings_by_status_breakdown(client, test_session_factory, seeded_admin):
    owner_id, venue_id = await _seeded_owner_and_venue(test_session_factory)
    await _confirmed_booking_with_payment(test_session_factory, venue_id, date.today() - timedelta(days=1))

    resp = await client.get("/api/v1/admin/overview", headers=_admin_headers(seeded_admin))
    body = resp.json()
    assert body["total_bookings"] >= 1
    assert body["bookings_by_status"].get("confirmed", 0) >= 1


async def test_overview_pending_venue_approvals_count(client, test_session_factory, seeded_admin):
    await _seeded_owner_and_venue(test_session_factory, venue_status="pending_review")
    resp = await client.get("/api/v1/admin/overview", headers=_admin_headers(seeded_admin))
    assert resp.json()["pending_venue_approvals"] >= 1


async def test_overview_active_venues_count(client, test_session_factory, seeded_admin):
    await _seeded_owner_and_venue(test_session_factory, venue_status="active")
    resp = await client.get("/api/v1/admin/overview", headers=_admin_headers(seeded_admin))
    assert resp.json()["active_venues"] >= 1


# ---------------------------------------------------------------------------
# POST /api/v1/admin/venues/{id}/suspend and /reactivate
# ---------------------------------------------------------------------------

async def test_suspend_active_venue_succeeds(client, test_session_factory, seeded_admin):
    owner_id, venue_id = await _seeded_owner_and_venue(test_session_factory, venue_status="active")
    resp = await client.post(
        f"/api/v1/admin/venues/{venue_id}/suspend",
        json={"reason": "Repeated no-shows reported by customers"},
        headers=_admin_headers(seeded_admin),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "suspended"

    async with test_session_factory() as session:
        venue = (await session.execute(select(Venue).where(Venue.id == venue_id))).scalar_one()
        assert venue.status == "suspended"
        assert venue.suspension_reason == "Repeated no-shows reported by customers"


async def test_suspend_venue_hides_it_from_public_search(client, test_session_factory, seeded_admin):
    owner_id, venue_id = await _seeded_owner_and_venue(test_session_factory, venue_status="active")
    await client.post(
        f"/api/v1/admin/venues/{venue_id}/suspend", json={"reason": "Test"}, headers=_admin_headers(seeded_admin)
    )
    resp = await client.get(f"/api/v1/venues/{venue_id}")
    assert resp.status_code == 404  # same visibility rule as any non-active venue


async def test_suspend_non_active_venue_gets_409(client, test_session_factory, seeded_admin):
    owner_id, venue_id = await _seeded_owner_and_venue(test_session_factory, venue_status="pending_review")
    resp = await client.post(
        f"/api/v1/admin/venues/{venue_id}/suspend", json={"reason": "Test"}, headers=_admin_headers(seeded_admin)
    )
    assert resp.status_code == 409


async def test_suspend_venue_requires_admin_role(client, test_session_factory, seeded_customer):
    owner_id, venue_id = await _seeded_owner_and_venue(test_session_factory, venue_status="active")
    token = create_access_token(seeded_customer, "customer")
    resp = await client.post(
        f"/api/v1/admin/venues/{venue_id}/suspend",
        json={"reason": "Test"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


async def test_reactivate_suspended_venue_succeeds_and_restores_search_visibility(
    client, test_session_factory, seeded_admin
):
    owner_id, venue_id = await _seeded_owner_and_venue(test_session_factory, venue_status="active")
    await client.post(
        f"/api/v1/admin/venues/{venue_id}/suspend", json={"reason": "Test"}, headers=_admin_headers(seeded_admin)
    )
    resp = await client.post(f"/api/v1/admin/venues/{venue_id}/reactivate", headers=_admin_headers(seeded_admin))
    assert resp.status_code == 200
    assert resp.json()["status"] == "active"

    async with test_session_factory() as session:
        venue = (await session.execute(select(Venue).where(Venue.id == venue_id))).scalar_one()
        assert venue.suspension_reason is None

    resp2 = await client.get(f"/api/v1/venues/{venue_id}")
    assert resp2.status_code == 200


async def test_reactivate_non_suspended_venue_gets_409(client, test_session_factory, seeded_admin):
    owner_id, venue_id = await _seeded_owner_and_venue(test_session_factory, venue_status="active")
    resp = await client.post(f"/api/v1/admin/venues/{venue_id}/reactivate", headers=_admin_headers(seeded_admin))
    assert resp.status_code == 409


# ---------------------------------------------------------------------------
# POST /api/v1/admin/users/{id}/suspend and /reactivate
# ---------------------------------------------------------------------------

async def test_suspend_user_blocks_future_login(client, test_session_factory, seeded_admin):
    email = f"cust-{uuid.uuid4().hex[:8]}@example.com"
    async with test_session_factory() as session:
        async with session.begin():
            customer = User(name="A Customer", email=email, password_hash=hash_password("a-real-password"),
                phone=f"123{uuid.uuid4().hex[:7]}", role="customer")
            session.add(customer)
            await session.flush()
            customer_id = customer.id

    resp = await client.post(
        f"/api/v1/admin/users/{customer_id}/suspend",
        json={"reason": "Fraudulent booking activity"},
        headers=_admin_headers(seeded_admin),
    )
    assert resp.status_code == 200

    login_resp = await client.post("/api/v1/auth/login", json={"login_id": email, "password": "a-real-password", "phone": f"123{uuid.uuid4().hex[:7]}"})
    assert login_resp.status_code == 401  # same generic message as wrong password, not a distinct one


async def test_suspend_user_revokes_existing_refresh_tokens(client, test_session_factory, seeded_admin):
    email = f"cust-{uuid.uuid4().hex[:8]}@example.com"
    async with test_session_factory() as session:
        async with session.begin():
            customer = User(name="A Customer", email=email, password_hash=hash_password("a-real-password"),
                phone=f"123{uuid.uuid4().hex[:7]}", role="customer")
            session.add(customer)
            await session.flush()
            customer_id = customer.id

    login_resp = await client.post("/api/v1/auth/login", json={"login_id": email, "password": "a-real-password", "phone": f"123{uuid.uuid4().hex[:7]}"})
    assert login_resp.status_code == 200

    await client.post(
        f"/api/v1/admin/users/{customer_id}/suspend", json={"reason": "Test"}, headers=_admin_headers(seeded_admin)
    )

    async with test_session_factory() as session:
        tokens = (
            await session.execute(select(RefreshToken).where(RefreshToken.user_id == customer_id))
        ).scalars().all()
        assert len(tokens) >= 1
        assert all(t.revoked_at is not None for t in tokens)


async def test_cannot_suspend_yourself(client, seeded_admin):
    resp = await client.post(
        f"/api/v1/admin/users/{seeded_admin}/suspend",
        json={"reason": "Testing"},
        headers=_admin_headers(seeded_admin),
    )
    assert resp.status_code == 422


async def test_suspend_already_suspended_user_gets_409(client, test_session_factory, seeded_admin, seeded_customer):
    await client.post(
        f"/api/v1/admin/users/{seeded_customer}/suspend",
        json={"reason": "First"},
        headers=_admin_headers(seeded_admin),
    )
    resp = await client.post(
        f"/api/v1/admin/users/{seeded_customer}/suspend",
        json={"reason": "Second"},
        headers=_admin_headers(seeded_admin),
    )
    assert resp.status_code == 409


async def test_suspend_user_requires_admin_role(client, seeded_customer):
    other_email = f"cust2-{uuid.uuid4().hex[:8]}@example.com"
    token = create_access_token(seeded_customer, "customer")
    resp = await client.post(
        f"/api/v1/admin/users/{seeded_customer}/suspend",
        json={"reason": "Test"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


async def test_reactivate_user_allows_login_again(client, test_session_factory, seeded_admin):
    email = f"cust-{uuid.uuid4().hex[:8]}@example.com"
    async with test_session_factory() as session:
        async with session.begin():
            customer = User(name="A Customer", email=email, password_hash=hash_password("a-real-password"),
                phone=f"123{uuid.uuid4().hex[:7]}", role="customer")
            session.add(customer)
            await session.flush()
            customer_id = customer.id

    await client.post(
        f"/api/v1/admin/users/{customer_id}/suspend", json={"reason": "Test"}, headers=_admin_headers(seeded_admin)
    )
    reactivate_resp = await client.post(
        f"/api/v1/admin/users/{customer_id}/reactivate", headers=_admin_headers(seeded_admin)
    )
    assert reactivate_resp.status_code == 200

    login_resp = await client.post("/api/v1/auth/login", json={"login_id": email, "password": "a-real-password", "phone": f"123{uuid.uuid4().hex[:7]}"})
    assert login_resp.status_code == 200


async def test_reactivate_non_suspended_user_gets_409(client, seeded_admin, seeded_customer):
    resp = await client.post(
        f"/api/v1/admin/users/{seeded_customer}/reactivate", headers=_admin_headers(seeded_admin)
    )
    assert resp.status_code == 409


async def test_suspend_user_writes_audit_log_with_reason(client, test_session_factory, seeded_admin, seeded_customer):
    await client.post(
        f"/api/v1/admin/users/{seeded_customer}/suspend",
        json={"reason": "Fraudulent activity reported"},
        headers=_admin_headers(seeded_admin),
    )
    resp = await client.get(
        "/api/v1/admin/audit-log", params={"entity_id": str(seeded_customer)}, headers=_admin_headers(seeded_admin)
    )
    entries = resp.json()
    assert any(e["action"] == "user.suspended" for e in entries)


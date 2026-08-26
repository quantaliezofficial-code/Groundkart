"""
In-app notifications: added so an owner/user finds out when an admin acts
on something of theirs, without asking support or happening to notice it
themselves. Two things to verify:

1. The endpoints themselves (list/unread-count/mark-read/mark-all-read),
   always scoped to the caller's own notifications.
2. That every admin action which affects an owner/user's own account
   actually creates one — venue approve/reject/suspend/reactivate,
   verification approve/reject, user suspend/reactivate, payout
   mark-paid. Booking confirm-payment/cancel-pending and payout run
   deliberately do NOT notify anyone here — see notify()'s call sites (or
   lack thereof) in booking/service.py and payout/service.py's run_payout
   for why: guest bookings often have no logged-in account to notify at
   all, and "the payout was computed" isn't the moment money actually
   moved, "marked paid" is.
"""
import uuid
from datetime import date, timedelta
from decimal import Decimal

import httpx
import pytest

from app.db import get_db, get_idem_db
from app.main import app
from app.models.core import OwnerVerification, Payout, User, Venue
from app.modules.auth.security import create_access_token, hash_password


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


def _admin_headers(admin_id):
    return {"Authorization": f"Bearer {create_access_token(admin_id, 'admin')}"}


def _user_headers(user_id, role="customer"):
    return {"Authorization": f"Bearer {create_access_token(user_id, role)}"}


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


async def _venue(test_session_factory, owner_id, *, status="pending_review"):
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


async def _verification(test_session_factory, user_id, *, status="pending"):
    async with test_session_factory() as session:
        async with session.begin():
            verification = OwnerVerification(
                user_id=user_id,
                document_url="http://localhost:8000/uploads/doc.pdf",
                business_name="Test Co",
                status=status,
            )
            session.add(verification)
            await session.flush()
            verification_id = verification.id
    return verification_id


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


async def _notifications_for(client, user_id, role="owner"):
    resp = await client.get("/api/v1/notifications", headers=_user_headers(user_id, role))
    assert resp.status_code == 200
    return resp.json()


# ---------------------------------------------------------------------------
# The endpoints themselves
# ---------------------------------------------------------------------------


async def test_list_notifications_requires_auth(client):
    resp = await client.get("/api/v1/notifications")
    assert resp.status_code == 401


async def test_list_notifications_scoped_to_caller_only(client, test_session_factory, seeded_admin):
    owner_a = await _owner(test_session_factory, name="Owner A")
    owner_b = await _owner(test_session_factory, name="Owner B")
    venue_a = await _venue(test_session_factory, owner_a)
    venue_b = await _venue(test_session_factory, owner_b)

    await client.post(f"/api/v1/admin/venues/{venue_a}/approve", headers=_admin_headers(seeded_admin))
    await client.post(f"/api/v1/admin/venues/{venue_b}/approve", headers=_admin_headers(seeded_admin))

    notifications_a = await _notifications_for(client, owner_a)
    assert len(notifications_a) == 1
    assert notifications_a[0]["type"] == "venue_approved"

    notifications_b = await _notifications_for(client, owner_b)
    assert len(notifications_b) == 1
    assert notifications_b[0]["id"] != notifications_a[0]["id"]


async def test_unread_count_and_mark_read(client, test_session_factory, seeded_admin):
    owner_id = await _owner(test_session_factory)
    venue_id = await _venue(test_session_factory, owner_id)
    await client.post(f"/api/v1/admin/venues/{venue_id}/approve", headers=_admin_headers(seeded_admin))

    count_resp = await client.get("/api/v1/notifications/unread-count", headers=_user_headers(owner_id, "owner"))
    assert count_resp.status_code == 200
    assert count_resp.json()["unread_count"] == 1

    notifications = await _notifications_for(client, owner_id)
    notification_id = notifications[0]["id"]
    assert notifications[0]["read_at"] is None

    read_resp = await client.post(
        f"/api/v1/notifications/{notification_id}/read", headers=_user_headers(owner_id, "owner")
    )
    assert read_resp.status_code == 200
    assert read_resp.json()["read_at"] is not None

    count_resp2 = await client.get("/api/v1/notifications/unread-count", headers=_user_headers(owner_id, "owner"))
    assert count_resp2.json()["unread_count"] == 0


async def test_cannot_mark_someone_elses_notification_read(client, test_session_factory, seeded_admin):
    owner_a = await _owner(test_session_factory, name="Owner A")
    owner_b = await _owner(test_session_factory, name="Owner B")
    venue_a = await _venue(test_session_factory, owner_a)
    await client.post(f"/api/v1/admin/venues/{venue_a}/approve", headers=_admin_headers(seeded_admin))

    notifications_a = await _notifications_for(client, owner_a)
    notification_id = notifications_a[0]["id"]

    resp = await client.post(
        f"/api/v1/notifications/{notification_id}/read", headers=_user_headers(owner_b, "owner")
    )
    assert resp.status_code == 404


async def test_mark_all_read(client, test_session_factory, seeded_admin):
    owner_id = await _owner(test_session_factory)
    venue_a = await _venue(test_session_factory, owner_id, status="active")
    venue_b = await _venue(test_session_factory, owner_id, status="active")
    await client.post(
        f"/api/v1/admin/venues/{venue_a}/suspend", json={"reason": "r1"}, headers=_admin_headers(seeded_admin)
    )
    await client.post(
        f"/api/v1/admin/venues/{venue_b}/suspend", json={"reason": "r2"}, headers=_admin_headers(seeded_admin)
    )

    resp = await client.post("/api/v1/notifications/read-all", headers=_user_headers(owner_id, "owner"))
    assert resp.status_code == 200
    assert resp.json()["marked_read"] == 2

    count_resp = await client.get("/api/v1/notifications/unread-count", headers=_user_headers(owner_id, "owner"))
    assert count_resp.json()["unread_count"] == 0


# ---------------------------------------------------------------------------
# Every admin action that should create one
# ---------------------------------------------------------------------------


async def test_venue_approve_reject_suspend_reactivate_each_notify_the_owner(
    client, test_session_factory, seeded_admin
):
    owner_id = await _owner(test_session_factory)

    pending_id = await _venue(test_session_factory, owner_id, status="pending_review")
    await client.post(f"/api/v1/admin/venues/{pending_id}/approve", headers=_admin_headers(seeded_admin))

    to_reject_id = await _venue(test_session_factory, owner_id, status="pending_review")
    await client.post(
        f"/api/v1/admin/venues/{to_reject_id}/reject",
        json={"reason": "missing photos"},
        headers=_admin_headers(seeded_admin),
    )

    active_id = await _venue(test_session_factory, owner_id, status="active")
    await client.post(
        f"/api/v1/admin/venues/{active_id}/suspend",
        json={"reason": "complaint received"},
        headers=_admin_headers(seeded_admin),
    )
    await client.post(f"/api/v1/admin/venues/{active_id}/reactivate", headers=_admin_headers(seeded_admin))

    notifications = await _notifications_for(client, owner_id)
    types = {n["type"] for n in notifications}
    assert types == {"venue_approved", "venue_rejected", "venue_suspended", "venue_reactivated"}
    rejected = next(n for n in notifications if n["type"] == "venue_rejected")
    assert "missing photos" in rejected["message"]


async def test_verification_approve_notifies_the_applicant(client, test_session_factory, seeded_admin, seeded_customer):
    verification_id = await _verification(test_session_factory, seeded_customer, status="pending")
    await client.post(
        f"/api/v1/admin/owner-verifications/{verification_id}/approve", headers=_admin_headers(seeded_admin)
    )

    notifications = await _notifications_for(client, seeded_customer, role="customer")
    assert len(notifications) == 1
    assert notifications[0]["type"] == "verification_approved"


async def test_verification_reject_notifies_the_applicant(client, test_session_factory, seeded_admin, seeded_customer):
    verification_id = await _verification(test_session_factory, seeded_customer, status="pending")
    await client.post(
        f"/api/v1/admin/owner-verifications/{verification_id}/reject",
        json={"reason": "document unclear"},
        headers=_admin_headers(seeded_admin),
    )

    notifications = await _notifications_for(client, seeded_customer, role="customer")
    assert len(notifications) == 1
    assert notifications[0]["type"] == "verification_rejected"
    assert "document unclear" in notifications[0]["message"]


async def test_user_suspend_reactivate_notify_the_target(client, test_session_factory, seeded_admin, seeded_customer):
    await client.post(
        f"/api/v1/admin/users/{seeded_customer}/suspend",
        json={"reason": "abuse report"},
        headers=_admin_headers(seeded_admin),
    )
    await client.post(f"/api/v1/admin/users/{seeded_customer}/reactivate", headers=_admin_headers(seeded_admin))

    notifications = await _notifications_for(client, seeded_customer, role="customer")
    types = {n["type"] for n in notifications}
    assert types == {"account_suspended", "account_reactivated"}
    suspended = next(n for n in notifications if n["type"] == "account_suspended")
    assert "abuse report" in suspended["message"]


async def test_payout_mark_paid_notifies_the_owner_but_run_does_not(
    client, test_session_factory, seeded_admin
):
    owner_id = await _owner(test_session_factory)
    payout_id = await _payout(test_session_factory, owner_id, status="pending")

    # Before mark-paid: no notification yet (run_payout deliberately
    # doesn't notify — see this file's module docstring for why).
    assert await _notifications_for(client, owner_id) == []

    await client.post(f"/api/v1/admin/payouts/{payout_id}/mark-paid", headers=_admin_headers(seeded_admin))

    notifications = await _notifications_for(client, owner_id)
    assert len(notifications) == 1
    assert notifications[0]["type"] == "payout_paid"

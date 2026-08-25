"""
Three more real gaps, same shape as the ones test_owner_dashboard.py
documents and fixed for the Owner dashboard: every existing GET route an
admin could theoretically call (GET /owner/venues, GET /owner/verification)
is scoped to *the caller's own* rows, not platform-wide — confirmed by
reading list_venues_for_owner/list_venues (catalog/service.py, both
owner_id- or active-only-scoped) and get_latest_verification_for_user
(owner_onboarding/service.py, current-user-only). There was no way for a
real admin, using only the HTTP API, to discover which venue/verification/
user IDs exist to act on with the suspend/approve/reject routes that
already existed and were already tested by ID. Found while wiring
AdminLayout.tsx to real data — flagged, not silently worked around, then
fixed the same way the Owner session fixed its three gaps.

1. GET /api/v1/admin/venues — every venue regardless of status/owner,
   optionally filtered by status. Powers both the approval queue
   (status=pending_review) and the listings-moderation view (all statuses,
   since GET /venues only ever returns 'active' and a suspended venue would
   otherwise vanish from every admin view with no way back to reactivate
   it).
2. GET /api/v1/admin/owner-verifications — every verification regardless of
   applicant, optionally filtered by status. Also had to extend the
   response shape: OwnerVerificationResponse (used for "my own status")
   deliberately has no user_id/document_url/applicant name or email — an
   admin reviewing a queue needs exactly those to know who submitted what
   and to actually see the document. This is not the same privacy question
   as customer-identity-on-bookings: identity verification is the entire
   point of this flow, the document itself IS a government/business ID,
   and the applicant already knowingly submitted it for an admin to review.
3. GET /api/v1/admin/users — every user, optionally filtered by role and/or
   suspended status. Reuses the existing AdminUserView shape (already has
   suspended_at/suspension_reason) rather than inventing a new one.
"""
import uuid
from decimal import Decimal

import httpx
import pytest

from app.db import get_db
from app.main import app
from app.models.core import OwnerVerification, User, Venue
from app.modules.auth.security import create_access_token, hash_password


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


async def _verification(test_session_factory, user_id, *, status="pending", **overrides):
    defaults = dict(
        user_id=user_id,
        document_url="http://localhost:8000/uploads/owner-verifications/doc.pdf",
        business_name="Rao Sports Co",
        status=status,
    )
    defaults.update(overrides)
    async with test_session_factory() as session:
        async with session.begin():
            verification = OwnerVerification(**defaults)
            session.add(verification)
            await session.flush()
            verification_id = verification.id
    return verification_id


# ---------------------------------------------------------------------------
# GET /api/v1/admin/venues
# ---------------------------------------------------------------------------


async def test_admin_list_venues_requires_admin_role(client, seeded_customer):
    token = create_access_token(seeded_customer, "customer")
    resp = await client.get("/api/v1/admin/venues", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403


async def test_admin_list_venues_returns_every_status_not_just_active(
    client, test_session_factory, seeded_admin
):
    owner_id = await _owner(test_session_factory)
    await _venue(test_session_factory, owner_id, status="pending_review")
    await _venue(test_session_factory, owner_id, status="active")
    await _venue(test_session_factory, owner_id, status="suspended")
    await _venue(test_session_factory, owner_id, status="draft")

    resp = await client.get("/api/v1/admin/venues", headers=_admin_headers(seeded_admin))
    assert resp.status_code == 200
    statuses = {v["status"] for v in resp.json()}
    assert statuses == {"pending_review", "active", "suspended", "draft"}


async def test_admin_list_venues_filters_by_status(client, test_session_factory, seeded_admin):
    owner_id = await _owner(test_session_factory)
    target_id = await _venue(test_session_factory, owner_id, status="pending_review")
    await _venue(test_session_factory, owner_id, status="active")

    resp = await client.get(
        "/api/v1/admin/venues", params={"status": "pending_review"}, headers=_admin_headers(seeded_admin)
    )
    assert resp.status_code == 200
    data = resp.json()
    assert [v["id"] for v in data] == [str(target_id)]


async def test_admin_list_venues_across_multiple_owners(client, test_session_factory, seeded_admin):
    """The gap, made concrete: GET /owner/venues as an admin returns only
    venues the admin itself owns (normally none) — this route must return
    every owner's venues, not just one."""
    owner_a = await _owner(test_session_factory, name="Owner A")
    owner_b = await _owner(test_session_factory, name="Owner B")
    await _venue(test_session_factory, owner_a, status="active")
    await _venue(test_session_factory, owner_b, status="active")

    resp = await client.get("/api/v1/admin/venues", headers=_admin_headers(seeded_admin))
    assert resp.status_code == 200
    owner_ids = {v["owner_id"] for v in resp.json()}
    assert owner_ids == {str(owner_a), str(owner_b)}


async def test_admin_list_venues_includes_owner_identity(client, test_session_factory, seeded_admin):
    """Without this, an admin managing venues sees nothing but a UUID
    fragment for who owns each one — no real name or way to contact them."""
    owner_id = await _owner(test_session_factory, name="Rekha Nair")
    await _venue(test_session_factory, owner_id, status="active")

    resp = await client.get("/api/v1/admin/venues", headers=_admin_headers(seeded_admin))
    assert resp.status_code == 200
    body = resp.json()[0]
    assert body["owner_name"] == "Rekha Nair"
    assert "@" in body["owner_email"]


# ---------------------------------------------------------------------------
# GET /api/v1/admin/owner-verifications
# ---------------------------------------------------------------------------


async def test_admin_list_verifications_requires_admin_role(client, seeded_customer):
    token = create_access_token(seeded_customer, "customer")
    resp = await client.get("/api/v1/admin/owner-verifications", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403


async def test_admin_list_verifications_includes_applicant_identity(
    client, test_session_factory, seeded_admin, seeded_customer
):
    """Without this, an admin sees a document with no way to know who
    submitted it — a real gap in OwnerVerificationResponse (the 'my own
    status' shape), not present in this admin-facing shape."""
    await _verification(test_session_factory, seeded_customer, business_name="Priya's Turf")

    resp = await client.get("/api/v1/admin/owner-verifications", headers=_admin_headers(seeded_admin))
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["user_id"] == str(seeded_customer)
    assert data[0]["applicant_name"] == "Priya Sharma"
    assert "@" in data[0]["applicant_email"]
    assert data[0]["document_url"].startswith("http")
    assert data[0]["business_name"] == "Priya's Turf"


async def test_admin_list_verifications_filters_by_status(client, test_session_factory, seeded_admin, seeded_customer):
    pending_id = await _verification(test_session_factory, seeded_customer, status="pending")

    other_user = await _owner(test_session_factory, name="Someone Else")
    await _verification(test_session_factory, other_user, status="approved")

    resp = await client.get(
        "/api/v1/admin/owner-verifications", params={"status": "pending"}, headers=_admin_headers(seeded_admin)
    )
    assert resp.status_code == 200
    data = resp.json()
    assert [v["id"] for v in data] == [str(pending_id)]


async def test_admin_list_verifications_defaults_to_all_statuses(
    client, test_session_factory, seeded_admin, seeded_customer
):
    await _verification(test_session_factory, seeded_customer, status="pending")
    other_user = await _owner(test_session_factory)
    await _verification(test_session_factory, other_user, status="approved")

    resp = await client.get("/api/v1/admin/owner-verifications", headers=_admin_headers(seeded_admin))
    assert resp.status_code == 200
    assert len(resp.json()) == 2


# ---------------------------------------------------------------------------
# GET /api/v1/admin/users
# ---------------------------------------------------------------------------


async def test_admin_list_users_requires_admin_role(client, seeded_customer):
    token = create_access_token(seeded_customer, "customer")
    resp = await client.get("/api/v1/admin/users", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403


async def test_admin_list_users_returns_every_role(client, seeded_admin, seeded_customer, test_session_factory):
    owner_id = await _owner(test_session_factory)

    resp = await client.get("/api/v1/admin/users", headers=_admin_headers(seeded_admin))
    assert resp.status_code == 200
    ids = {u["id"] for u in resp.json()}
    assert {str(seeded_admin), str(seeded_customer), str(owner_id)} <= ids


async def test_admin_list_users_filters_by_role(client, seeded_admin, seeded_customer, test_session_factory):
    owner_id = await _owner(test_session_factory)

    resp = await client.get("/api/v1/admin/users", params={"role": "owner"}, headers=_admin_headers(seeded_admin))
    assert resp.status_code == 200
    data = resp.json()
    assert all(u["role"] == "owner" for u in data)
    assert str(owner_id) in {u["id"] for u in data}
    assert str(seeded_customer) not in {u["id"] for u in data}


async def test_admin_list_users_filters_by_suspended(client, test_session_factory, seeded_admin, seeded_customer):
    await client.post(
        f"/api/v1/admin/users/{seeded_customer}/suspend",
        json={"reason": "test suspension"},
        headers=_admin_headers(seeded_admin),
    )

    resp = await client.get(
        "/api/v1/admin/users", params={"suspended": "true"}, headers=_admin_headers(seeded_admin)
    )
    assert resp.status_code == 200
    data = resp.json()
    assert [u["id"] for u in data] == [str(seeded_customer)]
    assert data[0]["suspension_reason"] == "test suspension"

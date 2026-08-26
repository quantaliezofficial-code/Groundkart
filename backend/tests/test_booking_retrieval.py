"""
PHASE_C4_SUMMARY.md's flagged gap: POST /bookings now reads customer_id
from a verified token when present, falls back to guest checkout
otherwise. The retrieval routes (GET /bookings/{id}, GET /bookings, GET
/bookings/manage/{token}) are the natural complement — attributing a
booking to an account is only useful if the account can see it again.

The PII-leak angle gets its own explicit tests: Implementation Plan Phase 0
item #3 named the original codebase's unauthenticated booking-leak
endpoint as a top-priority security fix. GET /bookings/{id} is deliberately
checked against the exact shape of that mistake (a stranger learning
another customer's booking exists at all), not just "wrong customer can't
see the data."
"""
import httpx
import pytest
from sqlalchemy import select

from app.db import get_db, get_idem_db
from app.main import app
from app.models.core import Booking
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


async def test_authenticated_booking_is_attributed_to_customer_id(
    client, test_session_factory, seeded_customer, seeded_unit
):
    token = create_access_token(seeded_customer, "customer")
    resp = await client.post(
        "/api/v1/bookings",
        json={"inventory_unit_id": str(seeded_unit)},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    assert resp.json()["manage_token"] is None  # account booking, not guest

    async with test_session_factory() as session:
        booking = (
            await session.execute(select(Booking).where(Booking.inventory_unit_id == seeded_unit))
        ).scalar_one()
        assert booking.customer_id == seeded_customer
        assert booking.guest_name is None
        assert booking.guest_email is None


async def test_unauthenticated_booking_is_still_a_guest_checkout(client, seeded_unit):
    """Regression check — this route's pre-existing guest path must keep
    working exactly as before now that auth has been wired in."""
    resp = await client.post(
        "/api/v1/bookings",
        json={
            "inventory_unit_id": str(seeded_unit),
            "guest_name": "Raj Kumar",
            "guest_email": "raj@example.com",
        },
    )
    assert resp.status_code == 201
    assert resp.json()["manage_token"] is not None


async def test_invalid_token_degrades_to_guest_not_401(client, seeded_unit):
    """An expired/garbage token attached to a request for a route that's
    supposed to be open to guests shouldn't 401 the whole request — it
    should just mean 'anonymous', same as no header at all."""
    resp = await client.post(
        "/api/v1/bookings",
        json={
            "inventory_unit_id": str(seeded_unit),
            "guest_name": "Raj Kumar",
            "guest_email": "raj@example.com",
        },
        headers={"Authorization": "Bearer not-a-real-token"},
    )
    assert resp.status_code == 201
    assert resp.json()["manage_token"] is not None


async def test_authenticated_request_with_guest_fields_is_rejected(
    client, seeded_customer, seeded_unit
):
    """Decision Point C-4: ambiguous (both customer_id AND guest fields)
    is rejected, not silently resolved one way."""
    token = create_access_token(seeded_customer, "customer")
    resp = await client.post(
        "/api/v1/bookings",
        json={
            "inventory_unit_id": str(seeded_unit),
            "guest_name": "Someone Else",
            "guest_email": "someone@example.com",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422


async def test_customer_can_view_their_own_booking(client, seeded_customer, seeded_unit):
    token = create_access_token(seeded_customer, "customer")
    create_resp = await client.post(
        "/api/v1/bookings",
        json={"inventory_unit_id": str(seeded_unit)},
        headers={"Authorization": f"Bearer {token}"},
    )
    booking_id = create_resp.json()["booking_id"]

    get_resp = await client.get(
        f"/api/v1/bookings/{booking_id}", headers={"Authorization": f"Bearer {token}"}
    )
    assert get_resp.status_code == 200
    assert get_resp.json()["status"] == "pending_payment"


async def test_booking_detail_includes_venue_id_and_real_slot_timing(client, seeded_customer, seeded_unit):
    """A real gap found while starting frontend integration: venue_id and
    the actual slot date/time weren't in this response at all — nothing
    could show a customer *when* their booking is for, or link back to
    the venue. slot_date/slot_start_time/slot_end_time are properties
    over the eager-loaded inventory_unit (app/models/core.py)."""
    token = create_access_token(seeded_customer, "customer")
    create_resp = await client.post(
        "/api/v1/bookings",
        json={"inventory_unit_id": str(seeded_unit)},
        headers={"Authorization": f"Bearer {token}"},
    )
    booking_id = create_resp.json()["booking_id"]

    get_resp = await client.get(
        f"/api/v1/bookings/{booking_id}", headers={"Authorization": f"Bearer {token}"}
    )
    body = get_resp.json()
    assert body["venue_id"] is not None
    assert body["slot_date"] == "2027-08-15"
    assert body["slot_start_time"] is not None
    assert body["slot_end_time"] is not None


async def test_different_customer_gets_404_not_403(client, seeded_customer, seeded_unit):
    """The exact category of bug Implementation Plan Phase 0 item #3 named:
    a stranger should not be able to confirm another customer's booking
    even exists. 404, never 403."""
    owner_token = create_access_token(seeded_customer, "customer")
    create_resp = await client.post(
        "/api/v1/bookings",
        json={"inventory_unit_id": str(seeded_unit)},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    booking_id = create_resp.json()["booking_id"]

    import uuid

    stranger_token = create_access_token(uuid.uuid4(), "customer")
    resp = await client.get(
        f"/api/v1/bookings/{booking_id}", headers={"Authorization": f"Bearer {stranger_token}"}
    )
    assert resp.status_code == 404


async def test_admin_can_view_any_booking(client, seeded_customer, seeded_admin, seeded_unit):
    customer_token = create_access_token(seeded_customer, "customer")
    create_resp = await client.post(
        "/api/v1/bookings",
        json={"inventory_unit_id": str(seeded_unit)},
        headers={"Authorization": f"Bearer {customer_token}"},
    )
    booking_id = create_resp.json()["booking_id"]

    admin_token = create_access_token(seeded_admin, "admin")
    resp = await client.get(
        f"/api/v1/bookings/{booking_id}", headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert resp.status_code == 200


async def test_venue_owner_cannot_view_a_customer_booking_via_this_route(
    client, seeded_owner_with_unit
):
    """Deliberate scope boundary documented in the service function: an
    owner needs a different view (their venue's calendar), not this
    single-booking-by-id route — even for a booking against their own
    venue/unit."""
    owner_id, _, unit_id = seeded_owner_with_unit

    guest_resp = await client.post(
        "/api/v1/bookings",
        json={
            "inventory_unit_id": str(unit_id),
            "guest_name": "Raj Kumar",
            "guest_email": "raj@example.com",
        },
    )
    booking_id = guest_resp.json()["booking_id"]

    owner_token = create_access_token(owner_id, "owner")
    resp = await client.get(
        f"/api/v1/bookings/{booking_id}", headers={"Authorization": f"Bearer {owner_token}"}
    )
    assert resp.status_code == 404


async def test_admin_can_view_a_guest_booking_via_this_route(
    client, seeded_admin, seeded_owner_with_unit
):
    """A real gap in this file's own coverage: the sibling test just above
    proves an OWNER can't reach a guest booking through this route, but
    nothing here ever checked whether an ADMIN can — despite the
    function's own docstring claiming a guest booking is 'never reachable
    through this route at all, for anyone.' Reading get_booking_for_viewer
    directly shows is_admin grants access unconditionally, with no
    guest-exclusion clause — this confirms that's actually true, rather
    than trusting the (apparently stale) docstring."""
    _, _, unit_id = seeded_owner_with_unit

    guest_resp = await client.post(
        "/api/v1/bookings",
        json={"inventory_unit_id": str(unit_id), "guest_name": "Raj Kumar", "guest_email": "raj@example.com"},
    )
    booking_id = guest_resp.json()["booking_id"]

    admin_token = create_access_token(seeded_admin, "admin")
    resp = await client.get(
        f"/api/v1/bookings/{booking_id}", headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert resp.status_code == 200


async def test_anonymous_request_to_get_booking_is_401(client, seeded_customer, seeded_unit):
    token = create_access_token(seeded_customer, "customer")
    create_resp = await client.post(
        "/api/v1/bookings",
        json={"inventory_unit_id": str(seeded_unit)},
        headers={"Authorization": f"Bearer {token}"},
    )
    booking_id = create_resp.json()["booking_id"]

    resp = await client.get(f"/api/v1/bookings/{booking_id}")
    assert resp.status_code == 401


async def test_my_bookings_returns_only_this_customers_bookings(
    client, test_session_factory, seeded_customer, seeded_unit
):
    token = create_access_token(seeded_customer, "customer")
    await client.post(
        "/api/v1/bookings",
        json={"inventory_unit_id": str(seeded_unit)},
        headers={"Authorization": f"Bearer {token}"},
    )

    list_resp = await client.get("/api/v1/bookings", headers={"Authorization": f"Bearer {token}"})
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1


async def test_my_bookings_excludes_guest_bookings_even_same_email(
    client, seeded_customer, seeded_unit
):
    """Guest checkout has no account-level identity to aggregate against —
    a guest booking never appears in anyone's 'My Bookings', even if the
    account holder's email happens to match the guest_email used."""
    await client.post(
        "/api/v1/bookings",
        json={
            "inventory_unit_id": str(seeded_unit),
            "guest_name": "Same Person",
            "guest_email": "matching@example.com",
        },
    )

    token = create_access_token(seeded_customer, "customer")
    list_resp = await client.get("/api/v1/bookings", headers={"Authorization": f"Bearer {token}"})
    assert list_resp.json() == []


async def test_guest_can_view_their_booking_via_manage_token(client, seeded_unit):
    create_resp = await client.post(
        "/api/v1/bookings",
        json={
            "inventory_unit_id": str(seeded_unit),
            "guest_name": "Raj Kumar",
            "guest_email": "raj@example.com",
        },
    )
    raw_token = create_resp.json()["manage_token"]

    resp = await client.get(f"/api/v1/bookings/manage/{raw_token}")
    assert resp.status_code == 200
    assert resp.json()["status"] == "pending_payment"


async def test_wrong_manage_token_returns_404(client, seeded_unit):
    await client.post(
        "/api/v1/bookings",
        json={
            "inventory_unit_id": str(seeded_unit),
            "guest_name": "Raj Kumar",
            "guest_email": "raj@example.com",
        },
    )

    resp = await client.get("/api/v1/bookings/manage/totally-made-up-token")
    assert resp.status_code == 404


async def test_manage_token_route_requires_no_auth_header_at_all(client, seeded_unit):
    """The token itself is the credential — no Authorization header should
    ever be required for this route."""
    create_resp = await client.post(
        "/api/v1/bookings",
        json={
            "inventory_unit_id": str(seeded_unit),
            "guest_name": "Raj Kumar",
            "guest_email": "raj@example.com",
        },
    )
    raw_token = create_resp.json()["manage_token"]

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as bare_client:
        resp = await bare_client.get(f"/api/v1/bookings/manage/{raw_token}")
    assert resp.status_code == 200

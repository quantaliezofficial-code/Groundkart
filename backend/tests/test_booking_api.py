import uuid
"""
07_design.md §3.3 through the actual ASGI app — proves the FastAPI route,
Pydantic validation, and dependency-injected DB session all wire together
correctly, not just the service function in isolation (that's
test_concurrency.py's job).
"""
import httpx
import pytest

from app.db import get_db, get_idem_db
from app.main import app


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
    app.dependency_overrides.pop(get_db, None)


async def test_healthz(client):
    resp = await client.get("/healthz")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


async def test_create_guest_booking_returns_manage_token(client, seeded_unit):
    resp = await client.post(
        "/api/v1/bookings",
        json={
            "inventory_unit_id": str(seeded_unit),
            "guest_name": "Priya Sharma",
            "guest_email": "priya@example.com",
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["manage_token"] is not None
    assert body["amount"] == "2000.00"


async def test_second_request_for_same_unit_gets_409(client, seeded_unit):
    first = await client.post(
        "/api/v1/bookings",
        json={
            "inventory_unit_id": str(seeded_unit),
            "guest_name": "Priya Sharma",
            "guest_email": "priya@example.com",
        },
    )
    assert first.status_code == 201

    second = await client.post(
        "/api/v1/bookings",
        json={
            "inventory_unit_id": str(seeded_unit),
            "guest_name": "Raj Kumar",
            "guest_email": "raj@example.com",
        },
    )
    assert second.status_code == 409


async def test_half_guest_request_is_rejected_with_422(client, seeded_unit):
    """guest_name without guest_email — should never reach the database at
    all (BookingCreateRequest's validator catches it first)."""
    resp = await client.post(
        "/api/v1/bookings",
        json={"inventory_unit_id": str(seeded_unit), "guest_name": "Only Name"},
    )
    assert resp.status_code == 422

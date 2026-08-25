"""
GET /api/v1/venues/{id}/inventory-units — a real gap found while starting
frontend integration: nothing let a caller list a venue's actual slots
(POST .../inventory-units, the owner-creates-them side, already existed).
Reuses get_venue's exact visibility gate (404-not-403 for a non-active
venue, owner/admin can preview) rather than inventing a separate rule.
"""
import uuid
from datetime import date, time, timedelta
from decimal import Decimal

import httpx
import pytest

from app.db import get_db
from app.main import app
from app.models.core import InventoryUnit, User, Venue
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


async def _owner_venue_and_unit(test_session_factory, *, venue_status="active", unit_status="available"):
    async with test_session_factory() as session:
        async with session.begin():
            owner = User(
                name="Mr. Sharma", email=f"sharma-{uuid.uuid4().hex[:8]}@example.com",
                phone=f"123{uuid.uuid4().hex[:7]}",
                password_hash=hash_password("whatever-1"), role="owner",
            )
            session.add(owner)
            await session.flush()
            venue = Venue(
                owner_id=owner.id, name="The Grand Turf Arena", slug=f"gta-{uuid.uuid4().hex[:8]}",
                category="sports", address="123 Stadium Road", city="Lucknow",
                unit_type="hour", base_price=Decimal("2000.00"), status=venue_status,
            )
            session.add(venue)
            await session.flush()
            unit = InventoryUnit(
                venue_id=venue.id, date=date(2027, 8, 15), start_time=time(20, 0), end_time=time(21, 0),
                price=Decimal("2000.00"), status=unit_status,
            )
            session.add(unit)
            await session.flush()
            owner_id, venue_id, unit_id = owner.id, venue.id, unit.id
    return owner_id, venue_id, unit_id


async def test_list_inventory_units_for_active_venue_is_public(client, test_session_factory):
    _, venue_id, unit_id = await _owner_venue_and_unit(test_session_factory)
    resp = await client.get(f"/api/v1/venues/{venue_id}/inventory-units")
    assert resp.status_code == 200
    units = resp.json()
    assert len(units) == 1
    assert units[0]["id"] == str(unit_id)
    assert units[0]["status"] == "available"


async def test_list_inventory_units_shows_both_available_and_booked(client, test_session_factory):
    _, venue_id, _ = await _owner_venue_and_unit(test_session_factory)
    async with test_session_factory() as session:
        async with session.begin():
            session.add(InventoryUnit(
                venue_id=venue_id, date=date(2027, 8, 15), start_time=time(21, 0), end_time=time(22, 0),
                price=Decimal("2000.00"), status="held",
            ))
    resp = await client.get(f"/api/v1/venues/{venue_id}/inventory-units")
    statuses = {u["status"] for u in resp.json()}
    assert statuses == {"available", "held"}


async def test_list_inventory_units_filters_by_date_range(client, test_session_factory):
    _, venue_id, _ = await _owner_venue_and_unit(test_session_factory)  # 2027-08-15
    async with test_session_factory() as session:
        async with session.begin():
            session.add(InventoryUnit(
                venue_id=venue_id, date=date(2027, 9, 1), start_time=time(10, 0), end_time=time(11, 0),
                price=Decimal("2000.00"), status="available",
            ))
    resp = await client.get(
        f"/api/v1/venues/{venue_id}/inventory-units",
        params={"date_from": "2027-08-01", "date_to": "2027-08-31"},
    )
    units = resp.json()
    assert len(units) == 1
    assert units[0]["date"] == "2027-08-15"


async def test_list_inventory_units_for_pending_venue_is_404_to_strangers(client, test_session_factory):
    _, venue_id, _ = await _owner_venue_and_unit(test_session_factory, venue_status="pending_review")
    resp = await client.get(f"/api/v1/venues/{venue_id}/inventory-units")
    assert resp.status_code == 404


async def test_list_inventory_units_for_pending_venue_visible_to_its_owner(client, test_session_factory):
    owner_id, venue_id, _ = await _owner_venue_and_unit(test_session_factory, venue_status="pending_review")
    token = create_access_token(owner_id, "owner")
    resp = await client.get(
        f"/api/v1/venues/{venue_id}/inventory-units", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200


async def test_list_inventory_units_for_nonexistent_venue_is_404(client):
    resp = await client.get(f"/api/v1/venues/{uuid.uuid4()}/inventory-units")
    assert resp.status_code == 404

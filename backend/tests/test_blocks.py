import uuid
from datetime import datetime, date, time
from zoneinfo import ZoneInfo
import httpx
import pytest
import pytest_asyncio
from app.db import get_db, get_idem_db
from app.main import app
from app.modules.auth.security import create_access_token
from app.models.core import User

pytestmark = pytest.mark.anyio
VENUE_LOCAL_TZ = ZoneInfo("Asia/Kolkata")

@pytest_asyncio.fixture
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

@pytest_asyncio.fixture
async def base_venue(client, seeded_verified_owner, seeded_admin):
    owner_token = create_access_token(seeded_verified_owner, "owner")
    admin_token = create_access_token(seeded_admin, "admin")
    resp = await client.post(
        "/api/v1/venues",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={
            "name": "Block Test Venue",
            "category": "sports",
            "address": "123 Test St",
            "city": "Testville",
            "unit_type": "hour",
            "base_price": "500.00",
        }
    )
    assert resp.status_code == 201
    venue = resp.json()
    resp = await client.post(
        f"/api/v1/admin/venues/{venue['id']}/approve",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert resp.status_code == 200
    return venue

@pytest_asyncio.fixture
async def hourly_units(client, base_venue, seeded_verified_owner):
    owner_token = create_access_token(seeded_verified_owner, "owner")
    today = date.today().isoformat()
    resp = await client.post(
        f"/api/v1/venues/{base_venue['id']}/inventory-units",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"units": [
            {"date": today, "start_time": "10:00:00", "end_time": "11:00:00"},
            {"date": today, "start_time": "11:00:00", "end_time": "12:00:00"},
            {"date": today, "start_time": "12:00:00", "end_time": "13:00:00"},
        ]}
    )
    assert resp.status_code == 201
    return resp.json()

async def test_venue_block_creation_and_listing(client, base_venue, seeded_verified_owner, hourly_units):
    owner_token = create_access_token(seeded_verified_owner, "owner")
    today = date.today()
    start = datetime.combine(today, time(10, 30)).replace(tzinfo=VENUE_LOCAL_TZ)
    end = datetime.combine(today, time(11, 30)).replace(tzinfo=VENUE_LOCAL_TZ)
    
    resp = await client.post(
        f"/api/v1/venues/{base_venue['id']}/blocks",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={
            "start_time": start.isoformat(),
            "end_time": end.isoformat(),
            "reason": "Maintenance"
        }
    )
    assert resp.status_code == 201
    block = resp.json()
    assert block["status"] == "active"
    assert block["reason"] == "Maintenance"
    
    resp = await client.get(
        f"/api/v1/venues/{base_venue['id']}/blocks",
        headers={"Authorization": f"Bearer {owner_token}"}
    )
    assert resp.status_code == 200
    blocks = resp.json()
    assert len(blocks) == 1
    assert blocks[0]["id"] == block["id"]

async def test_availability_calculation_with_blocks(client, base_venue, seeded_verified_owner, hourly_units):
    owner_token = create_access_token(seeded_verified_owner, "owner")
    today = date.today()
    start = datetime.combine(today, time(10, 30)).replace(tzinfo=VENUE_LOCAL_TZ)
    end = datetime.combine(today, time(11, 30)).replace(tzinfo=VENUE_LOCAL_TZ)
    
    await client.post(
        f"/api/v1/venues/{base_venue['id']}/blocks",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"start_time": start.isoformat(), "end_time": end.isoformat(), "reason": "Partial overlap test"}
    )
    
    resp = await client.get(
        f"/api/v1/venues/{base_venue['id']}/inventory-units",
        headers={"Authorization": f"Bearer {owner_token}"}
    )
    units = resp.json()
    assert units[0]["status"] == "blocked"
    assert units[1]["status"] == "blocked"
    assert units[2]["status"] == "available"

async def test_exact_boundary_block(client, base_venue, seeded_verified_owner, hourly_units):
    owner_token = create_access_token(seeded_verified_owner, "owner")
    today = date.today()
    start = datetime.combine(today, time(11, 0)).replace(tzinfo=VENUE_LOCAL_TZ)
    end = datetime.combine(today, time(12, 0)).replace(tzinfo=VENUE_LOCAL_TZ)
    
    await client.post(
        f"/api/v1/venues/{base_venue['id']}/blocks",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"start_time": start.isoformat(), "end_time": end.isoformat(), "reason": "Exact boundary"}
    )
    
    resp = await client.get(
        f"/api/v1/venues/{base_venue['id']}/inventory-units",
        headers={"Authorization": f"Bearer {owner_token}"}
    )
    units = resp.json()
    assert units[0]["status"] == "available"
    assert units[1]["status"] == "blocked"
    assert units[2]["status"] == "available"

async def test_inactive_block_ignored(client, base_venue, seeded_verified_owner, hourly_units):
    owner_token = create_access_token(seeded_verified_owner, "owner")
    today = date.today()
    start = datetime.combine(today, time(11, 0)).replace(tzinfo=VENUE_LOCAL_TZ)
    end = datetime.combine(today, time(12, 0)).replace(tzinfo=VENUE_LOCAL_TZ)
    
    resp = await client.post(
        f"/api/v1/venues/{base_venue['id']}/blocks",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"start_time": start.isoformat(), "end_time": end.isoformat(), "reason": "To be deactivated"}
    )
    block_id = resp.json()["id"]
    
    await client.patch(
        f"/api/v1/venues/{base_venue['id']}/blocks/{block_id}",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"status": "inactive"}
    )
    
    resp = await client.get(
        f"/api/v1/venues/{base_venue['id']}/inventory-units",
        headers={"Authorization": f"Bearer {owner_token}"}
    )
    units = resp.json()
    assert units[1]["status"] == "available"

async def test_cannot_block_over_confirmed_booking(client, base_venue, seeded_verified_owner, seeded_admin, hourly_units):
    owner_token = create_access_token(seeded_verified_owner, "owner")
    admin_token = create_access_token(seeded_admin, "admin")
    
    unit_id = hourly_units[1]["id"]
    resp = await client.post(
        "/api/v1/bookings",
        json={
            "inventory_unit_id": unit_id,
            "guest_name": "Test",
            "guest_email": "test@test.com"
        }
    )
    assert resp.status_code == 201
    booking_id = resp.json()["booking_id"]
    
    await client.post(
        f"/api/v1/admin/bookings/{booking_id}/confirm-payment",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    today = date.today()
    start = datetime.combine(today, time(10, 30)).replace(tzinfo=VENUE_LOCAL_TZ)
    end = datetime.combine(today, time(11, 30)).replace(tzinfo=VENUE_LOCAL_TZ)
    
    resp = await client.post(
        f"/api/v1/venues/{base_venue['id']}/blocks",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"start_time": start.isoformat(), "end_time": end.isoformat(), "reason": "Should fail"}
    )
    assert resp.status_code == 409
    assert "overlaps with an existing booking" in resp.json()["detail"]

async def test_full_day_block(client, seeded_verified_owner, seeded_admin):
    owner_token = create_access_token(seeded_verified_owner, "owner")
    admin_token = create_access_token(seeded_admin, "admin")
    
    resp = await client.post(
        "/api/v1/venues",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={
            "name": "Full Day Venue",
            "category": "farmhouse",
            "address": "123",
            "city": "Test",
            "unit_type": "full_day",
            "base_price": "5000.00",
        }
    )
    venue = resp.json()
    await client.post(f"/api/v1/admin/venues/{venue['id']}/approve", headers={"Authorization": f"Bearer {admin_token}"})
    
    today = date.today()
    await client.post(
        f"/api/v1/venues/{venue['id']}/inventory-units",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"units": [{"date": today.isoformat()}]}
    )
    
    start = datetime.combine(today, time(12, 0)).replace(tzinfo=VENUE_LOCAL_TZ)
    end = datetime.combine(today, time(14, 0)).replace(tzinfo=VENUE_LOCAL_TZ)
    await client.post(
        f"/api/v1/venues/{venue['id']}/blocks",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"start_time": start.isoformat(), "end_time": end.isoformat(), "reason": "Mid-day maintenance"}
    )
    
    resp = await client.get(
        f"/api/v1/venues/{venue['id']}/inventory-units",
        headers={"Authorization": f"Bearer {owner_token}"}
    )
    units = resp.json()
    assert units[0]["status"] == "blocked"

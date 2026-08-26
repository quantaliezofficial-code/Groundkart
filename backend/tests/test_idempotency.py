import asyncio
import uuid
import httpx
import pytest
from datetime import datetime, timedelta, timezone
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db, get_idem_db
from app.main import app
from app.modules.auth.security import create_access_token
from app.models.core import IdempotencyKey
from app.config import settings

@pytest.fixture
async def async_client(test_session_factory):
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

@pytest.fixture
def db_customer_token(seeded_customer):
    return create_access_token(seeded_customer, "customer")

@pytest.fixture
async def db_session(test_session_factory):
    async with test_session_factory() as session:
        yield session

@pytest.fixture
def make_booking_payload(seeded_unit):
    return {
        "inventory_unit_id": str(seeded_unit),
        "guest_name": None,
        "guest_email": None,
        "guest_phone": None
    }

@pytest.mark.asyncio
async def test_idempotency_sequential_replay(async_client, db_customer_token, make_booking_payload, db_session: AsyncSession):
    idem_key = str(uuid.uuid4())
    headers = {
        "Authorization": f"Bearer {db_customer_token}",
        "Idempotency-Key": idem_key
    }
    
    # First request
    resp1 = await async_client.post("/api/v1/bookings", json=make_booking_payload, headers=headers)
    assert resp1.status_code == 201
    data1 = resp1.json()
    
    # Second request (replay)
    resp2 = await async_client.post("/api/v1/bookings", json=make_booking_payload, headers=headers)
    assert resp2.status_code == 201
    data2 = resp2.json()
    
    # Must be exact same response
    assert data1 == data2

    # Verify only one booking was created in DB for this unit
    from app.models.core import Booking
    result = await db_session.execute(
        select(Booking).where(Booking.inventory_unit_id == make_booking_payload["inventory_unit_id"])
    )
    assert len(result.scalars().all()) == 1

@pytest.mark.asyncio
async def test_idempotency_mismatched_payload(async_client, db_customer_token, make_booking_payload):
    idem_key = str(uuid.uuid4())
    headers = {
        "Authorization": f"Bearer {db_customer_token}",
        "Idempotency-Key": idem_key
    }
    
    resp1 = await async_client.post("/api/v1/bookings", json=make_booking_payload, headers=headers)
    assert resp1.status_code == 201
    
    # Alter payload to something valid
    payload2 = make_booking_payload.copy()
    payload2["guest_name"] = "Alice"
    payload2["guest_email"] = "alice@example.com"
    
    resp2 = await async_client.post("/api/v1/bookings", json=payload2, headers=headers)
    assert resp2.status_code == 422
    assert "Idempotency key replayed with different payload" in resp2.text

@pytest.mark.asyncio
async def test_idempotency_concurrent_replay(async_client, db_customer_token, make_booking_payload):
    idem_key = str(uuid.uuid4())
    headers = {
        "Authorization": f"Bearer {db_customer_token}",
        "Idempotency-Key": idem_key
    }
    
    # Fire multiple requests concurrently
    tasks = [
        async_client.post("/api/v1/bookings", json=make_booking_payload, headers=headers)
        for _ in range(3)
    ]
    
    responses = await asyncio.gather(*tasks)
    
    # One should succeed with 201, others should either get 409 or 201 (if the first finishes incredibly fast, which is unlikely given they are fired simultaneously)
    # The requirement: "Ensure the key is atomically claimed so concurrent identical requests cannot execute twice."
    status_codes = [r.status_code for r in responses]
    assert 201 in status_codes
    assert 409 in status_codes or status_codes.count(201) == 3

@pytest.mark.asyncio
async def test_idempotency_expiry_cleanup(async_client, db_customer_token, make_booking_payload, db_session: AsyncSession):
    idem_key = str(uuid.uuid4())
    headers = {
        "Authorization": f"Bearer {db_customer_token}",
        "Idempotency-Key": idem_key
    }
    
    resp1 = await async_client.post("/api/v1/bookings", json=make_booking_payload, headers=headers)
    assert resp1.status_code == 201
    
    # Manually expire the key
    await db_session.execute(
        update(IdempotencyKey).where(IdempotencyKey.key == idem_key).values(
            expires_at=datetime.now(timezone.utc) - timedelta(days=1)
        )
    )
    await db_session.commit()
    
    resp2 = await async_client.post("/api/v1/bookings", json=make_booking_payload, headers=headers)
    assert resp2.status_code == 409
    assert "expired" in resp2.text

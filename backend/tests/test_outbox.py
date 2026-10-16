import pytest
import uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from httpx import AsyncClient, ASGITransport

from app.models.core import Booking, OutboxEvent, Payment
from app.modules.core.outbox_worker import process_outbox_events, handle_event
from app.modules.core.outbox import create_outbox_event
from app.db import get_db, get_idem_db
from app.main import app

@pytest.fixture
async def db_session(test_session_factory):
    async with test_session_factory() as session:
        yield session

@pytest.fixture
async def client(test_session_factory):
    async def _override_get_db():
        async with test_session_factory() as session:
            yield session
            
    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_idem_db] = _override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_idem_db, None)

@pytest.fixture
def make_booking_payload(seeded_owner_with_unit):
    _, _, unit_id = seeded_owner_with_unit
    return {
        "inventory_unit_id": str(unit_id),
        "guest_name": "Guest User",
        "guest_email": "guest@example.com",
        "guest_phone": "+919876543210"
    }

@pytest.mark.asyncio
async def test_commit_produces_outbox_event(
    client: AsyncClient, db_session, make_booking_payload
):
    response = await client.post("/api/v1/bookings", json=make_booking_payload)
    assert response.status_code == 201
    
    booking_id = response.json()["booking_id"]
    
    stmt = select(OutboxEvent).where(OutboxEvent.aggregate_id == uuid.UUID(booking_id))
    result = await db_session.execute(stmt)
    events = result.scalars().all()
    
    assert len(events) == 1
    event = events[0]
    assert event.event_type == "booking_created"
    assert event.status == "pending"

@pytest.mark.asyncio
async def test_rollback_no_event(
    client: AsyncClient, db_session, make_booking_payload
):
    payload = make_booking_payload.copy()
    payload["inventory_unit_id"] = str(uuid.uuid4())
    
    response = await client.post("/api/v1/bookings", json=payload)
    assert response.status_code in (404, 409)
    
    stmt = select(OutboxEvent)
    result = await db_session.execute(stmt)
    events = result.scalars().all()
    
    assert len(events) == 0

@pytest.mark.asyncio
async def test_retry_and_failed_status(db_session, monkeypatch):
    event_id = uuid.uuid4()
    
    async def mock_handle_event(event, session):
        raise Exception("Intentional failure")
        
    monkeypatch.setattr("app.modules.core.outbox_worker.handle_event", mock_handle_event)
    
    event = OutboxEvent(
        id=event_id,
        event_type="test",
        aggregate_type="test",
        aggregate_id=uuid.uuid4(),
        payload={},
        status="pending",
        attempts=4
    )
    db_session.add(event)
    await db_session.commit()
    
    processed = await process_outbox_events(db_session)
    assert processed == 0
    
    await db_session.refresh(event)
    assert event.status == "failed"
    assert event.attempts == 5
    assert event.error_details == "Intentional failure"
    await db_session.commit()

@pytest.mark.asyncio
async def test_retry_bounded_backoff(db_session, monkeypatch):
    event_id = uuid.uuid4()
    
    async def mock_handle_event(event, session):
        raise Exception("Intentional failure")
        
    monkeypatch.setattr("app.modules.core.outbox_worker.handle_event", mock_handle_event)
    
    event = OutboxEvent(
        id=event_id,
        event_type="test",
        aggregate_type="test",
        aggregate_id=uuid.uuid4(),
        payload={},
        status="pending",
        attempts=1,
        next_attempt_at=datetime.now(timezone.utc) - timedelta(minutes=1)
    )
    db_session.add(event)
    await db_session.commit()
    
    await process_outbox_events(db_session)
    
    await db_session.refresh(event)
    assert event.status == "pending"
    assert event.attempts == 2
    assert event.next_attempt_at > datetime.now(timezone.utc) + timedelta(minutes=3)
    await db_session.commit()

@pytest.mark.asyncio
async def test_duplicate_delivery_idempotent(db_session, monkeypatch):
    event_id = uuid.uuid4()
    
    calls = 0
    async def mock_handle_event(event, session):
        nonlocal calls
        calls += 1
        
    monkeypatch.setattr("app.modules.core.outbox_worker.handle_event", mock_handle_event)
    
    event = OutboxEvent(
        id=event_id,
        event_type="test",
        aggregate_type="test",
        aggregate_id=uuid.uuid4(),
        payload={},
        status="pending"
    )
    db_session.add(event)
    await db_session.commit()
    
    processed = await process_outbox_events(db_session)
    assert processed == 1
    assert calls == 1
    
    await db_session.refresh(event)
    assert event.status == "processed"
    
    processed = await process_outbox_events(db_session)
    assert processed == 0
    assert calls == 1
    await db_session.commit()

import pytest
import uuid
import httpx
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db import get_db, get_idem_db
from app.main import app
from app.models.core import User, Venue
from app.modules.auth.security import create_access_token

@pytest.fixture
async def client(test_session_factory):
    async def _override_get_db():
        async with test_session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_idem_db] = _override_get_db

    async with AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac

    app.dependency_overrides.clear()

@pytest.fixture
async def owner_and_venue(test_session_factory):
    async with test_session_factory() as session:
        async with session.begin():
            owner = User(
                name="Test Owner",
                email=f"owner-{uuid.uuid4().hex[:8]}@example.com",
                phone="1234567890",
                password_hash="test",
                role="owner",
                is_verified=True,
            )
            session.add(owner)
            await session.flush()
            
            venue = Venue(
                owner_id=owner.id,
                name="Test Venue",
                slug=f"test-venue-{uuid.uuid4().hex[:8]}",
                category="sports",
                address="123 Test St",
                city="Test City",
                unit_type="hour",
                base_price=100,
                status="active"
            )
            session.add(venue)
            await session.flush()
        return owner, venue

@pytest.fixture
async def owner_token(owner_and_venue):
    owner, _ = owner_and_venue
    return create_access_token(owner.id, "owner")

@pytest.fixture
async def active_venue(owner_and_venue):
    _, venue = owner_and_venue
    return venue

@pytest.fixture
async def db_session(test_session_factory):
    async with test_session_factory() as session:
        yield session

@pytest.mark.asyncio
async def test_archive_venue(
    client: AsyncClient,
    owner_token: str,
    active_venue: Venue,
    db_session: AsyncSession
):
    # Public can see active venue
    res = await client.get("/api/v1/venues")
    assert res.status_code == 200
    assert any(v["id"] == str(active_venue.id) for v in res.json().get("data", res.json()))

    # Owner archives venue
    headers = {"Authorization": f"Bearer {owner_token}"}
    res = await client.delete(f"/api/v1/venues/{active_venue.id}", headers=headers)
    assert res.status_code == 204

    # DB status updated
    venue_res = await db_session.execute(select(Venue).where(Venue.id == active_venue.id))
    active_venue = venue_res.scalar_one()
    assert active_venue.status == "archived"

    # Public can no longer see it
    res = await client.get("/api/v1/venues")
    assert not any(v["id"] == str(active_venue.id) for v in res.json().get("data", res.json()))

    # Owner can still see it
    res = await client.get("/api/v1/owner/venues", headers=headers)
    assert res.status_code == 200
    assert any(v["id"] == str(active_venue.id) for v in res.json())


@pytest.mark.asyncio
async def test_soft_delete_user(
    client: AsyncClient,
    owner_token: str,
    active_venue: Venue,
    db_session: AsyncSession
):
    owner_id = active_venue.owner_id
    
    headers = {"Authorization": f"Bearer {owner_token}"}
    res = await client.delete("/api/v1/users/me", headers=headers)
    assert res.status_code == 204

    # DB user updated
    res = await db_session.execute(select(User).where(User.id == owner_id))
    user = res.scalar_one()
    assert user.deleted_at is not None

    # Active venue archived
    venue_res = await db_session.execute(select(Venue).where(Venue.id == active_venue.id))
    active_venue = venue_res.scalar_one()
    assert active_venue.status == "archived"






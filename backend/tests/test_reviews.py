import uuid

import httpx
import pytest
from sqlalchemy import select

from app.db import get_db, get_idem_db
from app.main import app
from app.models.core import Venue, Review
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


@pytest.fixture
async def setup_venue(test_session_factory, seeded_verified_owner, seeded_admin):
    """Creates an active venue for review testing."""
    async with test_session_factory() as session:
        async with session.begin():
            venue = Venue(
                owner_id=seeded_verified_owner,
                name="Test Venue for Reviews",
                slug=f"test-venue-{uuid.uuid4().hex[:8]}",
                category="sports",
                address="123 Road",
                city="Test City",
                unit_type="hour",
                base_price=1000,
                status="active",
            )
            session.add(venue)
            await session.flush()
            venue_id = venue.id
    return venue_id


async def test_create_and_list_review(client, setup_venue, seeded_customer):
    venue_id = setup_venue
    token = create_access_token(seeded_customer, "customer")

    # 1. Create a review
    resp = await client.post(
        f"/api/v1/venues/{venue_id}/reviews",
        json={"rating": 4, "content": "Great place!"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["rating"] == 4
    assert body["content"] == "Great place!"
    assert "user_name" in body

    review_id = body["id"]

    # 2. List the reviews (public)
    list_resp = await client.get(f"/api/v1/venues/{venue_id}/reviews")
    assert list_resp.status_code == 200
    list_body = list_resp.json()
    assert len(list_body) == 1
    assert list_body[0]["id"] == review_id


async def test_admin_can_delete_review(client, setup_venue, seeded_customer, seeded_admin):
    venue_id = setup_venue
    customer_token = create_access_token(seeded_customer, "customer")
    admin_token = create_access_token(seeded_admin, "admin")

    # Create review
    create_resp = await client.post(
        f"/api/v1/venues/{venue_id}/reviews",
        json={"rating": 5, "content": "Awesome!"},
        headers={"Authorization": f"Bearer {customer_token}"},
    )
    assert create_resp.status_code == 201
    review_id = create_resp.json()["id"]

    # Delete review as admin
    del_resp = await client.delete(
        f"/api/v1/admin/reviews/{review_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert del_resp.status_code == 204

    # Ensure it's deleted
    list_resp = await client.get(f"/api/v1/venues/{venue_id}/reviews")
    assert len(list_resp.json()) == 0


async def test_admin_list_all_reviews(client, setup_venue, seeded_customer, seeded_admin):
    venue_id = setup_venue
    customer_token = create_access_token(seeded_customer, "customer")
    admin_token = create_access_token(seeded_admin, "admin")

    # Create review
    await client.post(
        f"/api/v1/venues/{venue_id}/reviews",
        json={"rating": 3, "content": "It was okay."},
        headers={"Authorization": f"Bearer {customer_token}"},
    )

    # Admin list all reviews
    list_resp = await client.get(
        f"/api/v1/admin/reviews",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert list_resp.status_code == 200
    body = list_resp.json()
    assert len(body) >= 1
    assert body[0]["venue_name"] == "Test Venue for Reviews"


async def test_average_rating_recalculated(client, test_session_factory, setup_venue, seeded_customer, seeded_admin):
    venue_id = setup_venue
    customer_token = create_access_token(seeded_customer, "customer")
    admin_token = create_access_token(seeded_admin, "admin")

    # 1. Create two reviews (rating 5 and rating 1)
    await client.post(
        f"/api/v1/venues/{venue_id}/reviews",
        json={"rating": 5, "content": "Awesome!"},
        headers={"Authorization": f"Bearer {customer_token}"},
    )
    
    resp2 = await client.post(
        f"/api/v1/venues/{venue_id}/reviews",
        json={"rating": 1, "content": "Terrible!"},
        headers={"Authorization": f"Bearer {customer_token}"},
    )
    review2_id = resp2.json()["id"]

    # 2. Average rating should be 3
    async with test_session_factory() as session:
        venue = (await session.execute(select(Venue).where(Venue.id == venue_id))).scalar_one()
        assert venue.avg_rating == 3.00

    # 3. Delete the 1-star review
    await client.delete(
        f"/api/v1/admin/reviews/{review2_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    # 4. Average rating should now be 5
    async with test_session_factory() as session:
        venue = (await session.execute(select(Venue).where(Venue.id == venue_id))).scalar_one()
        assert venue.avg_rating == 5.00

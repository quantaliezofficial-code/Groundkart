import uuid
from datetime import date as date_, time, datetime

import httpx
import pytest
from sqlalchemy import select

from app.db import get_db, get_idem_db
from app.main import app
from app.models.core import Venue, Review, Booking, InventoryUnit
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
async def setup_review_data(test_session_factory, seeded_verified_owner, seeded_customer):
    """Creates an active venue, inventory unit, and booking for review testing."""
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

            unit = InventoryUnit(
                venue_id=venue_id,
                date=date_.today(),
                start_time=time(10, 0),
                end_time=time(11, 0),
                price=1000,
                status="available",
            )
            session.add(unit)
            await session.flush()

            # Completed booking
            booking = Booking(
                customer_id=seeded_customer,
                venue_id=venue_id,
                venue_name="Test Venue for Reviews",
                venue_category="sports",
                inventory_unit_id=unit.id,
                status="completed",
                amount=1000,
                currency="INR",
            )
            session.add(booking)
            await session.flush()
            booking_id = booking.id

            # Uncompleted booking
            uncompleted_booking = Booking(
                customer_id=seeded_customer,
                venue_id=venue_id,
                venue_name="Test Venue for Reviews",
                venue_category="sports",
                inventory_unit_id=unit.id,
                status="confirmed",
                amount=1000,
                currency="INR",
            )
            session.add(uncompleted_booking)
            await session.flush()
            uncompleted_booking_id = uncompleted_booking.id

            # Cancelled booking
            cancelled_booking = Booking(
                customer_id=seeded_customer,
                venue_id=venue_id,
                venue_name="Test Venue for Reviews",
                venue_category="sports",
                inventory_unit_id=unit.id,
                status="cancelled",
                amount=1000,
                currency="INR",
            )
            session.add(cancelled_booking)
            await session.flush()
            cancelled_booking_id = cancelled_booking.id

    return {
        "venue_id": venue_id,
        "booking_id": booking_id,
        "uncompleted_booking_id": uncompleted_booking_id,
        "cancelled_booking_id": cancelled_booking_id
    }


async def test_create_and_list_review(client, setup_review_data, seeded_customer):
    venue_id = setup_review_data["venue_id"]
    booking_id = setup_review_data["booking_id"]
    token = create_access_token(seeded_customer, "customer")

    # 1. Create a review
    resp = await client.post(
        f"/api/v1/venues/{venue_id}/reviews",
        json={"booking_id": str(booking_id), "rating": 4, "content": "Great place!"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["rating"] == 4
    assert body["content"] == "Great place!"
    assert "user_name" in body
    assert body["booking_id"] == str(booking_id)

    review_id = body["id"]

    # 2. List the reviews (public)
    list_resp = await client.get(f"/api/v1/venues/{venue_id}/reviews")
    assert list_resp.status_code == 200
    list_body = list_resp.json()
    assert len(list_body) == 1
    assert list_body[0]["id"] == review_id
    assert list_body[0]["booking_id"] == str(booking_id)

    # 3. Prevent duplicates
    dup_resp = await client.post(
        f"/api/v1/venues/{venue_id}/reviews",
        json={"booking_id": str(booking_id), "rating": 5, "content": "I want to review again!"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert dup_resp.status_code == 400
    assert "Booking already reviewed" in dup_resp.json()["detail"]


async def test_prevent_review_for_uncompleted_or_cancelled(client, setup_review_data, seeded_customer):
    venue_id = setup_review_data["venue_id"]
    token = create_access_token(seeded_customer, "customer")

    # Uncompleted
    un_resp = await client.post(
        f"/api/v1/venues/{venue_id}/reviews",
        json={"booking_id": str(setup_review_data["uncompleted_booking_id"]), "rating": 4, "content": "Great place!"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert un_resp.status_code == 400
    assert "Only completed bookings can be reviewed" in un_resp.json()["detail"]

    # Cancelled
    canc_resp = await client.post(
        f"/api/v1/venues/{venue_id}/reviews",
        json={"booking_id": str(setup_review_data["cancelled_booking_id"]), "rating": 4, "content": "Great place!"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert canc_resp.status_code == 400
    assert "Only completed bookings can be reviewed" in canc_resp.json()["detail"]


async def test_admin_can_delete_review(client, setup_review_data, seeded_customer, seeded_admin):
    venue_id = setup_review_data["venue_id"]
    booking_id = setup_review_data["booking_id"]
    customer_token = create_access_token(seeded_customer, "customer")
    admin_token = create_access_token(seeded_admin, "admin")

    # Create review
    create_resp = await client.post(
        f"/api/v1/venues/{venue_id}/reviews",
        json={"booking_id": str(booking_id), "rating": 5, "content": "Awesome!"},
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


async def test_admin_list_all_reviews(client, setup_review_data, seeded_customer, seeded_admin):
    venue_id = setup_review_data["venue_id"]
    booking_id = setup_review_data["booking_id"]
    customer_token = create_access_token(seeded_customer, "customer")
    admin_token = create_access_token(seeded_admin, "admin")

    # Create review
    await client.post(
        f"/api/v1/venues/{venue_id}/reviews",
        json={"booking_id": str(booking_id), "rating": 3, "content": "It was okay."},
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


async def test_average_rating_recalculated(client, test_session_factory, setup_review_data, seeded_customer, seeded_admin):
    venue_id = setup_review_data["venue_id"]
    booking_id = setup_review_data["booking_id"]
    
    # We need a second completed booking to make a second review
    async with test_session_factory() as session:
        async with session.begin():
            unit = InventoryUnit(
                venue_id=venue_id,
                date=date_.today(),
                start_time=time(12, 0),
                end_time=time(13, 0),
                price=1000,
                status="available",
            )
            session.add(unit)
            await session.flush()
            booking2 = Booking(
                customer_id=seeded_customer,
                venue_id=venue_id,
                venue_name="Test Venue for Reviews",
                venue_category="sports",
                inventory_unit_id=unit.id,
                status="completed",
                amount=1000,
                currency="INR",
            )
            session.add(booking2)
            await session.flush()
            booking2_id = booking2.id

    customer_token = create_access_token(seeded_customer, "customer")
    admin_token = create_access_token(seeded_admin, "admin")

    # 1. Create two reviews (rating 5 and rating 1)
    await client.post(
        f"/api/v1/venues/{venue_id}/reviews",
        json={"booking_id": str(booking_id), "rating": 5, "content": "Awesome!"},
        headers={"Authorization": f"Bearer {customer_token}"},
    )
    
    resp2 = await client.post(
        f"/api/v1/venues/{venue_id}/reviews",
        json={"booking_id": str(booking2_id), "rating": 1, "content": "Terrible!"},
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

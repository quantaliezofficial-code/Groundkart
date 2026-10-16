import uuid
import pytest
from httpx import AsyncClient

from app.db import get_db, get_idem_db
from app.main import app
from app.models.core import User, Venue, InventoryUnit, Booking, OwnerVerification, Notification, VenueMedia
from app.modules.auth.security import create_access_token
import pytest_asyncio
import httpx

@pytest_asyncio.fixture
async def client(test_session_factory):
    async def override_get_db():
        async with test_session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_idem_db] = override_get_db
    
    transport = httpx.ASGITransport(app=app)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac
    finally:
        app.dependency_overrides.clear()

async def _create_test_user(db, role="customer"):
    user = User(
        email=f"test_{uuid.uuid4()}@example.com",
        phone=f"+1{uuid.uuid4().hex[:10]}",
        password_hash="fake",
        name=f"Test {role}",
        role=role
    )
    db.add(user)
    await db.commit()
    return user

async def _create_test_venue(db, owner_id):
    venue = Venue(
        owner_id=owner_id,
        name=f"Venue {uuid.uuid4()}",
        slug=f"venue-{uuid.uuid4()}",
        category="sports",
        status="active",
        unit_type="hour",
        base_price=100,
        address="123 Test St",
        city="Test City"
    )
    db.add(venue)
    await db.flush()
    db.add_all([
        VenueMedia(venue_id=venue.id, url="http://example.com/p1.jpg", is_cover=True, sort_order=0),
        VenueMedia(venue_id=venue.id, url="http://example.com/p2.jpg", is_cover=False, sort_order=1),
        VenueMedia(venue_id=venue.id, url="http://example.com/p3.jpg", is_cover=False, sort_order=2),
    ])
    await db.commit()
    return venue

from datetime import date, time

async def _create_test_booking(db, venue_id, customer_id=None):
    unit = InventoryUnit(venue_id=venue_id, date=date(2027, 1, 1), start_time=time(10, 0), end_time=time(11, 0), price=100, status="booked")
    db.add(unit)
    await db.commit()
    booking = Booking(
        venue_id=venue_id,
        venue_name="Test Venue",
        venue_category="sports",
        inventory_unit_id=unit.id,
        customer_id=customer_id,
        status="confirmed",
        amount=100
    )
    db.add(booking)
    await db.commit()
    return booking

@pytest_asyncio.fixture
async def users(test_session_factory, clean_tables):
    async with test_session_factory() as db:
        return {
            "admin": await _create_test_user(db, "admin"),
            "owner1": await _create_test_user(db, "owner"),
            "owner2": await _create_test_user(db, "owner"),
            "customer1": await _create_test_user(db, "customer"),
            "customer2": await _create_test_user(db, "customer")
        }

@pytest.mark.asyncio
async def test_venue_authorization(client: AsyncClient, test_session_factory, users):
    async with test_session_factory() as db:
        venue = await _create_test_venue(db, users["owner1"].id)
        await db.commit()

    # Owner 1 can modify
    resp = await client.patch(
        f"/api/v1/venues/{venue.id}", 
        json={"name": "New Name"}, 
        headers={"Authorization": f"Bearer {create_access_token(users['owner1'].id, 'owner')}"}
    )
    assert resp.status_code == 200

    # Owner 2 cannot modify
    resp = await client.patch(
        f"/api/v1/venues/{venue.id}", 
        json={"name": "Hacked"}, 
        headers={"Authorization": f"Bearer {create_access_token(users['owner2'].id, 'owner')}"}
    )
    assert resp.status_code == 403

    # Admin can modify
    resp = await client.patch(
        f"/api/v1/venues/{venue.id}", 
        json={"name": "Admin Edit"}, 
        headers={"Authorization": f"Bearer {create_access_token(users['admin'].id, 'admin')}"}
    )
    assert resp.status_code == 200

@pytest.mark.asyncio
async def test_booking_authorization(client: AsyncClient, test_session_factory, users):
    async with test_session_factory() as db:
        venue = await _create_test_venue(db, users["owner1"].id)
        booking = await _create_test_booking(db, venue.id, users["customer1"].id)
        await db.commit()

    # Customer 1 can view
    resp = await client.get(
        f"/api/v1/bookings/{booking.id}",
        headers={"Authorization": f"Bearer {create_access_token(users['customer1'].id, 'customer')}"}
    )
    assert resp.status_code == 200

    # Customer 2 cannot view (IDOR protection)
    resp = await client.get(
        f"/api/v1/bookings/{booking.id}",
        headers={"Authorization": f"Bearer {create_access_token(users['customer2'].id, 'customer')}"}
    )
    assert resp.status_code == 404

    # Owner 1 cannot view via this route (deliberate scope boundary)
    resp = await client.get(
        f"/api/v1/bookings/{booking.id}",
        headers={"Authorization": f"Bearer {create_access_token(users['owner1'].id, 'owner')}"}
    )
    assert resp.status_code == 404

    # Owner 2 cannot view
    resp = await client.get(
        f"/api/v1/bookings/{booking.id}",
        headers={"Authorization": f"Bearer {create_access_token(users['owner2'].id, 'owner')}"}
    )
    assert resp.status_code == 404

    # Admin can view
    resp = await client.get(
        f"/api/v1/bookings/{booking.id}",
        headers={"Authorization": f"Bearer {create_access_token(users['admin'].id, 'admin')}"}
    )
    assert resp.status_code == 200

@pytest.mark.asyncio
async def test_booking_cancel_authorization(client: AsyncClient, test_session_factory, users):
    async with test_session_factory() as db:
        venue = await _create_test_venue(db, users["owner1"].id)
        booking = await _create_test_booking(db, venue.id, users["customer1"].id)
        await db.commit()

    # Customer 2 cannot cancel (IDOR protection)
    resp = await client.post(
        f"/api/v1/bookings/{booking.id}/cancel",
        json={"reason": "Hacking"},
        headers={"Authorization": f"Bearer {create_access_token(users['customer2'].id, 'customer')}"}
    )
    assert resp.status_code == 404
    
    # Customer 1 can cancel
    resp = await client.post(
        f"/api/v1/bookings/{booking.id}/cancel",
        json={"reason": "Can't make it"},
        headers={"Authorization": f"Bearer {create_access_token(users['customer1'].id, 'customer')}"}
    )
    assert resp.status_code == 200

@pytest.mark.asyncio
async def test_notification_authorization(client: AsyncClient, test_session_factory, users):
    async with test_session_factory() as db:
        notif = Notification(user_id=users["customer1"].id, type="info", message="Hi")
        db.add(notif)
        await db.commit()
        await db.refresh(notif)
        notif_id = notif.id

    # Customer 2 cannot delete
    resp = await client.delete(
        f"/api/v1/notifications/{notif_id}",
        headers={"Authorization": f"Bearer {create_access_token(users['customer2'].id, 'customer')}"}
    )
    assert resp.status_code == 404

    # Customer 1 can delete
    resp = await client.delete(
        f"/api/v1/notifications/{notif_id}",
        headers={"Authorization": f"Bearer {create_access_token(users['customer1'].id, 'customer')}"}
    )
    assert resp.status_code == 204

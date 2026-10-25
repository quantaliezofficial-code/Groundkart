import uuid
from datetime import date, datetime, time, timedelta
from decimal import Decimal

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import text

from app.db import get_db, get_idem_db
from app.main import app
from app.models.core import InventoryUnit, User, Venue, UseCase, VenuePurpose, VenueRentalOption, VenueMedia
from app.modules.auth.security import create_access_token, hash_password


@pytest_asyncio.fixture
async def client(test_session_factory):
    async def _override_get_db():
        async with test_session_factory() as session:
            try:
                yield session
            finally:
                if session.in_transaction():
                    await session.rollback()
                await session.close()

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_idem_db] = _override_get_db

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


async def _create_test_owner_and_venue(test_session_factory):
    async with test_session_factory() as session:
        async with session.begin():
            owner = User(
                name="Ramesh Owner",
                email=f"owner-{uuid.uuid4().hex[:8]}@example.com",
                phone=f"987{uuid.uuid4().hex[:7]}",
                password_hash=hash_password("owner-pass-1"),
                role="owner",
            )
            session.add(owner)
            await session.flush()

            venue = Venue(
                owner_id=owner.id,
                name="Grand Lawn & Turf",
                slug=f"lawn-{uuid.uuid4().hex[:8]}",
                category="lawn",
                address="Ring Road 42",
                city="Bengaluru",
                capacity=500,
                unit_type="hour",
                base_price=Decimal("1500.00"),
                status="active",
            )
            session.add(venue)
            await session.flush()

            use_case = UseCase(name=f"Wedding-{uuid.uuid4().hex[:6]}")
            session.add(use_case)
            await session.flush()

            owner_id, venue_id, use_case_id = owner.id, venue.id, use_case.id

    return owner_id, venue_id, use_case_id


async def _create_test_admin(test_session_factory):
    async with test_session_factory() as session:
        async with session.begin():
            admin = User(
                name="Super Admin",
                email=f"admin-{uuid.uuid4().hex[:8]}@example.com",
                phone=f"911{uuid.uuid4().hex[:7]}",
                password_hash=hash_password("admin-pass-1"),
                role="admin",
            )
            session.add(admin)
            await session.flush()
            admin_id = admin.id
    return admin_id


# ---------------------------------------------------------------------------
# 1. Rental Options Tests
# ---------------------------------------------------------------------------

async def test_rental_options_crud_and_price_sync(client, test_session_factory):
    owner_id, venue_id, _ = await _create_test_owner_and_venue(test_session_factory)
    token = create_access_token(user_id=owner_id, role="owner")
    headers = {"Authorization": f"Bearer {token}"}

    # Create hourly option
    resp_hour = await client.post(
        f"/api/v1/owner/venues/{venue_id}/rental-options",
        json={
            "mode": "hour",
            "price": "1200.00",
            "open_time": "06:00:00",
            "close_time": "22:00:00",
            "slot_minutes": 60,
            "min_minutes": 60,
            "max_minutes": 180,
            "buffer_minutes": 15,
            "enabled": True,
        },
        headers=headers,
    )
    assert resp_hour.status_code == 201
    hour_id = resp_hour.json()["id"]

    # Create full_day option
    resp_day = await client.post(
        f"/api/v1/owner/venues/{venue_id}/rental-options",
        json={
            "mode": "full_day",
            "price": "25000.00",
            "open_time": "08:00:00",
            "close_time": "23:00:00",
            "buffer_minutes": 60,
            "enabled": True,
        },
        headers=headers,
    )
    assert resp_day.status_code == 201
    day_id = resp_day.json()["id"]

    # Duplicate mode returns 409
    resp_dup = await client.post(
        f"/api/v1/owner/venues/{venue_id}/rental-options",
        json={"mode": "hour", "price": "1000.00"},
        headers=headers,
    )
    assert resp_dup.status_code == 409

    # Check venue base_price and unit_type synced to cheapest enabled option (hour @ 1200)
    v_resp = await client.get(f"/api/v1/venues/{venue_id}")
    assert v_resp.json()["base_price"] == "1200.00"
    assert v_resp.json()["unit_type"] == "hour"

    # Disable hour option -> venue should sync to full_day @ 25000
    patch_resp = await client.patch(
        f"/api/v1/owner/venues/{venue_id}/rental-options/{hour_id}",
        json={"enabled": False},
        headers=headers,
    )
    assert patch_resp.status_code == 200

    v_resp2 = await client.get(f"/api/v1/venues/{venue_id}")
    assert v_resp2.json()["base_price"] == "25000.00"
    assert v_resp2.json()["unit_type"] == "full_day"

    # Delete full_day option
    del_resp = await client.delete(
        f"/api/v1/owner/venues/{venue_id}/rental-options/{day_id}",
        headers=headers,
    )
    assert del_resp.status_code == 204


# ---------------------------------------------------------------------------
# 2. Purposes Tests & Admin Moderation
# ---------------------------------------------------------------------------

async def test_purposes_and_admin_moderation(client, test_session_factory):
    owner_id, venue_id, use_case_id = await _create_test_owner_and_venue(test_session_factory)
    admin_id = await _create_test_admin(test_session_factory)

    owner_token = create_access_token(user_id=owner_id, role="owner")
    admin_token = create_access_token(user_id=admin_id, role="admin")

    # 1. Create catalogue purpose (Wedding)
    resp_cat = await client.post(
        f"/api/v1/owner/venues/{venue_id}/purposes",
        json={
            "use_case_id": str(use_case_id),
            "description": "Grand outdoor wedding setups with stage lighting.",
            "max_guests": 450,
            "allowed_modes": ["half_day", "full_day"],
            "price_override": "30000.00",
            "rules": "No loud fireworks after 10 PM.",
        },
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert resp_cat.status_code == 201
    wedding_id = resp_cat.json()["id"]

    # 2. Create custom purpose (Night Box Cricket) -> requires admin approval
    resp_custom = await client.post(
        f"/api/v1/owner/venues/{venue_id}/purposes",
        json={
            "custom_name": "Box Cricket Tournament",
            "description": "Floodlight turf box cricket.",
            "max_guests": 50,
            "allowed_modes": ["hour"],
            "price_override": "1800.00",
        },
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert resp_custom.status_code == 201
    custom_id = resp_custom.json()["id"]
    assert resp_custom.json()["is_custom_approved"] is False

    # Public endpoint should show catalogue purpose, but NOT unapproved custom purpose
    pub_purposes = (await client.get(f"/api/v1/venues/{venue_id}/purposes")).json()
    pub_ids = [p["id"] for p in pub_purposes]
    assert wedding_id in pub_ids
    assert custom_id not in pub_ids

    # Owner endpoint should show both
    owner_purposes = (
        await client.get(
            f"/api/v1/owner/venues/{venue_id}/purposes",
            headers={"Authorization": f"Bearer {owner_token}"},
        )
    ).json()
    owner_ids = [p["id"] for p in owner_purposes]
    assert wedding_id in owner_ids
    assert custom_id in owner_ids

    # Admin checks pending custom purposes
    pending_list = (
        await client.get(
            "/api/v1/admin/purposes/pending",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
    ).json()
    assert any(p["id"] == custom_id for p in pending_list)

    # Admin approves custom purpose
    approve_resp = await client.post(
        f"/api/v1/admin/purposes/{custom_id}/approve",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert approve_resp.status_code == 200
    assert approve_resp.json()["is_custom_approved"] is True

    # Now public endpoint shows custom purpose too
    pub_purposes_after = (await client.get(f"/api/v1/venues/{venue_id}/purposes")).json()
    assert any(p["id"] == custom_id for p in pub_purposes_after)


# ---------------------------------------------------------------------------
# 3. Booking Details Validation & Pricing Override
# ---------------------------------------------------------------------------

async def test_booking_purpose_validation_and_pricing(client, test_session_factory):
    owner_id, venue_id, use_case_id = await _create_test_owner_and_venue(test_session_factory)
    owner_token = create_access_token(user_id=owner_id, role="owner")

    # Add purpose: Wedding (max 200 guests, allowed_modes: ["full_day"], price_override: 35000)
    p_resp = await client.post(
        f"/api/v1/owner/venues/{venue_id}/purposes",
        json={
            "use_case_id": str(use_case_id),
            "max_guests": 200,
            "allowed_modes": ["full_day"],
            "price_override": "35000.00",
        },
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    wedding_purpose_id = p_resp.json()["id"]

    # Create full_day inventory unit
    u_resp = await client.post(
        f"/api/v1/venues/{venue_id}/inventory-units",
        json={
            "units": [
                {
                    "date": "2027-11-20",
                    "price": "20000.00",
                }
            ]
        },
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert u_resp.status_code == 201
    unit_id = u_resp.json()[0]["id"]

    # 1. Invalid purpose: random UUID
    bad_p_resp = await client.post(
        "/api/v1/bookings",
        json={
            "inventory_unit_id": unit_id,
            "guest_name": "Bride Groom",
            "guest_email": "wedding@example.com",
            "purpose_id": str(uuid.uuid4()),
            "rental_mode": "full_day",
            "guest_count": 100,
        },
    )
    assert bad_p_resp.status_code == 422

    # 2. Mode not allowed for purpose (hourly on wedding purpose that only allows full_day)
    bad_mode_resp = await client.post(
        "/api/v1/bookings",
        json={
            "inventory_unit_id": unit_id,
            "guest_name": "Bride Groom",
            "guest_email": "wedding@example.com",
            "purpose_id": wedding_purpose_id,
            "rental_mode": "hour",
            "guest_count": 100,
        },
    )
    assert bad_mode_resp.status_code == 422

    # 3. Guest count exceeds purpose limit (250 > 200)
    bad_guests_resp = await client.post(
        "/api/v1/bookings",
        json={
            "inventory_unit_id": unit_id,
            "guest_name": "Bride Groom",
            "guest_email": "wedding@example.com",
            "purpose_id": wedding_purpose_id,
            "rental_mode": "full_day",
            "guest_count": 250,
        },
    )
    assert bad_guests_resp.status_code == 422

    # 4. Valid booking: should use price_override of 35000 instead of unit price 20000
    ok_booking = await client.post(
        "/api/v1/bookings",
        json={
            "inventory_unit_id": unit_id,
            "guest_name": "Bride Groom",
            "guest_email": "wedding@example.com",
            "guest_phone": "9998887776",
            "purpose_id": wedding_purpose_id,
            "rental_mode": "full_day",
            "guest_count": 150,
            "customer_notes": "Decorations need to be set up in the morning.",
        },
    )
    assert ok_booking.status_code == 201
    assert Decimal(str(ok_booking.json()["amount"])) == Decimal("35000.00")


# ---------------------------------------------------------------------------
# 4. Overlap Guard & Availability Endpoint
# ---------------------------------------------------------------------------

async def test_availability_and_overlap_guard(client, test_session_factory):
    owner_id, venue_id, _ = await _create_test_owner_and_venue(test_session_factory)
    owner_token = create_access_token(user_id=owner_id, role="owner")
    headers = {"Authorization": f"Bearer {owner_token}"}

    test_date = date(2027, 12, 10)

    # Create rental options: hour and full_day
    await client.post(
        f"/api/v1/owner/venues/{venue_id}/rental-options",
        json={"mode": "hour", "price": "1000.00", "open_time": "08:00:00", "close_time": "22:00:00"},
        headers=headers,
    )
    await client.post(
        f"/api/v1/owner/venues/{venue_id}/rental-options",
        json={"mode": "full_day", "price": "15000.00"},
        headers=headers,
    )

    # Create 1 full_day unit and 2 hourly units on same date
    units_payload = [
        {"date": str(test_date), "start_time": None, "end_time": None, "price": "15000.00"},
        {"date": str(test_date), "start_time": "09:00:00", "end_time": "10:00:00", "price": "1000.00"},
        {"date": str(test_date), "start_time": "10:00:00", "end_time": "11:00:00", "price": "1000.00"},
    ]
    u_resp = await client.post(
        f"/api/v1/venues/{venue_id}/inventory-units",
        json={"units": units_payload},
        headers=headers,
    )
    assert u_resp.status_code == 201
    created_units = u_resp.json()
    full_day_unit = created_units[0]
    hour_unit_1 = created_units[1]
    hour_unit_2 = created_units[2]

    # Availability endpoint: both full_day and 2 hourly slots available
    avail_resp = await client.get(
        f"/api/v1/venues/{venue_id}/availability?from={test_date}&to={test_date}"
    )
    assert avail_resp.status_code == 200
    avail_data = avail_resp.json()[0]
    assert avail_data["is_full_day_available"] is True
    assert avail_data["hourly_slots_total"] == 2
    assert avail_data["hourly_slots_available"] == 2
    assert set(avail_data["available_rental_modes"]) == {"hour", "full_day"}

    # Book 1 hour (09:00 - 10:00)
    book_hour = await client.post(
        "/api/v1/bookings",
        json={
            "inventory_unit_id": hour_unit_1["id"],
            "guest_name": "Morning Player",
            "guest_email": "player@example.com",
            "rental_mode": "hour",
        },
    )
    assert book_hour.status_code == 201

    # Now customer lists inventory-units:
    # 1. Booked hour slot is hidden!
    # 2. Overlapping full-day slot is also hidden because an overlapping slot is occupied!
    # 3. Only the non-overlapping second hour slot (10:00 - 11:00) is visible!
    cust_units = (await client.get(f"/api/v1/venues/{venue_id}/inventory-units")).json()
    cust_unit_ids = [u["id"] for u in cust_units]
    assert hour_unit_1["id"] not in cust_unit_ids
    assert full_day_unit["id"] not in cust_unit_ids
    assert hour_unit_2["id"] in cust_unit_ids

    # Attempting to book full-day unit now must fail with 409 Conflict
    conflict_book = await client.post(
        "/api/v1/bookings",
        json={
            "inventory_unit_id": full_day_unit["id"],
            "guest_name": "Late Booker",
            "guest_email": "late@example.com",
            "rental_mode": "full_day",
        },
    )
    assert conflict_book.status_code == 409

    # Availability endpoint now reports full-day unavailable, 1 hourly slot available
    avail_resp2 = await client.get(
        f"/api/v1/venues/{venue_id}/availability?from={test_date}&to={test_date}"
    )
    avail_data2 = avail_resp2.json()[0]
    assert avail_data2["is_full_day_available"] is False
    assert avail_data2["hourly_slots_available"] == 1


# ---------------------------------------------------------------------------
# 5. Media Constraints & Video Link Tests
# ---------------------------------------------------------------------------

async def test_media_limits_and_video_links(client, test_session_factory):
    owner_id, venue_id, _ = await _create_test_owner_and_venue(test_session_factory)
    token = create_access_token(user_id=owner_id, role="owner")
    headers = {"Authorization": f"Bearer {token}"}

    # Add a YouTube video link
    yt_resp = await client.post(
        f"/api/v1/owner/venues/{venue_id}/media/link",
        json={
            "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "thumbnail_url": "https://img.youtube.com/vi/dQw4w9WgXcQ/0.jpg",
        },
        headers=headers,
    )
    assert yt_resp.status_code == 201
    video_id = yt_resp.json()["id"]
    assert yt_resp.json()["media_type"] == "video"
    assert yt_resp.json()["is_cover"] is False

    # Attempt to set video as cover must fail with 422
    cover_fail = await client.put(
        f"/api/v1/venues/{venue_id}/images/{video_id}/cover",
        headers=headers,
    )
    assert cover_fail.status_code == 422

    # Add 2 more videos (reaches limit of 3)
    for i in range(2):
        v_resp = await client.post(
            f"/api/v1/owner/venues/{venue_id}/media/link",
            json={"url": f"https://vimeo.com/{123456 + i}"},
            headers=headers,
        )
        assert v_resp.status_code == 201

    # 4th video must be rejected with 422
    v_overflow = await client.post(
        f"/api/v1/owner/venues/{venue_id}/media/link",
        json={"url": "https://youtube.com/watch?v=overflow"},
        headers=headers,
    )
    assert v_overflow.status_code == 422


async def test_video_upload_duration_and_size_validation(client, test_session_factory):
    owner_id, venue_id, _ = await _create_test_owner_and_venue(test_session_factory)
    token = create_access_token(user_id=owner_id, role="owner")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Video duration < 10 seconds -> 422
    resp_short = await client.post(
        f"/api/v1/venues/{venue_id}/images",
        files={"image": ("short.mp4", b"\x00\x00\x00\x18ftypmp42fake", "video/mp4")},
        data={"is_cover": "false", "duration": "5.5"},
        headers=headers,
    )
    assert resp_short.status_code == 422
    assert "Minimum video duration is 10 seconds" in resp_short.json()["detail"]

    # 2. Video duration > 90 seconds (1m 30s) -> 422
    resp_long = await client.post(
        f"/api/v1/venues/{venue_id}/images",
        files={"image": ("long.mp4", b"\x00\x00\x00\x18ftypmp42fake", "video/mp4")},
        data={"is_cover": "false", "duration": "95.0"},
        headers=headers,
    )
    assert resp_long.status_code == 422
    assert "Maximum video duration is 1 minute 30 seconds" in resp_long.json()["detail"]

    # 3. Valid video duration (between 10s and 90s) -> 201
    resp_valid = await client.post(
        f"/api/v1/venues/{venue_id}/images",
        files={"image": ("valid.mp4", b"\x00\x00\x00\x18ftypmp42fake", "video/mp4")},
        data={"is_cover": "false", "duration": "45.0"},
        headers=headers,
    )
    assert resp_valid.status_code == 201
    media = resp_valid.json()["media"]
    assert any(m["media_type"] == "video" for m in media)


# ---------------------------------------------------------------------------
# 6. Owner Dashboard Overview & Venue Stats Tests
# ---------------------------------------------------------------------------

async def test_owner_dashboard_overview_and_stats(client, test_session_factory):
    owner_id, venue_id, _ = await _create_test_owner_and_venue(test_session_factory)
    token = create_access_token(user_id=owner_id, role="owner")
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch overview
    resp = await client.get("/api/v1/owner/overview", headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    assert "attention_items" in data
    assert "counters" in data
    assert "booking_stages" in data
    assert "listing_stages" in data
    assert "upcoming_events" in data

    # Check listing stages for the venue
    assert len(data["listing_stages"]) >= 1
    venue_stage = next(s for s in data["listing_stages"] if s["venue_id"] == str(venue_id))
    assert venue_stage["status"] == "active"
    assert venue_stage["progress_pct"] == 100

    # Fetch venue stats
    stats_resp = await client.get(f"/api/v1/owner/venues/{venue_id}/stats", headers=headers)
    assert stats_resp.status_code == 200
    stats = stats_resp.json()
    assert stats["venue_id"] == str(venue_id)
    assert "revenue_last_30_days" in stats
    assert "events_upcoming" in stats

import asyncio
import uuid
from decimal import Decimal
import pytest
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db, get_idem_db
from app.main import app
from app.models.core import Booking, InventoryUnit, Payment, IdempotencyKey
from app.modules.auth.security import create_access_token
from backend.tests.invariants import assert_invariants


@pytest.fixture
async def async_client(test_session_factory):
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
async def db_session(test_session_factory):
    async with test_session_factory() as session:
        yield session


# ===========================================================================
# SCENARIO 1: Double-click on Confirm booking (same user, same slot)
# ===========================================================================

@pytest.mark.asyncio
async def test_scenario_1_double_click_with_idempotency_key(
    async_client, seeded_unit, db_session: AsyncSession
):
    """
    Scenario 1 (with Idempotency-Key):
    Two identical requests fired within milliseconds with the same Idempotency-Key.
    Expected:
    - Exactly 1 booking row in DB.
    - Exactly 1 held unit in DB.
    - Second response returns the same booking (replay) with header 'Idempotent-Replayed: true'.
    - Invariants audit passes.
    """
    idem_key = f"double-click-{uuid.uuid4()}"
    payload = {
        "inventory_unit_id": str(seeded_unit),
        "guest_name": "Same User",
        "guest_email": "sameuser@example.com",
        "guest_phone": "+919876543210",
    }
    headers = {"Idempotency-Key": idem_key}

    # Fire two concurrent requests
    resps = await asyncio.gather(
        async_client.post("/api/v1/bookings", json=payload, headers=headers),
        async_client.post("/api/v1/bookings", json=payload, headers=headers),
    )

    # At least one must be 201
    status_codes = [r.status_code for r in resps]
    assert 201 in status_codes, f"Neither request succeeded: {status_codes}"

    # If both returned 200/201, both must return the same booking_id
    success_resps = [r for r in resps if r.status_code == 201]
    booking_ids = {r.json()["booking_id"] for r in success_resps}
    assert len(booking_ids) == 1, f"Multiple booking IDs returned: {booking_ids}"

    # Verify that a replay returns Idempotent-Replayed header
    replay_resp = await async_client.post("/api/v1/bookings", json=payload, headers=headers)
    assert replay_resp.status_code == 201
    assert replay_resp.headers.get("Idempotent-Replayed") == "true", (
        f"Missing 'Idempotent-Replayed: true' header. Got headers: {replay_resp.headers}"
    )

    # DB Checks
    bookings = (
        await db_session.execute(
            select(Booking).where(Booking.inventory_unit_id == seeded_unit)
        )
    ).scalars().all()
    assert len(bookings) == 1, f"Expected 1 booking in DB, found {len(bookings)}"

    unit = await db_session.get(InventoryUnit, seeded_unit)
    assert unit.status == "held"

    # Invariant audit
    await assert_invariants(db_session)


@pytest.mark.asyncio
async def test_scenario_1_double_click_without_idempotency_key(
    async_client, seeded_unit, db_session: AsyncSession
):
    """
    Scenario 1 (without Idempotency-Key):
    A user rapidly double-clicks 'Confirm Booking' without an Idempotency-Key.
    Expected:
    - Exactly one booking and one held unit in DB.
    - The second request must NOT show an ugly 409 'This slot is no longer available' error to the user!
      Instead, it gracefully recovers and returns the user's existing pending booking for that slot.
    - Invariants audit passes.
    """
    payload = {
        "inventory_unit_id": str(seeded_unit),
        "guest_name": "Double Clicker",
        "guest_email": "doubleclick@example.com",
        "guest_phone": "+919876543211",
    }

    # Fire two requests concurrently without Idempotency-Key header
    resps = await asyncio.gather(
        async_client.post("/api/v1/bookings", json=payload),
        async_client.post("/api/v1/bookings", json=payload),
    )

    # Both should return 201 (recovering the same booking)
    status_codes = [r.status_code for r in resps]
    assert 500 not in status_codes
    assert all(code == 201 for code in status_codes), (
        f"Expected both to return 201 (recovering booking for double-click), but got {status_codes}. "
        f"Bodies: {[r.text for r in resps]}"
    )

    booking_ids = {r.json()["booking_id"] for r in resps}
    assert len(booking_ids) == 1, f"Multiple booking IDs returned: {booking_ids}"

    # Authoritative DB verification
    bookings = (
        await db_session.execute(
            select(Booking).where(Booking.inventory_unit_id == seeded_unit)
        )
    ).scalars().all()
    assert len(bookings) == 1, f"Expected 1 booking in DB, found {len(bookings)}"

    unit = await db_session.get(InventoryUnit, seeded_unit)
    assert unit.status == "held"

    await assert_invariants(db_session)


# ===========================================================================
# SCENARIO 2: Two different users take the last slot at the same moment
# ===========================================================================

@pytest.mark.asyncio
async def test_scenario_2_concurrent_slot_competition_mixed_users(
    async_client, seeded_unit, db_session: AsyncSession
):
    """
    Scenario 2:
    20 concurrent requests for 1 inventory unit from 20 different users
    (10 signed-in customers and 10 guests).
    Expected:
    - Exactly 1 success (201 Created).
    - Exactly 19 rejections (409 Conflict with clear message).
    - Zero 500 server crashes.
    - Exactly 1 booking in DB.
    - Unit held exactly once (status == 'held').
    - Invariants audit passes.
    """
    from app.models.core import User

    # Create 10 customers
    customers = []
    for i in range(10):
        user = User(
            name=f"Customer {i}",
            email=f"customer{i}_{uuid.uuid4().hex[:6]}@example.com",
            phone=f"+919811{i:02d}{1000 + i:04d}",
            password_hash="fakehash",
            role="customer",
        )
        db_session.add(user)
        customers.append(user)
    await db_session.commit()
    for c in customers:
        await db_session.refresh(c)

    # Prepare 20 requests
    tasks = []

    # 10 signed-in requests
    for i, user in enumerate(customers):
        token = create_access_token(user.id, "customer")
        payload = {"inventory_unit_id": str(seeded_unit)}
        headers = {"Authorization": f"Bearer {token}"}
        tasks.append(async_client.post("/api/v1/bookings", json=payload, headers=headers))

    # 10 guest requests
    for i in range(10):
        payload = {
            "inventory_unit_id": str(seeded_unit),
            "guest_name": f"Guest {i}",
            "guest_email": f"guest_{i}_{uuid.uuid4().hex[:6]}@example.com",
            "guest_phone": f"+919922{i:02d}{1000 + i:04d}",
        }
        tasks.append(async_client.post("/api/v1/bookings", json=payload))

    # Fire all 20 concurrently
    resps = await asyncio.gather(*tasks)

    status_codes = [r.status_code for r in resps]
    assert 500 not in status_codes, f"500 Internal Server Error observed: {[r.text for r in resps if r.status_code == 500]}"
    assert status_codes.count(201) == 1, f"Expected exactly 1 success (201), got: {status_codes.count(201)}. Codes: {status_codes}"
    assert status_codes.count(409) == 19, f"Expected exactly 19 conflicts (409), got: {status_codes.count(409)}. Codes: {status_codes}"

    # Verify winning booking
    winning_resp = [r for r in resps if r.status_code == 201][0]
    winning_data = winning_resp.json()
    assert "booking_id" in winning_data

    # Verify database state
    bookings = (
        await db_session.execute(
            select(Booking).where(Booking.inventory_unit_id == seeded_unit)
        )
    ).scalars().all()
    assert len(bookings) == 1, f"Expected 1 booking row in DB, found {len(bookings)}"
    assert bookings[0].status == "pending_payment"
    assert str(bookings[0].id) == winning_data["booking_id"]

    unit = await db_session.get(InventoryUnit, seeded_unit)
    assert unit.status == "held"

    # Invariants audit
    await assert_invariants(db_session)


# ===========================================================================
# SCENARIO 3: Admin double-confirms a payment
# ===========================================================================

@pytest.mark.asyncio
async def test_scenario_3a_admin_concurrent_confirm_with_idempotency_key(
    async_client, seeded_owner_with_unit, seeded_admin, db_session: AsyncSession
):
    """
    Scenario 3A: Admin confirms payment with an Idempotency-Key.
    Two concurrent requests or network retry with the same key.
    Expected:
    - Exactly 1 successful Payment row in DB.
    - Booking confirmed once.
    - Exactly 1 AuditLog entry.
    - Replay returns 200 with 'Idempotent-Replayed: true'.
    - Invariants audit passes.
    """
    from app.models.core import AuditLog, Notification
    _, _, unit_id = seeded_owner_with_unit
    admin_token = create_access_token(seeded_admin, "admin")

    unit = await db_session.get(InventoryUnit, unit_id)
    unit.status = "held"
    booking = Booking(
        inventory_unit_id=unit_id,
        guest_name="Pooja Shah",
        guest_email="pooja@example.com",
        venue_id=unit.venue_id,
        venue_name="The Grand Arena",
        venue_category="sports",
        status="pending_payment",
        amount=Decimal("2000.00"),
    )
    db_session.add(booking)
    await db_session.commit()
    await db_session.refresh(booking)

    idem_key = f"admin-confirm-{uuid.uuid4()}"
    headers = {
        "Authorization": f"Bearer {admin_token}",
        "Idempotency-Key": idem_key,
    }
    payload = {
        "amount": "2000.00",
        "method": "upi",
        "reference": "UPI-TXN-9999",
        "notes": "Verified offline payment",
    }

    # Fire two concurrent requests with same key
    resps = await asyncio.gather(
        async_client.post(f"/api/v1/admin/bookings/{booking.id}/confirm-payment", json=payload, headers=headers),
        async_client.post(f"/api/v1/admin/bookings/{booking.id}/confirm-payment", json=payload, headers=headers),
    )

    status_codes = [r.status_code for r in resps]
    assert 500 not in status_codes
    assert all(code in (200, 409) for code in status_codes)
    assert 200 in status_codes

    # Sequential replay with same key must return 200 and Idempotent-Replayed: true
    replay_resp = await async_client.post(
        f"/api/v1/admin/bookings/{booking.id}/confirm-payment",
        json=payload,
        headers=headers,
    )
    assert replay_resp.status_code == 200
    assert replay_resp.headers.get("Idempotent-Replayed") == "true", f"Headers: {replay_resp.headers}"

    # Verify DB: exactly 1 Payment row
    payments = (
        await db_session.execute(select(Payment).where(Payment.booking_id == booking.id))
    ).scalars().all()
    assert len(payments) == 1, f"Expected 1 Payment row, found {len(payments)}"
    assert payments[0].status == "success"

    # Verify booking state
    await db_session.refresh(booking)
    assert booking.status == "confirmed"

    # Verify AuditLog: exactly 1 payment confirmation audit
    audits = (
        await db_session.execute(
            select(AuditLog).where(
                AuditLog.entity_id == booking.id,
                AuditLog.action == "booking.payment_confirmed_offline",
            )
        )
    ).scalars().all()
    assert len(audits) == 1, f"Expected 1 AuditLog entry, found {len(audits)}"

    await assert_invariants(db_session)


@pytest.mark.asyncio
async def test_scenario_3b_two_admins_concurrent_confirm_without_key(
    async_client, seeded_owner_with_unit, seeded_admin, db_session: AsyncSession
):
    """
    Scenario 3B: Two different admins (or double-click without key) confirm payment at the exact same instant.
    Expected:
    - Exactly 1 Payment row in DB.
    - Exactly 1 returns 200, the other returns 409 conflict.
    - Exactly 1 AuditLog entry.
    - Invariants audit passes.
    """
    from app.models.core import AuditLog, User
    _, _, unit_id = seeded_owner_with_unit

    # Create admin 2
    admin2 = User(
        name="Admin Two",
        email=f"admin2_{uuid.uuid4().hex[:6]}@example.com",
        phone=f"+919877{uuid.uuid4().int % 1000000:06d}",
        password_hash="fakehash",
        role="admin",
    )
    db_session.add(admin2)

    unit = await db_session.get(InventoryUnit, unit_id)
    unit.status = "held"
    booking = Booking(
        inventory_unit_id=unit_id,
        guest_name="Vikas Roy",
        guest_email="vikas@example.com",
        venue_id=unit.venue_id,
        venue_name="The Grand Arena",
        venue_category="sports",
        status="pending_payment",
        amount=Decimal("2000.00"),
    )
    db_session.add(booking)
    await db_session.commit()
    await db_session.refresh(admin2)
    await db_session.refresh(booking)

    token1 = create_access_token(seeded_admin, "admin")
    token2 = create_access_token(admin2.id, "admin")

    payload = {"amount": "2000.00", "method": "cash"}

    resps = await asyncio.gather(
        async_client.post(
            f"/api/v1/admin/bookings/{booking.id}/confirm-payment",
            json=payload,
            headers={"Authorization": f"Bearer {token1}"},
        ),
        async_client.post(
            f"/api/v1/admin/bookings/{booking.id}/confirm-payment",
            json=payload,
            headers={"Authorization": f"Bearer {token2}"},
        ),
    )

    status_codes = [r.status_code for r in resps]
    assert 500 not in status_codes
    assert status_codes.count(200) == 1, f"Expected exactly 1 200 OK: {status_codes}"
    assert status_codes.count(409) == 1, f"Expected exactly 1 409 Conflict: {status_codes}"

    # Exactly 1 Payment row
    payments = (
        await db_session.execute(select(Payment).where(Payment.booking_id == booking.id))
    ).scalars().all()
    assert len(payments) == 1

    # Exactly 1 Audit entry
    audits = (
        await db_session.execute(
            select(AuditLog).where(
                AuditLog.entity_id == booking.id,
                AuditLog.action == "booking.payment_confirmed_offline",
            )
        )
    ).scalars().all()
    assert len(audits) == 1

    await assert_invariants(db_session)


@pytest.mark.asyncio
async def test_scenario_3c_confirm_wrong_amount_changes_nothing(
    async_client, seeded_owner_with_unit, seeded_admin, db_session: AsyncSession
):
    """
    Scenario 3C: Confirm payment with incorrect amount.
    Expected:
    - Returns 422 Unprocessable Entity.
    - No Payment row created.
    - Booking status remains pending_payment.
    - Invariants audit passes.
    """
    _, _, unit_id = seeded_owner_with_unit
    admin_token = create_access_token(seeded_admin, "admin")

    unit = await db_session.get(InventoryUnit, unit_id)
    unit.status = "held"
    booking = Booking(
        inventory_unit_id=unit_id,
        guest_name="Deepak Joshi",
        guest_email="deepak@example.com",
        venue_id=unit.venue_id,
        venue_name="The Grand Arena",
        venue_category="sports",
        status="pending_payment",
        amount=Decimal("2000.00"),
    )
    db_session.add(booking)
    await db_session.commit()
    await db_session.refresh(booking)

    # Attempt confirmation with wrong amount (e.g. 1500 instead of 2000)
    resp = await async_client.post(
        f"/api/v1/admin/bookings/{booking.id}/confirm-payment",
        json={"amount": "1500.00", "method": "cash"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 422

    # Verify no payment was created
    payments = (
        await db_session.execute(select(Payment).where(Payment.booking_id == booking.id))
    ).scalars().all()
    assert len(payments) == 0

    # Booking remains pending_payment
    await db_session.refresh(booking)
    assert booking.status == "pending_payment"

    await assert_invariants(db_session)


# ===========================================================================
# SCENARIO 4: Retry after a timeout where the server actually finished
# ===========================================================================

@pytest.mark.asyncio
async def test_scenario_4a_retry_after_lost_response(
    async_client, seeded_unit, db_session: AsyncSession
):
    """
    Scenario 4A: The client sends a booking request, the server completes
    and commits to DB, but the connection dropped before client saw the response.
    The client retries with the exact same Idempotency-Key.
    Expected:
    - Exactly 1 booking in DB.
    - Exactly 1 held unit in DB.
    - Replay returns original 201 response with same booking_id.
    - Response has header 'Idempotent-Replayed: true'.
    - Invariants audit passes.
    """
    idem_key = f"retry-timeout-{uuid.uuid4()}"
    payload = {
        "inventory_unit_id": str(seeded_unit),
        "guest_name": "Timeout User",
        "guest_email": "timeout@example.com",
        "guest_phone": "+919876543220",
    }
    headers = {"Idempotency-Key": idem_key}

    # First attempt finishes on server, but client "loses" the response
    first_resp = await async_client.post("/api/v1/bookings", json=payload, headers=headers)
    assert first_resp.status_code == 201
    original_booking_id = first_resp.json()["booking_id"]
    assert "Idempotent-Replayed" not in first_resp.headers

    # Client retries with identical key and payload
    retry_resp = await async_client.post("/api/v1/bookings", json=payload, headers=headers)
    assert retry_resp.status_code == 201
    assert retry_resp.headers.get("Idempotent-Replayed") == "true", (
        f"Missing 'Idempotent-Replayed: true' header. Got: {retry_resp.headers}"
    )
    assert retry_resp.json()["booking_id"] == original_booking_id

    # DB Checks: no duplicate booking
    bookings = (
        await db_session.execute(
            select(Booking).where(Booking.inventory_unit_id == seeded_unit)
        )
    ).scalars().all()
    assert len(bookings) == 1, f"Expected 1 booking, got {len(bookings)}"

    unit = await db_session.get(InventoryUnit, seeded_unit)
    assert unit.status == "held"

    await assert_invariants(db_session)


@pytest.mark.asyncio
async def test_scenario_4b_same_key_different_payload_gives_422(
    async_client, seeded_unit, db_session: AsyncSession
):
    """
    Scenario 4B: Client attempts to reuse an idempotency key with a mutated payload.
    Expected:
    - 422 Unprocessable Entity.
    - Detail states 'Idempotency key replayed with different payload'.
    - Invariants audit passes.
    """
    idem_key = f"mismatch-{uuid.uuid4()}"
    payload_a = {
        "inventory_unit_id": str(seeded_unit),
        "guest_name": "Original Name",
        "guest_email": "original@example.com",
        "guest_phone": "+919876543221",
    }
    headers = {"Idempotency-Key": idem_key}

    resp1 = await async_client.post("/api/v1/bookings", json=payload_a, headers=headers)
    assert resp1.status_code == 201

    # Second request with same key but different payload
    payload_b = {
        "inventory_unit_id": str(seeded_unit),
        "guest_name": "Mutated Name",
        "guest_email": "mutated@example.com",
        "guest_phone": "+919876543221",
    }
    resp2 = await async_client.post("/api/v1/bookings", json=payload_b, headers=headers)
    assert resp2.status_code == 422
    assert "different payload" in resp2.json()["detail"].lower()

    await assert_invariants(db_session)


@pytest.mark.asyncio
async def test_scenario_4c_expired_key_gives_clear_error(
    async_client, seeded_unit, db_session: AsyncSession
):
    """
    Scenario 4C: Client sends a request with an expired idempotency key.
    Expected:
    - Clear error (409 Conflict with detail explaining key expired).
    - Invariants audit passes.
    """
    from datetime import datetime, timedelta, timezone

    idem_key = f"expired-key-{uuid.uuid4()}"
    headers = {"Idempotency-Key": idem_key}
    payload = {
        "inventory_unit_id": str(seeded_unit),
        "guest_name": "Expired Test",
        "guest_email": "expired@example.com",
        "guest_phone": "+919876543222",
    }

    # Pre-seed an expired idempotency key in DB
    # Note: guest keys are scoped by client_ip when client_ip is present
    # With TestClient/ASGITransport, client_ip is '127.0.0.1' or None
    # Let's add with and without client_ip prefix or fetch how client_ip gets formatted
    scoped_key = f"127.0.0.1:{idem_key}"
    expired_record = IdempotencyKey(
        key=scoped_key,
        actor_id=None,
        operation="create_booking",
        request_hash="dummyhash",
        status="completed",
        expires_at=datetime.now(timezone.utc) - timedelta(hours=2),
    )
    db_session.add(expired_record)
    await db_session.commit()

    resp = await async_client.post("/api/v1/bookings", json=payload, headers=headers)
    assert resp.status_code == 409
    assert "expired" in resp.json()["detail"].lower()

    await assert_invariants(db_session)


@pytest.mark.asyncio
async def test_scenario_4d_concurrent_in_progress_key_returns_409_retry_after(
    async_client, seeded_unit, db_session: AsyncSession
):
    """
    Scenario 4D: Request arrives while the first is still running (status == 'in_progress').
    Expected:
    - Second request does not run twice.
    - Gets 409 with Retry-After header.
    - Invariants audit passes.
    """
    import hashlib
    import json
    from datetime import datetime, timedelta, timezone

    from app.schemas.booking import BookingCreateRequest

    idem_key = f"in-progress-{uuid.uuid4()}"
    payload = {
        "inventory_unit_id": str(seeded_unit),
        "guest_name": "In Progress Test",
        "guest_email": "inprogress@example.com",
        "guest_phone": "+919876543223",
    }
    req_model = BookingCreateRequest(**payload)
    payload_hash = hashlib.sha256(req_model.model_dump_json().encode("utf-8")).hexdigest()
    headers = {"Idempotency-Key": idem_key}

    # Pre-seed key as in_progress
    scoped_key = f"127.0.0.1:{idem_key}"
    in_progress_record = IdempotencyKey(
        key=scoped_key,
        actor_id=None,
        operation="create_booking",
        request_hash=payload_hash,
        status="in_progress",
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )
    db_session.add(in_progress_record)
    await db_session.commit()

    # Second request with same key while first is in_progress
    resp = await async_client.post("/api/v1/bookings", json=payload, headers=headers)
    assert resp.status_code == 409
    assert "in progress" in resp.json()["detail"].lower()
    assert "Retry-After" in resp.headers

    await assert_invariants(db_session)


# ===========================================================================
# SCENARIO 5: Cancel and confirm race
# ===========================================================================

@pytest.mark.asyncio
async def test_scenario_5_cancel_and_confirm_race(
    async_client, seeded_owner_with_unit, seeded_admin, db_session: AsyncSession
):
    """
    Scenario 5: Customer cancels while admin confirms payment for the same booking.
    Expected:
    - Exactly one coherent final state:
      EITHER: Cancelled with the correct refund and a freed unit ('available')
      OR: Confirmed with no refund and a booked unit ('booked')
    - NEVER both:
      * Never a refund recorded for an unpaid booking
      * Never a freed unit under a confirmed booking
      * Never duplicate payments or duplicate refunds
    - Invariants audit passes.
    """
    from app.models.core import User, Refund
    _, _, unit_id = seeded_owner_with_unit
    admin_token = create_access_token(seeded_admin, "admin")

    customer = User(
        name="Race Customer",
        email=f"race_{uuid.uuid4().hex[:6]}@example.com",
        phone=f"+919877{uuid.uuid4().int % 1000000:06d}",
        password_hash="fakehash",
        role="customer",
    )
    db_session.add(customer)

    unit = await db_session.get(InventoryUnit, unit_id)
    unit.status = "held"
    booking = Booking(
        inventory_unit_id=unit_id,
        customer_id=customer.id,
        venue_id=unit.venue_id,
        venue_name="The Grand Arena",
        venue_category="sports",
        status="pending_payment",
        amount=Decimal("2000.00"),
    )
    db_session.add(booking)
    await db_session.commit()
    await db_session.refresh(customer)
    await db_session.refresh(booking)

    customer_token = create_access_token(customer.id, "customer")

    # Concurrently fire confirm-payment (admin) and cancel (customer)
    resps = await asyncio.gather(
        async_client.post(
            f"/api/v1/admin/bookings/{booking.id}/confirm-payment",
            json={"amount": "2000.00", "method": "upi"},
            headers={"Authorization": f"Bearer {admin_token}"},
        ),
        async_client.post(
            f"/api/v1/bookings/{booking.id}/cancel",
            json={"reason": "Customer cancellation race"},
            headers={"Authorization": f"Bearer {customer_token}"},
        ),
    )

    status_codes = [r.status_code for r in resps]
    assert 500 not in status_codes

    # Refresh DB state
    await db_session.refresh(booking)
    await db_session.refresh(unit)
    payments = (
        await db_session.execute(select(Payment).where(Payment.booking_id == booking.id))
    ).scalars().all()
    refunds = (
        await db_session.execute(select(Refund).where(Refund.booking_id == booking.id))
    ).scalars().all()

    if booking.status == "confirmed":
        # Admin confirmation succeeded before cancellation
        assert len(payments) == 1
        assert payments[0].status == "success"
        assert len(refunds) == 0
        assert unit.status == "booked"
    elif booking.status in ("cancelled", "refunded"):
        # Customer cancellation happened after payment confirmed (or before)
        assert unit.status == "available"
        if len(payments) > 0:
            assert len(payments) == 1
            assert payments[0].status == "refunded"
            assert len(refunds) == 1
            assert refunds[0].status == "processed"
        else:
            assert len(refunds) == 0, "Never a refund for an unpaid booking!"

    # Universal negative assertions
    assert not (booking.status == "confirmed" and unit.status == "available"), "Freed unit under confirmed booking!"
    assert not (len(refunds) > 0 and len(payments) == 0), "Refund recorded for unpaid booking!"

    # Invariants audit
    await assert_invariants(db_session)


# ===========================================================================
# SCENARIO 6: Double refund / Double cancel protection
# ===========================================================================

@pytest.mark.asyncio
async def test_scenario_6_double_cancel_with_idempotency_key(
    async_client, seeded_owner_with_unit, seeded_admin, db_session: AsyncSession
):
    """
    Scenario 6: Customer double-clicks Cancel on a confirmed booking with an Idempotency-Key.
    Expected:
    - Exactly 1 refund record created.
    - Exactly 1 Payment row marked 'refunded'.
    - Second response replays the original cancellation with 'Idempotent-Replayed: true'.
    - Invariants audit passes.
    """
    from app.models.core import User, Refund
    _, _, unit_id = seeded_owner_with_unit

    customer = User(
        name="Double Cancel Customer",
        email=f"cancel_{uuid.uuid4().hex[:6]}@example.com",
        phone=f"+919877{uuid.uuid4().int % 1000000:06d}",
        password_hash="fakehash",
        role="customer",
    )
    db_session.add(customer)

    unit = await db_session.get(InventoryUnit, unit_id)
    unit.status = "booked"
    booking = Booking(
        inventory_unit_id=unit_id,
        customer_id=customer.id,
        venue_id=unit.venue_id,
        venue_name="The Grand Arena",
        venue_category="sports",
        status="confirmed",
        amount=Decimal("2000.00"),
    )
    db_session.add(booking)
    await db_session.flush()

    payment = Payment(
        booking_id=booking.id,
        gateway="offline",
        amount=Decimal("2000.00"),
        currency="INR",
        method="upi",
        status="success",
        commission_rate=Decimal("10.00"),
        commission_amount=Decimal("200.00"),
    )
    db_session.add(payment)
    await db_session.commit()
    await db_session.refresh(customer)
    await db_session.refresh(booking)

    customer_token = create_access_token(customer.id, "customer")
    idem_key = f"cancel-{uuid.uuid4()}"
    headers = {
        "Authorization": f"Bearer {customer_token}",
        "Idempotency-Key": idem_key,
    }
    payload = {"reason": "Double click cancel test"}

    # Rapid double click
    resps = await asyncio.gather(
        async_client.post(f"/api/v1/bookings/{booking.id}/cancel", json=payload, headers=headers),
        async_client.post(f"/api/v1/bookings/{booking.id}/cancel", json=payload, headers=headers),
    )

    status_codes = [r.status_code for r in resps]
    assert 500 not in status_codes
    assert 200 in status_codes

    # Replay check
    replay_resp = await async_client.post(
        f"/api/v1/bookings/{booking.id}/cancel", json=payload, headers=headers
    )
    assert replay_resp.status_code == 200
    assert replay_resp.headers.get("Idempotent-Replayed") == "true"

    # Exactly 1 refund in DB
    refunds = (
        await db_session.execute(select(Refund).where(Refund.booking_id == booking.id))
    ).scalars().all()
    assert len(refunds) == 1, f"Expected 1 refund record, got {len(refunds)}"

    await assert_invariants(db_session)


# ===========================================================================
# SCENARIO 7: Concurrent Payout Run / Double Mark-Paid
# ===========================================================================

@pytest.mark.asyncio
async def test_scenario_7_concurrent_payout_run_and_mark_paid(
    async_client, seeded_owner_with_unit, seeded_admin, db_session: AsyncSession
):
    """
    Scenario 7: Concurrent admin payout run or double mark-paid.
    Expected:
    - Every payment stamped to exactly one payout.
    - Idempotency prevents duplicate payout runs.
    - Replay returns Idempotent-Replayed: true.
    - Invariants audit passes.
    """
    from datetime import date, datetime, time, timedelta, timezone
    owner_id, _, unit_id = seeded_owner_with_unit
    admin_token = create_access_token(seeded_admin, "admin")

    unit = await db_session.get(InventoryUnit, unit_id)
    venue_id = unit.venue_id

    # Create an eligible past slot and payment
    today = datetime.now(timezone.utc).date()
    past_date = today - timedelta(days=20)
    past_unit = InventoryUnit(
        venue_id=venue_id,
        date=past_date,
        start_time=time(10, 0),
        end_time=time(11, 0),
        price=Decimal("1000.00"),
        status="booked",
    )
    db_session.add(past_unit)
    await db_session.flush()

    past_booking = Booking(
        inventory_unit_id=past_unit.id,
        guest_name="Payout Guest",
        guest_email="payoutguest@example.com",
        guest_phone="+919876543299",
        venue_id=venue_id,
        venue_name="The Grand Arena",
        venue_category="sports",
        status="completed",
        amount=Decimal("1000.00"),
    )
    db_session.add(past_booking)
    await db_session.flush()

    past_payment = Payment(
        booking_id=past_booking.id,
        gateway="offline",
        amount=Decimal("1000.00"),
        currency="INR",
        method="upi",
        status="success",
        commission_rate=Decimal("10.00"),
        commission_amount=Decimal("100.00"),
    )
    db_session.add(past_payment)
    await db_session.commit()

    idem_key = f"payout-run-{uuid.uuid4()}"
    headers = {
        "Authorization": f"Bearer {admin_token}",
        "Idempotency-Key": idem_key,
    }
    payload = {
        "owner_id": str(owner_id),
        "period_start": str(past_date - timedelta(days=2)),
        "period_end": str(past_date + timedelta(days=2)),
    }

    # Two concurrent payout runs with same key
    resps = await asyncio.gather(
        async_client.post("/api/v1/admin/payouts/run", json=payload, headers=headers),
        async_client.post("/api/v1/admin/payouts/run", json=payload, headers=headers),
    )
    status_codes = [r.status_code for r in resps]
    assert 500 not in status_codes
    assert 200 in status_codes

    replay_resp = await async_client.post("/api/v1/admin/payouts/run", json=payload, headers=headers)
    assert replay_resp.status_code == 200
    assert replay_resp.headers.get("Idempotent-Replayed") == "true"

    payout_id = replay_resp.json()["id"]

    # Now test double mark-paid with idempotency key
    mark_key = f"mark-paid-{uuid.uuid4()}"
    mark_headers = {
        "Authorization": f"Bearer {admin_token}",
        "Idempotency-Key": mark_key,
    }
    mark_payload = {"reference": "NEFT-123456"}

    mark_resps = await asyncio.gather(
        async_client.post(f"/api/v1/admin/payouts/{payout_id}/mark-paid", json=mark_payload, headers=mark_headers),
        async_client.post(f"/api/v1/admin/payouts/{payout_id}/mark-paid", json=mark_payload, headers=mark_headers),
    )
    mark_codes = [r.status_code for r in mark_resps]
    assert 500 not in mark_codes
    assert 200 in mark_codes

    mark_replay = await async_client.post(
        f"/api/v1/admin/payouts/{payout_id}/mark-paid", json=mark_payload, headers=mark_headers
    )
    assert mark_replay.status_code == 200
    assert mark_replay.headers.get("Idempotent-Replayed") == "true"

    await assert_invariants(db_session)


# ===========================================================================
# SCENARIO 12: Inventory batch create retried / NULL-time slot deduplication
# ===========================================================================

@pytest.mark.asyncio
async def test_scenario_12_inventory_null_time_slot_deduplication(
    seeded_owner_with_unit, db_session: AsyncSession
):
    """
    Scenario 12: Full-day and half-day units with NULL times cannot be duplicated.
    uq_inventory_unit_slot_nullsafe enforces uniqueness on (venue_id, date, COALESCE(start_time, '00:00:00'), COALESCE(end_time, '23:59:59')).
    Expected:
    - Attempting to insert duplicate full-day units (with NULL times) fails with IntegrityError.
    - Invariants audit passes.
    """
    from datetime import date
    from sqlalchemy.exc import IntegrityError
    owner_id, _, unit_id = seeded_owner_with_unit
    unit = await db_session.get(InventoryUnit, unit_id)
    venue_id = unit.venue_id

    # Insert a full-day unit (start_time=None, end_time=None)
    target_date = date(2026, 12, 25)
    unit1 = InventoryUnit(
        venue_id=venue_id,
        date=target_date,
        start_time=None,
        end_time=None,
        price=Decimal("15000.00"),
        status="available",
    )
    db_session.add(unit1)
    await db_session.commit()

    # Attempt to insert a duplicate full-day unit for the exact same venue and date
    unit2 = InventoryUnit(
        venue_id=venue_id,
        date=target_date,
        start_time=None,
        end_time=None,
        price=Decimal("15000.00"),
        status="available",
    )
    db_session.add(unit2)
    with pytest.raises(IntegrityError):
        await db_session.commit()

    await db_session.rollback()
    await assert_invariants(db_session)


# ===========================================================================
# SCENARIO 16: Guest key collision: second guest replays first guest's key
# ===========================================================================

@pytest.mark.asyncio
async def test_scenario_16_guest_key_collision_refused(
    async_client, seeded_unit, db_session: AsyncSession
):
    """
    Scenario 16: Guest key collision.
    A second guest attempts to replay or collide with a first guest's idempotency key.
    Expected:
    - If payload is different: Refused with 422 Unprocessable Entity.
    - Cannot hijack another guest's booking.
    - Invariants audit passes.
    """
    idem_key = f"guest-shared-{uuid.uuid4()}"
    headers = {"Idempotency-Key": idem_key}

    payload_guest1 = {
        "inventory_unit_id": str(seeded_unit),
        "guest_name": "Guest One",
        "guest_email": "guest1@example.com",
        "guest_phone": "+919876543231",
    }
    resp1 = await async_client.post("/api/v1/bookings", json=payload_guest1, headers=headers)
    assert resp1.status_code == 201

    payload_guest2 = {
        "inventory_unit_id": str(seeded_unit),
        "guest_name": "Guest Two Attacker",
        "guest_email": "guest2@example.com",
        "guest_phone": "+919876543232",
    }
    resp2 = await async_client.post("/api/v1/bookings", json=payload_guest2, headers=headers)
    # Refused due to payload mismatch (422)
    assert resp2.status_code == 422
    assert "different payload" in resp2.json()["detail"].lower()

    await assert_invariants(db_session)


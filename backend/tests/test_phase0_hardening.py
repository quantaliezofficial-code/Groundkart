"""
Phase 0 Production Hardening Verification Suite
Tests all Phase 0 deliverables addressing research findings B7, B6, B2, A2, A3, A4:
1. Hold duration default is 30 minutes.
2. Max 3 active holds per customer/guest email returns 429 on 4th attempt.
3. 10-digit Indian mobile number validation and normalization.
4. System settings GET & PATCH endpoints with AuditLog diffs.
5. Admin review deletion, owner document views, and homepage placement audit logs.
6. Booking action requests listing and processing.
7. Commission rate and amount snapshot on payment confirmation, respected by payouts.
"""
import uuid
from datetime import date, datetime, time, timezone
from decimal import Decimal

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import func, select

from app.db import get_db, get_idem_db
from app.main import app
from app.models.core import (
    AuditLog,
    Booking,
    BookingActionRequest,
    InventoryUnit,
    Payment,
    Payout,
    Review,
    SystemConfiguration,
    User,
    Venue,
    OwnerVerification,
)
from app.modules.auth.security import create_access_token, hash_password
from app.modules.booking.service import create_booking, confirm_booking_by_admin
from app.modules.core.config_service import get_system_config
from app.modules.payout.service import run_payout


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


async def _create_test_unit(session, venue_id, slot_date=None, start_h=10, price=1000):
    unit = InventoryUnit(
        id=uuid.uuid4(),
        venue_id=venue_id,
        date=slot_date or date(2027, 9, 1),
        start_time=time(start_h, 0),
        end_time=time(start_h + 1, 0),
        price=price,
        status="available",
    )
    session.add(unit)
    await session.flush()
    return unit


# ---------------------------------------------------------------------------
# Finding B7: Hold Duration Default is 30 Minutes
# ---------------------------------------------------------------------------

async def test_hold_duration_default_is_30_minutes(test_session_factory):
    async with test_session_factory() as session:
        config = await get_system_config(session)
        assert config.booking_hold_duration_minutes == 30


# ---------------------------------------------------------------------------
# Finding B7: Active Holds Limit (Max 3 Active Unconfirmed Holds)
# ---------------------------------------------------------------------------

async def test_max_three_active_holds_cap(test_session_factory, seeded_verified_owner):
    async with test_session_factory() as session:
        async with session.begin():
            venue = Venue(
                owner_id=seeded_verified_owner,
                name="Arena Max Holds",
                slug=f"arena-max-holds-{uuid.uuid4().hex[:6]}",
                category="sports",
                address="Addr",
                city="Lucknow",
                unit_type="hour",
                base_price=1000,
                status="active",
            )
            session.add(venue)
            await session.flush()

            units = []
            for h in range(10, 15):
                u = await _create_test_unit(session, venue.id, start_h=h)
                units.append(u.id)

    guest_email = "slot-hoarder@example.com"
    # Create 3 bookings successfully
    for i in range(3):
        async with test_session_factory() as session:
            booking, _ = await create_booking(
                session=session,
                inventory_unit_id=units[i],
                guest_name="Guest Test",
                guest_email=guest_email,
                guest_phone="9876543210",
            )
            assert booking.status == "pending_payment"

    # 4th booking with same guest_email should raise 429
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        async with test_session_factory() as session:
            await create_booking(
                session=session,
                inventory_unit_id=units[3],
                guest_name="Guest Test",
                guest_email=guest_email,
                guest_phone="9876543210",
            )
    assert exc_info.value.status_code == 429
    assert "Maximum 3 active reservation holds" in exc_info.value.detail


# ---------------------------------------------------------------------------
# Finding B7: 10-Digit Indian Mobile Number Validation & Normalization
# ---------------------------------------------------------------------------

async def test_indian_mobile_number_validation_and_normalization(test_session_factory, seeded_verified_owner):
    async with test_session_factory() as session:
        async with session.begin():
            venue = Venue(
                owner_id=seeded_verified_owner,
                name="Arena Mobile",
                slug=f"arena-mobile-{uuid.uuid4().hex[:6]}",
                category="sports",
                address="Addr",
                city="Lucknow",
                unit_type="hour",
                base_price=1000,
                status="active",
            )
            session.add(venue)
            await session.flush()
            unit1 = await _create_test_unit(session, venue.id, start_h=10)
            unit2 = await _create_test_unit(session, venue.id, start_h=11)
            u1_id, u2_id = unit1.id, unit2.id

    from fastapi import HTTPException
    # Invalid phone (letters or wrong length) -> 422
    with pytest.raises(HTTPException) as exc_info:
        async with test_session_factory() as session:
            await create_booking(
                session=session,
                inventory_unit_id=u1_id,
                guest_name="Test",
                guest_email="test1@example.com",
                guest_phone="12345",
            )
    assert exc_info.value.status_code == 422
    assert "Invalid phone number" in exc_info.value.detail

    # Valid phone with +91 prefix normalizes to 10 digits
    async with test_session_factory() as session:
        b, _ = await create_booking(
            session=session,
            inventory_unit_id=u1_id,
            guest_name="Test",
            guest_email="test1@example.com",
            guest_phone="+91 98765 43210",
        )
        assert b.guest_phone == "9876543210"


# ---------------------------------------------------------------------------
# Finding A2: Admin Settings GET and PATCH Endpoints with Audit Log
# ---------------------------------------------------------------------------

async def test_admin_settings_get_and_patch(client, test_session_factory, seeded_admin):
    admin_token = create_access_token(seeded_admin, "admin")
    headers = {"Authorization": f"Bearer {admin_token}"}

    # GET settings
    get_resp = await client.get("/api/v1/admin/settings", headers=headers)
    assert get_resp.status_code == 200
    settings_data = get_resp.json()
    assert settings_data["booking_hold_duration_minutes"] == 30
    assert settings_data["platform_commission_percent"] == 10

    # PATCH settings
    patch_resp = await client.patch(
        "/api/v1/admin/settings",
        json={"booking_hold_duration_minutes": 45, "platform_commission_percent": 12},
        headers=headers,
    )
    assert patch_resp.status_code == 200
    updated_data = patch_resp.json()
    assert updated_data["booking_hold_duration_minutes"] == 45
    assert updated_data["platform_commission_percent"] == 12

    # Verify AuditLog was recorded
    async with test_session_factory() as session:
        result = await session.execute(
            select(AuditLog).where(AuditLog.action == "settings.updated")
        )
        log = result.scalar_one_or_none()
        assert log is not None
        assert log.actor_id == seeded_admin
        assert log.extra_data["before"]["booking_hold_duration_minutes"] == 30
        assert log.extra_data["after"]["booking_hold_duration_minutes"] == 45
        assert log.extra_data["before"]["platform_commission_percent"] == 10
        assert log.extra_data["after"]["platform_commission_percent"] == 12


# ---------------------------------------------------------------------------
# Finding A3: Audit Logging for Review Deletion & Owner Document View
# ---------------------------------------------------------------------------

async def test_review_deletion_and_doc_view_audit_logging(
    client, test_session_factory, seeded_admin, seeded_verified_owner, seeded_customer
):
    admin_token = create_access_token(seeded_admin, "admin")
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Setup Review
    async with test_session_factory() as session:
        async with session.begin():
            venue = Venue(
                owner_id=seeded_verified_owner,
                name="Arena Review",
                slug=f"arena-review-{uuid.uuid4().hex[:6]}",
                category="sports",
                address="Addr",
                city="Lucknow",
                unit_type="hour",
                base_price=1000,
                status="active",
            )
            session.add(venue)
            await session.flush()
            unit = await _create_test_unit(session, venue.id)
            booking = Booking(
                customer_id=seeded_customer,
                venue_id=venue.id,
                venue_name=venue.name,
                venue_category=venue.category,
                inventory_unit_id=unit.id,
                status="confirmed",
                amount=Decimal("1000.00"),
                currency="INR",
            )
            session.add(booking)
            await session.flush()
            review = Review(
                booking_id=booking.id,
                venue_id=venue.id,
                user_id=seeded_customer,
                rating=2,
                content="Not good",
            )
            session.add(review)
            await session.flush()
            rev_id = review.id

    # Admin deletes review
    del_resp = await client.delete(f"/api/v1/admin/reviews/{rev_id}", headers=headers)
    assert del_resp.status_code == 204

    # Verify review.deleted audit log
    async with test_session_factory() as session:
        log = (
            await session.execute(
                select(AuditLog).where(AuditLog.action == "review.deleted", AuditLog.entity_id == rev_id)
            )
        ).scalar_one_or_none()
        assert log is not None
        assert log.actor_id == seeded_admin

    # Setup Owner Verification with mock document
    from app.storage_client import get_private_file_storage
    storage = get_private_file_storage()
    _, s_key = await storage.save(b"%PDF-1.4 mock pdf document", "application/pdf", "verifications")

    async with test_session_factory() as session:
        async with session.begin():
            verif = OwnerVerification(
                user_id=seeded_verified_owner,
                identification_type="aadhaar",
                identification_number="123456789012",
                document_url=s_key,
                storage_key=s_key,
                status="pending",
            )
            session.add(verif)
            await session.flush()
            verif_id = verif.id

    # Viewing document URL via admin endpoint
    doc_resp = await client.get(f"/api/v1/admin/owner-verifications/{verif_id}/document", headers=headers)
    assert doc_resp.status_code == 200, f"Expected 200 but got {doc_resp.status_code}: {doc_resp.text}"

    # Verify owner_verification.document_viewed audit log
    async with test_session_factory() as session:
        log = (
            await session.execute(
                select(AuditLog).where(
                    AuditLog.action == "owner_verification.document_viewed",
                    AuditLog.entity_id == verif_id,
                )
            )
        ).scalar_one_or_none()
        assert log is not None
        assert log.actor_id == seeded_admin


# ---------------------------------------------------------------------------
# Finding B2: Commission Snapshot on Payment Confirmation & Payout Aggregation
# ---------------------------------------------------------------------------

async def test_commission_snapshot_and_payout_aggregation(
    test_session_factory, seeded_verified_owner, seeded_admin
):
    async with test_session_factory() as session:
        async with session.begin():
            venue = Venue(
                owner_id=seeded_verified_owner,
                name="Arena Comm",
                slug=f"arena-comm-{uuid.uuid4().hex[:6]}",
                category="sports",
                address="Addr",
                city="Lucknow",
                unit_type="hour",
                base_price=3000,
                status="active",
            )
            session.add(venue)
            await session.flush()
            # Slot date in the past so it qualifies for payout
            unit = await _create_test_unit(session, venue.id, slot_date=date(2025, 1, 10), price=3000)
            u_id = unit.id

    # Create and confirm booking by admin
    async with test_session_factory() as session:
        booking, _ = await create_booking(
            session=session,
            inventory_unit_id=u_id,
            guest_name="Comm Guest",
            guest_email="comm@example.com",
            guest_phone="9876543210",
        )
        b_id = booking.id

    async with test_session_factory() as session:
        confirmed_booking = await confirm_booking_by_admin(
            session=session,
            booking_id=b_id,
            admin_id=seeded_admin,
            amount=Decimal("3000.00"),
            method="bank_transfer",
            reference="UTR123456",
        )

    # Verify payment row has snapshotted commission rate (10%) and amount (300.00)
    async with test_session_factory() as session:
        payment = (
            await session.execute(select(Payment).where(Payment.booking_id == b_id))
        ).scalar_one()
        assert payment.commission_rate == Decimal("10.00")
        assert payment.commission_amount == Decimal("300.00")

    # Run payout for this owner and verify it uses snapshotted commission
    async with test_session_factory() as session:
        payout = await run_payout(
            session=session,
            admin_id=seeded_admin,
            owner_id=seeded_verified_owner,
            period_start=date(2025, 1, 1),
            period_end=date(2025, 1, 31),
        )
        assert payout is not None
        assert payout.gross_amount == Decimal("3000.00")
        assert payout.commission_amount == Decimal("300.00")
        assert payout.net_amount == Decimal("2700.00")


# ---------------------------------------------------------------------------
# Finding B6 & A4: Owner Grace Flag Creates Action Request & Admin Processes
# ---------------------------------------------------------------------------

async def test_owner_flag_creates_action_request_and_admin_processes(
    client, test_session_factory, seeded_verified_owner, seeded_customer, seeded_admin
):
    admin_token = create_access_token(seeded_admin, "admin")
    owner_token = create_access_token(seeded_verified_owner, "owner")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    owner_headers = {"Authorization": f"Bearer {owner_token}"}

    # Setup confirmed booking
    async with test_session_factory() as session:
        async with session.begin():
            venue = Venue(
                owner_id=seeded_verified_owner,
                name="Arena Flag",
                slug=f"arena-flag-{uuid.uuid4().hex[:6]}",
                category="sports",
                address="Addr",
                city="Lucknow",
                unit_type="hour",
                base_price=1500,
                status="active",
            )
            session.add(venue)
            await session.flush()
            unit = await _create_test_unit(session, venue.id, slot_date=date(2026, 12, 1), price=1500)
            u_id = unit.id

    async with test_session_factory() as session:
        booking, _ = await create_booking(
            session=session,
            inventory_unit_id=u_id,
            guest_name="Flag Guest",
            guest_email="flag@example.com",
            guest_phone="9876543210",
        )
        b_id = booking.id

    async with test_session_factory() as session:
        await confirm_booking_by_admin(
            session=session,
            booking_id=b_id,
            admin_id=seeded_admin,
            amount=Decimal("1500.00"),
            method="bank_transfer",
            reference="UTRFLAG123",
        )

    # 1. Owner flags booking within grace period
    flag_resp = await client.post(
        f"/api/v1/bookings/{b_id}/flag",
        json={"reason": "Double booked on owner local calendar"},
        headers=owner_headers,
    )
    assert flag_resp.status_code == 200
    assert flag_resp.json()["status"] == "under_admin_review"

    # Verify BookingActionRequest was created in pending status
    async with test_session_factory() as session:
        booking = (await session.execute(select(Booking).where(Booking.id == b_id))).scalar_one()
        assert booking.status == "under_admin_review"

        req = (
            await session.execute(
                select(BookingActionRequest).where(BookingActionRequest.booking_id == b_id)
            )
        ).scalar_one()
        assert req.status == "pending"
        assert req.action_type == "cancel"
        assert req.reason == "Double booked on owner local calendar"
        req_id = req.id

    # 2. Admin lists booking action requests
    list_resp = await client.get("/api/v1/admin/booking-actions?status=pending", headers=admin_headers)
    assert list_resp.status_code == 200
    actions = list_resp.json()
    assert any(a["id"] == str(req_id) for a in actions)

    # 3. Admin gets detail of the booking action request
    detail_resp = await client.get(f"/api/v1/admin/booking-actions/{req_id}", headers=admin_headers)
    assert detail_resp.status_code == 200
    assert detail_resp.json()["id"] == str(req_id)

    # 4. Admin processes the request: APPROVES
    proc_resp = await client.post(
        f"/api/v1/admin/booking-actions/{req_id}/process",
        json={"decision": "approved", "admin_notes": "Valid double booking, approving refund."},
        headers=admin_headers,
    )
    assert proc_resp.status_code == 200
    proc_data = proc_resp.json()
    assert proc_data["status"] == "approved"

    # Verify booking and payment state updated
    async with test_session_factory() as session:
        b_after = (await session.execute(select(Booking).where(Booking.id == b_id))).scalar_one()
        assert b_after.status == "refunded"
        p_after = (await session.execute(select(Payment).where(Payment.booking_id == b_id))).scalar_one()
        assert p_after.status == "refunded"
        assert p_after.refund_amount == Decimal("1500.00")

        # Verify audit log for approval
        log = (
            await session.execute(
                select(AuditLog).where(
                    AuditLog.action == "booking_action.approved",
                    AuditLog.entity_id == req_id,
                )
            )
        ).scalar_one_or_none()
        assert log is not None
        assert log.actor_id == seeded_admin



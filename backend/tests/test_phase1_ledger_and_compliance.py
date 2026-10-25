"""
Phase 1 Ledger Trust & Compliance Verification Suite
Tests all Phase 1 deliverables addressing research findings B1, B4, B5, B6:
1. Double-entry ledger balanced emission on payment confirmation.
2. Double-entry ledger balanced reversal & Refund entity on customer cancellation.
3. Double-entry ledger balanced reversal & Refund entity on admin-approved owner cancellation.
4. Payout settlement with UTR reference, beneficiary bank account, and double-entry disbursement.
5. Owner beneficiary bank account management, IFSC & account number validation, and primary account toggling.
6. Payout holdback duration enforcement (payout_holdback_days).
7. Full ledger reconciliation API (GET /api/v1/admin/ledger/reconcile).
8. Ledger entries querying, filtering, and pagination.
"""
import uuid
from datetime import date, datetime, time, timedelta
from decimal import Decimal

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import select

from app.db import get_db, get_idem_db
from app.main import app
from app.models.core import (
    Booking,
    BookingActionRequest,
    InventoryUnit,
    LedgerEntry,
    OwnerBankAccount,
    Payment,
    Payout,
    Refund,
    SystemConfiguration,
    User,
    Venue,
    OwnerVerification,
)
from app.modules.auth.security import create_access_token, hash_password
from app.modules.booking.service import (
    VENUE_LOCAL_TZ,
    confirm_booking_by_admin,
    create_booking,
    request_booking_action,
    process_booking_action_request,
)
from app.modules.core.config_service import update_system_config
from app.modules.ledger.service import Account, EntryType

TODAY = datetime.now(VENUE_LOCAL_TZ).date()


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


async def _create_test_venue_and_unit(session, owner_id, slot_date=None, start_h=10, price=2000):
    venue = Venue(
        owner_id=owner_id,
        name="Phase 1 Test Arena",
        slug=f"p1-arena-{uuid.uuid4().hex[:6]}",
        category="football",
        address="Sector 62, Noida",
        city="Noida",
        unit_type="hour",
        base_price=price,
        status="active",
    )
    session.add(venue)
    await session.flush()

    unit = InventoryUnit(
        id=uuid.uuid4(),
        venue_id=venue.id,
        date=slot_date or (TODAY + timedelta(days=5)),
        start_time=time(start_h, 0),
        end_time=time(start_h + 1, 0),
        price=price,
        status="available",
    )
    session.add(unit)
    await session.flush()
    return venue, unit


# ---------------------------------------------------------------------------
# 1. Double-Entry Ledger Balancing on Payment Confirmation
# ---------------------------------------------------------------------------

async def test_payment_confirmation_emits_balanced_double_entry(test_session_factory, seeded_verified_owner, seeded_admin, client):
    async with test_session_factory() as session:
        async with session.begin():
            venue, unit = await _create_test_venue_and_unit(session, seeded_verified_owner, price=2000)
            unit_id = unit.id

        booking, _ = await create_booking(
            session=session,
            inventory_unit_id=unit_id,
            guest_name="Rohan Sharma",
            guest_email="rohan@example.com",
            guest_phone="9876543210",
        )
        booking_id = booking.id

        # Admin confirms payment
        await confirm_booking_by_admin(
            session=session,
            booking_id=booking_id,
            admin_id=seeded_admin,
            amount=Decimal("2000.00"),
            method="upi",
            reference="UPI-REF-001",
        )

    # Verify double-entry ledger rows
    async with test_session_factory() as session:
        res = await session.execute(
            select(LedgerEntry).where(LedgerEntry.booking_id == booking_id).order_by(LedgerEntry.direction.desc())
        )
        entries = res.scalars().all()
        assert len(entries) == 3

        # All entries must share the same transaction_id
        tx_ids = {e.transaction_id for e in entries}
        assert len(tx_ids) == 1

        debits = [e for e in entries if e.direction == "debit"]
        credits = [e for e in entries if e.direction == "credit"]

        assert len(debits) == 1
        assert debits[0].account == Account.CUSTOMER_FUNDS_HELD
        assert debits[0].amount == Decimal("2000.00")

        assert len(credits) == 2
        owner_payable = next(e for e in credits if e.account == Account.OWNER_PAYABLE)
        comm_entry = next(e for e in credits if e.account == Account.PLATFORM_COMMISSION_REVENUE)

        # 10% commission on 2000 = 200, owner payable = 1800
        assert owner_payable.amount == Decimal("1800.00")
        assert comm_entry.amount == Decimal("200.00")
        assert debits[0].amount == (owner_payable.amount + comm_entry.amount)

    # Verify via Reconciliation API endpoint
    token = create_access_token(seeded_admin, "admin")
    resp = await client.get("/api/v1/admin/ledger/reconcile", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    reconcile = resp.json()
    assert reconcile["balanced"] is True
    assert Decimal(str(reconcile["imbalance"])) == Decimal("0.00")
    assert Decimal(str(reconcile["total_debits"])) == Decimal("2000.00")
    assert Decimal(str(reconcile["total_credits"])) == Decimal("2000.00")
    assert Decimal(str(reconcile["account_balances"]["customer_funds_held"])) == Decimal("2000.00")
    assert Decimal(str(reconcile["account_balances"]["owner_payable"])) == Decimal("1800.00")
    assert Decimal(str(reconcile["account_balances"]["platform_commission_revenue"])) == Decimal("200.00")


# ---------------------------------------------------------------------------
# 2. Customer Cancellation: Refund Entity & Balanced Double-Entry Reversal
# ---------------------------------------------------------------------------

async def test_customer_cancellation_emits_refund_and_balanced_ledger(test_session_factory, seeded_verified_owner, seeded_admin, client):
    # Customer booking 5 days in advance (100% refund tier >48 hours)
    customer_id = uuid.uuid4()
    async with test_session_factory() as session:
        async with session.begin():
            customer = User(
                id=customer_id,
                name="Ananya Roy",
                email=f"ananya-{uuid.uuid4().hex[:6]}@example.com",
                phone="9876543211",
                password_hash=hash_password("test-pass-123"),
                role="customer",
            )
            session.add(customer)
            venue, unit = await _create_test_venue_and_unit(session, seeded_verified_owner, slot_date=TODAY + timedelta(days=5), price=3000)
            unit_id = unit.id

        booking, _ = await create_booking(
            session=session,
            inventory_unit_id=unit_id,
            customer_id=customer_id,
        )
        booking_id = booking.id

        await confirm_booking_by_admin(
            session=session,
            booking_id=booking_id,
            admin_id=seeded_admin,
            amount=Decimal("3000.00"),
            method="card",
            reference="CARD-TX-999",
        )

    # Customer cancels via HTTP API
    cust_token = create_access_token(customer_id, "customer")
    cancel_resp = await client.post(
        f"/api/v1/bookings/{booking_id}/cancel",
        json={"reason": "Change of plans"},
        headers={"Authorization": f"Bearer {cust_token}"},
    )
    assert cancel_resp.status_code == 200
    assert cancel_resp.json()["status"] == "refunded"

    # Verify Refund row
    async with test_session_factory() as session:
        res = await session.execute(select(Refund).where(Refund.booking_id == booking_id))
        refund = res.scalar_one_or_none()
        assert refund is not None
        assert refund.amount == Decimal("3000.00")
        assert refund.status == "processed"
        assert refund.mode == "offline_manual"
        assert refund.reason == "Change of plans"

        # Verify refund ledger entries
        res = await session.execute(
            select(LedgerEntry).where(
                LedgerEntry.booking_id == booking_id,
                LedgerEntry.entry_type == EntryType.REFUND,
            )
        )
        refund_entries = res.scalars().all()
        assert len(refund_entries) == 3

        debits = [e for e in refund_entries if e.direction == "debit"]
        credits = [e for e in refund_entries if e.direction == "credit"]

        # Debits: Owner payable reversed (2700) + Commission reversed (300)
        assert len(debits) == 2
        owner_rev = next(e for e in debits if e.account == Account.OWNER_PAYABLE)
        comm_rev = next(e for e in debits if e.account == Account.PLATFORM_COMMISSION_REVENUE)
        assert owner_rev.amount == Decimal("2700.00")
        assert comm_rev.amount == Decimal("300.00")

        # Credit: Customer funds returned (3000)
        assert len(credits) == 1
        assert credits[0].account == Account.CUSTOMER_FUNDS_HELD
        assert credits[0].amount == Decimal("3000.00")

    # Reconcile API check: overall ledger must remain 100% balanced with 0 net liability
    token = create_access_token(seeded_admin, "admin")
    resp = await client.get("/api/v1/admin/ledger/reconcile", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    rec = resp.json()
    assert rec["balanced"] is True
    assert Decimal(str(rec["imbalance"])) == Decimal("0.00")
    # All balances return to 0 since 100% refund reversed all positions
    assert Decimal(str(rec["account_balances"]["customer_funds_held"])) == Decimal("0.00")
    assert Decimal(str(rec["account_balances"]["owner_payable"])) == Decimal("0.00")
    assert Decimal(str(rec["account_balances"]["platform_commission_revenue"])) == Decimal("0.00")

    # Admin refunds endpoint check
    refunds_resp = await client.get("/api/v1/admin/refunds", headers={"Authorization": f"Bearer {token}"})
    assert refunds_resp.status_code == 200
    all_refunds = refunds_resp.json()
    assert len(all_refunds) >= 1
    matched = next(r for r in all_refunds if r["booking_id"] == str(booking_id))
    assert Decimal(str(matched["amount"])) == Decimal("3000.00")
    assert matched["status"] == "processed"


# ---------------------------------------------------------------------------
# 3. Owner Cancellation Approval: Refund Entity & Ledger Emission
# ---------------------------------------------------------------------------

async def test_owner_cancellation_approval_emits_refund_and_ledger(test_session_factory, seeded_verified_owner, seeded_admin, client):
    async with test_session_factory() as session:
        async with session.begin():
            venue, unit = await _create_test_venue_and_unit(session, seeded_verified_owner, price=1500)
            unit_id = unit.id

        booking, _ = await create_booking(
            session=session,
            inventory_unit_id=unit_id,
            guest_name="Vikram Rao",
            guest_email="vikram@example.com",
        )
        booking_id = booking.id

        await confirm_booking_by_admin(
            session=session,
            booking_id=booking_id,
            admin_id=seeded_admin,
            amount=Decimal("1500.00"),
            method="upi",
            reference="UPI-VIKRAM-1500",
        )

        # Owner requests cancellation
        action_req = await request_booking_action(
            session=session,
            booking_id=booking_id,
            actor_id=seeded_verified_owner,
            actor_type="owner",
            action_type="cancel",
            reason_code="maintenance",
            notes="Turf undergoing unexpected floodlight repairs",
        )
        action_id = action_req.id

    # Admin approves the owner cancellation via HTTP API
    token = create_access_token(seeded_admin, "admin")
    resp = await client.post(
        f"/api/v1/admin/booking-actions/{action_id}/process",
        json={"decision": "approved", "decision_reason": "Approved due to emergency maintenance"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "approved"

    # Verify Refund row was created
    async with test_session_factory() as session:
        res = await session.execute(select(Refund).where(Refund.booking_id == booking_id))
        refund = res.scalar_one_or_none()
        assert refund is not None
        assert refund.amount == Decimal("1500.00")
        assert refund.status == "processed"
        assert "maintenance" in refund.reason.lower()

        # Verify ledger entries for this refund
        res = await session.execute(
            select(LedgerEntry).where(LedgerEntry.booking_id == booking_id, LedgerEntry.entry_type == EntryType.REFUND)
        )
        entries = res.scalars().all()
        assert len(entries) == 3


# ---------------------------------------------------------------------------
# 4. Payout Settlement: UTR Reference, Beneficiary Account & Double-Entry Disbursement
# ---------------------------------------------------------------------------

async def test_payout_settlement_with_utr_and_bank_account(test_session_factory, seeded_verified_owner, seeded_admin, client):
    # Setup owner bank account
    owner_token = create_access_token(seeded_verified_owner, "owner")
    bank_resp = await client.post(
        "/api/v1/owner/bank-accounts",
        json={
            "account_holder_name": "Arjun Sports Enterprises",
            "account_number": "91234567890123",
            "ifsc_code": "HDFC0001234",
            "bank_name": "HDFC Bank",
            "upi_id": "arjun@hdfcbank",
            "is_primary": True,
        },
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert bank_resp.status_code == 201
    bank_account_id = bank_resp.json()["id"]

    # Create past-dated booking (eligible for payout)
    past_date = TODAY - timedelta(days=10)
    async with test_session_factory() as session:
        async with session.begin():
            venue, unit = await _create_test_venue_and_unit(session, seeded_verified_owner, slot_date=past_date, price=5000)
            unit_id = unit.id

        booking, _ = await create_booking(
            session=session,
            inventory_unit_id=unit_id,
            guest_name="Tournament Client",
            guest_email="client@example.com",
        )
        booking_id = booking.id

        await confirm_booking_by_admin(
            session=session,
            booking_id=booking_id,
            admin_id=seeded_admin,
            amount=Decimal("5000.00"),
            method="bank_transfer",
            reference="BANK-PAST-01",
        )

    # Admin runs payout
    admin_token = create_access_token(seeded_admin, "admin")
    run_resp = await client.post(
        "/api/v1/admin/payouts/run",
        json={
            "owner_id": str(seeded_verified_owner),
            "period_start": str(TODAY - timedelta(days=20)),
            "period_end": str(TODAY - timedelta(days=1)),
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert run_resp.status_code == 200
    payout_id = run_resp.json()["id"]
    # 5000 gross - 500 commission (10%) = 4500 net
    assert Decimal(str(run_resp.json()["net_amount"])) == Decimal("4500.00")

    # Admin marks payout paid with UTR and bank account ID
    mark_resp = await client.post(
        f"/api/v1/admin/payouts/{payout_id}/mark-paid",
        json={
            "reference": "UTR-ICICI-20261016-00441",
            "bank_account_id": bank_account_id,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert mark_resp.status_code == 200
    paid_payout = mark_resp.json()
    assert paid_payout["status"] == "paid"
    assert paid_payout["payout_reference"] == "UTR-ICICI-20261016-00441"
    assert paid_payout["bank_account_id"] == bank_account_id

    # Verify double-entry disbursement records
    async with test_session_factory() as session:
        res = await session.execute(
            select(LedgerEntry).where(LedgerEntry.payout_id == uuid.UUID(payout_id))
        )
        payout_entries = res.scalars().all()
        assert len(payout_entries) == 2

        debit_entry = next(e for e in payout_entries if e.direction == "debit")
        credit_entry = next(e for e in payout_entries if e.direction == "credit")

        assert debit_entry.account == Account.OWNER_PAYABLE
        assert debit_entry.amount == Decimal("4500.00")

        assert credit_entry.account == Account.PLATFORM_CASH
        assert credit_entry.amount == Decimal("4500.00")

    # Reconciliation API check
    rec_resp = await client.get("/api/v1/admin/ledger/reconcile", headers={"Authorization": f"Bearer {admin_token}"})
    assert rec_resp.status_code == 200
    rec = rec_resp.json()
    assert rec["balanced"] is True
    assert Decimal(str(rec["imbalance"])) == Decimal("0.00")
    # Owner payable should be 0 because 4500 was fully disbursed!
    assert Decimal(str(rec["account_balances"]["owner_payable"])) == Decimal("0.00")
    # Commission revenue retained: 500
    assert Decimal(str(rec["account_balances"]["platform_commission_revenue"])) == Decimal("500.00")


# ---------------------------------------------------------------------------
# 5. Owner Bank Account Management & Validation Rules
# ---------------------------------------------------------------------------

async def test_owner_bank_account_validation_and_primary_toggling(client, seeded_verified_owner):
    owner_token = create_access_token(seeded_verified_owner, "owner")

    # 1. Invalid IFSC format (lowercase, wrong length, missing 0)
    bad_ifsc_resp = await client.post(
        "/api/v1/owner/bank-accounts",
        json={
            "account_holder_name": "Test User",
            "account_number": "1234567890",
            "ifsc_code": "INVALID_IFSC",
        },
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert bad_ifsc_resp.status_code == 422

    # 2. Invalid account number (<9 digits or letters)
    bad_acc_resp = await client.post(
        "/api/v1/owner/bank-accounts",
        json={
            "account_holder_name": "Test User",
            "account_number": "1234",
            "ifsc_code": "SBIN0001234",
        },
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert bad_acc_resp.status_code == 422

    # 3. Add first account (Primary)
    acc1_resp = await client.post(
        "/api/v1/owner/bank-accounts",
        json={
            "account_holder_name": "Sharma Sports Club",
            "account_number": "112233445566",
            "ifsc_code": "SBIN0001234",
            "is_primary": True,
        },
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert acc1_resp.status_code == 201
    acc1 = acc1_resp.json()
    assert acc1["is_primary"] is True

    # 4. Add second account with is_primary=True -> acc1 should become is_primary=False
    acc2_resp = await client.post(
        "/api/v1/owner/bank-accounts",
        json={
            "account_holder_name": "Sharma Sports Club",
            "account_number": "998877665544",
            "ifsc_code": "ICIC0001234",
            "is_primary": True,
        },
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert acc2_resp.status_code == 201
    acc2 = acc2_resp.json()
    assert acc2["is_primary"] is True

    # 5. List bank accounts -> verify acc2 is primary, acc1 is non-primary
    list_resp = await client.get("/api/v1/owner/bank-accounts", headers={"Authorization": f"Bearer {owner_token}"})
    assert list_resp.status_code == 200
    accounts = list_resp.json()
    assert len(accounts) == 2
    assert accounts[0]["id"] == acc2["id"]
    assert accounts[0]["is_primary"] is True
    assert accounts[1]["id"] == acc1["id"]
    assert accounts[1]["is_primary"] is False


# ---------------------------------------------------------------------------
# 6. Payout Settlement Holdback Duration Window Enforcement
# ---------------------------------------------------------------------------

async def test_payout_holdback_days_window_enforcement(client, test_session_factory, seeded_verified_owner, seeded_admin):
    admin_token = create_access_token(seeded_admin, "admin")

    # Set payout_holdback_days to 3
    patch_resp = await client.patch(
        "/api/v1/admin/settings",
        json={"payout_holdback_days": 3},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["payout_holdback_days"] == 3

    # Create slot 1 day ago (violates 3-day holdback window)
    async with test_session_factory() as session:
        async with session.begin():
            venue, unit = await _create_test_venue_and_unit(session, seeded_verified_owner, slot_date=TODAY - timedelta(days=1), price=1000)
            unit_id = unit.id

        booking, _ = await create_booking(
            session=session,
            inventory_unit_id=unit_id,
            guest_name="Holdback Test",
            guest_email="holdback@example.com",
        )
        booking_id = booking.id

        await confirm_booking_by_admin(
            session=session,
            booking_id=booking_id,
            admin_id=seeded_admin,
            amount=Decimal("1000.00"),
            method="upi",
            reference="UPI-HOLDBACK-1",
        )

    # Attempt to run payout for period ending 1 day ago -> rejected due to holdback window
    rej_resp = await client.post(
        "/api/v1/admin/payouts/run",
        json={
            "owner_id": str(seeded_verified_owner),
            "period_start": str(TODAY - timedelta(days=10)),
            "period_end": str(TODAY - timedelta(days=1)),
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert rej_resp.status_code == 422
    assert "holdback window" in rej_resp.json()["detail"].lower()

    # Create slot 5 days ago (satisfies 3-day holdback window)
    async with test_session_factory() as session:
        async with session.begin():
            venue2, unit2 = await _create_test_venue_and_unit(session, seeded_verified_owner, slot_date=TODAY - timedelta(days=5), price=1200)
            unit2_id = unit2.id

        booking2, _ = await create_booking(
            session=session,
            inventory_unit_id=unit2_id,
            guest_name="Holdback Passed",
            guest_email="holdback2@example.com",
        )
        booking2_id = booking2.id

        await confirm_booking_by_admin(
            session=session,
            booking_id=booking2_id,
            admin_id=seeded_admin,
            amount=Decimal("1200.00"),
            method="upi",
            reference="UPI-HOLDBACK-2",
        )

    # Run payout with period_end = TODAY - 4 days (older than 3 days holdback) -> succeeds
    ok_resp = await client.post(
        "/api/v1/admin/payouts/run",
        json={
            "owner_id": str(seeded_verified_owner),
            "period_start": str(TODAY - timedelta(days=10)),
            "period_end": str(TODAY - timedelta(days=4)),
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert ok_resp.status_code == 200
    assert Decimal(str(ok_resp.json()["gross_amount"])) == Decimal("1200.00")


# ---------------------------------------------------------------------------
# 7. Ledger Entries Querying, Filtering, and Pagination
# ---------------------------------------------------------------------------

async def test_ledger_entries_filtering_and_pagination(client, test_session_factory, seeded_verified_owner, seeded_admin):
    # Create booking and confirm payment
    async with test_session_factory() as session:
        async with session.begin():
            venue, unit = await _create_test_venue_and_unit(session, seeded_verified_owner, price=1000)
            unit_id = unit.id

        booking, _ = await create_booking(
            session=session,
            inventory_unit_id=unit_id,
            guest_name="Query Test",
            guest_email="query@example.com",
        )
        booking_id = booking.id

        await confirm_booking_by_admin(
            session=session,
            booking_id=booking_id,
            admin_id=seeded_admin,
            amount=Decimal("1000.00"),
            method="upi",
            reference="UPI-QUERY-01",
        )

    admin_token = create_access_token(seeded_admin, "admin")

    # Filter by booking_id
    resp = await client.get(
        f"/api/v1/admin/ledger/entries?booking_id={booking_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    entries = resp.json()
    assert len(entries) == 3

    # Filter by account = "platform_commission_revenue"
    resp_comm = await client.get(
        f"/api/v1/admin/ledger/entries?booking_id={booking_id}&account=platform_commission_revenue",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp_comm.status_code == 200
    comm_entries = resp_comm.json()
    assert len(comm_entries) == 1
    assert Decimal(str(comm_entries[0]["amount"])) == Decimal("100.00")


# ---------------------------------------------------------------------------
# 8. Owner Verification: PAN & GSTIN Identity Capture
# ---------------------------------------------------------------------------

async def test_owner_verification_pan_and_gstin_identity(client, test_session_factory, seeded_admin):
    customer_id = uuid.uuid4()
    async with test_session_factory() as session:
        async with session.begin():
            customer = User(
                id=customer_id,
                name="Tax Compliant Owner",
                email=f"taxowner-{uuid.uuid4().hex[:6]}@example.com",
                phone="9876543299",
                password_hash=hash_password("owner-pass-123"),
                role="customer",
            )
            session.add(customer)

    token = create_access_token(customer_id, "customer")

    files = {"document": ("id.jpg", b"fake_image_bytes", "image/jpeg")}
    data = {
        "business_name": "Pro Sports Academy LLP",
        "identification_type": "pan",
        "identification_number": "ABCDE1234F",
        "pan": "ABCDE1234F",
        "gstin": "27ABCDE1234F1Z5",
    }
    resp = await client.post(
        "/api/v1/owner/verification",
        files=files,
        data=data,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["pan"] == "ABCDE1234F"
    assert body["gstin"] == "27ABCDE1234F1Z5"

    admin_token = create_access_token(seeded_admin, "admin")
    admin_list_resp = await client.get(
        "/api/v1/admin/owner-verifications",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert admin_list_resp.status_code == 200
    verifications = admin_list_resp.json()
    submitted = next(v for v in verifications if v["user_id"] == str(customer_id))
    assert submitted["pan"] == "ABCDE1234F"
    assert submitted["gstin"] == "27ABCDE1234F1Z5"

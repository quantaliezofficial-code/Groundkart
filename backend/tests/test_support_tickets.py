"""
Tests for support tickets — covers permissions, lifecycle transitions,
booking linkage (disputes), notifications, and audit trail.

Follows the same patterns as tests/test_admin_oversight.py: dependency
override for get_db, real database, full HTTP roundtrips through ASGI
transport.
"""
import uuid
from datetime import date, time
from decimal import Decimal

import httpx
import pytest
from sqlalchemy import select

from app.db import get_db, get_idem_db
from app.main import app
from app.models.core import (
    AuditLog,
    Booking,
    InventoryUnit,
    Notification,
    SupportTicket,
    User,
    Venue,
)
from app.modules.auth.security import create_access_token, hash_password


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _auth_headers(user_id: uuid.UUID, role: str) -> dict:
    token = create_access_token(user_id, role)
    return {"Authorization": f"Bearer {token}"}


import pytest_asyncio


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def client(test_session_factory):
    """Override get_db so the FastAPI app uses the test session factory
    (same pattern as test_admin_oversight.py)."""
    async def _override_get_db():
        async with test_session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_idem_db] = _override_get_db

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest_asyncio.fixture(scope="function")
async def seeded_ticket_scenario(test_session_factory, clean_tables):
    """Creates: admin, owner, customer, other_customer, venue, booking —
    the minimum needed for testing ticket/dispute flows."""
    async with test_session_factory() as session:
        async with session.begin():
            admin = User(
                name="Admin",
                email=f"admin-{uuid.uuid4().hex[:8]}@example.com",
                phone=f"100{uuid.uuid4().hex[:7]}",
                password_hash=hash_password("admin-pass"),
                role="admin",
            )
            session.add(admin)

            owner = User(
                name="Owner",
                email=f"owner-{uuid.uuid4().hex[:8]}@example.com",
                phone=f"200{uuid.uuid4().hex[:7]}",
                password_hash=hash_password("owner-pass"),
                role="owner",
                is_verified=True,
            )
            session.add(owner)

            customer = User(
                name="Customer",
                email=f"cust-{uuid.uuid4().hex[:8]}@example.com",
                phone=f"300{uuid.uuid4().hex[:7]}",
                password_hash=hash_password("cust-pass"),
                role="customer",
            )
            session.add(customer)

            other_customer = User(
                name="Other Customer",
                email=f"other-{uuid.uuid4().hex[:8]}@example.com",
                phone=f"400{uuid.uuid4().hex[:7]}",
                password_hash=hash_password("other-pass"),
                role="customer",
            )
            session.add(other_customer)

            await session.flush()

            venue = Venue(
                owner_id=owner.id,
                name="Test Venue",
                slug=f"test-venue-{uuid.uuid4().hex[:8]}",
                category="sports",
                address="123 Test Road",
                city="TestCity",
                unit_type="hour",
                base_price=Decimal("1000.00"),
                status="active",
            )
            session.add(venue)
            await session.flush()

            unit = InventoryUnit(
                venue_id=venue.id,
                date=date(2027, 12, 25),
                start_time=time(10, 0),
                end_time=time(11, 0),
                price=Decimal("1000.00"),
                status="booked",
            )
            session.add(unit)
            await session.flush()

            booking = Booking(
                customer_id=customer.id,
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

    return {
        "admin_id": admin.id,
        "owner_id": owner.id,
        "customer_id": customer.id,
        "other_customer_id": other_customer.id,
        "venue_id": venue.id,
        "booking_id": booking.id,
    }


# ═══════════════════════════════════════════════════════════════════════════
# 1. PERMISSIONS & VISIBILITY
# ═══════════════════════════════════════════════════════════════════════════

class TestPermissions:

    async def test_unauthenticated_cannot_create_ticket(self, client):
        resp = await client.post(
            "/api/v1/support/tickets",
            json={"subject": "Help", "description": "I need help"},
        )
        assert resp.status_code == 401

    async def test_unauthenticated_cannot_list_tickets(self, client):
        resp = await client.get("/api/v1/support/tickets")
        assert resp.status_code == 401

    async def test_customer_sees_only_own_tickets(
        self, client, seeded_ticket_scenario,
    ):
        s = seeded_ticket_scenario
        cust_headers = _auth_headers(s["customer_id"], "customer")
        other_headers = _auth_headers(s["other_customer_id"], "customer")

        # Customer creates a ticket
        resp = await client.post(
            "/api/v1/support/tickets",
            json={"subject": "My Issue", "description": "Something broke"},
            headers=cust_headers,
        )
        assert resp.status_code == 201
        ticket_id = resp.json()["id"]

        # Customer sees their own ticket
        resp = await client.get("/api/v1/support/tickets", headers=cust_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 1
        assert resp.json()[0]["id"] == ticket_id

        # Other customer sees nothing
        resp = await client.get("/api/v1/support/tickets", headers=other_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 0

    async def test_other_customer_cannot_view_ticket_detail(
        self, client, seeded_ticket_scenario,
    ):
        s = seeded_ticket_scenario
        cust_headers = _auth_headers(s["customer_id"], "customer")
        other_headers = _auth_headers(s["other_customer_id"], "customer")

        resp = await client.post(
            "/api/v1/support/tickets",
            json={"subject": "Private Issue", "description": "Secret"},
            headers=cust_headers,
        )
        ticket_id = resp.json()["id"]

        # Other customer gets 404 (not 403, to avoid leaking existence)
        resp = await client.get(
            f"/api/v1/support/tickets/{ticket_id}", headers=other_headers,
        )
        assert resp.status_code == 404

    async def test_owner_sees_venue_tickets(
        self, client, seeded_ticket_scenario,
    ):
        s = seeded_ticket_scenario
        cust_headers = _auth_headers(s["customer_id"], "customer")
        owner_headers = _auth_headers(s["owner_id"], "owner")

        # Customer creates ticket linked to venue
        resp = await client.post(
            "/api/v1/support/tickets",
            json={
                "subject": "Venue Issue",
                "description": "Problem at venue",
                "category": "venue_issue",
                "venue_id": str(s["venue_id"]),
            },
            headers=cust_headers,
        )
        assert resp.status_code == 201

        # Owner sees it (owner endpoint returns venue-scoped tickets)
        resp = await client.get("/api/v1/support/tickets", headers=owner_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 1
        assert resp.json()[0]["subject"] == "Venue Issue"

    async def test_customer_cannot_use_admin_endpoints(
        self, client, seeded_ticket_scenario,
    ):
        s = seeded_ticket_scenario
        cust_headers = _auth_headers(s["customer_id"], "customer")

        resp = await client.get(
            "/api/v1/admin/support/tickets", headers=cust_headers,
        )
        assert resp.status_code == 403

    async def test_admin_sees_all_tickets(
        self, client, seeded_ticket_scenario,
    ):
        s = seeded_ticket_scenario
        cust_headers = _auth_headers(s["customer_id"], "customer")
        admin_headers = _auth_headers(s["admin_id"], "admin")

        # Customer creates a ticket
        await client.post(
            "/api/v1/support/tickets",
            json={"subject": "Ticket A", "description": "Content"},
            headers=cust_headers,
        )

        # Admin sees it via admin endpoint
        resp = await client.get(
            "/api/v1/admin/support/tickets", headers=admin_headers,
        )
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    async def test_internal_comments_hidden_from_customer(
        self, client, seeded_ticket_scenario,
    ):
        s = seeded_ticket_scenario
        cust_headers = _auth_headers(s["customer_id"], "customer")
        admin_headers = _auth_headers(s["admin_id"], "admin")

        # Create ticket
        resp = await client.post(
            "/api/v1/support/tickets",
            json={"subject": "Test", "description": "Internal note test"},
            headers=cust_headers,
        )
        ticket_id = resp.json()["id"]

        # Admin adds internal note
        resp = await client.post(
            f"/api/v1/support/tickets/{ticket_id}/comments",
            json={"comment": "Internal admin note", "internal": True},
            headers=admin_headers,
        )
        assert resp.status_code == 201
        assert resp.json()["internal"] is True

        # Admin adds public comment
        resp = await client.post(
            f"/api/v1/support/tickets/{ticket_id}/comments",
            json={"comment": "Public reply"},
            headers=admin_headers,
        )
        assert resp.status_code == 201

        # Customer sees ticket detail — should NOT see internal note
        resp = await client.get(
            f"/api/v1/support/tickets/{ticket_id}", headers=cust_headers,
        )
        assert resp.status_code == 200
        events = resp.json()["events"]
        for e in events:
            assert e["internal"] is False, "Internal event leaked to customer"

        # Admin sees all events including internal
        resp = await client.get(
            f"/api/v1/support/tickets/{ticket_id}", headers=admin_headers,
        )
        events = resp.json()["events"]
        internal_events = [e for e in events if e["internal"] is True]
        assert len(internal_events) >= 1

    async def test_customer_cannot_post_internal_notes(
        self, client, seeded_ticket_scenario,
    ):
        s = seeded_ticket_scenario
        cust_headers = _auth_headers(s["customer_id"], "customer")

        resp = await client.post(
            "/api/v1/support/tickets",
            json={"subject": "Test", "description": "Content"},
            headers=cust_headers,
        )
        ticket_id = resp.json()["id"]

        resp = await client.post(
            f"/api/v1/support/tickets/{ticket_id}/comments",
            json={"comment": "Trying internal", "internal": True},
            headers=cust_headers,
        )
        assert resp.status_code == 403


# ═══════════════════════════════════════════════════════════════════════════
# 2. LIFECYCLE TRANSITIONS
# ═══════════════════════════════════════════════════════════════════════════

class TestLifecycle:

    async def test_valid_transitions(
        self, client, seeded_ticket_scenario,
    ):
        s = seeded_ticket_scenario
        cust_headers = _auth_headers(s["customer_id"], "customer")
        admin_headers = _auth_headers(s["admin_id"], "admin")

        # Create ticket (status=open)
        resp = await client.post(
            "/api/v1/support/tickets",
            json={"subject": "Lifecycle Test", "description": "Testing"},
            headers=cust_headers,
        )
        assert resp.status_code == 201
        ticket_id = resp.json()["id"]
        assert resp.json()["status"] == "open"

        # open -> in_review
        resp = await client.patch(
            f"/api/v1/admin/support/tickets/{ticket_id}",
            json={"status": "in_review"},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "in_review"

        # in_review -> waiting_customer
        resp = await client.patch(
            f"/api/v1/admin/support/tickets/{ticket_id}",
            json={"status": "waiting_customer"},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "waiting_customer"

        # waiting_customer -> in_review
        resp = await client.patch(
            f"/api/v1/admin/support/tickets/{ticket_id}",
            json={"status": "in_review"},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "in_review"

        # in_review -> resolved
        resp = await client.patch(
            f"/api/v1/admin/support/tickets/{ticket_id}",
            json={"status": "resolved"},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "resolved"
        assert resp.json()["resolved_at"] is not None

        # resolved -> closed
        resp = await client.patch(
            f"/api/v1/admin/support/tickets/{ticket_id}",
            json={"status": "closed"},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "closed"
        assert resp.json()["closed_at"] is not None

    async def test_invalid_transition_returns_409(
        self, client, seeded_ticket_scenario,
    ):
        s = seeded_ticket_scenario
        cust_headers = _auth_headers(s["customer_id"], "customer")
        admin_headers = _auth_headers(s["admin_id"], "admin")

        resp = await client.post(
            "/api/v1/support/tickets",
            json={"subject": "Invalid", "description": "Testing"},
            headers=cust_headers,
        )
        ticket_id = resp.json()["id"]

        # open -> resolved (not allowed, must go through in_review first)
        resp = await client.patch(
            f"/api/v1/admin/support/tickets/{ticket_id}",
            json={"status": "resolved"},
            headers=admin_headers,
        )
        assert resp.status_code == 409

    async def test_closed_is_terminal(
        self, client, seeded_ticket_scenario,
    ):
        s = seeded_ticket_scenario
        cust_headers = _auth_headers(s["customer_id"], "customer")
        admin_headers = _auth_headers(s["admin_id"], "admin")

        resp = await client.post(
            "/api/v1/support/tickets",
            json={"subject": "Close Test", "description": "Testing"},
            headers=cust_headers,
        )
        ticket_id = resp.json()["id"]

        # Fast-close: open -> closed
        resp = await client.patch(
            f"/api/v1/admin/support/tickets/{ticket_id}",
            json={"status": "closed"},
            headers=admin_headers,
        )
        assert resp.status_code == 200

        # Cannot reopen
        resp = await client.patch(
            f"/api/v1/admin/support/tickets/{ticket_id}",
            json={"status": "open"},
            headers=admin_headers,
        )
        assert resp.status_code == 409

    async def test_status_changes_create_events(
        self, client, seeded_ticket_scenario,
    ):
        s = seeded_ticket_scenario
        cust_headers = _auth_headers(s["customer_id"], "customer")
        admin_headers = _auth_headers(s["admin_id"], "admin")

        resp = await client.post(
            "/api/v1/support/tickets",
            json={"subject": "Event Test", "description": "Testing"},
            headers=cust_headers,
        )
        ticket_id = resp.json()["id"]

        await client.patch(
            f"/api/v1/admin/support/tickets/{ticket_id}",
            json={"status": "in_review"},
            headers=admin_headers,
        )

        resp = await client.get(
            f"/api/v1/support/tickets/{ticket_id}", headers=admin_headers,
        )
        events = resp.json()["events"]
        status_events = [e for e in events if e["event_type"] == "status_changed"]
        assert len(status_events) >= 1
        assert status_events[-1]["old_status"] == "open"
        assert status_events[-1]["new_status"] == "in_review"


# ═══════════════════════════════════════════════════════════════════════════
# 3. BOOKING LINKAGE (DISPUTES)
# ═══════════════════════════════════════════════════════════════════════════

class TestDisputeBookingLinkage:

    async def test_dispute_without_booking_fails(
        self, client, seeded_ticket_scenario,
    ):
        s = seeded_ticket_scenario
        cust_headers = _auth_headers(s["customer_id"], "customer")

        resp = await client.post(
            "/api/v1/support/tickets",
            json={
                "subject": "Dispute",
                "description": "I want a refund",
                "category": "dispute",
            },
            headers=cust_headers,
        )
        assert resp.status_code == 400
        assert "booking_id" in resp.json()["detail"].lower()

    async def test_dispute_with_valid_booking_succeeds(
        self, client, seeded_ticket_scenario,
    ):
        s = seeded_ticket_scenario
        cust_headers = _auth_headers(s["customer_id"], "customer")

        resp = await client.post(
            "/api/v1/support/tickets",
            json={
                "subject": "Dispute on my booking",
                "description": "The venue was not as described",
                "category": "dispute",
                "booking_id": str(s["booking_id"]),
            },
            headers=cust_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["category"] == "dispute"
        assert data["booking_id"] == str(s["booking_id"])
        # venue_id should be auto-inferred from booking
        assert data["venue_id"] == str(s["venue_id"])

    async def test_customer_cannot_dispute_others_booking(
        self, client, seeded_ticket_scenario,
    ):
        s = seeded_ticket_scenario
        other_headers = _auth_headers(s["other_customer_id"], "customer")

        resp = await client.post(
            "/api/v1/support/tickets",
            json={
                "subject": "Not my booking",
                "description": "Trying to dispute someone else's booking",
                "category": "dispute",
                "booking_id": str(s["booking_id"]),
            },
            headers=other_headers,
        )
        assert resp.status_code == 403

    async def test_dispute_resolution_does_not_modify_booking(
        self, client, seeded_ticket_scenario, test_session_factory,
    ):
        """Dispute resolution records outcomes in the ticket, NOT in the
        booking — the booking's status and payment fields must remain
        unchanged."""
        s = seeded_ticket_scenario
        cust_headers = _auth_headers(s["customer_id"], "customer")
        admin_headers = _auth_headers(s["admin_id"], "admin")

        # Create dispute
        resp = await client.post(
            "/api/v1/support/tickets",
            json={
                "subject": "Dispute",
                "description": "Issue with booking",
                "category": "dispute",
                "booking_id": str(s["booking_id"]),
            },
            headers=cust_headers,
        )
        ticket_id = resp.json()["id"]

        # Resolve it through the ticket lifecycle
        await client.patch(
            f"/api/v1/admin/support/tickets/{ticket_id}",
            json={"status": "in_review"},
            headers=admin_headers,
        )
        await client.patch(
            f"/api/v1/admin/support/tickets/{ticket_id}",
            json={"status": "resolved"},
            headers=admin_headers,
        )

        # Verify booking status is UNCHANGED
        async with test_session_factory() as session:
            result = await session.execute(
                select(Booking).where(Booking.id == s["booking_id"])
            )
            booking = result.scalar_one()
            assert booking.status == "confirmed", \
                f"Dispute resolution changed booking status to '{booking.status}'"

    async def test_owner_can_see_dispute_for_their_venue(
        self, client, seeded_ticket_scenario,
    ):
        s = seeded_ticket_scenario
        cust_headers = _auth_headers(s["customer_id"], "customer")
        owner_headers = _auth_headers(s["owner_id"], "owner")

        # Customer creates dispute
        resp = await client.post(
            "/api/v1/support/tickets",
            json={
                "subject": "Venue dispute",
                "description": "Bad experience",
                "category": "dispute",
                "booking_id": str(s["booking_id"]),
            },
            headers=cust_headers,
        )
        assert resp.status_code == 201
        ticket_id = resp.json()["id"]

        # Owner sees it in their ticket list
        resp = await client.get("/api/v1/support/tickets", headers=owner_headers)
        assert resp.status_code == 200
        ticket_ids = [t["id"] for t in resp.json()]
        assert ticket_id in ticket_ids


# ═══════════════════════════════════════════════════════════════════════════
# 4. NOTIFICATIONS
# ═══════════════════════════════════════════════════════════════════════════

class TestNotifications:

    async def test_ticket_creation_notifies_admin(
        self, client, seeded_ticket_scenario, test_session_factory,
    ):
        s = seeded_ticket_scenario
        cust_headers = _auth_headers(s["customer_id"], "customer")

        await client.post(
            "/api/v1/support/tickets",
            json={"subject": "Notify Test", "description": "Content"},
            headers=cust_headers,
        )

        # Check admin has a notification
        async with test_session_factory() as session:
            result = await session.execute(
                select(Notification).where(
                    Notification.user_id == s["admin_id"],
                    Notification.type == "support_ticket.created",
                )
            )
            notifications = result.scalars().all()
            assert len(notifications) >= 1

    async def test_status_change_notifies_creator(
        self, client, seeded_ticket_scenario, test_session_factory,
    ):
        s = seeded_ticket_scenario
        cust_headers = _auth_headers(s["customer_id"], "customer")
        admin_headers = _auth_headers(s["admin_id"], "admin")

        resp = await client.post(
            "/api/v1/support/tickets",
            json={"subject": "Status Notify", "description": "Content"},
            headers=cust_headers,
        )
        ticket_id = resp.json()["id"]

        await client.patch(
            f"/api/v1/admin/support/tickets/{ticket_id}",
            json={"status": "in_review"},
            headers=admin_headers,
        )

        async with test_session_factory() as session:
            result = await session.execute(
                select(Notification).where(
                    Notification.user_id == s["customer_id"],
                    Notification.type == "support_ticket.status_changed",
                )
            )
            notifications = result.scalars().all()
            assert len(notifications) >= 1


# ═══════════════════════════════════════════════════════════════════════════
# 5. AUDIT TRAIL
# ═══════════════════════════════════════════════════════════════════════════

class TestAuditTrail:

    async def test_admin_actions_create_audit_logs(
        self, client, seeded_ticket_scenario, test_session_factory,
    ):
        s = seeded_ticket_scenario
        cust_headers = _auth_headers(s["customer_id"], "customer")
        admin_headers = _auth_headers(s["admin_id"], "admin")

        resp = await client.post(
            "/api/v1/support/tickets",
            json={"subject": "Audit Test", "description": "Content"},
            headers=cust_headers,
        )
        ticket_id = resp.json()["id"]

        # Admin updates ticket
        await client.patch(
            f"/api/v1/admin/support/tickets/{ticket_id}",
            json={"status": "in_review"},
            headers=admin_headers,
        )

        # Verify audit logs exist
        async with test_session_factory() as session:
            result = await session.execute(
                select(AuditLog).where(
                    AuditLog.entity_type == "support_ticket",
                    AuditLog.entity_id == uuid.UUID(ticket_id),
                )
            )
            logs = result.scalars().all()
            # At least 2: one for creation, one for update
            assert len(logs) >= 2

            actions = {log.action for log in logs}
            assert "support_ticket.created" in actions
            assert "support_ticket.updated" in actions

    async def test_audit_log_visible_in_admin_audit_endpoint(
        self, client, seeded_ticket_scenario,
    ):
        s = seeded_ticket_scenario
        cust_headers = _auth_headers(s["customer_id"], "customer")
        admin_headers = _auth_headers(s["admin_id"], "admin")

        resp = await client.post(
            "/api/v1/support/tickets",
            json={"subject": "Audit Visible", "description": "Content"},
            headers=cust_headers,
        )
        ticket_id = resp.json()["id"]

        # Check via admin audit-log endpoint
        resp = await client.get(
            "/api/v1/admin/audit-log",
            params={"entity_type": "support_ticket", "entity_id": ticket_id},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert len(resp.json()) >= 1


# ═══════════════════════════════════════════════════════════════════════════
# 6. GENERAL TICKET OPERATIONS
# ═══════════════════════════════════════════════════════════════════════════

class TestGeneralOperations:

    async def test_create_general_ticket_without_booking(
        self, client, seeded_ticket_scenario,
    ):
        s = seeded_ticket_scenario
        cust_headers = _auth_headers(s["customer_id"], "customer")

        resp = await client.post(
            "/api/v1/support/tickets",
            json={
                "subject": "General Help",
                "description": "I need assistance with my account",
                "category": "billing",
                "priority": "high",
            },
            headers=cust_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["subject"] == "General Help"
        assert data["category"] == "billing"
        assert data["priority"] == "high"
        assert data["status"] == "open"
        assert data["booking_id"] is None

    async def test_add_public_comment(
        self, client, seeded_ticket_scenario,
    ):
        s = seeded_ticket_scenario
        cust_headers = _auth_headers(s["customer_id"], "customer")

        resp = await client.post(
            "/api/v1/support/tickets",
            json={"subject": "Comment Test", "description": "Initial"},
            headers=cust_headers,
        )
        ticket_id = resp.json()["id"]

        resp = await client.post(
            f"/api/v1/support/tickets/{ticket_id}/comments",
            json={"comment": "Adding more info"},
            headers=cust_headers,
        )
        assert resp.status_code == 201
        assert resp.json()["comment"] == "Adding more info"
        assert resp.json()["internal"] is False

    async def test_admin_filter_by_status_and_category(
        self, client, seeded_ticket_scenario,
    ):
        s = seeded_ticket_scenario
        cust_headers = _auth_headers(s["customer_id"], "customer")
        admin_headers = _auth_headers(s["admin_id"], "admin")

        # Create tickets with different categories
        await client.post(
            "/api/v1/support/tickets",
            json={"subject": "A", "description": "Billing issue", "category": "billing"},
            headers=cust_headers,
        )
        await client.post(
            "/api/v1/support/tickets",
            json={"subject": "B", "description": "General", "category": "general"},
            headers=cust_headers,
        )

        # Filter by category
        resp = await client.get(
            "/api/v1/admin/support/tickets",
            params={"category": "billing"},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        for t in resp.json():
            assert t["category"] == "billing"

    async def test_admin_assign_ticket(
        self, client, seeded_ticket_scenario,
    ):
        s = seeded_ticket_scenario
        cust_headers = _auth_headers(s["customer_id"], "customer")
        admin_headers = _auth_headers(s["admin_id"], "admin")

        resp = await client.post(
            "/api/v1/support/tickets",
            json={"subject": "Assign Test", "description": "Content"},
            headers=cust_headers,
        )
        ticket_id = resp.json()["id"]

        resp = await client.patch(
            f"/api/v1/admin/support/tickets/{ticket_id}",
            json={"assignee_id": str(s["admin_id"])},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["assignee_id"] == str(s["admin_id"])

    async def test_admin_change_priority(
        self, client, seeded_ticket_scenario,
    ):
        s = seeded_ticket_scenario
        cust_headers = _auth_headers(s["customer_id"], "customer")
        admin_headers = _auth_headers(s["admin_id"], "admin")

        resp = await client.post(
            "/api/v1/support/tickets",
            json={"subject": "Priority Test", "description": "Low priority"},
            headers=cust_headers,
        )
        ticket_id = resp.json()["id"]

        resp = await client.patch(
            f"/api/v1/admin/support/tickets/{ticket_id}",
            json={"priority": "urgent"},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["priority"] == "urgent"

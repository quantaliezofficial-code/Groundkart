"""
Comprehensive tests for Help Center & Know More ticket integration (Phase H1).
Covers:
- Category listing and article counts
- Article search (audience, category, query) and search query logging
- Article detail retrieval, section anchor parsing, and related article links
- Helpfulness feedback submission
- Know More ticket creation:
  - Server-side excerpt snapshot extraction from markdown
  - Article version tracking
  - Deduplication: appending comment when active ticket exists for section
  - Daily rate limit (5 tickets/day)
- Contact form submission for guests (GuestEnquiry) and signed-in users (SupportTicket)
"""
import uuid
from datetime import datetime, timezone

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import select

from app.db import get_db, get_idem_db
from app.main import app
from app.models.core import (
    GuestEnquiry,
    HelpArticle,
    HelpCategory,
    HelpFeedback,
    HelpSearchLog,
    SupportTicket,
    TicketEvent,
    User,
)
from app.modules.auth.security import create_access_token


def _auth_headers(user_id: uuid.UUID, role: str) -> dict:
    token = create_access_token(user_id, role)
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
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


@pytest_asyncio.fixture
async def customer_user(test_session_factory) -> User:
    async with test_session_factory() as session:
        async with session.begin():
            user = User(
                name="Aarav Patel",
                email="aarav@example.com",
                phone="9876543210",
                password_hash="mock-hash",
                role="customer",
            )
            session.add(user)
            await session.flush()
            return user


@pytest_asyncio.fixture
async def admin_user(test_session_factory) -> User:
    async with test_session_factory() as session:
        async with session.begin():
            user = User(
                name="Admin Super",
                email="admin@groundkart.com",
                phone="9999999999",
                password_hash="mock-hash",
                role="admin",
            )
            session.add(user)
            await session.flush()
            return user


@pytest_asyncio.fixture
async def sample_category(test_session_factory) -> HelpCategory:
    async with test_session_factory() as session:
        async with session.begin():
            category = HelpCategory(
                slug="booking-guide",
                name="Booking a Venue",
                icon="calendar",
                audience="customer",
                sort_order=1,
            )
            session.add(category)
            await session.flush()
            return category


@pytest_asyncio.fixture
async def sample_article(test_session_factory, sample_category) -> HelpArticle:
    body = (
        "# Booking in 5 Easy Steps\n\n"
        "Here is the complete guide to booking your favorite venue on GroundKart.\n\n"
        "## Step 1: Find a Venue\n\n"
        "Search by location, sport, or date. Filter turf amenities to find the right pitch.\n\n"
        "## Step 2: Choose Slot and Purpose\n\n"
        "Select an available hourly slot or full-day block, and specify the event purpose.\n\n"
        "## Step 3: Set Prices and Payment\n\n"
        "Review the calculated pricing, including any security deposit or peak-hour adjustments, then pay.\n"
    )
    async with test_session_factory() as session:
        async with session.begin():
            article = HelpArticle(
                slug="booking-in-5-steps",
                title="Booking in 5 Steps",
                summary="A simple step-by-step walk-through of the booking process.",
                body_markdown=body,
                audience="customer",
                category_id=sample_category.id,
                language="en",
                status="published",
                version=1,
                sort_order=1,
            )
            session.add(article)
            await session.flush()
            return article


# ─────────────────────────────────────────────────────────────────────────────
# 1. Categories & Article Counts
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_help_categories_listing_with_counts(client, sample_category, sample_article, test_session_factory):
    # Add a draft article to ensure it is not counted in public stats
    async with test_session_factory() as session:
        async with session.begin():
            draft = HelpArticle(
                slug="draft-article",
                title="Draft Booking Tip",
                summary="Hidden tip",
                body_markdown="Draft content",
                audience="customer",
                category_id=sample_category.id,
                language="en",
                status="draft",
            )
            session.add(draft)

    res = await client.get("/api/v1/help/categories?lang=en")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 1
    cat = next((c for c in data if c["slug"] == sample_category.slug), None)
    assert cat is not None
    assert cat["name"] == "Booking a Venue"
    assert cat["article_count"] == 1  # only published article is counted


# ─────────────────────────────────────────────────────────────────────────────
# 2. Articles Search & Navigation
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_help_articles_search_and_log(client, sample_article, test_session_factory):
    # Search for "Prices"
    res = await client.get("/api/v1/help/articles?q=Prices")
    assert res.status_code == 200
    articles = res.json()
    assert len(articles) == 1
    assert articles[0]["slug"] == sample_article.slug

    # Verify search query was logged in help_search_log
    async with test_session_factory() as session:
        log_res = await session.execute(select(HelpSearchLog).where(HelpSearchLog.query == "Prices"))
        log_entry = log_res.scalars().first()
        assert log_entry is not None
        assert log_entry.result_count == 1


@pytest.mark.asyncio
async def test_help_article_detail_and_sections(client, sample_article):
    res = await client.get(f"/api/v1/help/articles/{sample_article.slug}")
    assert res.status_code == 200
    data = res.json()
    assert data["title"] == "Booking in 5 Steps"
    assert len(data["sections"]) == 3

    # Check generated section anchor slugs
    s1 = data["sections"][0]
    assert s1["title"] == "Step 1: Find a Venue"
    assert s1["anchor"] == "step-1-find-a-venue"

    s3 = data["sections"][2]
    assert s3["title"] == "Step 3: Set Prices and Payment"
    assert s3["anchor"] == "step-3-set-prices-and-payment"


@pytest.mark.asyncio
async def test_help_article_not_found(client):
    res = await client.get("/api/v1/help/articles/non-existent-article")
    assert res.status_code == 404


# ─────────────────────────────────────────────────────────────────────────────
# 3. Helpfulness Feedback
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_submit_help_feedback(client, sample_article, customer_user, test_session_factory):
    # Submit feedback with section and authentication
    res = await client.post(
        f"/api/v1/help/articles/{sample_article.id}/feedback",
        headers=_auth_headers(customer_user.id, "customer"),
        json={"helpful": True, "section": "step-2-choose-slot-and-purpose"},
    )
    assert res.status_code == 200
    assert res.json()["success"] is True

    async with test_session_factory() as session:
        fb_res = await session.execute(
            select(HelpFeedback).where(HelpFeedback.article_id == sample_article.id)
        )
        fb = fb_res.scalars().first()
        assert fb is not None
        assert fb.helpful is True
        assert fb.section == "step-2-choose-slot-and-purpose"
        assert fb.user_id == customer_user.id


# ─────────────────────────────────────────────────────────────────────────────
# 4. Know More Tickets: Snapshot, Deduplication & Rate Limiting
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_know_more_ticket_server_snapshot(client, sample_article, customer_user, test_session_factory):
    """Verifies that the server populates the tamper-proof excerpt from the stored article markdown."""
    res = await client.post(
        "/api/v1/support/tickets",
        headers=_auth_headers(customer_user.id, "customer"),
        json={
            "subject": "Help Request",
            "description": "I do not understand how pricing rules are applied here.",
            "category": "help_request",
            "help_article_id": str(sample_article.id),
            "help_section": "Step 3: Set Prices and Payment",
            "reason_code": "unclear_step",
        },
    )
    assert res.status_code == 201
    ticket = res.json()
    assert ticket["category"] == "help_request"
    assert ticket["help_article_id"] == str(sample_article.id)
    assert ticket["help_section"] == "Step 3: Set Prices and Payment"
    assert "Review the calculated pricing" in ticket["help_excerpt"]
    assert ticket["help_article_version"] == 1
    assert "Help request: Booking in 5 Steps, Step 3: Set Prices and Payment" in ticket["subject"]


@pytest.mark.asyncio
async def test_know_more_ticket_deduplication(client, sample_article, customer_user, test_session_factory):
    """When a ticket is already open for the same article & section, appending a second request adds a comment."""
    # First request
    res1 = await client.post(
        "/api/v1/support/tickets",
        headers=_auth_headers(customer_user.id, "customer"),
        json={
            "subject": "Help Request",
            "description": "First question about step 1",
            "category": "help_request",
            "help_article_id": str(sample_article.id),
            "help_section": "Step 1: Find a Venue",
        },
    )
    assert res1.status_code == 201
    ticket_id_1 = res1.json()["id"]

    # Second request on the SAME section
    res2 = await client.post(
        "/api/v1/support/tickets",
        headers=_auth_headers(customer_user.id, "customer"),
        json={
            "subject": "Help Request",
            "description": "Follow-up question on step 1",
            "category": "help_request",
            "help_article_id": str(sample_article.id),
            "help_section": "Step 1: Find a Venue",
        },
    )
    # Deduplication returns the existing ticket
    assert res2.status_code == 201
    ticket_id_2 = res2.json()["id"]
    assert ticket_id_1 == ticket_id_2

    # Verify a comment event was appended
    async with test_session_factory() as session:
        t_res = await session.execute(
            select(SupportTicket).where(SupportTicket.id == uuid.UUID(ticket_id_1))
        )
        ticket = t_res.scalar_one()
        events_res = await session.execute(
            select(TicketEvent).where(TicketEvent.ticket_id == ticket.id).order_by(TicketEvent.created_at)
        )
        events = list(events_res.scalars().all())
        assert len(events) == 2
        assert events[0].event_type == "created"
        assert events[1].event_type == "comment"
        assert "Follow-up question on step 1" in events[1].comment


@pytest.mark.asyncio
async def test_know_more_ticket_rate_limit(client, test_session_factory, customer_user):
    """Enforces 5 help tickets per day limit."""
    # Create 5 distinct articles to avoid deduplication
    article_ids = []
    async with test_session_factory() as session:
        async with session.begin():
            for i in range(6):
                art = HelpArticle(
                    slug=f"article-limit-{i}",
                    title=f"Article {i}",
                    summary="Summary",
                    body_markdown=f"Content {i}",
                    status="published",
                )
                session.add(art)
                await session.flush()
                article_ids.append(art.id)

    # First 5 tickets should succeed
    for i in range(5):
        res = await client.post(
            "/api/v1/support/tickets",
            headers=_auth_headers(customer_user.id, "customer"),
            json={
                "subject": f"Question {i}",
                "description": f"Details {i}",
                "category": "help_request",
                "help_article_id": str(article_ids[i]),
            },
        )
        assert res.status_code == 201

    # 6th ticket must be blocked with 429
    res6 = await client.post(
        "/api/v1/support/tickets",
        headers=_auth_headers(customer_user.id, "customer"),
        json={
            "subject": "Question 6",
            "description": "Details 6",
            "category": "help_request",
            "help_article_id": str(article_ids[5]),
        },
    )
    assert res6.status_code == 429
    assert "Daily help request limit reached" in res6.json()["detail"]


# ─────────────────────────────────────────────────────────────────────────────
# 5. Contact Form Submissions
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_contact_form_guest_submission(client, test_session_factory):
    res = await client.post(
        "/api/v1/contact",
        json={
            "name": "Guest Visitor",
            "email": "visitor@example.com",
            "phone": "9811122233",
            "subject": "Partnership inquiry",
            "message": "I would like to list our tennis academy venues on GroundKart.",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["enquiry_id"] is not None

    async with test_session_factory() as session:
        enq_res = await session.execute(
            select(GuestEnquiry).where(GuestEnquiry.email == "visitor@example.com")
        )
        enquiry = enq_res.scalar_one_or_none()
        assert enquiry is not None
        assert enquiry.name == "Guest Visitor"
        assert enquiry.status == "new"


@pytest.mark.asyncio
async def test_contact_form_authenticated_submission(client, customer_user, test_session_factory):
    res = await client.post(
        "/api/v1/contact",
        headers=_auth_headers(customer_user.id, "customer"),
        json={
            "name": "Aarav Patel",
            "email": "aarav@example.com",
            "subject": "Booking invoice question",
            "message": "Can I get a GST invoice for my past corporate tournament booking?",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["ticket_id"] is not None

    async with test_session_factory() as session:
        t_res = await session.execute(
            select(SupportTicket).where(SupportTicket.id == uuid.UUID(data["ticket_id"]))
        )
        ticket = t_res.scalar_one_or_none()
        assert ticket is not None
        assert ticket.creator_id == customer_user.id
        assert ticket.category == "general"
        assert ticket.subject == "Booking invoice question"

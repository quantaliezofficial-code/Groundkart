import os
import uuid
from datetime import date, time

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

# Always the test database — never the dev one. Set before importing
# anything that reads app.config.settings at import time.
os.environ["DATABASE_URL"] = "postgresql+asyncpg://groundbooking:devpassword@localhost:5432/groundbooking_test"

from app.models.core import InventoryUnit, User, Venue  # noqa: E402
from app.modules.auth.security import hash_password  # noqa: E402

TEST_DATABASE_URL = os.environ["DATABASE_URL"]


@pytest_asyncio.fixture
async def test_engine():
    engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def test_session_factory(test_engine, clean_tables):
    return async_sessionmaker(test_engine, expire_on_commit=False)


@pytest_asyncio.fixture(autouse=True)
async def clean_tables(test_engine):
    """Every test starts from an empty, known state. Runs before AND after
    so a previous failed run can't leave stale rows behind either.

    payouts and login_rate_limits added this slice — both were missing
    (payouts genuinely a gap from when that table was first added; it
    didn't surface as a test failure because every payout test so far
    creates its own fresh, randomly-generated owner_id, but leftover rows
    would have accumulated silently across a long test session)."""
    async def _truncate():
        async with test_engine.begin() as conn:
            await conn.execute(
                text(
                    "TRUNCATE ticket_events, support_tickets, "
                    "blocks, venue_media, venue_amenities, amenities, audit_logs, "
                    "owner_verifications, refresh_tokens, login_rate_limits, payments, "
                    "payouts, bookings, booking_events, notifications, reviews, "
                    "inventory_units, categories, venue_types, use_cases, venue_use_cases, venues, users, idempotency_keys, outbox_events, jobs, pricing_rules CASCADE"
                )
            )

    await _truncate()
    yield
    await _truncate()


@pytest_asyncio.fixture
async def seeded_unit(test_session_factory) -> uuid.UUID:
    """One owner, one active venue, one available hourly inventory_unit —
    the minimum needed for create_booking() to do anything. Returns the
    inventory_unit_id; the concurrency test fires every concurrent request
    at exactly this one row."""
    async with test_session_factory() as session:
        async with session.begin():
            owner = User(
                name="Mr. Sharma",
                email="sharma@example.com",
                phone=f"123{uuid.uuid4().hex[:7]}",
                password_hash="not-a-real-hash",
                role="owner",
            )
            session.add(owner)
            await session.flush()

            venue = Venue(
                owner_id=owner.id,
                name="The Grand Turf Arena",
                slug=f"grand-turf-arena-{uuid.uuid4().hex[:8]}",
                category="sports",
                address="123 Stadium Road",
                city="Lucknow",
                unit_type="hour",
                base_price=2000,
                status="active",
            )
            session.add(venue)
            await session.flush()

            unit = InventoryUnit(
                venue_id=venue.id,
                date=date(2027, 8, 15),
                start_time=time(20, 0),
                end_time=time(21, 0),
                price=2000,
                status="available",
            )
            session.add(unit)
            await session.flush()
            unit_id = unit.id

    return unit_id


OWNER_PLAIN_PASSWORD = "correct-horse-battery-staple"


@pytest_asyncio.fixture
async def seeded_owner_with_unit(test_session_factory):
    """Like seeded_unit, but also returns the owner's id/email (and a known
    plaintext password, OWNER_PLAIN_PASSWORD) — needed for auth tests that
    actually log in as the venue's real owner. Returns
    (owner_id, owner_email, unit_id)."""
    owner_email = f"sharma-{uuid.uuid4().hex[:8]}@example.com"
    async with test_session_factory() as session:
        async with session.begin():
            owner = User(
                name="Mr. Sharma",
                email=owner_email,
                phone=f"123{uuid.uuid4().hex[:7]}",
                password_hash=hash_password(OWNER_PLAIN_PASSWORD),
                role="owner",
            )
            session.add(owner)
            await session.flush()

            venue = Venue(
                owner_id=owner.id,
                name="The Grand Turf Arena",
                slug=f"grand-turf-arena-{uuid.uuid4().hex[:8]}",
                category="sports",
                address="123 Stadium Road",
                city="Lucknow",
                unit_type="hour",
                base_price=2000,
                status="active",
            )
            session.add(venue)
            await session.flush()

            unit = InventoryUnit(
                venue_id=venue.id,
                date=date(2027, 8, 15),
                start_time=time(20, 0),
                end_time=time(21, 0),
                price=2000,
                status="available",
            )
            session.add(unit)
            await session.flush()
            owner_id, unit_id = owner.id, unit.id

    return owner_id, owner_email, unit_id


@pytest_asyncio.fixture
async def seeded_customer(test_session_factory) -> uuid.UUID:
    """A plain customer account, the starting point for the owner-
    onboarding flow — nobody starts as an owner; everyone applies as a
    customer first. Returns the user_id."""
    async with test_session_factory() as session:
        async with session.begin():
            user = User(
                name="Priya Sharma",
                email=f"priya-{uuid.uuid4().hex[:8]}@example.com",
                phone=f"123{uuid.uuid4().hex[:7]}",
                password_hash=hash_password("a-decent-password"),
                role="customer",
            )
            session.add(user)
            await session.flush()
            user_id = user.id
    return user_id


@pytest_asyncio.fixture
async def seeded_admin(test_session_factory) -> uuid.UUID:
    """Admins aren't self-service signups anywhere in this codebase —
    seeded directly, same as a real deployment would seed the first admin
    via a one-off script or direct DB insert, never an open endpoint."""
    async with test_session_factory() as session:
        async with session.begin():
            admin = User(
                name="Platform Admin",
                email=f"admin-{uuid.uuid4().hex[:8]}@example.com",
                phone=f"123{uuid.uuid4().hex[:7]}",
                password_hash=hash_password("not-used-in-tests"),
                role="admin",
            )
            session.add(admin)
            await session.flush()
            admin_id = admin.id
    return admin_id


@pytest_asyncio.fixture
async def seeded_verified_owner(test_session_factory) -> uuid.UUID:
    """A verified owner with NO venue yet — for catalog tests that exercise
    venue creation itself, as opposed to seeded_owner_with_unit, which
    already has a venue+unit pre-built for booking-engine tests that don't
    care about catalog creation."""
    async with test_session_factory() as session:
        async with session.begin():
            owner = User(
                name="Mr. Verma",
                email=f"verma-{uuid.uuid4().hex[:8]}@example.com",
                phone=f"123{uuid.uuid4().hex[:7]}",
                password_hash=hash_password("a-decent-password"),
                role="owner",
                is_verified=True,
            )
            session.add(owner)
            await session.flush()
            owner_id = owner.id
    return owner_id

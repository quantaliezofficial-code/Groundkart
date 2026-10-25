import uuid
import httpx
import pytest
from sqlalchemy import select, text
from fastapi import HTTPException

from app.db import get_db, get_idem_db
from app.main import app
from app.modules.auth.security import create_access_token
from app.modules.auth import service as auth_service


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


async def test_check_rate_limit_enforces_threshold_and_retry_after(test_session_factory):
    key = f"test:timeout:{uuid.uuid4().hex}"
    async with test_session_factory() as session:
        # 3 attempts allowed in 30 seconds
        for _ in range(3):
            await auth_service.check_rate_limit(session, key, max_attempts=3, window_seconds=30)

        # 4th attempt must raise 429 with Retry-After header
        with pytest.raises(HTTPException) as exc_info:
            await auth_service.check_rate_limit(session, key, max_attempts=3, window_seconds=30)

        exc = exc_info.value
        assert exc.status_code == 429
        assert "Retry-After" in exc.headers
        retry_after = int(exc.headers["Retry-After"])
        assert 1 <= retry_after <= 30
        assert f"try again in {retry_after} seconds" in exc.detail
        assert exc.headers.get("code") == "rate_limited"


async def test_rate_limit_key_normalization(test_session_factory):
    """Whitespace and uppercase variations should share the same rate-limit bucket."""
    uid = uuid.uuid4().hex[:8]
    async with test_session_factory() as session:
        await auth_service.check_rate_limit(session, f"ratelimit:login:  User_{uid}@Example.COM  ", max_attempts=2, window_seconds=60)
        await auth_service.check_rate_limit(session, f"ratelimit:login:user_{uid}@example.com", max_attempts=2, window_seconds=60)

        # 3rd attempt with another variation must be rejected
        with pytest.raises(HTTPException) as exc_info:
            await auth_service.check_rate_limit(session, f"ratelimit:login:USER_{uid}@EXAMPLE.COM", max_attempts=2, window_seconds=60)
        assert exc_info.value.status_code == 429


async def test_cleanup_expired_rate_limits(test_session_factory):
    """Old counters are pruned while active counters are retained."""
    async with test_session_factory() as session:
        # Insert an expired row
        expired_key = f"expired:{uuid.uuid4().hex}"
        active_key = f"active:{uuid.uuid4().hex}"

        async with session.begin():
            await session.execute(
                text(
                    """
                    INSERT INTO login_rate_limits (key, window_start, attempt_count)
                    VALUES (:expired_key, now() - interval '2 hours', 5),
                           (:active_key, now(), 1)
                    """
                ),
                {"expired_key": expired_key, "active_key": active_key},
            )

        deleted = await auth_service.cleanup_expired_rate_limits(session, older_than_seconds=3600)
        assert deleted >= 1

        # Verify active_key is still present
        res = await session.execute(
            text("SELECT key FROM login_rate_limits WHERE key = :key"),
            {"key": active_key},
        )
        assert res.scalar_one_or_none() == active_key

        # Verify expired_key is gone
        res_exp = await session.execute(
            text("SELECT key FROM login_rate_limits WHERE key = :key"),
            {"key": expired_key},
        )
        assert res_exp.scalar_one_or_none() is None


async def test_reset_password_endpoint_rate_limited(client):
    """POST /auth/reset-password has IP rate limiting with 429 response."""
    statuses = []
    headers = {"X-Forwarded-For": f"198.51.100.{uuid.uuid4().int % 250}"}
    for _ in range(12):
        resp = await client.post(
            "/api/v1/auth/reset-password",
            json={"token": "invalid-token", "new_password": "new-secure-password"},
            headers=headers,
        )
        statuses.append(resp.status_code)

    assert 429 in statuses
    assert statuses[0] == 400 or statuses[0] == 422 or statuses[0] == 401 or statuses[0] == 404
    # Check that 429 response has Retry-After
    last_resp = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": "invalid-token", "new_password": "new-secure-password"},
        headers=headers,
    )
    assert last_resp.status_code == 429
    assert "Retry-After" in last_resp.headers


async def test_support_ticket_creation_rate_limited(client, seeded_customer):
    """POST /api/v1/support/tickets returns 429 and Retry-After after limit is hit."""
    token = create_access_token(seeded_customer, "customer")
    auth_headers = {
        "Authorization": f"Bearer {token}",
        "X-Forwarded-For": f"203.0.113.{uuid.uuid4().int % 250}",
    }

    statuses = []
    for i in range(12):
        resp = await client.post(
            "/api/v1/support/tickets",
            json={"subject": f"Inquiry {i}", "description": "Need assistance with booking", "category": "general"},
            headers=auth_headers,
        )
        statuses.append(resp.status_code)

    assert 429 in statuses
    assert statuses[0] == 201

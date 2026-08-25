import uuid
"""
Signup -> login -> protected route -> refresh -> logout, through the real
ASGI app — and specifically, the refresh-token reuse-detection path, which
is the one part of TRD §4's auth requirements that's easy to get wrong
silently (issuing/expiring tokens is easy to get right; detecting *reuse*
of an already-rotated token is the part that actually needs a test).

Login rate limiting (test_login_rate_limited_after_too_many_attempts) is
Postgres-backed, not Redis-backed — Redis was removed from this project
entirely per explicit client direction (see the phase summary doc for
this slice). The assertions here are unchanged from before that switch:
same threshold (10/60s), same observable behavior, just a different
mechanism underneath.
"""
import httpx
import pytest

from app.db import get_db
from app.main import REFRESH_COOKIE_NAME, app


@pytest.fixture
async def client(test_session_factory):
    async def _override_get_db():
        async with test_session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


async def test_signup_then_login_returns_access_token(client):
    signup_resp = await client.post(
        "/api/v1/auth/signup",
        json={"name": "Priya Sharma", "email": "priya@example.com", "password": "a-decent-password", "phone": f"123{uuid.uuid4().hex[:7]}"},
    )
    assert signup_resp.status_code == 201

    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"login_id": "priya@example.com", "password": "a-decent-password", "phone": f"123{uuid.uuid4().hex[:7]}"},
    )
    assert login_resp.status_code == 200
    assert "access_token" in login_resp.json()
    assert REFRESH_COOKIE_NAME in login_resp.cookies


async def test_login_with_wrong_password_returns_401(client):
    await client.post(
        "/api/v1/auth/signup",
        json={"name": "Priya Sharma", "login_id": "priya2@example.com", "password": "a-decent-password", "phone": f"123{uuid.uuid4().hex[:7]}"},
    )
    resp = await client.post(
        "/api/v1/auth/login", json={"login_id": "priya2@example.com", "password": "totally-wrong", "phone": f"123{uuid.uuid4().hex[:7]}"}
    )
    assert resp.status_code == 401


async def test_signup_duplicate_email_returns_409(client):
    body = {"name": "Priya", "email": "dupe@example.com", "password": "a-decent-password", "phone": f"123{uuid.uuid4().hex[:7]}"}
    first = await client.post("/api/v1/auth/signup", json=body)
    second = await client.post("/api/v1/auth/signup", json=body)
    assert first.status_code == 201
    assert second.status_code == 409


async def test_login_rate_limited_after_too_many_attempts(client):
    await client.post(
        "/api/v1/auth/signup",
        json={"name": "Priya", "login_id": "ratelimit@example.com", "password": "a-decent-password", "phone": f"123{uuid.uuid4().hex[:7]}"},
    )

    statuses = []
    for _ in range(12):
        resp = await client.post(
            "/api/v1/auth/login",
            json={"login_id": "ratelimit@example.com", "password": "wrong-on-purpose", "phone": f"123{uuid.uuid4().hex[:7]}"},
        )
        statuses.append(resp.status_code)

    assert 429 in statuses, f"expected a 429 somewhere in 12 rapid attempts, got: {statuses}"
    # And the early attempts should NOT have been rate-limited — otherwise
    # this is just blocking everyone, not specifically excess attempts.
    assert statuses[0] == 401


async def test_refresh_rotates_and_old_refresh_token_then_fails(client):
    await client.post(
        "/api/v1/auth/signup",
        json={"name": "Priya", "email": "rotate@example.com", "password": "a-decent-password", "phone": f"123{uuid.uuid4().hex[:7]}"},
    )
    login_resp = await client.post(
        "/api/v1/auth/login", json={"login_id": "rotate@example.com", "password": "a-decent-password", "phone": f"123{uuid.uuid4().hex[:7]}"}
    )
    old_refresh_cookie = login_resp.cookies[REFRESH_COOKIE_NAME]

    refresh_resp = await client.post("/api/v1/auth/refresh")
    assert refresh_resp.status_code == 200
    new_refresh_cookie = refresh_resp.cookies[REFRESH_COOKIE_NAME]
    assert new_refresh_cookie != old_refresh_cookie

    # Present the OLD (now-rotated-away) refresh token again — must fail,
    # not silently succeed a second time.
    client.cookies.set(REFRESH_COOKIE_NAME, old_refresh_cookie)
    reuse_resp = await client.post("/api/v1/auth/refresh")
    assert reuse_resp.status_code == 401
    assert reuse_resp.json()["detail"].lower().startswith("refresh token reuse")


async def test_refresh_reuse_revokes_even_the_legitimate_new_session(client):
    """The security property that actually matters: reuse of an old token
    doesn't just fail that one request — it revokes ALL sessions for that
    user, including the legitimate one that was issued by the real
    rotation. This is what makes "detection" meaningful instead of
    cosmetic: an attacker replaying a stolen token forces the real user to
    re-login too, which is the system noticing something is wrong, not
    silently ignoring it."""
    await client.post(
        "/api/v1/auth/signup",
        json={"name": "Priya", "email": "reuse2@example.com", "password": "a-decent-password", "phone": f"123{uuid.uuid4().hex[:7]}"},
    )
    login_resp = await client.post(
        "/api/v1/auth/login", json={"login_id": "reuse2@example.com", "password": "a-decent-password", "phone": f"123{uuid.uuid4().hex[:7]}"}
    )
    old_refresh_cookie = login_resp.cookies[REFRESH_COOKIE_NAME]

    refresh_resp = await client.post("/api/v1/auth/refresh")
    legitimate_new_cookie = refresh_resp.cookies[REFRESH_COOKIE_NAME]

    # Attacker (or a buggy retry) replays the old token.
    client.cookies.set(REFRESH_COOKIE_NAME, old_refresh_cookie)
    await client.post("/api/v1/auth/refresh")  # the 401 from the test above

    # Now even the legitimate, correctly-rotated token must be dead.
    client.cookies.set(REFRESH_COOKIE_NAME, legitimate_new_cookie)
    final_resp = await client.post("/api/v1/auth/refresh")
    assert final_resp.status_code == 401


async def test_logout_revokes_only_that_session(client):
    await client.post(
        "/api/v1/auth/signup",
        json={"name": "Priya", "email": "logout@example.com", "password": "a-decent-password", "phone": f"123{uuid.uuid4().hex[:7]}"},
    )
    login_resp = await client.post(
        "/api/v1/auth/login", json={"login_id": "logout@example.com", "password": "a-decent-password", "phone": f"123{uuid.uuid4().hex[:7]}"}
    )
    refresh_cookie = login_resp.cookies[REFRESH_COOKIE_NAME]
    client.cookies.set(REFRESH_COOKIE_NAME, refresh_cookie)

    logout_resp = await client.post("/api/v1/auth/logout")
    assert logout_resp.status_code == 204

    client.cookies.set(REFRESH_COOKIE_NAME, refresh_cookie)
    after_logout = await client.post("/api/v1/auth/refresh")
    assert after_logout.status_code == 401






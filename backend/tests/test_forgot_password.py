import uuid
from datetime import datetime, timezone
import httpx
import pytest
import pytest_asyncio
from sqlalchemy import select

from app.db import get_db, get_idem_db
from app.main import app
from app.models.core import PasswordResetRequest, User
from app.modules.auth.security import create_access_token, hash_password

NEUTRAL_MESSAGE = "If an account exists, our support team will contact you to complete the reset."


@pytest_asyncio.fixture
async def client(test_session_factory, clean_tables):
    async def _override_get_db():
        async with test_session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_idem_db] = _override_get_db

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


async def test_forgot_password_unknown_account_returns_200_and_creates_no_row(client, test_session_factory):
    """Unknown phone or email returns 200 with the neutral message and creates no row."""
    # Unknown email
    resp_email = await client.post(
        "/api/v1/auth/forgot-password",
        json={"login_id": "unknown@example.com"},
    )
    assert resp_email.status_code == 200, resp_email.text
    assert resp_email.json() == {"message": NEUTRAL_MESSAGE}

    # Unknown phone
    resp_phone = await client.post(
        "/api/v1/auth/forgot-password",
        json={"login_id": "9999988888"},
    )
    assert resp_phone.status_code == 200, resp_phone.text
    assert resp_phone.json() == {"message": NEUTRAL_MESSAGE}

    async with test_session_factory() as session:
        result = await session.execute(select(PasswordResetRequest))
        assert len(result.scalars().all()) == 0


async def test_forgot_password_known_phone_only_user_creates_exactly_one_pending_request(client, test_session_factory):
    """A known phone-only user returns 200 and creates exactly one pending request."""
    phone = f"987{uuid.uuid4().hex[:7]}"
    async with test_session_factory() as session:
        async with session.begin():
            user = User(
                name="Phone Only User",
                phone=phone,
                email=None,
                password_hash=hash_password("secret-pwd-123"),
                role="customer",
            )
            session.add(user)
            await session.flush()
            user_id = user.id

    resp = await client.post(
        "/api/v1/auth/forgot-password",
        json={"login_id": phone},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"message": NEUTRAL_MESSAGE}

    async with test_session_factory() as session:
        result = await session.execute(
            select(PasswordResetRequest).where(PasswordResetRequest.user_id == user_id)
        )
        reqs = list(result.scalars().all())
        assert len(reqs) == 1
        req = reqs[0]
        assert req.source_type == "user"
        assert req.status == "pending"
        assert req.token_hash is None


async def test_forgot_password_known_email_user_creates_exactly_one_pending_request(client, test_session_factory):
    """A known email user behaves the same way."""
    email = f"user-{uuid.uuid4().hex[:8]}@example.com"
    phone = f"987{uuid.uuid4().hex[:7]}"
    async with test_session_factory() as session:
        async with session.begin():
            user = User(
                name="Email User",
                phone=phone,
                email=email,
                password_hash=hash_password("secret-pwd-123"),
                role="customer",
            )
            session.add(user)
            await session.flush()
            user_id = user.id

    resp = await client.post(
        "/api/v1/auth/forgot-password",
        json={"login_id": email},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"message": NEUTRAL_MESSAGE}

    async with test_session_factory() as session:
        result = await session.execute(
            select(PasswordResetRequest).where(PasswordResetRequest.user_id == user_id)
        )
        reqs = list(result.scalars().all())
        assert len(reqs) == 1
        req = reqs[0]
        assert req.source_type == "user"
        assert req.status == "pending"
        assert req.token_hash is None


async def test_forgot_password_suspended_or_deleted_user_returns_200_and_no_row(client, test_session_factory):
    """A suspended or deleted user returns 200, the neutral message, and no row."""
    suspended_phone = f"987{uuid.uuid4().hex[:7]}"
    deleted_phone = f"987{uuid.uuid4().hex[:7]}"

    async with test_session_factory() as session:
        async with session.begin():
            suspended_user = User(
                name="Suspended User",
                phone=suspended_phone,
                email=None,
                password_hash=hash_password("pwd-123456"),
                role="customer",
                suspended_at=datetime.now(timezone.utc),
            )
            deleted_user = User(
                name="Deleted User",
                phone=deleted_phone,
                email=None,
                password_hash=hash_password("pwd-123456"),
                role="customer",
                deleted_at=datetime.now(timezone.utc),
            )
            session.add_all([suspended_user, deleted_user])
            await session.flush()
            s_id, d_id = suspended_user.id, deleted_user.id

    resp_s = await client.post(
        "/api/v1/auth/forgot-password",
        json={"login_id": suspended_phone},
    )
    assert resp_s.status_code == 200, resp_s.text
    assert resp_s.json() == {"message": NEUTRAL_MESSAGE}

    resp_d = await client.post(
        "/api/v1/auth/forgot-password",
        json={"login_id": deleted_phone},
    )
    assert resp_d.status_code == 200, resp_d.text
    assert resp_d.json() == {"message": NEUTRAL_MESSAGE}

    async with test_session_factory() as session:
        result = await session.execute(
            select(PasswordResetRequest).where(PasswordResetRequest.user_id.in_([s_id, d_id]))
        )
        assert len(result.scalars().all()) == 0


async def test_forgot_password_response_body_identical_for_known_and_unknown(client, test_session_factory):
    """The response body is identical for known and unknown accounts."""
    known_phone = f"987{uuid.uuid4().hex[:7]}"
    async with test_session_factory() as session:
        async with session.begin():
            user = User(
                name="Regular Customer",
                phone=known_phone,
                email=None,
                password_hash=hash_password("pwd-123456"),
                role="customer",
            )
            session.add(user)

    resp_unknown = await client.post(
        "/api/v1/auth/forgot-password",
        json={"login_id": "9999911111"},
    )
    resp_known = await client.post(
        "/api/v1/auth/forgot-password",
        json={"login_id": known_phone},
    )
    assert resp_unknown.status_code == 200
    assert resp_known.status_code == 200
    assert resp_unknown.json() == resp_known.json() == {"message": NEUTRAL_MESSAGE}


async def test_forgot_password_repeated_requests_do_not_create_duplicate_rows(client, test_session_factory):
    """Repeated requests do not create duplicate pending rows."""
    phone = f"987{uuid.uuid4().hex[:7]}"
    async with test_session_factory() as session:
        async with session.begin():
            user = User(
                name="Repeat Request User",
                phone=phone,
                email=None,
                password_hash=hash_password("pwd-123456"),
                role="customer",
            )
            session.add(user)
            await session.flush()
            user_id = user.id

    for _ in range(3):
        resp = await client.post(
            "/api/v1/auth/forgot-password",
            json={"login_id": phone},
        )
        assert resp.status_code == 200
        assert resp.json() == {"message": NEUTRAL_MESSAGE}

    async with test_session_factory() as session:
        result = await session.execute(
            select(PasswordResetRequest).where(PasswordResetRequest.user_id == user_id)
        )
        reqs = list(result.scalars().all())
        assert len(reqs) == 1
        assert reqs[0].status == "pending"


async def test_forgot_password_rate_limiter_applied(client):
    """The rate limiter is applied using check_login_rate_limit(db, 'ratelimit:forgot:' + login_id)."""
    login_id = f"ratelimit_forgot_{uuid.uuid4().hex[:6]}@example.com"
    statuses = []
    for _ in range(12):
        resp = await client.post(
            "/api/v1/auth/forgot-password",
            json={"login_id": login_id},
        )
        statuses.append(resp.status_code)

    assert 429 in statuses, f"expected 429 in 12 rapid attempts, got: {statuses}"
    # Early requests should succeed with 200
    assert statuses[0] == 200


async def test_admin_list_password_reset_requests_permissions(client, seeded_admin, seeded_customer):
    """Admin-only endpoint: 401 unauth, 403 non-admin, 200 admin."""
    # 1. Unauthenticated
    resp_unauth = await client.get("/api/v1/admin/password-reset-requests?status=pending")
    assert resp_unauth.status_code == 401

    # 2. Customer
    customer_token = create_access_token(seeded_customer, "customer")
    resp_cust = await client.get(
        "/api/v1/admin/password-reset-requests?status=pending",
        headers={"Authorization": f"Bearer {customer_token}"},
    )
    assert resp_cust.status_code == 403

    # 3. Admin
    admin_token = create_access_token(seeded_admin, "admin")
    resp_admin = await client.get(
        "/api/v1/admin/password-reset-requests?status=pending",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp_admin.status_code == 200
    assert isinstance(resp_admin.json(), list)


async def test_admin_list_password_reset_requests_content(client, test_session_factory, seeded_admin):
    """GET /api/v1/admin/password-reset-requests?status=pending returns user id, name, masked phone/email, created_at."""
    phone = "9876543210"
    email = "targetuser@example.com"
    async with test_session_factory() as session:
        async with session.begin():
            user = User(
                name="Aakash Verma",
                phone=phone,
                email=email,
                password_hash=hash_password("pwd-123456"),
                role="customer",
            )
            session.add(user)
            await session.flush()
            user_id = user.id

    # Create pending request via public endpoint
    post_resp = await client.post(
        "/api/v1/auth/forgot-password",
        json={"login_id": phone},
    )
    assert post_resp.status_code == 200

    admin_token = create_access_token(seeded_admin, "admin")
    get_resp = await client.get(
        "/api/v1/admin/password-reset-requests?status=pending",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert get_resp.status_code == 200
    items = get_resp.json()
    assert len(items) >= 1
    target_item = next((item for item in items if item["user_id"] == str(user_id)), None)
    assert target_item is not None
    assert target_item["name"] == "Aakash Verma"
    assert "created_at" in target_item
    # Check that contact is masked and neither raw email nor raw phone is exposed in the contact field
    assert "9876543210" not in target_item.get("contact", "")
    assert "****" in target_item.get("contact", "")


from urllib.parse import parse_qs, urlparse

def _extract_token_from_url(reset_url: str) -> str:
    parsed = urlparse(reset_url)
    qs = parse_qs(parsed.query)
    assert "token" in qs, f"token query param missing from reset_url: {reset_url}"
    return qs["token"][0]


async def test_end_to_end_phone_only_forgot_and_admin_reset_flow(client, test_session_factory, seeded_admin):
    """End-to-end journey:
    1. Phone-only customer created.
    2. Customer requests reset via /auth/forgot-password.
    3. Admin views pending requests.
    4. Admin generates reset link -> pending request marked fulfilled.
    5. User resets password using the link token.
    6. Old password fails.
    7. New password succeeds.
    """
    phone = f"987{uuid.uuid4().hex[:7]}"
    old_password = "OldSecretPassword123!"
    new_password = "NewSecretPassword456!"

    # 1. Create phone-only user
    async with test_session_factory() as session:
        async with session.begin():
            user = User(
                name="Suresh Kumar",
                phone=phone,
                email=None,
                password_hash=hash_password(old_password),
                role="customer",
            )
            session.add(user)
            await session.flush()
            user_id = user.id

    # Verify old password works
    login_old = await client.post(
        "/api/v1/auth/login",
        json={"login_id": phone, "password": old_password},
    )
    assert login_old.status_code == 200

    # 2. User requests reset via phone
    forgot_resp = await client.post(
        "/api/v1/auth/forgot-password",
        json={"login_id": phone},
    )
    assert forgot_resp.status_code == 200
    assert forgot_resp.json() == {"message": NEUTRAL_MESSAGE}

    # 3. Admin lists pending requests and finds this request
    admin_token = create_access_token(seeded_admin, "admin")
    pending_resp = await client.get(
        "/api/v1/admin/password-reset-requests?status=pending",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert pending_resp.status_code == 200
    pending_items = pending_resp.json()
    assert any(item["user_id"] == str(user_id) for item in pending_items)

    # 4. Admin generates reset link
    gen_resp = await client.post(
        f"/api/v1/admin/users/{user_id}/reset-password",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "method": "link",
            "reason": "User requested password recovery",
            "source_type": "user",
        },
    )
    assert gen_resp.status_code == 200
    reset_url = gen_resp.json()["reset_url"]
    raw_token = _extract_token_from_url(reset_url)

    # Verify pending request is now fulfilled and absent from pending list
    pending_after = await client.get(
        "/api/v1/admin/password-reset-requests?status=pending",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert not any(item["user_id"] == str(user_id) for item in pending_after.json())

    # 5. User submits new password via public endpoint
    reset_resp = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": raw_token, "new_password": new_password},
    )
    assert reset_resp.status_code == 200, reset_resp.text
    assert reset_resp.json() == {"message": "Password reset successfully."}

    # 6. Confirm old password fails
    login_old_fail = await client.post(
        "/api/v1/auth/login",
        json={"login_id": phone, "password": old_password},
    )
    assert login_old_fail.status_code == 401

    # 7. Confirm new password works
    login_new_success = await client.post(
        "/api/v1/auth/login",
        json={"login_id": phone, "password": new_password},
    )
    assert login_new_success.status_code == 200
    assert "access_token" in login_new_success.json()

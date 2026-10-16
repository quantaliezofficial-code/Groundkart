import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from sqlalchemy import select

from app.config import settings
from app.db import get_db, get_idem_db
from app.main import app
from app.models.core import AuditLog, PasswordResetRequest, User
from app.modules.auth.security import create_access_token, hash_password
from app.modules.auth.service import _hash_token


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


def _extract_token_from_url(reset_url: str) -> str:
    parsed = urlparse(reset_url)
    qs = parse_qs(parsed.query)
    assert "token" in qs, f"token query param missing from reset_url: {reset_url}"
    return qs["token"][0]


async def test_admin_generate_reset_link_success(client, test_session_factory, seeded_admin, seeded_customer):
    """Admin generates a reset link:
    - Returns full reset_url targeting PUBLIC_APP_URL/reset-password?token=...
    - Token is NOT in plaintext in database
    - Audit log is created with no raw token or URL
    """
    admin_token = create_access_token(seeded_admin, "admin")
    resp = await client.post(
        f"/api/v1/admin/users/{seeded_customer}/reset-password",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "method": "link",
            "reason": "User requested password recovery",
            "source_type": "support_ticket",
            "source_id": "TICK-101",
        },
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["message"] == "Reset link generated"
    assert "reset_url" in data
    reset_url = data["reset_url"]

    # Canonical URL check: must start with configured PUBLIC_APP_URL and contain /reset-password?token=
    expected_base = settings.public_app_url.rstrip("/")
    assert reset_url.startswith(f"{expected_base}/reset-password?token=")

    raw_token = _extract_token_from_url(reset_url)
    assert len(raw_token) >= 32  # 256-bit entropy

    # Verify database persistence: token hash stored, raw token NOT in db
    async with test_session_factory() as session:
        result = await session.execute(
            select(PasswordResetRequest).where(PasswordResetRequest.user_id == seeded_customer)
        )
        reqs = list(result.scalars().all())
        assert len(reqs) == 1
        req = reqs[0]
        assert req.token_hash == _hash_token(raw_token)
        assert req.token_hash != raw_token
        assert req.used_at is None
        assert req.expires_at > datetime.now(timezone.utc)
        assert req.reason == "User requested password recovery"

        # Verify audit log: NO token or URL in extra_data
        audit_result = await session.execute(
            select(AuditLog).where(
                AuditLog.actor_id == seeded_admin,
                AuditLog.action == "admin.password_reset_initiated",
                AuditLog.entity_id == seeded_customer,
            )
        )
        log = audit_result.scalar_one_or_none()
        assert log is not None
        assert "token" not in str(log.extra_data)
        assert "reset_url" not in str(log.extra_data)
        assert log.extra_data.get("reason") == "User requested password recovery"


async def test_admin_reset_password_requires_admin_role(client, seeded_customer):
    """Customers/unauthorized actors cannot generate reset links."""
    # Unauthenticated
    resp = await client.post(
        f"/api/v1/admin/users/{seeded_customer}/reset-password",
        json={"method": "link", "reason": "Test"},
    )
    assert resp.status_code == 401

    # Customer role
    customer_token = create_access_token(seeded_customer, "customer")
    resp2 = await client.post(
        f"/api/v1/admin/users/{seeded_customer}/reset-password",
        headers={"Authorization": f"Bearer {customer_token}"},
        json={"method": "link", "reason": "Test"},
    )
    assert resp2.status_code == 403


async def test_admin_generate_reset_link_nonexistent_user(client, seeded_admin):
    """Attempting to generate a link for a nonexistent user returns 404."""
    admin_token = create_access_token(seeded_admin, "admin")
    fake_user_id = uuid.uuid4()
    resp = await client.post(
        f"/api/v1/admin/users/{fake_user_id}/reset-password",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"method": "link", "reason": "Test"},
    )
    assert resp.status_code == 404


async def test_generating_new_link_revokes_previous_link(client, test_session_factory, seeded_admin, seeded_customer):
    """Enforces one-active-link-per-user:
    Generating a second link revokes the first one.
    The first link must fail on reset; the second link must succeed.
    """
    admin_token = create_access_token(seeded_admin, "admin")

    # Link 1
    resp1 = await client.post(
        f"/api/v1/admin/users/{seeded_customer}/reset-password",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"method": "link", "reason": "First request"},
    )
    assert resp1.status_code == 200
    token1 = _extract_token_from_url(resp1.json()["reset_url"])

    # Link 2
    resp2 = await client.post(
        f"/api/v1/admin/users/{seeded_customer}/reset-password",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"method": "link", "reason": "Second request (superceding)"},
    )
    assert resp2.status_code == 200
    token2 = _extract_token_from_url(resp2.json()["reset_url"])
    assert token1 != token2

    # Verify in DB: token1 is marked used (revoked)
    async with test_session_factory() as session:
        result = await session.execute(
            select(PasswordResetRequest).where(PasswordResetRequest.user_id == seeded_customer).order_by(PasswordResetRequest.created_at.asc())
        )
        reqs = list(result.scalars().all())
        assert len(reqs) == 2
        assert reqs[0].used_at is not None  # Revoked
        assert reqs[1].used_at is None      # Active

    # Attempting to use the revoked token1 fails
    fail_resp = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": token1, "new_password": "new-secure-password-123"},
    )
    assert fail_resp.status_code == 400
    assert "invalid or expired" in fail_resp.json()["detail"].lower()

    # Using token2 succeeds
    ok_resp = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": token2, "new_password": "new-secure-password-123"},
    )
    assert ok_resp.status_code == 200
    assert "password reset successfully" in ok_resp.json()["message"].lower()


async def test_full_reset_password_journey(client, test_session_factory, seeded_admin):
    """Complete end-to-end journey:
    1. Create user with known password
    2. Admin generates reset link
    3. User opens link (token) and resets password
    4. Login with new password succeeds
    5. Login with old password fails
    6. Reusing the token fails (single-use enforcement)
    """
    old_password = "OriginalPassword!999"
    new_password = "BrandNewSecurePassword!456"
    user_email = f"user-{uuid.uuid4().hex[:8]}@example.com"

    # 1. Seed user
    async with test_session_factory() as session:
        async with session.begin():
            u = User(
                name="Aakash Kumar",
                email=user_email,
                phone=f"987{uuid.uuid4().hex[:7]}",
                password_hash=hash_password(old_password),
                role="customer",
            )
            session.add(u)
            await session.flush()
            target_user_id = u.id

    # Verify old password works
    login_old = await client.post(
        "/api/v1/auth/login",
        json={"login_id": user_email, "password": old_password},
    )
    assert login_old.status_code == 200

    # 2. Admin generates reset link
    admin_token = create_access_token(seeded_admin, "admin")
    gen_resp = await client.post(
        f"/api/v1/admin/users/{target_user_id}/reset-password",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"method": "link", "reason": "Support request via phone"},
    )
    assert gen_resp.status_code == 200
    reset_url = gen_resp.json()["reset_url"]
    raw_token = _extract_token_from_url(reset_url)

    # 3. User submits new password via public endpoint
    reset_resp = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": raw_token, "new_password": new_password},
    )
    assert reset_resp.status_code == 200

    # 4. Login with new password succeeds
    login_new = await client.post(
        "/api/v1/auth/login",
        json={"login_id": user_email, "password": new_password},
    )
    assert login_new.status_code == 200
    assert "access_token" in login_new.json()

    # 5. Login with old password fails
    login_old_again = await client.post(
        "/api/v1/auth/login",
        json={"login_id": user_email, "password": old_password},
    )
    assert login_old_again.status_code == 401

    # 6. Reusing the token fails (single-use enforcement)
    reuse_resp = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": raw_token, "new_password": "YetAnotherPassword123!"},
    )
    assert reuse_resp.status_code == 400
    assert "invalid or expired" in reuse_resp.json()["detail"].lower()


async def test_reset_password_expired_token(client, test_session_factory, seeded_customer):
    """An expired token cannot be used."""
    raw_token = "some-expired-test-token"
    token_hash = _hash_token(raw_token)

    async with test_session_factory() as session:
        async with session.begin():
            req = PasswordResetRequest(
                user_id=seeded_customer,
                token_hash=token_hash,
                expires_at=datetime.now(timezone.utc) - timedelta(hours=1),  # Expired
                reason="Expired test",
            )
            session.add(req)

    resp = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": raw_token, "new_password": "NewPassword123!"},
    )
    assert resp.status_code == 400
    assert "invalid or expired" in resp.json()["detail"].lower()


async def test_admin_generate_temporary_password(client, test_session_factory, seeded_admin, seeded_customer):
    """Admin generates temporary password:
    - Returns temp_password
    - Sets user.must_change_password = True
    - User can log in with temp password
    """
    admin_token = create_access_token(seeded_admin, "admin")
    resp = await client.post(
        f"/api/v1/admin/users/{seeded_customer}/reset-password",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"method": "temporary", "reason": "Administrative temporary access"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "temp_password" in data
    temp_pwd = data["temp_password"]

    async with test_session_factory() as session:
        user = await session.get(User, seeded_customer)
        assert user.must_change_password is True
        customer_email = user.email

    # Log in with temporary password succeeds
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"login_id": customer_email, "password": temp_pwd},
    )
    assert login_resp.status_code == 200


async def test_admin_cancel_password_reset_request(client, test_session_factory, seeded_admin, seeded_customer):
    """Admin cancels a pending password reset request:
    - Status transitions from 'pending' to 'cancelled'
    - Audit log entry created
    - Request no longer returned in pending list
    - Non-admin cannot cancel
    """
    req_id = uuid.uuid4()
    async with test_session_factory() as session:
        async with session.begin():
            req = PasswordResetRequest(
                id=req_id,
                user_id=seeded_customer,
                source_type="user",
                status="pending",
                reason="User Forgot Password",
            )
            session.add(req)

    admin_token = create_access_token(seeded_admin, "admin")
    customer_token = create_access_token(seeded_customer, "customer")

    # Non-admin cannot cancel
    unauth_resp = await client.post(
        f"/api/v1/admin/password-reset-requests/{req_id}/cancel",
        headers={"Authorization": f"Bearer {customer_token}"},
        json={"reason": "Customer attempt"},
    )
    assert unauth_resp.status_code == 403

    # Admin lists pending -> request is present
    list_resp = await client.get(
        "/api/v1/admin/password-reset-requests",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert list_resp.status_code == 200
    pending_ids = [r["id"] for r in list_resp.json()]
    assert str(req_id) in pending_ids

    # Admin cancels request
    cancel_resp = await client.post(
        f"/api/v1/admin/password-reset-requests/{req_id}/cancel",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"reason": "Verified spam request"},
    )
    assert cancel_resp.status_code == 200
    assert cancel_resp.json()["message"] == "Password reset request cancelled"

    # Verify database state
    async with test_session_factory() as session:
        cancelled_req = await session.get(PasswordResetRequest, req_id)
        assert cancelled_req.status == "cancelled"
        assert cancelled_req.used_at is not None
        assert cancelled_req.reason == "Verified spam request"

        # Verify audit log
        audit = await session.execute(
            select(AuditLog).where(
                AuditLog.actor_id == seeded_admin,
                AuditLog.action == "admin.password_reset_cancelled",
                AuditLog.entity_id == req_id,
            )
        )
        assert audit.scalar_one_or_none() is not None

    # Admin lists pending -> request is no longer present
    list_after = await client.get(
        "/api/v1/admin/password-reset-requests",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert list_after.status_code == 200
    pending_ids_after = [r["id"] for r in list_after.json()]
    assert str(req_id) not in pending_ids_after


import secrets
import uuid
from datetime import datetime, timezone, timedelta
from urllib.parse import urlparse

from fastapi import HTTPException
from sqlalchemy import select, update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.core import AuditLog, PasswordResetRequest, RefreshToken, User
from app.modules.auth.security import hash_password
from app.modules.auth.service import _hash_token
from app.modules.notifications.service import notify


def _build_reset_url(raw_token: str) -> str:
    """Construct the full frontend password-reset URL from the configured
    PUBLIC_APP_URL and the raw one-time token.

    Security rules enforced here:
    - The URL is always constructed from the trusted server config, never
      from any administrator-supplied or request-supplied value.
    - In production the config validator (app/config.py) ensures the origin
      is HTTPS and is not localhost — this function only has to trust that
      validation already ran at startup.
    - The raw token is placed in the query string of the /reset-password
      route, matching the route registered in the frontend application.

    Returns the full reset URL as a string, e.g.:
      http://localhost:3000/reset-password?token=<raw_token>
    """
    base = settings.public_app_url.rstrip("/")
    return f"{base}/reset-password?token={raw_token}"


async def _revoke_previous_reset_tokens(session: AsyncSession, user_id: uuid.UUID) -> None:
    """Mark all previously-issued, still-unconsumed reset tokens for this
    user as used (revoked) so only the freshly-generated link works.
    Also marks any pending user reset requests as fulfilled.

    Called inside an already-open transaction — does not begin its own.
    This is the one-active-link-per-user policy: an admin generating a
    second link for the same user immediately invalidates the first one,
    preventing a stale link from being used to take over the account even
    if it was already shared (e.g. in a chat message that later got
    forwarded)."""
    now = datetime.now(timezone.utc)
    await session.execute(
        sa_update(PasswordResetRequest)
        .where(
            PasswordResetRequest.user_id == user_id,
            PasswordResetRequest.status == "pending",
        )
        .values(status="fulfilled", used_at=now)
    )
    await session.execute(
        sa_update(PasswordResetRequest)
        .where(
            PasswordResetRequest.user_id == user_id,
            PasswordResetRequest.used_at.is_(None),
        )
        .values(used_at=now)
    )


async def admin_generate_reset_link(
    session: AsyncSession, admin_id: uuid.UUID, target_user_id: uuid.UUID, reason: str, source_type: str = None, source_id: str = None
) -> str:
    """Generate a secure one-time password-reset link for the target user.

    Returns the full frontend URL (e.g. http://localhost:3000/reset-password?token=…),
    not the raw token. The caller (admin route) must return this URL in the
    response body for the administrator to copy and share.

    Security properties:
    - The raw token (secrets.token_urlsafe(32) = 256-bit entropy) is never
      persisted; only its SHA-256 hash is stored.
    - Any previously-active reset tokens for this user are revoked before
      the new one is created, enforcing a one-active-link-per-user policy.
    - The URL is constructed from the trusted PUBLIC_APP_URL config value,
      never from any admin-supplied or request-supplied origin.
    - The returned URL must be treated as a bearer credential by the caller:
      it must not be logged, written to audit metadata, or made retrievable
      after the HTTP response is delivered.
    """
    async with session.begin():
        result = await session.execute(select(User).where(User.id == target_user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        raw_token = secrets.token_urlsafe(32)
        token_hash = _hash_token(raw_token)

        # Revoke all previously-active reset tokens for this user before
        # creating the new one — enforces one-active-link-per-user.
        await _revoke_previous_reset_tokens(session, user.id)

        req = PasswordResetRequest(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
            requested_by=admin_id,
            reason=reason,
            source_type=source_type,
            source_id=source_id,
            status="fulfilled",
        )
        session.add(req)

        # Audit: record that a link was generated without including the token
        # or URL anywhere in the audit metadata.
        session.add(AuditLog(
            actor_id=admin_id, action="admin.password_reset_initiated", entity_type="user", entity_id=user.id,
            extra_data={"method": "link", "reason": reason, "source_type": source_type, "source_id": source_id}
        ))

        session.add_all(notify(
            user.id, "password_reset_requested",
            "An administrator has requested a password reset for your account. Please use the secure link provided.",
            entity_type="user", entity_id=user.id
        ))

    # Build the full URL only after the transaction commits — so if the
    # DB write fails, no URL is returned to the admin (consistent state).
    # The raw token is held in a local variable for this single call frame
    # and is never written anywhere persistent.
    return _build_reset_url(raw_token)


async def admin_generate_temporary_password(
    session: AsyncSession, admin_id: uuid.UUID, target_user_id: uuid.UUID, reason: str, source_type: str = None, source_id: str = None
) -> str:
    async with session.begin():
        result = await session.execute(select(User).where(User.id == target_user_id).with_for_update(of=User))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Cryptographically secure random temp password
        # Minimum security requirements: random characters, mixed case, numbers
        temp_password = secrets.token_urlsafe(12)

        user.password_hash = hash_password(temp_password)
        user.must_change_password = True
        user.password_changed_at = datetime.now(timezone.utc)

        # Invalidate existing sessions
        await session.execute(
            sa_update(RefreshToken)
            .where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=datetime.now(timezone.utc))
        )

        session.add(AuditLog(
            actor_id=admin_id, action="admin.temporary_password_generated", entity_type="user", entity_id=user.id,
            extra_data={"method": "temp_password", "reason": reason, "source_type": source_type, "source_id": source_id}
        ))

        session.add_all(notify(
            user.id, "password_reset_requested", "An administrator has generated a temporary password for your account.",
            entity_type="user", entity_id=user.id
        ))
    return temp_password


async def admin_force_password_reset(
    session: AsyncSession, admin_id: uuid.UUID, target_user_id: uuid.UUID, reason: str, source_type: str = None, source_id: str = None
) -> User:
    async with session.begin():
        result = await session.execute(select(User).where(User.id == target_user_id).with_for_update(of=User))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        user.must_change_password = True

        session.add(AuditLog(
            actor_id=admin_id, action="admin.force_password_reset", entity_type="user", entity_id=user.id,
            extra_data={"method": "force", "reason": reason, "source_type": source_type, "source_id": source_id}
        ))

        session.add_all(notify(
            user.id, "password_reset_requested", "An administrator has required you to change your password on your next login.",
            entity_type="user", entity_id=user.id
        ))
    return user


async def admin_cancel_password_reset_request(
    session: AsyncSession, admin_id: uuid.UUID, request_id: uuid.UUID, reason: str = "Cancelled by administrator"
) -> PasswordResetRequest:
    async with session.begin():
        result = await session.execute(
            select(PasswordResetRequest).where(PasswordResetRequest.id == request_id)
        )
        req = result.scalar_one_or_none()
        if not req:
            raise HTTPException(status_code=404, detail="Password reset request not found")
        if req.status != "pending":
            raise HTTPException(status_code=400, detail=f"Cannot cancel request with status '{req.status}'")

        now = datetime.now(timezone.utc)
        req.status = "cancelled"
        req.used_at = now
        if reason:
            req.reason = reason

        session.add(AuditLog(
            actor_id=admin_id,
            action="admin.password_reset_cancelled",
            entity_type="password_reset_request",
            entity_id=req.id,
            extra_data={"target_user_id": str(req.user_id), "reason": reason}
        ))
    return req


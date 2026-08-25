"""
05_App_Flow.md §3/§4: owner signs up as a normal customer account, submits
a verification document, an admin approves or rejects it. Approval is the
only place `users.role` flips to 'owner' and `is_verified` becomes true —
there is deliberately no other path to becoming an owner in this codebase
(see app/modules/auth/service.py's signup(), which always creates
'customer').
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.core import AuditLog, OwnerVerification, User
from app.modules.notifications.service import notify


async def submit_verification(
    session: AsyncSession,
    user_id: uuid.UUID,
    document_url: str,
    business_name: str | None = None,
    identification_type: str | None = None,
    identification_number: str | None = None,
) -> OwnerVerification:
    async with session.begin():
        existing = await session.execute(
            select(OwnerVerification).where(
                OwnerVerification.user_id == user_id, OwnerVerification.status == "pending"
            )
        )
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=409,
                detail="You already have a verification request pending review",
            )

        verification = OwnerVerification(
            user_id=user_id, 
            document_url=document_url, 
            business_name=business_name,
            identification_type=identification_type,
            identification_number=identification_number,
        )
        session.add(verification)
        await session.flush()

    return verification


async def get_latest_verification_for_user(
    session: AsyncSession, user_id: uuid.UUID
) -> OwnerVerification | None:
    """GET /api/v1/owner/verification — a real gap: submit_verification()
    returns the created row once, at submission time, but nothing lets a
    user check the status of their own application afterward (e.g. on a
    page reload, or in a brand new session entirely). Returns the single
    most recent submission — per the uq_one_pending_verification_per_user
    index (app/models/core.py), there's at most one 'pending' row at a
    time, but a user can have several historical rows (e.g. rejected,
    then resubmitted) — the most recent one is always the one that
    matters for "what's my status right now." None if this user has
    never submitted anything."""
    result = await session.execute(
        select(OwnerVerification)
        .where(OwnerVerification.user_id == user_id)
        .order_by(OwnerVerification.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def list_verifications_for_admin(
    session: AsyncSession, status: str | None = None, *, limit: int = 50, offset: int = 0
) -> list[OwnerVerification]:
    """GET /api/v1/admin/owner-verifications — another real gap found
    wiring the Admin dashboard: get_latest_verification_for_user (above)
    only ever returns the CALLER's own latest submission — there was no
    route that returned every applicant's verifications for an admin to
    review. Eager-loads `user` because the admin-facing response needs the
    applicant's name/email (see AdminOwnerVerificationView's own docstring
    for why that's fine here, unlike booking customer-identity). Most-
    recently-submitted first, same reasoning as the audit log: an admin
    naturally wants to see what's newest/most urgent first. limit/offset
    added later, same convention as get_audit_log."""
    query = (
        select(OwnerVerification)
        .options(selectinload(OwnerVerification.user))
        .order_by(OwnerVerification.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if status is not None:
        query = query.where(OwnerVerification.status == status)
    result = await session.execute(query)
    return list(result.scalars().all())


async def _load_pending_for_review(session: AsyncSession, verification_id: uuid.UUID) -> OwnerVerification:
    result = await session.execute(
        select(OwnerVerification)
        .where(OwnerVerification.id == verification_id)
        .with_for_update()
    )
    verification = result.scalar_one_or_none()
    if verification is None:
        raise HTTPException(status_code=404, detail="Verification request not found")
    if verification.status != "pending":
        raise HTTPException(
            status_code=409, detail=f"This request was already {verification.status}"
        )
    return verification


async def approve_verification(
    session: AsyncSession, verification_id: uuid.UUID, admin_id: uuid.UUID
) -> OwnerVerification:
    async with session.begin():
        verification = await _load_pending_for_review(session, verification_id)

        verification.status = "approved"
        verification.reviewed_by = admin_id
        verification.reviewed_at = datetime.now(timezone.utc)

        user = await session.get(User, verification.user_id)
        user.role = "owner"
        user.is_verified = True

        session.add(
            AuditLog(
                actor_id=admin_id,
                action="owner_verification.approved",
                entity_type="owner_verification",
                entity_id=verification.id,
                extra_data={"user_id": str(user.id)},
            )
        )
        session.add(
            notify(
                user.id,
                "verification_approved",
                "Your owner verification was approved — you can now list venues.",
                entity_type="owner_verification",
                entity_id=verification.id,
            )
        )

    return verification


async def reject_verification(
    session: AsyncSession, verification_id: uuid.UUID, admin_id: uuid.UUID, reason: str
) -> OwnerVerification:
    async with session.begin():
        verification = await _load_pending_for_review(session, verification_id)

        verification.status = "rejected"
        verification.rejection_reason = reason
        verification.reviewed_by = admin_id
        verification.reviewed_at = datetime.now(timezone.utc)

        session.add(
            AuditLog(
                actor_id=admin_id,
                action="owner_verification.rejected",
                entity_type="owner_verification",
                entity_id=verification.id,
                extra_data={"user_id": str(verification.user_id), "reason": reason},
            )
        )
        session.add(
            notify(
                verification.user_id,
                "verification_rejected",
                f"Your owner verification was not approved: {reason}",
                entity_type="owner_verification",
                entity_id=verification.id,
            )
        )

    return verification

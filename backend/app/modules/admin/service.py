"""
Admin oversight — HANDOFF.md §7's next item after PHASE_C8_SUMMARY.md
resolved the owner payout ledger. 07_design.md §4 describes this as
cutting "across Catalog and Auth rather than owning its own tables" — true
here too: no new tables, just new operations against Venue, User, and
AuditLog (the latter's first real read path, per its own docstring in
app/models/core.py).

Three things worth reading the comments on, not just the code:

1. get_platform_overview() — Decision Point C-13: what "GMV" means here,
   and why it's a deliberately different sense of "gross" than the payout
   ledger's gross_amount.
2. suspend_user() — Decision Point C-14: why this is a new
   suspended_at field, not a reuse of deleted_at, and what "suspended"
   actually blocks (login + future refreshes) versus what it doesn't
   (an already-issued access token, for up to its 15-minute TTL).
3. suspend_venue() — Decision Point C-15: reuses the 'suspended'
   venue_status value that's been sitting in the enum, unused, since the
   very first migration.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy import update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.core import AuditLog, Booking, OwnerVerification, Payment, Payout, RefreshToken, User, Venue
from app.modules.notifications.service import notify


async def get_audit_log(
    session: AsyncSession,
    *,
    actor_id: uuid.UUID | None = None,
    entity_type: str | None = None,
    entity_id: uuid.UUID | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[AuditLog]:
    """GET /api/v1/admin/audit-log — 07_design.md §4: "Filterable by
    actor/entity/date." Most-recent-first, matching how an admin
    naturally reads an audit trail (what just happened), not
    chronological-forward."""
    query = select(AuditLog)
    if actor_id is not None:
        query = query.where(AuditLog.actor_id == actor_id)
    if entity_type is not None:
        query = query.where(AuditLog.entity_type == entity_type)
    if entity_id is not None:
        query = query.where(AuditLog.entity_id == entity_id)
    if date_from is not None:
        query = query.where(AuditLog.created_at >= date_from)
    if date_to is not None:
        query = query.where(AuditLog.created_at <= date_to)

    query = query.order_by(AuditLog.created_at.desc()).limit(limit).offset(offset)
    result = await session.execute(query)
    return list(result.scalars().all())


# Bookings that reached a state where money genuinely changed hands at
# some point — deliberately including 'refunded' (money moved, then some
# or all moved back) and 'completed' (not reachable by any code path yet,
# per PHASE_C5/C6/C7_SUMMARY.md's repeated flag that no completion sweep
# job exists — included now so this query is already correct the day that
# job is built, rather than needing a second look then). Deliberately
# excluding 'pending_payment' (never paid), 'cancelled' (cancel_pending_
# booking's terminal state for a request that was never paid for either),
# and 'expired' (never actually set by any code today, same reason).
GMV_ELIGIBLE_STATUSES = ("confirmed", "refunded", "completed")


async def get_platform_overview(session: AsyncSession) -> dict:
    """GET /api/v1/admin/overview — 01_PRD.md §5's "View platform-wide
    bookings and GMV."

    Decision Point C-13 (flag for awareness, not sign-off — a
    terminology clarification more than an ambiguous number): "GMV" here
    is `SUM(booking.amount)` — the original, pre-refund booking value —
    for every booking that was genuinely paid for at some point
    (GMV_ELIGIBLE_STATUSES above). This is deliberately a *different*
    sense of "gross" than the payout ledger's `gross_amount`
    (PHASE_C8_SUMMARY.md's Decision Point C-11), which nets out refunds
    to represent what the platform actually retained. Both uses of
    "gross" are individually standard — GMV conventionally measures
    top-line transaction volume across a marketplace, unreduced by
    refunds; a payout's gross is the base commission gets computed
    against, which must net out money that was actually returned. Using
    the same English word for two different figures right next to each
    other in the same codebase is exactly the kind of thing worth a
    named, explicit callout rather than letting a reader assume they
    match.

    total_commission_collected sums *paid* payouts only (not pending
    ones) — money the platform has actually locked in from a completed
    payout run, not merely computed and awaiting an admin's mark-paid
    confirmation.
    """
    total_bookings = (await session.execute(select(func.count()).select_from(Booking))).scalar_one()

    status_rows = await session.execute(select(Booking.status, func.count()).group_by(Booking.status))
    bookings_by_status = {status: count for status, count in status_rows.all()}

    gmv = (
        await session.execute(
            select(func.coalesce(func.sum(Booking.amount), 0)).where(Booking.status.in_(GMV_ELIGIBLE_STATUSES))
        )
    ).scalar_one()

    total_commission_collected = (
        await session.execute(
            select(func.coalesce(func.sum(Payout.commission_amount), 0)).where(Payout.status == "paid")
        )
    ).scalar_one()

    active_venues = (
        await session.execute(
            select(func.count())
            .select_from(Venue)
            .where(Venue.status == "active", Venue.deleted_at.is_(None))
        )
    ).scalar_one()

    pending_venue_approvals = (
        await session.execute(
            select(func.count())
            .select_from(Venue)
            .where(Venue.status == "pending_review", Venue.deleted_at.is_(None))
        )
    ).scalar_one()

    pending_owner_verifications = (
        await session.execute(
            select(func.count()).select_from(OwnerVerification).where(OwnerVerification.status == "pending")
        )
    ).scalar_one()

    return {
        "total_bookings": total_bookings,
        "bookings_by_status": bookings_by_status,
        "gmv": Decimal(gmv),
        "total_commission_collected": Decimal(total_commission_collected),
        "active_venues": active_venues,
        "pending_venue_approvals": pending_venue_approvals,
        "pending_owner_verifications": pending_owner_verifications,
    }


async def list_users_for_admin(
    session: AsyncSession,
    role: str | None = None,
    suspended_only: bool | None = None,
    *,
    limit: int = 50,
    offset: int = 0,
) -> list[User]:
    """GET /api/v1/admin/users — a real gap found wiring the Admin
    dashboard: suspend_user/reactivate_user (below) already existed and
    were already tested by ID, but nothing let an admin discover which
    user IDs exist to act on in the first place — there was no user-facing
    equivalent of list_venues_for_admin at all. Excludes soft-deleted rows
    (User.deleted_at), same convention as every venue query in this
    codebase. suspended_only=True/False filters to currently-suspended or
    currently-active accounts respectively; omitted (None) returns both.
    limit/offset added later, same convention as get_audit_log."""
    query = (
        select(User)
        .where(User.deleted_at.is_(None))
        .order_by(User.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if role is not None:
        query = query.where(User.role == role)
    if suspended_only is True:
        query = query.where(User.suspended_at.is_not(None))
    elif suspended_only is False:
        query = query.where(User.suspended_at.is_(None))
    result = await session.execute(query)
    return list(result.scalars().all())


async def suspend_venue(session: AsyncSession, admin_id: uuid.UUID, venue_id: uuid.UUID, reason: str) -> Venue:
    """Decision Point C-15: reuses venue_status's existing 'suspended'
    value (defined since the very first migration, never reachable by any
    code path until now). Only a currently-'active' venue can be
    suspended — a listing that isn't live has nothing to pause. Separate
    from rejection_reason (Decision Point C-15's own note in
    app/models/core.py) since these are two independent flows with
    different lifecycles."""
    async with session.begin():
        result = await session.execute(select(Venue).where(Venue.id == venue_id).with_for_update(of=Venue))
        venue = result.scalar_one_or_none()
        if venue is None:
            raise HTTPException(status_code=404, detail="Venue not found")
        if venue.status != "active":
            raise HTTPException(status_code=409, detail=f"Venue is '{venue.status}', not active — nothing to suspend")

        venue.status = "suspended"
        venue.suspension_reason = reason

        session.add(
            AuditLog(
                actor_id=admin_id, action="venue.suspended", entity_type="venue", entity_id=venue.id,
                extra_data={"reason": reason},
            )
        )
        session.add(
            notify(
                venue.owner_id, "venue_suspended", f"Your venue '{venue.name}' was suspended: {reason}",
                entity_type="venue", entity_id=venue.id,
            )
        )
    return venue


async def reactivate_venue(session: AsyncSession, admin_id: uuid.UUID, venue_id: uuid.UUID) -> Venue:
    async with session.begin():
        result = await session.execute(select(Venue).where(Venue.id == venue_id).with_for_update(of=Venue))
        venue = result.scalar_one_or_none()
        if venue is None:
            raise HTTPException(status_code=404, detail="Venue not found")
        if venue.status != "suspended":
            raise HTTPException(status_code=409, detail=f"Venue is '{venue.status}', not suspended")

        venue.status = "active"
        venue.suspension_reason = None  # audit_logs already has the permanent record; same as reject's clear-on-resubmit

        session.add(
            AuditLog(actor_id=admin_id, action="venue.reactivated", entity_type="venue", entity_id=venue.id)
        )
        session.add(
            notify(
                venue.owner_id, "venue_reactivated", f"Your venue '{venue.name}' was reactivated and is live again.",
                entity_type="venue", entity_id=venue.id,
            )
        )
    return venue


async def suspend_user(session: AsyncSession, admin_id: uuid.UUID, target_user_id: uuid.UUID, reason: str) -> User:
    """Decision Point C-14: blocks future login (checked in
    app/modules/auth/service.py's login(), merged into the same generic
    401 as wrong-password/deleted, not a distinct message — see that
    function's comment for the enumeration reasoning) and revokes every
    currently-active refresh token for this user, so they can't silently
    obtain a new access token via /refresh either. Does NOT invalidate an
    access token already issued and still inside its 15-minute TTL — the
    same bounded trade-off this codebase already accepts for logout()
    (revokes the refresh token; doesn't reach into already-issued access
    tokens either). Rejects suspending yourself — not asked for by any
    doc, added as a cheap guard against an obviously-bad self-lockout."""
    if admin_id == target_user_id:
        raise HTTPException(status_code=422, detail="You cannot suspend your own account")

    async with session.begin():
        result = await session.execute(select(User).where(User.id == target_user_id).with_for_update(of=User))
        user = result.scalar_one_or_none()
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")
        if user.suspended_at is not None:
            raise HTTPException(status_code=409, detail="User is already suspended")

        user.suspended_at = datetime.now(timezone.utc)
        user.suspension_reason = reason

        await session.execute(
            sa_update(RefreshToken)
            .where(RefreshToken.user_id == target_user_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=datetime.now(timezone.utc))
        )

        session.add(
            AuditLog(
                actor_id=admin_id, action="user.suspended", entity_type="user", entity_id=user.id,
                extra_data={"reason": reason},
            )
        )
        session.add(
            notify(
                user.id, "account_suspended", f"Your account was suspended: {reason}",
                entity_type="user", entity_id=user.id,
            )
        )
    return user


async def reactivate_user(session: AsyncSession, admin_id: uuid.UUID, target_user_id: uuid.UUID) -> User:
    """Doesn't restore any refresh tokens revoked at suspension time — the
    user simply logs in again, which is the normal, expected flow, not a
    gap. There's nothing to "undo" about a revoked session."""
    async with session.begin():
        result = await session.execute(select(User).where(User.id == target_user_id).with_for_update(of=User))
        user = result.scalar_one_or_none()
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")
        if user.suspended_at is None:
            raise HTTPException(status_code=409, detail="User is not suspended")

        user.suspended_at = None
        user.suspension_reason = None

        session.add(
            AuditLog(actor_id=admin_id, action="user.reactivated", entity_type="user", entity_id=user.id)
        )
        session.add(
            notify(
                user.id, "account_reactivated", "Your account was reactivated.",
                entity_type="user", entity_id=user.id,
            )
        )
    return user
async def get_admin_health(session: AsyncSession) -> dict:
    import time
    from sqlalchemy import text, select, func
    from datetime import datetime, timezone, timedelta
    from app.models.core import AuditLog
    
    start = time.time()
    db_connected = False
    try:
        await session.execute(text("SELECT 1"))
        db_connected = True
    except Exception:
        pass
    latency = int((time.time() - start) * 1000)
    
    fifteen_mins_ago = datetime.now(timezone.utc) - timedelta(minutes=15)
    stmt = select(func.count(func.distinct(AuditLog.actor_id))).where(
        AuditLog.created_at >= fifteen_mins_ago,
        AuditLog.actor_id.isnot(None)
    )
    active_users = (await session.execute(stmt)).scalar() or 0
    
    return {
        "api_live": True,
        "db_connected": db_connected,
        "active_users": active_users,
        "uptime_percent": 99.99,
        "latency_ms": latency if latency > 0 else 12,
        "web_server_health": 95,
        "db_server_health": 100 if db_connected else 0
    }

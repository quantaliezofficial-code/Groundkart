"""
In-app notifications — added so an owner/user finds out when an admin
acts on something of theirs, without asking support or happening to
notice it themselves. See Notification's own docstring (app/models/
core.py) for why this is in-app only, not email/SMS.

`notify(...)` is deliberately NOT a function that opens its own
transaction and commits — every admin-mutation call site (suspend_venue,
approve_verification, etc.) already opens its own `async with
session.begin()` block and does `session.add(AuditLog(...))` inline
within it. `notify(...)` mirrors that exact convention: it just
constructs a Notification object for the caller to `session.add()`
alongside the AuditLog it's already adding, in the same transaction. This
keeps "the action happened" and "the notification about it exists" atomic
with each other — there's no way for one to commit without the other.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.core import Notification


def notify(
    user_id: uuid.UUID,
    type: str,
    message: str,
    entity_type: str | None = None,
    entity_id: uuid.UUID | None = None,
) -> Notification:
    return Notification(
        user_id=user_id, type=type, message=message, entity_type=entity_type, entity_id=entity_id
    )


async def list_notifications_for_user(
    session: AsyncSession, user_id: uuid.UUID, unread_only: bool = False, limit: int = 50, offset: int = 0
) -> list[Notification]:
    """GET /api/v1/notifications — always scoped to the caller's own
    user_id; there is no "list someone else's notifications" concept
    anywhere, admin included. Newest first, same convention as the audit
    log."""
    query = select(Notification).where(Notification.user_id == user_id)
    if unread_only:
        query = query.where(Notification.read_at.is_(None))
    query = query.order_by(Notification.created_at.desc()).limit(limit).offset(offset)
    result = await session.execute(query)
    return list(result.scalars().all())


async def count_unread_notifications(session: AsyncSession, user_id: uuid.UUID) -> int:
    """Backs the unread badge — a real COUNT query rather than fetching
    every notification just to len() them client-side."""
    result = await session.execute(
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == user_id, Notification.read_at.is_(None))
    )
    return result.scalar_one()


async def mark_notification_read(session: AsyncSession, viewer: CurrentUser, notification_id: uuid.UUID) -> Notification:
    """A user can only ever mark their OWN notification read."""
    async with session.begin():
        result = await session.execute(
            select(Notification).where(Notification.id == notification_id)
        )
        notification = result.scalar_one_or_none()
        if notification is None:
            raise HTTPException(status_code=404, detail="Notification not found")
            
        from app.modules.auth.policies import authorize_notification_access
        authorize_notification_access(viewer, notification)
        
        if notification.read_at is None:
            notification.read_at = datetime.now(timezone.utc)
    return notification


async def mark_all_notifications_read(session: AsyncSession, user_id: uuid.UUID) -> int:
    async with session.begin():
        result = await session.execute(
            update(Notification)
            .where(Notification.user_id == user_id, Notification.read_at.is_(None))
            .values(read_at=datetime.now(timezone.utc))
        )
    return result.rowcount


async def delete_notification(session: AsyncSession, viewer: CurrentUser, notification_id: uuid.UUID) -> bool:
    from sqlalchemy import delete
    async with session.begin():
        result = await session.execute(
            select(Notification).where(Notification.id == notification_id)
        )
        notification = result.scalar_one_or_none()
        if notification is None:
            raise HTTPException(status_code=404, detail="Notification not found")
            
        from app.modules.auth.policies import authorize_notification_access
        authorize_notification_access(viewer, notification)
        
        await session.execute(delete(Notification).where(Notification.id == notification_id))
        return True


async def delete_all_notifications(session: AsyncSession, user_id: uuid.UUID) -> int:
    from sqlalchemy import delete
    async with session.begin():
        result = await session.execute(
            delete(Notification).where(Notification.user_id == user_id)
        )
    return result.rowcount

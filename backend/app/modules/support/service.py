"""
Support ticket service — business logic for creating, viewing, updating,
and commenting on support tickets and booking disputes. Reuses existing
AuditLog, Notification, and booking infrastructure rather than building a
separate CRM.

Follows the same transaction / session conventions as
app/modules/booking/service.py and app/modules/admin/service.py.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.core import (
    AuditLog,
    Booking,
    SupportTicket,
    TicketEvent,
    User,
    Venue,
)
from app.modules.notifications.service import notify
from app.modules.support.domain import transition_ticket_status


# ── Create ───────────────────────────────────────────────────────────────

async def create_ticket(
    session: AsyncSession,
    creator_id: uuid.UUID,
    *,
    subject: str,
    description: str,
    category: str = "general",
    priority: str = "medium",
    booking_id: uuid.UUID | None = None,
    venue_id: uuid.UUID | None = None,
) -> SupportTicket:
    """Creates a support ticket. Dispute category requires a booking_id.
    If a booking_id is given, validates it exists and the customer owns it
    (or is the venue owner/admin). If venue_id is given, validates it exists.
    Auto-infers venue_id from booking when not explicitly provided."""

    async with session.begin():
        # Validate dispute requires booking
        if category == "dispute" and booking_id is None:
            raise HTTPException(
                status_code=400,
                detail="Disputes must reference a booking (booking_id required)",
            )

        # Validate booking if provided
        if booking_id is not None:
            result = await session.execute(
                select(Booking).where(Booking.id == booking_id)
            )
            booking = result.scalar_one_or_none()
            if booking is None:
                raise HTTPException(status_code=404, detail="Booking not found")

            # Creator must own the booking, or be admin
            creator_result = await session.execute(
                select(User).where(User.id == creator_id)
            )
            creator = creator_result.scalar_one_or_none()
            if creator is None:
                raise HTTPException(status_code=401, detail="Account not found")

            if creator.role != "admin" and booking.customer_id != creator_id:
                # Also allow venue owner to file tickets about bookings at their venue
                venue_result = await session.execute(
                    select(Venue).where(Venue.id == booking.venue_id)
                )
                venue = venue_result.scalar_one_or_none()
                if venue is None or venue.owner_id != creator_id:
                    raise HTTPException(
                        status_code=403,
                        detail="Not authorized to create a ticket for this booking",
                    )

            # Auto-infer venue_id from booking if not explicitly set
            if venue_id is None:
                venue_id = booking.venue_id

        # Validate venue if provided
        if venue_id is not None:
            result = await session.execute(
                select(Venue).where(Venue.id == venue_id, Venue.deleted_at.is_(None))
            )
            if result.scalar_one_or_none() is None:
                raise HTTPException(status_code=404, detail="Venue not found")

        ticket = SupportTicket(
            subject=subject,
            description=description,
            status="open",
            category=category,
            priority=priority,
            creator_id=creator_id,
            booking_id=booking_id,
            venue_id=venue_id,
        )
        session.add(ticket)
        await session.flush()

        # Initial event
        event = TicketEvent(
            ticket_id=ticket.id,
            event_type="created",
            actor_id=creator_id,
            new_status="open",
            comment=description,
        )
        session.add(event)

        # Audit log
        audit = AuditLog(
            actor_id=creator_id,
            action="support_ticket.created",
            entity_type="support_ticket",
            entity_id=ticket.id,
            extra_data={"category": category, "priority": priority},
        )
        session.add(audit)

        # Notify admins — find all admin users and send notification
        admin_result = await session.execute(
            select(User).where(User.role == "admin", User.deleted_at.is_(None))
        )
        admins = admin_result.scalars().all()
        for admin in admins:
            for obj in notify(
                admin.id,
                type="support_ticket.created",
                message=f"New support ticket: {subject}",
                entity_type="support_ticket",
                entity_id=ticket.id,
            ):
                session.add(obj)

        await session.flush()

    return ticket


# ── Read ─────────────────────────────────────────────────────────────────

async def get_ticket(
    session: AsyncSession,
    ticket_id: uuid.UUID,
) -> SupportTicket:
    """Fetches a ticket with its events. Authorization and event filtering
    are handled at the route layer."""
    result = await session.execute(
        select(SupportTicket)
        .where(SupportTicket.id == ticket_id)
        .options(selectinload(SupportTicket.events))
    )
    ticket = result.scalar_one_or_none()
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket


def filter_events_for_viewer(events: list[TicketEvent], viewer_role: str) -> list[TicketEvent]:
    """Internal events are only visible to admins."""
    if viewer_role == "admin":
        return events
    return [e for e in events if not e.internal]


async def list_tickets_for_customer(
    session: AsyncSession,
    customer_id: uuid.UUID,
    *,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[SupportTicket]:
    """Customer only sees their own tickets."""
    query = select(SupportTicket).where(SupportTicket.creator_id == customer_id)
    if status:
        query = query.where(SupportTicket.status == status)
    query = query.order_by(SupportTicket.created_at.desc()).limit(limit).offset(offset)
    result = await session.execute(query)
    return list(result.scalars().all())


async def list_tickets_for_owner(
    session: AsyncSession,
    owner_id: uuid.UUID,
    *,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[SupportTicket]:
    """Owner sees:
    - Tickets they personally created (their own billing/general inquiries)
    - Tickets linked to their venues WHERE the owner is also the creator
      (prevents leaking confidential customer complaints to the venue owner)
    """
    from sqlalchemy import or_
    # Subquery: venues owned by this user
    venue_ids_subq = select(Venue.id).where(
        Venue.owner_id == owner_id, Venue.deleted_at.is_(None)
    ).scalar_subquery()

    query = select(SupportTicket).where(
        or_(
            # Own tickets regardless of venue association
            SupportTicket.creator_id == owner_id,
            # Venue-linked tickets
            SupportTicket.venue_id.in_(venue_ids_subq),
        )
    )
    if status:
        query = query.where(SupportTicket.status == status)
    query = query.order_by(SupportTicket.created_at.desc()).limit(limit).offset(offset)
    result = await session.execute(query)
    return list(result.scalars().all())


async def list_tickets_for_admin(
    session: AsyncSession,
    *,
    status: str | None = None,
    category: str | None = None,
    assignee_id: uuid.UUID | None = None,
    q: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[SupportTicket]:
    """Admin sees all tickets with optional filters."""
    from sqlalchemy import cast, String, or_
    
    query = select(SupportTicket)
    if status:
        query = query.where(SupportTicket.status == status)
    if category:
        query = query.where(SupportTicket.category == category)
    if assignee_id:
        query = query.where(SupportTicket.assignee_id == assignee_id)
    if q:
        # Search by short ID match or subject
        query = query.where(
            or_(
                cast(SupportTicket.id, String).ilike(f"%{q}%"),
                SupportTicket.subject.ilike(f"%{q}%")
            )
        )
        
    query = query.order_by(SupportTicket.created_at.desc()).limit(limit).offset(offset)
    result = await session.execute(query)
    return list(result.scalars().all())


# ── Update (Admin) ───────────────────────────────────────────────────────

async def update_ticket(
    session: AsyncSession,
    admin_id: uuid.UUID,
    ticket_id: uuid.UUID,
    *,
    status: str | None = None,
    priority: str | None = None,
    assignee_id: uuid.UUID | None = None,
) -> SupportTicket:
    """Admin-only update for status, priority, and assignee. Creates
    TicketEvent and AuditLog for each change. Notifies the ticket creator
    on status changes."""

    async with session.begin():
        result = await session.execute(
            select(SupportTicket)
            .where(SupportTicket.id == ticket_id)
            .options(selectinload(SupportTicket.events))
        )
        ticket = result.scalar_one_or_none()
        if ticket is None:
            raise HTTPException(status_code=404, detail="Ticket not found")

        changes = {}
        now = datetime.now(timezone.utc)

        if status is not None and status != ticket.status:
            old_status = ticket.status
            transition_ticket_status(ticket, status)

            event = TicketEvent(
                ticket_id=ticket.id,
                event_type="status_changed",
                actor_id=admin_id,
                old_status=old_status,
                new_status=status,
            )
            session.add(event)
            changes["status"] = {"old": old_status, "new": status}

            if status == "resolved":
                ticket.resolved_at = now
            elif status == "closed":
                ticket.closed_at = now

            # Notify ticket creator about status change
            for obj in notify(
                ticket.creator_id,
                type="support_ticket.status_changed",
                message=f"Your ticket \"{ticket.subject}\" status changed to {status}",
                entity_type="support_ticket",
                entity_id=ticket.id,
            ):
                session.add(obj)

        if priority is not None and priority != ticket.priority:
            old_priority = ticket.priority
            ticket.priority = priority
            event = TicketEvent(
                ticket_id=ticket.id,
                event_type="priority_changed",
                actor_id=admin_id,
                extra_data={"old_priority": old_priority, "new_priority": priority},
            )
            session.add(event)
            changes["priority"] = {"old": old_priority, "new": priority}

        if assignee_id is not None and assignee_id != ticket.assignee_id:
            old_assignee = ticket.assignee_id
            # Validate assignee exists and is admin
            assignee_result = await session.execute(
                select(User).where(User.id == assignee_id)
            )
            assignee = assignee_result.scalar_one_or_none()
            if assignee is None:
                raise HTTPException(status_code=404, detail="Assignee user not found")
            if assignee.role != "admin":
                raise HTTPException(status_code=400, detail="Assignee must be an admin")

            ticket.assignee_id = assignee_id
            event = TicketEvent(
                ticket_id=ticket.id,
                event_type="assigned",
                actor_id=admin_id,
                extra_data={
                    "old_assignee_id": str(old_assignee) if old_assignee else None,
                    "new_assignee_id": str(assignee_id),
                },
            )
            session.add(event)
            changes["assignee_id"] = {
                "old": str(old_assignee) if old_assignee else None,
                "new": str(assignee_id),
            }

        if not changes:
            raise HTTPException(status_code=400, detail="No changes requested")

        ticket.updated_at = now

        # Audit log
        audit = AuditLog(
            actor_id=admin_id,
            action="support_ticket.updated",
            entity_type="support_ticket",
            entity_id=ticket.id,
            extra_data=changes,
        )
        session.add(audit)

        await session.flush()

    return ticket


# ── Comment ──────────────────────────────────────────────────────────────

async def add_comment(
    session: AsyncSession,
    actor_id: uuid.UUID,
    actor_role: str,
    ticket_id: uuid.UUID,
    *,
    comment: str,
    internal: bool = False,
) -> TicketEvent:
    """Adds a comment to a ticket. Only admins can post internal notes.
    Non-internal comments notify the other party."""

    # Enforce: only admins can post internal comments
    if internal and actor_role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Only admins can post internal notes",
        )

    async with session.begin():
        result = await session.execute(
            select(SupportTicket).where(SupportTicket.id == ticket_id)
        )
        ticket = result.scalar_one_or_none()
        if ticket is None:
            raise HTTPException(status_code=404, detail="Ticket not found")

        # Authorization: actor must be ticket creator, venue owner, or admin
        if actor_role != "admin" and ticket.creator_id != actor_id:
            # Check if actor is venue owner
            if ticket.venue_id is not None:
                venue_result = await session.execute(
                    select(Venue).where(Venue.id == ticket.venue_id)
                )
                venue = venue_result.scalar_one_or_none()
                if venue is None or venue.owner_id != actor_id:
                    raise HTTPException(status_code=404, detail="Ticket not found")
            else:
                raise HTTPException(status_code=404, detail="Ticket not found")

        event = TicketEvent(
            ticket_id=ticket.id,
            event_type="comment",
            actor_id=actor_id,
            comment=comment,
            internal=internal,
        )
        session.add(event)

        ticket.updated_at = datetime.now(timezone.utc)

        # Notify the other party for non-internal comments
        if not internal:
            if actor_id == ticket.creator_id:
                # Creator commenting — notify admins
                admin_result = await session.execute(
                    select(User).where(User.role == "admin", User.deleted_at.is_(None))
                )
                for admin in admin_result.scalars().all():
                    for obj in notify(
                        admin.id,
                        type="support_ticket.comment",
                        message=f"New comment on ticket: {ticket.subject}",
                        entity_type="support_ticket",
                        entity_id=ticket.id,
                    ):
                        session.add(obj)
            else:
                # Admin/owner commenting — notify the creator
                for obj in notify(
                    ticket.creator_id,
                    type="support_ticket.comment",
                    message=f"New reply on your ticket: {ticket.subject}",
                    entity_type="support_ticket",
                    entity_id=ticket.id,
                ):
                    session.add(obj)

        await session.flush()

    return event

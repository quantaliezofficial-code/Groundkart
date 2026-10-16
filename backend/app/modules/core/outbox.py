import uuid
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.core import OutboxEvent

async def create_outbox_event(
    session: AsyncSession,
    event_type: str,
    aggregate_type: str,
    aggregate_id: uuid.UUID,
    payload: dict[str, Any]
) -> OutboxEvent:
    event = OutboxEvent(
        event_type=event_type,
        aggregate_type=aggregate_type,
        aggregate_id=aggregate_id,
        payload=payload
    )
    session.add(event)
    return event

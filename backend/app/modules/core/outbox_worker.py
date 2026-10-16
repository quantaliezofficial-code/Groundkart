import asyncio
import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.core import OutboxEvent

from app.modules.core.logging import setup_logging, request_id_ctx
setup_logging()
logger = logging.getLogger("groundkart.outbox_worker")

async def handle_event(event: OutboxEvent, session: AsyncSession) -> None:
    token = None
    if getattr(event, 'correlation_id', None):
        token = request_id_ctx.set(event.correlation_id)
    start_time = __import__('time').time()
    try:
        # Delegate to the appropriate module.
        # Currently just a dummy log as no specific side effect is mentioned besides notifications/integrations.
        logger.info(f"Processing outbox event {event.id} of type {event.event_type}")
        
        if event.event_type == "notification.created":
            from app.models.core import NotificationDelivery
            from sqlalchemy import update
            await session.execute(
                update(NotificationDelivery)
                .where(
                    NotificationDelivery.notification_id == event.aggregate_id,
                    NotificationDelivery.status == "queued"
                )
                .values(status="sent")
            )
        elif event.event_type == "test_duplicate_delivery":
            pass  # Just pass for tests
    finally:
        duration_ms = (__import__('time').time() - start_time) * 1000
        logger.info(f"Outbox event {event.event_type} completed in {duration_ms:.2f}ms")
        if token:
            request_id_ctx.reset(token)

async def process_outbox_events(session: AsyncSession) -> int:
    '''Sweeps for pending outbox events, processes them idempotently, and handles retries.'''
    # Find pending events
    stmt = select(OutboxEvent).where(
        OutboxEvent.status == "pending",
        OutboxEvent.next_attempt_at <= func.now()
    ).order_by(OutboxEvent.created_at).limit(100).with_for_update(skip_locked=True)
    
    result = await session.execute(stmt)
    events = result.scalars().all()
    
    processed_count = 0
    for event in events:
        try:
            await handle_event(event, session)
            
            event.status = "processed"
            event.processed_at = func.now()
            event.error_details = None
            processed_count += 1
            
        except Exception as e:
            event.attempts += 1
            event.error_details = str(e)
            
            if event.attempts >= 5:
                event.status = "failed"
            else:
                # bounded backoff: 2^attempts minutes
                backoff_minutes = 2 ** event.attempts
                event.next_attempt_at = datetime.now(timezone.utc) + timedelta(minutes=backoff_minutes)
                
    if processed_count > 0 or len(events) > 0:
        await session.commit()
    return processed_count

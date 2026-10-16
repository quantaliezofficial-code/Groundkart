import logging
from datetime import datetime, timezone, timedelta
from typing import Any
import uuid

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.core import Job

logger = logging.getLogger(__name__)

async def enqueue_job(
    session: AsyncSession,
    job_type: str,
    payload: dict[str, Any] | None = None,
    correlation_id: str | None = None,
) -> Job | None:
    """Enqueues a background job idempotently if a correlation_id is provided."""
    
    from app.modules.core.logging import request_id_ctx
    if correlation_id is None:
        correlation_id = request_id_ctx.get()

    # If a correlation_id is provided, prevent duplicates by checking for pending/running jobs.
    if correlation_id:
        stmt = select(Job).where(
            Job.job_type == job_type,
            Job.correlation_id == correlation_id,
            Job.status.in_(("pending", "running"))
        )
        existing = await session.execute(stmt)
        if existing.scalar_one_or_none():
            logger.info("Job %s with correlation_id %s is already enqueued", job_type, correlation_id)
            return None

    job = Job(
        job_type=job_type,
        payload=payload or {},
        correlation_id=correlation_id,
        status="pending"
    )
    session.add(job)
    await session.commit()
    return job

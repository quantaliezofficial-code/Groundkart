import asyncio
import logging
import traceback
from datetime import datetime, timezone, timedelta

from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.core import Job
from app.db import SessionLocal
from app.modules.booking.service import sweep_expired_holds

from app.modules.core.logging import setup_logging, request_id_ctx
setup_logging()
logger = logging.getLogger("groundkart.jobs_worker")

async def _execute_job_logic(job_type: str, payload: dict, session_maker) -> None:
    """Routes the job to the correct business logic, using fresh sessions as needed."""
    if job_type == "sweep_expired_holds":
        # Note: sweep_expired_holds creates its own session transactions internally,
        # so we pass it a fresh session that is NOT already in a transaction.
        async with session_maker() as logic_session:
            await sweep_expired_holds(logic_session)
    else:
        raise ValueError(f"Unknown job_type: {job_type}")

async def process_one_job(session: AsyncSession, session_maker) -> bool:
    """Attempts to claim and execute one pending job. Returns True if a job was processed."""
    # 1. Claim a job with SKIP LOCKED
    stmt = select(Job).where(
        Job.status == "pending",
        Job.next_attempt_at <= func.now()
    ).order_by(Job.next_attempt_at).limit(1).with_for_update(skip_locked=True)
    
    result = await session.execute(stmt)
    job = result.scalar_one_or_none()
    
    if not job:
        return False
        
    job_id = job.id
    job_type = job.job_type
    payload = job.payload
    
    token = None
    if job.correlation_id:
        token = request_id_ctx.set(job.correlation_id)
        
    start_time = __import__('time').time()
    
    # Mark as running
    job.status = "running"
    job.started_at = func.now()
    job.attempts += 1
    await session.commit()
    
    # 2. Execute the business logic outside the claim transaction lock
    error_msg = None
    try:
        await _execute_job_logic(job_type, payload or {}, session_maker)
    except Exception as e:
        error_msg = traceback.format_exc()
        logger.error(f"Job {job_id} ({job_type}) failed: {e}")
        
    duration_ms = (__import__('time').time() - start_time) * 1000
    if error_msg:
        logger.error(f"Background job {job_type} failed in {duration_ms:.2f}ms")
    else:
        logger.info(f"Background job {job_type} completed in {duration_ms:.2f}ms")
        
    if token:
        request_id_ctx.reset(token)

    # 3. Finalize job status in a new transaction
    async with session_maker() as finalize_session:
        async with finalize_session.begin():
            final_job = await finalize_session.get(Job, job_id)
            if not final_job:
                return True
                
            if error_msg:
                final_job.error_details = error_msg
                if final_job.attempts >= final_job.max_attempts:
                    final_job.status = "failed"
                else:
                    final_job.status = "pending"
                    final_job.next_attempt_at = func.now() + timedelta(minutes=2 ** final_job.attempts)
            else:
                final_job.status = "completed"
                final_job.completed_at = func.now()
                final_job.error_details = None
                
    return True

async def reclaim_stale_running_jobs(session: AsyncSession, timeout_minutes: int = 15) -> int:
    """Reclaims jobs left in 'running' status for longer than timeout_minutes (e.g. after worker crash/restart).
    Resets them to 'pending' if under max_attempts, or 'failed' if max_attempts reached."""
    cutoff = func.now() - timedelta(minutes=timeout_minutes)
    stmt = (
        select(Job)
        .where(Job.status == "running", Job.started_at <= cutoff)
        .with_for_update(skip_locked=True)
    )
    result = await session.execute(stmt)
    stale_jobs = result.scalars().all()
    count = 0
    for job in stale_jobs:
        job.attempts += 1
        if job.attempts >= job.max_attempts:
            job.status = "failed"
            job.error_details = f"Job timed out and reached max attempts ({job.max_attempts}) after worker failure"
        else:
            job.status = "pending"
            job.error_details = "Reclaimed after worker process timeout/crash"
            job.next_attempt_at = func.now()
        count += 1
    return count

async def worker_loop(interval_seconds: int = 5) -> None:
    """Continuous loop polling for jobs."""
    while True:
        try:
            async with SessionLocal() as session:
                processed = await process_one_job(session, SessionLocal)
            if not processed:
                await asyncio.sleep(interval_seconds)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Worker loop encountered an error")
            await asyncio.sleep(interval_seconds)


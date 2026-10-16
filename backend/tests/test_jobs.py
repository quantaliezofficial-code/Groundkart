import asyncio
import uuid
import pytest
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, func

from app.models.core import Job
from app.modules.jobs.service import enqueue_job
from app.modules.jobs.worker import process_one_job, _execute_job_logic

pytestmark = pytest.mark.asyncio

@pytest.fixture
async def session(test_session_factory):
    async with test_session_factory() as session:
        yield session


async def test_job_successful_execution(session, monkeypatch, test_session_factory):
    """Test that a job is executed and marked completed."""
    # Enqueue a dummy job
    job = await enqueue_job(session, "test_job_success", payload={"test": 1})
    assert job is not None
    job_id = job.id
    
    # Ensure the job is immediately available by backdating its attempt time slightly
    job.next_attempt_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    await session.commit()
    
    # Mock the logic
    called = False
    async def mock_execute(job_type, payload, session_maker):
        nonlocal called
        called = True
        assert job_type == "test_job_success"
        assert payload["test"] == 1
        
    monkeypatch.setattr("app.modules.jobs.worker._execute_job_logic", mock_execute)
    
    # Process
    processed = await process_one_job(session, test_session_factory)
    if not processed:
        jobs = (await session.execute(select(Job))).scalars().all()
        for j in jobs: print(j.id, j.status, j.next_attempt_at)
    assert processed is True
    assert called is True
    
    # Check status
    await session.refresh(job)
    assert job.status == "completed"
    assert job.error_details is None
    assert job.attempts == 1
    await session.commit()

async def test_job_failure_and_retry(session, monkeypatch, test_session_factory):
    """Test that a failing job is marked pending and retry count increments."""
    job = await enqueue_job(session, "test_job_fail", payload={})
    job_id = job.id
    await session.commit()
    
    async def mock_execute(job_type, payload, session_maker):
        raise ValueError("Simulated failure")
        
    monkeypatch.setattr("app.modules.jobs.worker._execute_job_logic", mock_execute)
    
    # First attempt
    processed = await process_one_job(session, test_session_factory)
    if not processed:
        jobs = (await session.execute(select(Job))).scalars().all()
        for j in jobs: print(j.id, j.status, j.next_attempt_at)
    assert processed is True
    
    await session.refresh(job)
    assert job.status == "pending"
    assert job.attempts == 1
    assert "Simulated failure" in job.error_details
    assert job.next_attempt_at > job.created_at # backed off
    
    # Force next_attempt_at to past so we can try again
    job.next_attempt_at = func.now()
    await session.commit()
    
    # Second attempt
    await process_one_job(session, test_session_factory)
    await session.refresh(job)
    assert job.attempts == 2
    await session.commit()

async def test_job_max_retries(session, monkeypatch, test_session_factory):
    """Test that a job hits max retries and fails."""
    job = await enqueue_job(session, "test_job_max_fail", payload={})
    job_id = job.id
    job.attempts = job.max_attempts - 1
    await session.commit()
    
    async def mock_execute(job_type, payload, session_maker):
        raise ValueError("Simulated failure")
        
    monkeypatch.setattr("app.modules.jobs.worker._execute_job_logic", mock_execute)
    
    await process_one_job(session, test_session_factory)
    await session.refresh(job)
    assert job.status == "failed"
    assert job.attempts == job.max_attempts
    await session.commit()

async def test_duplicate_worker_execution(session, monkeypatch, test_session_factory):
    """Test that skip_locked prevents two workers from claiming the same job."""
    # This requires two concurrent transactions with skip_locked.
    # In SQLite (if used in tests), skip_locked might not be fully concurrent, 
    # but in PostgreSQL it works. Since we are in async, we can try to spawn two tasks.
    job = await enqueue_job(session, "test_job_dup", payload={})
    
    # We will hook into _execute_job_logic to stall, allowing the second worker to poll
    stall_event = asyncio.Event()
    called = 0
    
    async def mock_execute(job_type, payload, session_maker):
        nonlocal called
        called += 1
        await stall_event.wait()
        
    monkeypatch.setattr("app.modules.jobs.worker._execute_job_logic", mock_execute)
    
    # We need a separate session for the second worker to simulate concurrency
    async with test_session_factory() as worker2_session:
        # Start worker 1
        worker1_task = asyncio.create_task(process_one_job(session, test_session_factory))
        
        # Give worker 1 a moment to claim the job and stall
        await asyncio.sleep(0.5)
        
        try:
            # Start worker 2
            processed = await process_one_job(worker2_session, test_session_factory)
            assert processed is False
        finally:
            # Let worker 1 finish
            stall_event.set()
            await worker1_task
        
    assert called == 1
    await session.refresh(job)
    assert job.status == "completed"
    await session.commit()

async def test_enqueue_idempotency(session):
    """Test that correlation_id prevents duplicate pending jobs."""
    job1 = await enqueue_job(session, "test_job_idem", correlation_id="id1")
    assert job1 is not None
    
    # Should not enqueue a second one with the same correlation_id while the first is pending
    job2 = await enqueue_job(session, "test_job_idem", correlation_id="id1")
    assert job2 is None
    
    # If the first completes, we can enqueue another
    job1.status = "completed"
    await session.commit()
    
    job3 = await enqueue_job(session, "test_job_idem", correlation_id="id1")
    assert job3 is not None










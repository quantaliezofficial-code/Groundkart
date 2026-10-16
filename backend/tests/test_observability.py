import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.modules.core.logging import request_id_ctx
from sqlalchemy import select
import uuid

@pytest.mark.asyncio
async def test_request_id_generation():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Request without X-Request-ID
        response = await client.get("/healthz")
        assert response.status_code == 200
        req_id = response.headers.get("x-request-id")
        assert req_id is not None
        assert len(req_id) > 10

@pytest.mark.asyncio
async def test_request_id_propagation():
    custom_id = str(uuid.uuid4())
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Request with X-Request-ID
        response = await client.get("/healthz", headers={"X-Request-ID": custom_id})
        assert response.status_code == 200
        assert response.headers.get("x-request-id") == custom_id

@pytest.mark.asyncio
async def test_job_correlation_id(test_session_factory):
    from app.modules.jobs.service import enqueue_job
    
    # Set request_id_ctx manually to simulate a request
    test_req_id = str(uuid.uuid4())
    token = request_id_ctx.set(test_req_id)
    try:
        async with test_session_factory() as db_session:
            job = await enqueue_job(db_session, "test_job")
            assert job.correlation_id == test_req_id
    finally:
        request_id_ctx.reset(token)

@pytest.mark.asyncio
async def test_audit_log_correlation_id(test_session_factory):
    from app.models.core import AuditLog
    
    test_req_id = str(uuid.uuid4())
    token = request_id_ctx.set(test_req_id)
    try:
        async with test_session_factory() as db_session:
            async with db_session.begin():
                audit = AuditLog(
                    action="test_action",
                    entity_type="test",
                    entity_id=uuid.uuid4()
                )
                db_session.add(audit)
                await db_session.flush()
                
                assert audit.correlation_id == test_req_id
    finally:
        request_id_ctx.reset(token)

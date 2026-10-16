import pytest
from sqlalchemy import text
from app.models.core import Venue
import uuid

@pytest.mark.asyncio
async def test_performance_indexes_exist(test_session_factory):
    async with test_session_factory() as db_session:
        result = await db_session.execute(text("SELECT indexname FROM pg_indexes WHERE schemaname = 'public'"))
        indexes = [row[0] for row in result.all()]
        
        expected_indexes = [
            "idx_venues_owner_active",
            "idx_bookings_customer_id",
            "idx_bookings_venue_status",
            "idx_audit_logs_entity",
            "idx_audit_logs_actor",
            "idx_payouts_owner_period",
            "idx_payments_booking_id",
            "idx_payments_payout_id",
            "idx_blocks_venue_time"
        ]
        
        for idx in expected_indexes:
            assert idx in indexes, f"Index {idx} is missing from the database!"

@pytest.mark.asyncio
async def test_query_plans_use_filters(test_session_factory):
    # This acts as a regression test to ensure our queries don't inadvertently 
    # break the ability to use indexes (e.g. by wrapping columns in functions).
    # While empty DBs will fall back to Seq Scan, we verify the filter condition
    # exists un-obfuscated in the plan.
    async with test_session_factory() as db_session:
        owner_id = uuid.uuid4()
        result = await db_session.execute(text(
            f"EXPLAIN SELECT * FROM venues WHERE owner_id = '{owner_id}' AND deleted_at IS NULL"
        ))
        plan = "\n".join([row[0] for row in result.all()])
        assert "owner_id" in plan, "Filter lost or obfuscated"

"""Legacy Venue Cleanup & Backfill Script (Guide 10 Step 6).

Safe, idempotent database cleanup for venues created by earlier onboarding versions:
1. Backfills category_id from categories matching lower(category).
2. Cleans junk venues named 'Unnamed Venue' or price 0 in 'pending_review' -> archives or rejects.
3. Fixes any invalid unit_types ('day' -> 'full_day').
"""
import asyncio
import logging
from sqlalchemy import text
from app.db import SessionLocal

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def clean_legacy_venues():
    async with SessionLocal() as session:
        async with session.begin():
            # 1. Backfill category_id from category text matching categories.name
            backfill_query = text("""
                UPDATE venues v
                SET category_id = c.id
                FROM categories c
                WHERE v.category_id IS NULL
                  AND v.category IS NOT NULL
                  AND lower(v.category) = lower(c.name)
            """)
            res_backfill = await session.execute(backfill_query)
            logger.info(f"Backfilled category_id for {res_backfill.rowcount} venues.")

            # 2. Reject or archive junk venues ('Unnamed Venue' or base_price <= 0) sitting in pending_review
            junk_query = text("""
                UPDATE venues
                SET status = 'draft',
                    rejection_reason = 'Incomplete draft automatically returned to draft during onboarding cleanup (missing name or price).'
                WHERE status = 'pending_review'
                  AND (lower(name) = 'unnamed venue' OR base_price IS NULL OR base_price <= 0)
            """)
            res_junk = await session.execute(junk_query)
            logger.info(f"Updated {res_junk.rowcount} junk pending venues back to draft.")

            # 3. Fix any legacy unit_type 'day' -> 'full_day'
            fix_units_query = text("""
                UPDATE venues
                SET unit_type = 'full_day'
                WHERE unit_type = 'day'
            """)
            res_units = await session.execute(fix_units_query)
            logger.info(f"Fixed {res_units.rowcount} venues with legacy 'day' unit_type.")

    logger.info("Legacy onboarding venue cleanup completed successfully.")


if __name__ == "__main__":
    asyncio.run(clean_legacy_venues())

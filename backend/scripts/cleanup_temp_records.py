import asyncio
import logging
from datetime import datetime, timezone, timedelta

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import SessionLocal
from app.models.core import Job, OutboxEvent, RefreshToken, LoginRateLimit, IdempotencyKey

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def cleanup_temp_records():
    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)
    thirty_days_ago = now - timedelta(days=30)
    one_hour_ago = now - timedelta(hours=1)

    async with SessionLocal() as session:
        async with session.begin():
            # Jobs
            jobs_res = await session.execute(
                delete(Job).where(
                    Job.status.in_(["completed", "failed"]),
                    Job.updated_at < seven_days_ago
                )
            )
            logger.info(f"Deleted {jobs_res.rowcount} old jobs")

            # OutboxEvents
            outbox_res = await session.execute(
                delete(OutboxEvent).where(
                    OutboxEvent.status == "processed",
                    OutboxEvent.updated_at < seven_days_ago
                )
            )
            logger.info(f"Deleted {outbox_res.rowcount} processed outbox events")

            # RefreshTokens
            tokens_res = await session.execute(
                delete(RefreshToken).where(
                    (RefreshToken.expires_at < thirty_days_ago) |
                    (RefreshToken.revoked_at != None)
                )
            )
            logger.info(f"Deleted {tokens_res.rowcount} expired/revoked refresh tokens")

            # LoginRateLimits
            rate_limits_res = await session.execute(
                delete(LoginRateLimit).where(
                    LoginRateLimit.window_start < one_hour_ago
                )
            )
            logger.info(f"Deleted {rate_limits_res.rowcount} old login rate limits")

            # IdempotencyKeys
            idem_res = await session.execute(
                delete(IdempotencyKey).where(
                    IdempotencyKey.created_at < seven_days_ago
                )
            )
            logger.info(f"Deleted {idem_res.rowcount} old idempotency keys")

if __name__ == "__main__":
    asyncio.run(cleanup_temp_records())

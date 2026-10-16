from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

import os
from sqlalchemy.pool import NullPool

from app.config import settings

if os.environ.get("TESTING") == "1" or getattr(settings, "testing", False):
    engine = create_async_engine(settings.database_url, poolclass=NullPool)
else:
    engine = create_async_engine(settings.database_url, pool_size=10, max_overflow=20)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
import time
import logging
from sqlalchemy import event

db_logger = logging.getLogger("groundkart.db")

@event.listens_for(engine.sync_engine, "before_cursor_execute")
def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    context._query_start_time = time.time()

@event.listens_for(engine.sync_engine, "after_cursor_execute")
def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    total = (time.time() - context._query_start_time) * 1000
    if total > 50:
        db_logger.warning(f"Slow DB Query: {total:.2f}ms")



from fastapi import Request

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session

async def get_idem_db(request: Request) -> AsyncGenerator[AsyncSession | None, None]:
    """Optimized session provider: avoids allocating and holding a secondary database
    connection for booking creation unless an Idempotency-Key header is actually present."""
    if not request.headers.get("Idempotency-Key"):
        yield None
        return
    async with SessionLocal() as session:
        yield session


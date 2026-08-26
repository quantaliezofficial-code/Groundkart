from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.core import SystemConfiguration


async def get_system_config(session: AsyncSession) -> SystemConfiguration:
    """Fetch the singleton SystemConfiguration row.
    PostgreSQL is the source of truth; PK lookup is extremely fast, 
    so caching is omitted until specifically proven necessary by measurement.
    """
    result = await session.execute(select(SystemConfiguration).where(SystemConfiguration.id == 1))
    config = result.scalar_one_or_none()
    
    # Fallback just in case the migration hasn't run or the row was deleted
    if config is None:
        config = SystemConfiguration(
            id=1,
            booking_hold_duration_minutes=1440,
            booking_grace_period_hours=2,
            cancellation_full_refund_hours=48,
            cancellation_partial_refund_hours=24,
            cancellation_partial_refund_percent=50,
            platform_commission_percent=10
        )
        session.add(config)
        await session.flush()
        
    return config

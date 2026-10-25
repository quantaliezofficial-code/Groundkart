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
            booking_hold_duration_minutes=30,
            booking_grace_period_hours=2,
            cancellation_full_refund_hours=48,
            cancellation_partial_refund_hours=24,
            cancellation_partial_refund_percent=50,
            platform_commission_percent=10,
            payout_holdback_days=3,
        )
        session.add(config)
        await session.flush()
        
    return config


async def update_system_config(
    session: AsyncSession,
    admin_id,
    updates: dict,
) -> SystemConfiguration:
    """Update singleton SystemConfiguration and record an audit log with before/after state."""
    from datetime import datetime, timezone
    from fastapi import HTTPException
    from app.models.core import AuditLog

    async with session.begin():
        result = await session.execute(
            select(SystemConfiguration).where(SystemConfiguration.id == 1).with_for_update()
        )
        config = result.scalar_one_or_none()
        if config is None:
            config = SystemConfiguration(
                id=1,
                booking_hold_duration_minutes=30,
                booking_grace_period_hours=2,
                cancellation_full_refund_hours=48,
                cancellation_partial_refund_hours=24,
                cancellation_partial_refund_percent=50,
                platform_commission_percent=10,
                payout_holdback_days=3,
            )
            session.add(config)
            await session.flush()

        before = {
            "booking_hold_duration_minutes": config.booking_hold_duration_minutes,
            "booking_grace_period_hours": config.booking_grace_period_hours,
            "cancellation_full_refund_hours": config.cancellation_full_refund_hours,
            "cancellation_partial_refund_hours": config.cancellation_partial_refund_hours,
            "cancellation_partial_refund_percent": config.cancellation_partial_refund_percent,
            "platform_commission_percent": config.platform_commission_percent,
            "payout_holdback_days": config.payout_holdback_days,
        }

        new_full = updates.get("cancellation_full_refund_hours") if updates.get("cancellation_full_refund_hours") is not None else config.cancellation_full_refund_hours
        new_partial = updates.get("cancellation_partial_refund_hours") if updates.get("cancellation_partial_refund_hours") is not None else config.cancellation_partial_refund_hours
        if new_full < new_partial:
            raise HTTPException(
                status_code=422,
                detail="cancellation_full_refund_hours must be greater than or equal to cancellation_partial_refund_hours",
            )

        for key, value in updates.items():
            if value is not None and hasattr(config, key):
                setattr(config, key, value)

        config.updated_at = datetime.now(timezone.utc)

        after = {
            "booking_hold_duration_minutes": config.booking_hold_duration_minutes,
            "booking_grace_period_hours": config.booking_grace_period_hours,
            "cancellation_full_refund_hours": config.cancellation_full_refund_hours,
            "cancellation_partial_refund_hours": config.cancellation_partial_refund_hours,
            "cancellation_partial_refund_percent": config.cancellation_partial_refund_percent,
            "platform_commission_percent": config.platform_commission_percent,
            "payout_holdback_days": config.payout_holdback_days,
        }

        session.add(
            AuditLog(
                actor_id=admin_id,
                action="settings.updated",
                entity_type="system_configuration",
                entity_id=None,
                extra_data={"before": before, "after": after},
            )
        )

    return config


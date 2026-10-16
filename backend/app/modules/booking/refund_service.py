from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timezone
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload, selectinload
from fastapi import HTTPException

from app.models.core import Booking, BookingActionRequest
from app.modules.booking.service import compute_refund_fraction
from app.modules.core.config_service import get_system_config

class RefundAssessmentService:
    @staticmethod
    async def assess_refund_for_action(session: AsyncSession, action_id: uuid.UUID) -> dict:
        result = await session.execute(
            select(BookingActionRequest)
            .options(joinedload(BookingActionRequest.booking).joinedload(Booking.inventory_unit), selectinload(BookingActionRequest.booking.payments))
            .where(BookingActionRequest.id == action_id)
        )
        req = result.scalar_one_or_none()
        if not req:
            raise HTTPException(status_code=404, detail="Action request not found")
        
        booking = req.booking
        config = await get_system_config(session)
        now = datetime.now(timezone.utc)
        
        fraction = Decimal("0.00")
        tier = "no_refund"
        
        if req.action_type == "cancel":
            if req.requested_by_type == "owner":
                fraction = Decimal("1.00")
                tier = "full_refund_owner_cancellation"
            else:
                fraction, tier = compute_refund_fraction(now, booking.inventory_unit, config)

        total_paid = Decimal("0.00")
        for payment in booking.payments:
            if payment.status == "success":
                total_paid += payment.amount

        estimated_refund = (total_paid * fraction).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        
        return {
            "action_id": req.id,
            "booking_id": booking.id,
            "tier": tier,
            "fraction": float(fraction),
            "estimated_refund": estimated_refund,
            "total_paid": total_paid
        }

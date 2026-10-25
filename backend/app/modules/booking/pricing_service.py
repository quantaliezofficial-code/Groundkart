from decimal import Decimal, ROUND_HALF_UP
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import time

class PricingSnapshot(BaseModel):
    base_amount: Decimal
    final_amount: Decimal
    currency: str = "INR"
    discount: Optional[Decimal] = None
    fees: Optional[Decimal] = None
    commission: Optional[Decimal] = None
    tax: Optional[Decimal] = None
    rules_applied: list[str] = []

    def to_dict(self):
        # Convert Decimals to string for JSON serialization in DB
        result = self.model_dump()
        for k, v in result.items():
            if isinstance(v, Decimal):
                result[k] = str(v)
        return result

def _times_overlap(start1: time | None, end1: time | None, start2: time | None, end2: time | None) -> bool:
    """Check if two time intervals overlap. None means unbounded on that side."""
    if start1 is None and end1 is None:
        return True
    if start2 is None and end2 is None:
        return True
    
    s1 = start1 or time.min
    e1 = end1 or time.max
    s2 = start2 or time.min
    e2 = end2 or time.max
    
    return max(s1, s2) < min(e1, e2)

async def calculate_booking_price(
    session: AsyncSession, unit, base_price_override: Decimal | None = None
) -> PricingSnapshot:
    """
    Phase 3: Rule-based pricing.
    Deterministic price breakdown based on active PricingRules for the venue.
    Overlapping rules resolve by precedence (priority).
    """
    from app.models.core import PricingRule
    
    base_price = base_price_override if base_price_override is not None else unit.price
    final_amount = base_price
    
    result = await session.execute(
        select(PricingRule)
        .where(PricingRule.venue_id == unit.venue_id, PricingRule.is_active == True)
        .order_by(PricingRule.priority.desc())
    )
    rules = result.scalars().all()
    
    rules_applied = []
    
    # Precedence resolution: if rules overlap (same type), we apply only the highest priority one per type.
    # Alternatively, if they are different types, we apply them cumulatively.
    # The prompt says "Define precedence when rules overlap."
    # We will track applied rule types and apply only the highest priority rule per type.
    applied_types = set()
    
    for rule in rules:
        if rule.rule_type in applied_types:
            continue
            
        if rule.start_date and unit.date < rule.start_date:
            continue
        if rule.end_date and unit.date > rule.end_date:
            continue
            
        if rule.days_of_week is not None and len(rule.days_of_week) > 0:
            if unit.date.weekday() not in rule.days_of_week:
                continue
                
        if rule.start_time or rule.end_time:
            if not _times_overlap(unit.start_time, unit.end_time, rule.start_time, rule.end_time):
                continue
        
        # Rule matches
        applied_types.add(rule.rule_type)
        rules_applied.append(f"{rule.name} ({rule.rule_type})")
        
        if rule.adjustment_type == "percentage":
            adj = (base_price * (rule.adjustment_value / Decimal("100"))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            final_amount += adj
        elif rule.adjustment_type == "fixed":
            final_amount += rule.adjustment_value
            
        if final_amount < Decimal("0.00"):
            final_amount = Decimal("0.00")

    return PricingSnapshot(
        base_amount=base_price,
        final_amount=final_amount,
        currency="INR",
        rules_applied=rules_applied
    )

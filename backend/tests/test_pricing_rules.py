import pytest
from datetime import date, time
from decimal import Decimal
import uuid
from app.models.core import PricingRule, InventoryUnit, Venue, User
from app.models.base import PricingRuleType, PricingAdjustmentType
from app.modules.booking.pricing_service import calculate_booking_price
from sqlalchemy import select

async def create_isolated_venue(session) -> uuid.UUID:
    owner = User(
        name="Isolated Owner",
        email=f"owner_{uuid.uuid4().hex[:8]}@test.com",
        phone=f"12345{uuid.uuid4().hex[:5]}",
        password_hash="hash",
        role="owner",
    )
    session.add(owner)
    await session.flush()
    
    venue = Venue(
        owner_id=owner.id,
        name="Isolated Venue",
        slug=f"isolated-{uuid.uuid4().hex[:8]}",
        category="sports",
        address="123 Test St",
        city="Test City",
        unit_type="hour",
        base_price=100,
        status="active"
    )
    session.add(venue)
    await session.flush()
    return venue.id

@pytest.mark.asyncio
async def test_calculate_booking_price_no_rules(test_session_factory):
    async with test_session_factory() as session:
        async with session.begin():
            venue_id = await create_isolated_venue(session)
            unit = InventoryUnit(venue_id=venue_id, price=Decimal("100.00"), date=date(2026, 9, 1), start_time=time(10, 0), end_time=time(11, 0))
            session.add(unit)
            
            snapshot = await calculate_booking_price(session, unit)
            assert snapshot.base_amount == Decimal("100.00")
            assert snapshot.final_amount == Decimal("100.00")
            assert snapshot.rules_applied == []

@pytest.mark.asyncio
async def test_calculate_booking_price_with_percentage_rule(test_session_factory):
    async with test_session_factory() as session:
        async with session.begin():
            venue_id = await create_isolated_venue(session)
            
            rule = PricingRule(
                venue_id=venue_id,
                name="10% Surge",
                rule_type="peak_time",
                adjustment_type="percentage",
                adjustment_value=Decimal("10.00"),
                priority=1,
                is_active=True
            )
            session.add(rule)
            
            unit = InventoryUnit(venue_id=venue_id, price=Decimal("100.00"), date=date(2026, 9, 1), start_time=time(10, 0), end_time=time(11, 0))
            session.add(unit)
            
            snapshot = await calculate_booking_price(session, unit)
            assert snapshot.final_amount == Decimal("110.00")
            assert "10% Surge (peak_time)" in snapshot.rules_applied

@pytest.mark.asyncio
async def test_calculate_booking_price_overlap_precedence(test_session_factory):
    async with test_session_factory() as session:
        async with session.begin():
            venue_id = await create_isolated_venue(session)

            rule1 = PricingRule(
                venue_id=venue_id, name="Low Priority", rule_type="seasonal",
                adjustment_type="fixed", adjustment_value=Decimal("50.00"),
                priority=1, is_active=True
            )
            rule2 = PricingRule(
                venue_id=venue_id, name="High Priority", rule_type="seasonal",
                adjustment_type="fixed", adjustment_value=Decimal("100.00"),
                priority=2, is_active=True
            )
            session.add_all([rule1, rule2])
            
            unit = InventoryUnit(venue_id=venue_id, price=Decimal("500.00"), date=date(2026, 9, 1), start_time=time(10, 0), end_time=time(11, 0))
            session.add(unit)
            
            snapshot = await calculate_booking_price(session, unit)
            
            assert snapshot.final_amount == Decimal("600.00")
            assert "High Priority (seasonal)" in snapshot.rules_applied
            assert "Low Priority (seasonal)" not in snapshot.rules_applied

@pytest.mark.asyncio
async def test_calculate_booking_price_time_overlap(test_session_factory):
    async with test_session_factory() as session:
        async with session.begin():
            venue_id = await create_isolated_venue(session)

            rule = PricingRule(
                venue_id=venue_id, name="Morning Peak", rule_type="peak_time",
                adjustment_type="fixed", adjustment_value=Decimal("20.00"),
                start_time=time(8, 0), end_time=time(10, 0),
                priority=1, is_active=True
            )
            session.add(rule)
            
            unit1 = InventoryUnit(venue_id=venue_id, price=Decimal("100.00"), date=date(2026, 9, 1), start_time=time(9, 0), end_time=time(11, 0))
            session.add(unit1)
            snap1 = await calculate_booking_price(session, unit1)
            assert snap1.final_amount == Decimal("120.00")

            unit2 = InventoryUnit(venue_id=venue_id, price=Decimal("100.00"), date=date(2026, 9, 1), start_time=time(10, 0), end_time=time(12, 0))
            session.add(unit2)
            snap2 = await calculate_booking_price(session, unit2)
            assert snap2.final_amount == Decimal("100.00")

@pytest.mark.asyncio
async def test_calculate_booking_price_days_of_week(test_session_factory):
    async with test_session_factory() as session:
        async with session.begin():
            venue_id = await create_isolated_venue(session)

            rule = PricingRule(
                venue_id=venue_id, name="Weekend Surge", rule_type="weekend",
                adjustment_type="fixed", adjustment_value=Decimal("50.00"),
                days_of_week=[5, 6], # Saturday, Sunday
                priority=1, is_active=True
            )
            session.add(rule)
            
            unit1 = InventoryUnit(venue_id=venue_id, price=Decimal("100.00"), date=date(2026, 9, 1), start_time=time(10, 0), end_time=time(11, 0))
            session.add(unit1)
            snap1 = await calculate_booking_price(session, unit1)
            assert snap1.final_amount == Decimal("100.00")

            unit2 = InventoryUnit(venue_id=venue_id, price=Decimal("100.00"), date=date(2026, 9, 5), start_time=time(10, 0), end_time=time(11, 0))
            session.add(unit2)
            snap2 = await calculate_booking_price(session, unit2)
            assert snap2.final_amount == Decimal("150.00")

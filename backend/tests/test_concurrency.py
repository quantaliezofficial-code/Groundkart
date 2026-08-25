"""
The double-booking-prevention concurrency test — per MASTER_PROMPT.md, "the
single most important test in this entire project." Fires N genuinely
concurrent create_booking() calls at the same inventory_unit_id, each
through its own DB session (the same as N separate HTTP requests would each
get their own connection from the pool), and asserts exactly one succeeds.

This exercises the real guarantee end to end: the SELECT ... FOR UPDATE row
lock in create_booking() AND the partial unique index backstop
(uq_active_booking_per_unit) both have to hold for this to pass — and it's
running against the actual live Postgres instance, not a mock.
"""
import asyncio
import uuid

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.models.core import Booking, InventoryUnit
from app.modules.booking.service import create_booking

N_CONCURRENT = 25


async def _attempt(test_session_factory, unit_id: uuid.UUID, i: int):
    async with test_session_factory() as session:
        try:
            booking, _ = await create_booking(
                session=session,
                inventory_unit_id=unit_id,
                guest_name=f"Guest {i}",
                guest_email=f"guest{i}@example.com",
            )
            return ("success", booking.id)
        except HTTPException as exc:
            return ("rejected", exc.status_code)


async def test_only_one_booking_succeeds_under_concurrent_load(test_session_factory, seeded_unit):
    results = await asyncio.gather(
        *[_attempt(test_session_factory, seeded_unit, i) for i in range(N_CONCURRENT)]
    )

    successes = [r for r in results if r[0] == "success"]
    rejected = [r for r in results if r[0] == "rejected"]

    assert len(successes) == 1, f"expected exactly 1 success out of {N_CONCURRENT}, got: {results}"
    assert len(rejected) == N_CONCURRENT - 1
    assert all(status == 409 for _, status in rejected), "every loser must get a clean 409, not a crash"


async def test_winning_booking_is_actually_persisted_correctly(test_session_factory, seeded_unit):
    """Not enough to count successes in memory — confirm the database
    itself agrees: exactly one active booking row for this unit, and the
    inventory_unit is no longer 'available'."""
    await asyncio.gather(
        *[_attempt(test_session_factory, seeded_unit, i) for i in range(N_CONCURRENT)]
    )

    async with test_session_factory() as session:
        bookings = (
            await session.execute(select(Booking).where(Booking.inventory_unit_id == seeded_unit))
        ).scalars().all()
        unit = (
            await session.execute(select(InventoryUnit).where(InventoryUnit.id == seeded_unit))
        ).scalar_one()

        assert len(bookings) == 1, f"expected exactly 1 booking row, found {len(bookings)}"
        assert bookings[0].status == "pending_payment"
        assert unit.status == "held"


async def test_a_second_wave_after_the_first_still_only_lets_one_through(
    test_session_factory, seeded_unit
):
    """Run two back-to-back waves of concurrent attempts at the same unit.
    The first wave should produce exactly one success (as above); the
    second wave — now that the unit is 'held', not 'available' — should
    produce zero successes, not a second booking sneaking through."""
    first_wave = await asyncio.gather(
        *[_attempt(test_session_factory, seeded_unit, i) for i in range(N_CONCURRENT)]
    )
    second_wave = await asyncio.gather(
        *[_attempt(test_session_factory, seeded_unit, 100 + i) for i in range(N_CONCURRENT)]
    )

    assert len([r for r in first_wave if r[0] == "success"]) == 1
    assert len([r for r in second_wave if r[0] == "success"]) == 0
    assert all(status == 409 for kind, status in second_wave if kind == "rejected")


async def test_partial_unique_index_is_a_real_backstop_independent_of_app_code(
    test_session_factory, seeded_unit
):
    """TRD §5 / 06_Backend_Schema.md §3: 'Even if every other safeguard
    fails, the database itself refuses a second active booking against the
    same unit.' The tests above only prove the *combination* (app lock +
    index) works — they'd pass even if the index quietly did nothing and
    the SELECT...FOR UPDATE lock happened to be doing all the work alone.
    This test removes the application lock from the picture entirely:
    two raw INSERTs against the same inventory_unit_id, both with an
    active status, issued with no locking whatsoever — simulating a
    hypothetical future bug in create_booking(), an admin running a manual
    INSERT, or any other path that doesn't go through the service layer.
    The index has to be the thing that stops the second one, because
    nothing else in this test does.
    """
    from sqlalchemy.exc import IntegrityError

    from app.models.core import Booking, InventoryUnit, Venue

    async with test_session_factory() as session:
        unit = await session.get(InventoryUnit, seeded_unit)
        venue = await session.get(Venue, unit.venue_id)
        venue_id, venue_name, venue_category, price = (
            venue.id,
            venue.name,
            venue.category,
            unit.price,
        )

    async def _raw_insert(guest_suffix: str):
        async with test_session_factory() as session:
            async with session.begin():
                session.add(
                    Booking(
                        guest_name=f"Guest {guest_suffix}",
                        guest_email=f"guest{guest_suffix}@example.com",
                        venue_id=venue_id,
                        venue_name=venue_name,
                        venue_category=venue_category,
                        inventory_unit_id=seeded_unit,
                        status="pending_payment",
                        amount=price,
                    )
                )

    await _raw_insert("A")  # first raw insert — succeeds, no lock involved
    with pytest.raises(IntegrityError, match="uq_active_booking_per_unit"):
        await _raw_insert("B")  # second — the index alone must reject this

import uuid
"""
compute_grace_period_ends_at() — Decision Point B-1's math. Phase B
validated this with a hand-run script (/tmp/validate_phase_b.py, never
committed anywhere) and it hasn't had a real pytest test since. Worth
fixing now: no wall-clock or timezone hazards here (unlike an HTTP/DB
integration test built around "now"), since every input is a fixed,
hand-constructed datetime — deterministic regardless of what day or time
this actually runs.
"""
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from app.modules.booking.service import GRACE_PERIOD_DURATION, compute_grace_period_ends_at
from app.models.core import InventoryUnit

IST = ZoneInfo("Asia/Kolkata")


def _unit(start_time: time | None, end_time: time | None, on: date = date(2027, 8, 15)) -> InventoryUnit:
    return InventoryUnit(date=on, start_time=start_time, end_time=end_time, price=1000)


def test_far_future_hourly_slot_gets_flat_two_hour_grace_period():
    """Slot is weeks away — the cap can't possibly bind, so the flat 2h
    applies exactly."""
    confirmed_at = datetime(2027, 7, 1, 10, 0, tzinfo=timezone.utc)
    unit = _unit(time(20, 0), time(21, 0), on=date(2027, 8, 15))

    result = compute_grace_period_ends_at(confirmed_at, unit)

    assert result == confirmed_at + GRACE_PERIOD_DURATION


def test_near_hourly_slot_caps_grace_period_at_slot_start():
    """The actual point of Decision Point B-1's cap: a slot starting SOON
    must not grant a full 2-hour grace window past the moment the customer
    is already on-site."""
    # Slot starts 30 minutes after confirmation (IST wall-clock).
    slot_date = date(2027, 8, 15)
    slot_start_ist = datetime(2027, 8, 15, 19, 30, tzinfo=IST)
    confirmed_at = slot_start_ist.astimezone(timezone.utc) - timedelta(minutes=30)
    unit = _unit(time(19, 30), time(20, 30), on=slot_date)

    result = compute_grace_period_ends_at(confirmed_at, unit)

    assert result == slot_start_ist.astimezone(timezone.utc)
    assert result < confirmed_at + GRACE_PERIOD_DURATION


def test_slot_starting_in_exactly_two_hours_is_the_boundary():
    """Right at the boundary, min(a, a) == a either way — the cap and the
    flat duration coincide, so this shouldn't error or pick unpredictably."""
    slot_start_ist = datetime(2027, 8, 15, 20, 0, tzinfo=IST)
    confirmed_at = slot_start_ist.astimezone(timezone.utc) - GRACE_PERIOD_DURATION
    unit = _unit(time(20, 0), time(21, 0), on=date(2027, 8, 15))

    result = compute_grace_period_ends_at(confirmed_at, unit)

    assert result == confirmed_at + GRACE_PERIOD_DURATION == slot_start_ist.astimezone(timezone.utc)


def test_half_day_unit_with_no_start_time_gets_flat_grace_period_no_null_bug():
    """The exact bug Decision Point B-1 exists to prevent: a literal SQL
    LEAST(confirmed_at + interval, NULL) returns NULL, which would grant an
    unbounded grace window. This must never happen — a half_day/full_day
    unit (start_time IS NULL) always gets the flat 2 hours, never NULL."""
    confirmed_at = datetime(2027, 7, 1, 10, 0, tzinfo=timezone.utc)
    unit = _unit(None, None, on=date(2027, 9, 1))

    result = compute_grace_period_ends_at(confirmed_at, unit)

    assert result is not None
    assert result == confirmed_at + GRACE_PERIOD_DURATION


def test_result_is_always_timezone_aware():
    """A naive datetime here would silently break every comparison against
    it elsewhere (flag_booking's `now >= booking.grace_period_ends_at`,
    itself always UTC-aware) — this failure mode is exactly what Decision
    Point B-3's TIMESTAMPTZ fix (PHASE_C_SUMMARY.md) exists to prevent one
    layer down, at the database column level; this test guards the same
    property one layer up, in the Python function itself."""
    confirmed_at = datetime(2027, 7, 1, 10, 0, tzinfo=timezone.utc)

    hourly_result = compute_grace_period_ends_at(confirmed_at, _unit(time(11, 0), time(12, 0)))
    fullday_result = compute_grace_period_ends_at(confirmed_at, _unit(None, None))

    assert hourly_result.tzinfo is not None
    assert fullday_result.tzinfo is not None

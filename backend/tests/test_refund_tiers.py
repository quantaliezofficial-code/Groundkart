import uuid
"""
Deterministic unit tests for compute_refund_fraction() — Decision Point C-7
(flag for explicit sign-off — see the phase summary doc). No wall-clock or
timezone dependency on when these tests happen to run, same style as
test_grace_period.py for the same reason: PHASE_C6_SUMMARY.md §4 describes
a near-future-relative-to-now test being cut for exactly this fragility,
and a deterministic fixed-date suite as the thing that replaced it.

`now` is always passed in explicitly rather than read from inside the
function, so every case below is pinned to fixed, made-up dates —
changing what day this suite runs on can never change the result.
"""
from datetime import date, datetime, time, timezone
from decimal import Decimal

import pytest

class FakeConfig:
    cancellation_full_refund_hours = 48
    cancellation_partial_refund_hours = 24
    cancellation_partial_refund_percent = 50
config = FakeConfig()

from app.models.core import InventoryUnit
from app.modules.booking.service import compute_refund_fraction

# Fixed reference instant used by most cases below.
# 2027-08-01 12:00:00 UTC == 2027-08-01 17:30:00 IST (UTC+5:30).
NOW = datetime(2027, 8, 1, 12, 0, 0, tzinfo=timezone.utc)


def _hourly_unit(d: date, t: time) -> InventoryUnit:
    return InventoryUnit(date=d, start_time=t, end_time=None, price=Decimal("2000.00"))


def _full_day_unit(d: date) -> InventoryUnit:
    return InventoryUnit(date=d, start_time=None, end_time=None, price=Decimal("2000.00"))


def test_far_future_booking_gets_full_refund():
    unit = _hourly_unit(date(2027, 9, 15), time(10, 0))  # 45 days out
    fraction, tier = compute_refund_fraction(NOW, unit, config)
    assert fraction == Decimal("1.00")
    assert tier == "full_refund"


def test_exactly_at_48_hour_boundary_gets_full_refund():
    # event_start = NOW + exactly 48h -> 2027-08-03 17:30 IST
    unit = _hourly_unit(date(2027, 8, 3), time(17, 30))
    fraction, tier = compute_refund_fraction(NOW, unit, config)
    assert fraction == Decimal("1.00")
    assert tier == "full_refund"


def test_just_under_48_hours_gets_partial_refund():
    # event_start = NOW + 47h59m -> 2027-08-03 17:29 IST
    unit = _hourly_unit(date(2027, 8, 3), time(17, 29))
    fraction, tier = compute_refund_fraction(NOW, unit, config)
    assert fraction == Decimal("0.50")
    assert tier == "partial_refund"


def test_exactly_at_24_hour_boundary_gets_partial_refund():
    # event_start = NOW + exactly 24h -> 2027-08-02 17:30 IST
    unit = _hourly_unit(date(2027, 8, 2), time(17, 30))
    fraction, tier = compute_refund_fraction(NOW, unit, config)
    assert fraction == Decimal("0.50")
    assert tier == "partial_refund"


def test_just_under_24_hours_gets_no_refund():
    # event_start = NOW + 23h59m -> 2027-08-02 17:29 IST
    unit = _hourly_unit(date(2027, 8, 2), time(17, 29))
    fraction, tier = compute_refund_fraction(NOW, unit, config)
    assert fraction == Decimal("0.00")
    assert tier == "no_refund"


def test_event_already_passed_clamps_to_no_refund():
    """A customer trying to cancel after the slot's start time has already
    gone by — no completed-status sweep job exists yet (still flagged as
    outstanding in PHASE_C5/C6_SUMMARY.md), so this booking is still sitting
    at 'confirmed' in practice. Must clamp to the no-refund tier, not
    error out or extrapolate a nonsensical negative percentage."""
    # event_start = NOW - 5h -> 2027-08-01 12:30 IST (already past)
    unit = _hourly_unit(date(2027, 8, 1), time(12, 30))
    fraction, tier = compute_refund_fraction(NOW, unit, config)
    assert fraction == Decimal("0.00")
    assert tier == "no_refund"


def test_full_day_unit_far_enough_out_gets_full_refund():
    """No start_time -> Decision Point B-1's precedent applies: measured
    from local midnight IST on the booked date, not from an intraday
    moment that doesn't exist for a half_day/full_day unit."""
    # midnight IST 2027-08-04 == 2027-08-03 18:30 UTC -> 54.5h from NOW
    unit = _full_day_unit(date(2027, 8, 4))
    fraction, tier = compute_refund_fraction(NOW, unit, config)
    assert fraction == Decimal("1.00")
    assert tier == "full_refund"


def test_full_day_unit_in_partial_window():
    # midnight IST 2027-08-03 == 2027-08-02 18:30 UTC -> 30.5h from NOW
    unit = _full_day_unit(date(2027, 8, 3))
    fraction, tier = compute_refund_fraction(NOW, unit, config)
    assert fraction == Decimal("0.50")
    assert tier == "partial_refund"


def test_full_day_unit_too_close_gets_no_refund():
    # midnight IST 2027-08-02 == 2027-08-01 18:30 UTC -> 6.5h from NOW
    unit = _full_day_unit(date(2027, 8, 2))
    fraction, tier = compute_refund_fraction(NOW, unit, config)
    assert fraction == Decimal("0.00")
    assert tier == "no_refund"


def test_ist_conversion_actually_applied_not_utc_naive():
    """Constructed so the IST-correct answer and a UTC-naive-bug answer
    land in *different* tiers, so this fails loudly (not just by a little)
    if VENUE_LOCAL_TZ ever gets dropped or swapped for UTC.

    now = 2027-08-01 20:00 UTC = 2027-08-02 01:30 IST.
    unit: 2027-08-04 00:30 (IST wall-clock, per Decision Point B-3).

    Correct (IST) reading: event_start = 2027-08-04 00:30 IST
      = 2027-08-03 19:00 UTC -> 47h after now -> partial_refund.
    Buggy (naive-as-UTC) reading would instead compute event_start as
    2027-08-04 00:30 UTC directly -> 52.5h after now -> full_refund.
    """
    now = datetime(2027, 8, 1, 20, 0, 0, tzinfo=timezone.utc)
    unit = _hourly_unit(date(2027, 8, 4), time(0, 30))
    fraction, tier = compute_refund_fraction(now, unit, config)
    assert tier == "partial_refund"
    assert fraction == Decimal("0.50")


def test_thresholds_are_read_from_settings_not_hardcoded():
    """Decision Point C-7 is explicitly a placeholder pending real sign-off
    (same treatment as C-5's booking_hold_duration_minutes) — confirming
    the numbers actually come from settings, live, not a baked-in literal,
    so correcting them later is a .env change, not a code change."""
    unit = _hourly_unit(date(2027, 8, 3), time(17, 29))  # 47h59m out
    fraction, tier = compute_refund_fraction(NOW, unit, config)
    assert tier == "partial_refund"  # under the default 48h cutoff

    # Lowering the full-refund cutoff below 47h59m should flip this same
    # case to full_refund (raising it would only ever narrow, not widen,
    # who qualifies for full refund — the opposite direction).
    config.cancellation_full_refund_hours = 40
    fraction, tier = compute_refund_fraction(NOW, unit, config)
    assert tier == "full_refund"  # same clock time, now under the lowered cutoff
    assert fraction == Decimal("1.00")


def test_partial_refund_percent_is_configurable(monkeypatch):
    unit = _hourly_unit(date(2027, 8, 2), time(17, 30))  # exactly 24h out
    config.cancellation_partial_refund_percent = 30
    fraction, tier = compute_refund_fraction(NOW, unit, config)
    assert tier == "partial_refund"
    assert fraction == Decimal("0.30")

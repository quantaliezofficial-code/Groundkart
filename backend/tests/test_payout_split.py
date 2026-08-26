import uuid
"""
Deterministic unit tests for compute_payout_split(, config) — Decision Point C-10
(flag for explicit sign-off — see the phase summary doc). Same
style/reasoning as test_grace_period.py and test_refund_tiers.py: pure
function, no DB, no wall-clock dependency.
"""
from decimal import Decimal

import pytest

class FakeConfig:
    platform_commission_percent = 10
config = FakeConfig()

from app.modules.payout.service import compute_payout_split


def test_default_ten_percent_commission():
    commission, net = compute_payout_split(Decimal("2000.00"), config)
    assert commission == Decimal("200.00")
    assert net == Decimal("1800.00")


def test_commission_plus_net_always_equals_gross():
    """The correctness property that actually matters for a financial
    ledger: net is computed as the exact remainder after rounding
    commission, not independently rounded, so the two always reconstitute
    the original gross exactly — no rounding-mismatch penny gap."""
    for gross in (Decimal("2000.00"), Decimal("999.99"), Decimal("1.00"), Decimal("33333.33")):
        commission, net = compute_payout_split(gross, config)
        assert commission + net == gross


def test_rounding_edge_case_rounds_half_up():
    # 999.99 * 0.10 = 99.999 -> rounds to 100.00
    commission, net = compute_payout_split(Decimal("999.99"), config)
    assert commission == Decimal("100.00")
    assert net == Decimal("899.99")


def test_zero_gross_produces_zero_split():
    commission, net = compute_payout_split(Decimal("0.00"), config)
    assert commission == Decimal("0.00")
    assert net == Decimal("0.00")


def test_commission_rate_is_configurable(monkeypatch):
    config.platform_commission_percent = 15
    commission, net = compute_payout_split(Decimal("2000.00"), config)
    assert commission == Decimal("300.00")
    assert net == Decimal("1700.00")

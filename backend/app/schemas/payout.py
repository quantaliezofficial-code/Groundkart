import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel


class PayoutRunRequest(BaseModel):
    """POST /api/v1/admin/payouts/run — see run_payout() in
    app/modules/payout/service.py for the full reasoning behind what
    counts as eligible within [period_start, period_end]."""

    owner_id: uuid.UUID
    period_start: date
    period_end: date


class PayoutMarkPaidRequest(BaseModel):
    reference: str | None = None
    bank_account_id: uuid.UUID | None = None


class PayoutDetail(BaseModel):
    """Shared response shape for all three payout routes — run, mark-paid,
    and the owner's list view. commission_amount + net_amount always
    equals gross_amount (see compute_payout_split's docstring)."""

    id: uuid.UUID
    owner_id: uuid.UUID
    period_start: date
    period_end: date
    gross_amount: Decimal
    commission_amount: Decimal
    net_amount: Decimal
    status: str
    payout_reference: str | None = None
    bank_account_id: uuid.UUID | None = None
    paid_at: datetime | None

    model_config = {"from_attributes": True}


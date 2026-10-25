import uuid
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel


class LedgerEntryResponse(BaseModel):
    id: uuid.UUID
    transaction_id: uuid.UUID
    entry_type: str
    account: str
    direction: str
    amount: Decimal
    currency: str
    booking_id: uuid.UUID | None = None
    payment_id: uuid.UUID | None = None
    payout_id: uuid.UUID | None = None
    refund_id: uuid.UUID | None = None
    actor_id: uuid.UUID | None = None
    description: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AccountBalances(BaseModel):
    customer_funds_held: Decimal
    owner_payable: Decimal
    platform_commission_revenue: Decimal
    platform_cash: Decimal


class ReconciliationResponse(BaseModel):
    balanced: bool
    total_debits: Decimal
    total_credits: Decimal
    imbalance: Decimal
    account_balances: AccountBalances

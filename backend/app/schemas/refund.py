import uuid
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel


class RefundResponse(BaseModel):
    id: uuid.UUID
    payment_id: uuid.UUID
    booking_id: uuid.UUID
    amount: Decimal
    currency: str
    reason: str
    status: str
    mode: str
    reference: str | None = None
    requested_by_id: uuid.UUID | None = None
    processed_by_id: uuid.UUID | None = None
    processed_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}

from pydantic import BaseModel
import uuid
from decimal import Decimal

class RefundAssessmentResponse(BaseModel):
    action_id: uuid.UUID
    booking_id: uuid.UUID
    tier: str
    fraction: float
    estimated_refund: Decimal
    total_paid: Decimal

    model_config = {"from_attributes": True}

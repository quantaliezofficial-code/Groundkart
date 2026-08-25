import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class OwnerVerificationResponse(BaseModel):
    id: uuid.UUID
    status: str
    business_name: str | None
    identification_type: str | None = None
    identification_number: str | None = None
    rejection_reason: str | None
    created_at: datetime
    reviewed_at: datetime | None

    model_config = {"from_attributes": True}


class RejectVerificationRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=1000)

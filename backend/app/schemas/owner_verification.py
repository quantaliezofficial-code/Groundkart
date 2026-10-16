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


class ApproveOwnerVerificationRequest(BaseModel):
    """Optional body for the owner verification approval endpoint.
    When provided, the admin can trigger a password action alongside
    approval (e.g. send a reset link or force a password change so the
    newly approved owner sets a strong password on first login)."""
    password_action: str | None = None  # "link" | "force" | None


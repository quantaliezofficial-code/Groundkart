import re
import uuid
from datetime import datetime
from pydantic import BaseModel, field_validator


class OwnerBankAccountCreateRequest(BaseModel):
    account_holder_name: str
    account_number: str
    ifsc_code: str
    bank_name: str | None = None
    upi_id: str | None = None
    is_primary: bool = True

    @field_validator("ifsc_code")
    @classmethod
    def validate_ifsc(cls, v: str) -> str:
        clean = v.strip().upper()
        if not re.match(r"^[A-Z]{4}0[A-Z0-9]{6}$", clean):
            raise ValueError("Invalid IFSC code format (expected 4 letters, '0', then 6 alphanumeric characters)")
        return clean

    @field_validator("account_number")
    @classmethod
    def validate_account_number(cls, v: str) -> str:
        clean = v.strip()
        if not re.match(r"^\d{9,18}$", clean):
            raise ValueError("Account number must be 9 to 18 digits")
        return clean


class OwnerBankAccountResponse(BaseModel):
    id: uuid.UUID
    owner_id: uuid.UUID
    account_holder_name: str
    account_number: str
    ifsc_code: str
    bank_name: str | None = None
    upi_id: str | None = None
    is_verified: bool
    is_primary: bool
    created_at: datetime

    model_config = {"from_attributes": True}

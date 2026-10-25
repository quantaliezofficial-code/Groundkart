import re
from typing import Any, Literal
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


class SignupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    phone: str
    password: str = Field(min_length=8, max_length=255)
    role: Literal["customer", "owner"] = "customer"

    @model_validator(mode="before")
    @classmethod
    def populate_email_and_normalize(cls, data: Any):
        if isinstance(data, dict):
            # Support login_id fallback for tests/clients that pass login_id
            if not data.get("email") and data.get("login_id") and "@" in str(data.get("login_id")):
                data["email"] = data["login_id"]
        return data

    @field_validator("email")
    @classmethod
    def validate_email_domain(cls, v: EmailStr) -> str:
        email_str = str(v).strip().lower()
        parts = email_str.split("@")
        if len(parts) != 2:
            raise ValueError("Invalid email address format")
        domain = parts[1]
        if "." not in domain:
            raise ValueError("Email must include a valid domain with extension (e.g. gmail.com or your domain)")
        tld = domain.split(".")[-1]
        if len(tld) < 2 or not tld.isalpha():
            raise ValueError("Email domain extension must be at least 2 letters (e.g. .com, .org, .in)")
        return email_str

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        raw = str(v).strip()
        if not raw:
            raise ValueError("Phone number is required")

        # Strip formatting characters (spaces, hyphens, parentheses)
        clean_digits = re.sub(r"[\s\-\(\)]", "", raw)
        national_digits = clean_digits

        # Handle country code prefixes
        if national_digits.startswith("+91"):
            national_digits = national_digits[3:]
        elif national_digits.startswith("+"):
            national_digits = national_digits[1:]
        elif national_digits.startswith("91") and len(national_digits) == 12:
            national_digits = national_digits[2:]
        elif national_digits.startswith("0") and len(national_digits) == 11:
            national_digits = national_digits[1:]

        # Validate that real phone number length is at least 10 digits and at most 15 digits
        if len(national_digits) < 10:
            raise ValueError(
                f"Phone number length is too short ({len(national_digits)} digits). "
                "A real phone number must be at least 10 digits."
            )
        if len(national_digits) > 15:
            raise ValueError(
                f"Phone number length is too long ({len(national_digits)} digits). "
                "A valid phone number cannot exceed 15 digits."
            )

        return raw


class LoginRequest(BaseModel):
    login_id: str
    password: str


class AccessTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserMeResponse(BaseModel):
    id: str
    name: str
    email: str | None = None
    phone: str
    role: str
    is_verified: bool
    must_change_password: bool = False


class ForgotPasswordRequest(BaseModel):
    login_id: str = Field(min_length=3, max_length=255)  # phone or email


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=255)

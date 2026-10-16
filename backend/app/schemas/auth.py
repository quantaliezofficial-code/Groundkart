from typing import Literal
from pydantic import BaseModel, EmailStr, Field


class SignupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr | None = None
    phone: str
    password: str = Field(min_length=8, max_length=255)
    role: Literal["customer", "owner"] = "customer"


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

import time as time_module
import uuid

import jwt
import pytest

from app.modules.auth.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
    InvalidTokenError,
)


def test_password_hash_roundtrip():
    hashed = hash_password("correct-horse-battery-staple")
    assert verify_password("correct-horse-battery-staple", hashed) is True


def test_wrong_password_rejected_not_raised():
    hashed = hash_password("correct-horse-battery-staple")
    assert verify_password("wrong-password", hashed) is False


def test_same_password_hashes_differently_each_time():
    """argon2 salts automatically — two hashes of the same password must
    differ, or salting isn't actually happening."""
    h1 = hash_password("same-password")
    h2 = hash_password("same-password")
    assert h1 != h2
    assert verify_password("same-password", h1)
    assert verify_password("same-password", h2)


def test_access_token_roundtrip():
    user_id = uuid.uuid4()
    token = create_access_token(user_id, "owner")
    payload = decode_access_token(token)
    assert payload["sub"] == str(user_id)
    assert payload["role"] == "owner"


def test_tampered_token_rejected():
    token = create_access_token(uuid.uuid4(), "customer")
    tampered = token[:-4] + ("AAAA" if not token.endswith("AAAA") else "BBBB")
    with pytest.raises(InvalidTokenError):
        decode_access_token(tampered)


def test_expired_token_rejected():
    # Build a token that's already expired, bypassing the normal 15-minute
    # TTL — same secret/algorithm as the real thing, just a fabricated exp.
    from app.config import settings
    from app.modules.auth.security import JWT_ALGORITHM

    now = time_module.time()
    payload = {"sub": str(uuid.uuid4()), "role": "customer", "iat": now - 1000, "exp": now - 1}
    expired_token = jwt.encode(payload, settings.jwt_secret_key, algorithm=JWT_ALGORITHM)
    with pytest.raises(InvalidTokenError):
        decode_access_token(expired_token)


def test_token_signed_with_wrong_secret_rejected():
    payload = {"sub": str(uuid.uuid4()), "role": "owner", "iat": time_module.time(), "exp": time_module.time() + 900}
    forged = jwt.encode(payload, "not-the-real-secret", algorithm="HS256")
    with pytest.raises(InvalidTokenError):
        decode_access_token(forged)


def test_cors_validation_production_rejects_http():
    from app.config import Settings
    with pytest.raises(ValueError, match="must start with https://"):
        Settings(
            environment="production",
            jwt_secret_key="a" * 32,
            public_app_url="https://app.example.com",
            database_url="postgresql+asyncpg://user:pass@db.example.com:5432/proddb",
            cors_allowed_origins="http://frontend.example.com",
        )


def test_cors_validation_production_rejects_localhost():
    from app.config import Settings
    with pytest.raises(ValueError, match="must not contain localhost or 127.0.0.1"):
        Settings(
            environment="production",
            jwt_secret_key="a" * 32,
            public_app_url="https://app.example.com",
            database_url="postgresql+asyncpg://user:pass@db.example.com:5432/proddb",
            cors_allowed_origins="https://localhost:3000",
        )


def test_cors_validation_production_rejects_127_0_0_1():
    from app.config import Settings
    with pytest.raises(ValueError, match="must not contain localhost or 127.0.0.1"):
        Settings(
            environment="production",
            jwt_secret_key="a" * 32,
            public_app_url="https://app.example.com",
            database_url="postgresql+asyncpg://user:pass@db.example.com:5432/proddb",
            cors_allowed_origins="https://127.0.0.1:3000",
        )


def test_cors_validation_production_accepts_https_domains():
    from app.config import Settings
    s = Settings(
        environment="production",
        jwt_secret_key="a" * 32,
        public_app_url="https://app.example.com",
        database_url="postgresql+asyncpg://user:pass@db.example.com:5432/proddb",
        cors_allowed_origins="https://app.example.com,https://admin.example.com",
    )
    assert "https://app.example.com" in s.cors_allowed_origins


def test_production_database_url_validation():
    from app.config import Settings
    with pytest.raises(ValueError, match="DATABASE_URL must be explicitly set"):
        Settings(
            environment="production",
            jwt_secret_key="a" * 32,
            public_app_url="https://app.example.com",
            database_url="postgresql+asyncpg://groundbooking:devpassword@localhost:5432/groundbooking",
            cors_allowed_origins="https://app.example.com",
        )


"""
Settings, sourced entirely from environment variables / .env — never
hardcoded. TRD §7: "The current hardcoded SECRET_KEY = 'mysecretkey' and
plaintext DB credentials are the top-priority fix." This is that fix,
applied from the first line of the new backend rather than retrofitted.
"""
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://groundbooking:devpassword@localhost:5432/groundbooking"
    jwt_secret_key: str = "dev-only-not-for-production-CHANGE-ME"
    environment: str = "dev"

    @model_validator(mode="after")
    def validate_production_secrets(self) -> "Settings":
        if self.environment.lower() in ("prod", "production"):
            if self.jwt_secret_key == "dev-only-not-for-production-CHANGE-ME":
                raise ValueError(
                    "In production, JWT_SECRET_KEY must be explicitly set and cannot use the default dev secret."
                )
            if len(self.jwt_secret_key) < 32:
                raise ValueError(
                    "In production, JWT_SECRET_KEY must be at least 32 characters long."
                )
            # Validate DATABASE_URL in production: must be explicitly configured and not default dev db.
            if not self.database_url or self.database_url == "postgresql+asyncpg://groundbooking:devpassword@localhost:5432/groundbooking":
                raise ValueError(
                    "In production, DATABASE_URL must be explicitly set and cannot use the default dev database."
                )
            # Validate PUBLIC_APP_URL in production: must be HTTPS, must not be localhost.
            # Protects against silently generating localhost links in production.
            from urllib.parse import urlparse
            parsed = urlparse(self.public_app_url)
            if parsed.scheme != "https":
                raise ValueError(
                    "In production, PUBLIC_APP_URL must use HTTPS."
                )
            if parsed.hostname in ("localhost", "127.0.0.1", "0.0.0.0"):
                raise ValueError(
                    "In production, PUBLIC_APP_URL must not point at localhost."
                )
            # Validate CORS_ALLOWED_ORIGINS in production: must start with https:// and not contain localhost / 127.0.0.1
            origins = [o.strip() for o in self.cors_allowed_origins.split(",") if o.strip()]
            if not origins:
                raise ValueError(
                    "In production, CORS_ALLOWED_ORIGINS must be explicitly configured."
                )
            for origin in origins:
                if not origin.startswith("https://"):
                    raise ValueError(
                        f"In production, every CORS origin must start with https://: got '{origin}'"
                    )
                if "localhost" in origin or "127.0.0.1" in origin:
                    raise ValueError(
                        f"In production, CORS origins must not contain localhost or 127.0.0.1: got '{origin}'"
                    )
        return self

    storage_backend: str = "local"  # "local" or "s3"
    uploads_dir: str = "/tmp/groundkart-uploads"
    private_uploads_dir: str = "/tmp/groundkart-private-uploads"
    s3_bucket_name: str | None = None
    private_s3_bucket_name: str | None = None
    s3_endpoint_url: str | None = None
    s3_access_key_id: str | None = None
    s3_secret_access_key: str | None = None
    s3_region: str = "us-east-1"
    s3_public_base_url: str | None = None

    # CORS configuration: allow_credentials=True means this cannot be "*"
    # in production. Dev defaults include localhost and 127.0.0.1 on standard ports.
    cors_allowed_origins: str = (
        "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173"
    )
    cors_origin_regex: str | None = None

    # A real, necessary fix found while wiring the owner dashboard to real
    # data: LocalFileStorage (app/modules/storage/base.py) was returning
    # "local://{key}" as a venue image's URL — not a scheme any browser can
    # fetch, so an uploaded photo would save correctly but never actually
    # render anywhere it's displayed. This is what LocalFileStorage prefixes
    # onto the /uploads static mount (app/main.py) to produce a real,
    # fetchable URL instead. Change this to the real deployed origin outside
    # local dev; it is NOT meant to be the production answer to file storage
    # any more than LocalFileStorage itself is (see that module's docstring)
    # — it's what makes the dev/test storage path actually usable end to end.
    app_base_url: str = "http://localhost:8000"

    # The canonical public URL of the frontend application — used to
    # construct password-reset links that open the real GroundKart reset
    # page, NOT the backend API server. Deliberately separate from
    # app_base_url (which is the API/file-serving origin). In production
    # this must be HTTPS and must point at the actual deployed frontend
    # domain. The model_validator above enforces this in production.
    # Dev default: the Vite dev server port (3000, matching vite.config.ts).
    public_app_url: str = "http://localhost:3000"

    # A real gap found completing the Admin dashboard: hold_expires_at was
    # made *visible* to an admin (so a stale pending_payment booking could
    # be found and manually released via cancel-pending), but nothing ever
    # released one automatically — cancel_pending_booking's own docstring
    # already flagged this as still-missing (PHASE_C5_SUMMARY.md's
    # remaining-work list). This is that automation: how often the
    # background sweep (app/main.py's lifespan) checks for and releases
    # expired holds. 5 minutes is a reasonable default for a
    # booking_hold_duration_minutes measured in hours/days, not a
    # confirmed business number — same env-configurable treatment as the
    # other placeholders above.
    hold_sweep_interval_minutes: int = 5

settings = Settings()

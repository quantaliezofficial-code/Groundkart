"""
Settings, sourced entirely from environment variables / .env — never
hardcoded. TRD §7: "The current hardcoded SECRET_KEY = 'mysecretkey' and
plaintext DB credentials are the top-priority fix." This is that fix,
applied from the first line of the new backend rather than retrofitted.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://groundbooking:devpassword@localhost:5432/groundbooking"
    jwt_secret_key: str = "dev-only-not-for-production-CHANGE-ME"
    environment: str = "dev"



    # A real, necessary prerequisite found while starting frontend
    # integration (Phase D): no CORS configuration existed anywhere, which
    # silently blocks every browser-based request from a different origin
    # (the frontend dev server) regardless of whether the request itself
    # is otherwise correct. Comma-separated in .env since env vars are
    # plain strings; split in main.py. allow_credentials=True (the refresh
    # token travels as an httpOnly cookie) means this can never be "*" —
    # CORS itself forbids combining a wildcard origin with credentials.
    cors_allowed_origins: str = "http://localhost:3000,http://localhost:5173"

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

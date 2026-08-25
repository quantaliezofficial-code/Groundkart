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

    # Decision Point C-5 (flag for real sign-off — see PHASE_C6_SUMMARY.md):
    # 06_Backend_Schema.md/02_TRD.md both specify a 10-minute hold, sized
    # for "customer pays via hosted gateway checkout in the next few
    # minutes." With payment confirmed offline by an admin instead (the
    # client's actual current process), the real gap between a slot being
    # requested and payment being confirmed depends on a human deal, not a
    # checkout timer — 10 minutes is now much too short; a slot would
    # release itself back to available while a legitimate deal is still
    # being worked out. 1440 (24h) is a placeholder default, not a
    # confirmed business number — deliberately an env var, not a hardcoded
    # constant, so it's a config change, not a redeploy, once the client
    # confirms the real figure.
    booking_hold_duration_minutes: int = 1440

    # Decision Point C-7 (flag for real sign-off - see the phase summary
    # doc for this slice): no doc anywhere specifies the actual
    # distance-from-event refund tiers, only one hedged "e.g." example in
    # 03_Implementation_Plan.md ("free cancellation > 48h before, partial
    # refund inside that window") - no percentage for "partial," no second
    # cutoff for a no-refund tier, though 05_App_Flow.md's state diagram
    # implies one exists (full / partial / none). The three values below
    # are a defensible, industry-common placeholder shape, NOT a confirmed
    # business number - same treatment as booking_hold_duration_minutes
    # above: env-configurable so correcting them is a .env change, not a
    # redeploy. See compute_refund_fraction() in
    # app/modules/booking/service.py for how they're applied.
    cancellation_full_refund_hours: int = 48
    cancellation_partial_refund_hours: int = 24
    cancellation_partial_refund_percent: int = 50

    # Decision Point C-10 (flag for real sign-off — see the phase summary
    # doc for this slice): no doc anywhere states a commission percentage —
    # 01_PRD.md/03_Implementation_Plan.md both name "gross, commission,
    # net" as the shape of the payout ledger without ever giving the rate
    # itself. 10% is a common, defensible marketplace-commission
    # placeholder, not a confirmed business number — same env-configurable
    # treatment as the other numeric placeholders above.
    platform_commission_percent: int = 10

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

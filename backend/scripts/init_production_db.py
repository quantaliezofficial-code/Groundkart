#!/usr/bin/env python3
"""
Production Database Initializer for GroundKart
Executes all necessary steps when attaching a brand-new database in production:
1. Verifies database connection.
2. Executes Alembic schema migrations (`alembic upgrade head`).
3. Seeds essential static metadata (Categories, Space Types, System Configuration).
4. Ensures an initial SuperAdmin account exists.
5. Runs the production verification pre-flight suite.

Usage:
    python scripts/init_production_db.py [--non-interactive]
"""
import asyncio
import os
import secrets
import sys
from pathlib import Path
from urllib.parse import urlparse

# Ensure backend root is in sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from alembic.config import Config
from alembic import command
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.config import settings
from app.models.core import User, SystemConfiguration
from app.modules.auth.security import hash_password
from scripts.seed_categories_and_types import seed_db
from scripts.verify_production_readiness import verify_production


class Color:
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    CYAN = "\033[96m"
    BOLD = "\033[1m"
    RESET = "\033[0m"


async def ensure_system_configuration(session) -> None:
    """Ensure baseline system configuration exists (hold durations, refund tiers, commission)."""
    res = await session.execute(select(SystemConfiguration))
    config = res.scalar_one_or_none()
    if not config:
        print(f"  {Color.CYAN}[SEED]{Color.RESET} Initializing default system configuration...")
        new_config = SystemConfiguration(
            booking_hold_duration_minutes=settings.booking_hold_duration_minutes,
            booking_grace_period_hours=2,
            cancellation_full_refund_hours=settings.cancellation_full_refund_hours,
            cancellation_partial_refund_hours=settings.cancellation_partial_refund_hours,
            cancellation_partial_refund_percent=settings.cancellation_partial_refund_percent,
            platform_commission_percent=settings.platform_commission_percent,
            payout_holdback_days=0,
        )
        session.add(new_config)
        await session.commit()
        print(f"  {Color.GREEN}[DONE]{Color.RESET} System configuration initialized.")
    else:
        print(f"  {Color.GREEN}[OK]{Color.RESET} System configuration already present.")


async def ensure_admin_account(session) -> None:
    """Ensure at least one admin account exists."""
    res = await session.execute(
        select(User).where(User.role == "admin", User.deleted_at.is_(None)).limit(1)
    )
    admin = res.scalar_one_or_none()
    if admin:
        print(f"  {Color.GREEN}[OK]{Color.RESET} Admin account already exists: {admin.email} (Role: {admin.role})")
        return

    admin_email = os.environ.get("ADMIN_EMAIL", "").strip()
    admin_phone = os.environ.get("ADMIN_PHONE", "").strip()
    admin_password = os.environ.get("ADMIN_PASSWORD", "").strip()

    if not admin_email:
        admin_email = "admin@groundkart.com"
    if not admin_phone:
        admin_phone = "9999999999"

    generated_pw = False
    if not admin_password:
        admin_password = secrets.token_urlsafe(16)
        generated_pw = True

    print(f"  {Color.CYAN}[SEED]{Color.RESET} Creating initial SuperAdmin account ({admin_email})...")
    new_admin = User(
        name="Production Administrator",
        email=admin_email,
        phone=admin_phone,
        password_hash=hash_password(admin_password),
        role="admin",
        is_verified=True,
        must_change_password=generated_pw,
    )
    session.add(new_admin)
    await session.commit()
    print(f"  {Color.GREEN}[DONE]{Color.RESET} Admin created successfully!")
    print(f"\n{Color.BOLD}------------------------------------------------------{Color.RESET}")
    print(f"{Color.BOLD}   SUPERADMIN CREDENTIALS (SAVE IMMEDIATELY):         {Color.RESET}")
    print(f"   Email:    {admin_email}")
    print(f"   Phone:    {admin_phone}")
    print(f"   Password: {admin_password}")
    if generated_pw:
        print(f"   Note:     'must_change_password' is set to True. Change on first login.")
    print(f"{Color.BOLD}------------------------------------------------------\n{Color.RESET}")


def run_alembic_migrations():
    print(f"\n{Color.BOLD}Step 1: Running Alembic Migrations...{Color.RESET}")
    alembic_cfg = Config(str(backend_dir / "alembic.ini"))
    alembic_cfg.set_main_option("script_location", str(backend_dir / "alembic"))
    command.upgrade(alembic_cfg, "head")
    print(f"  {Color.GREEN}[DONE]{Color.RESET} Alembic migrations successfully applied to HEAD.")


async def init_database_async():
    # 2. Database connection & static seeds
    print(f"\n{Color.BOLD}Step 2: Seeding Static Metadata...{Color.RESET}")
    engine = create_async_engine(settings.database_url)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with session_factory() as session:
        # Categories & Types
        await seed_db(settings.database_url)
        print(f"  {Color.GREEN}[DONE]{Color.RESET} Standard categories, venue types, and use cases verified.")

        # System configuration
        await ensure_system_configuration(session)

        # Admin account
        print(f"\n{Color.BOLD}Step 3: Verifying Administrator Account...{Color.RESET}")
        await ensure_admin_account(session)

    await engine.dispose()

    # 4. Final verification
    print(f"\n{Color.BOLD}Step 4: Running Pre-Flight Verification Suite...{Color.RESET}")
    code = await verify_production()
    if code == 0:
        print(f"{Color.GREEN}{Color.BOLD}DATABASE INITIALIZATION COMPLETE: Attached database is ready!{Color.RESET}\n")
    else:
        print(f"{Color.YELLOW}Database initialized with warnings. Please review the output above.{Color.RESET}\n")


def main():
    print(f"\n{Color.BOLD}======================================================{Color.RESET}")
    print(f"{Color.BOLD}   GroundKart Production Database Initializer         {Color.RESET}")
    print(f"{Color.BOLD}======================================================{Color.RESET}")

    parsed = urlparse(settings.database_url)
    print(f"Target Database Host: {Color.CYAN}{parsed.hostname}{Color.RESET}, Database: {Color.CYAN}{parsed.path.lstrip('/')}{Color.RESET}")

    # 1. Run migrations (runs its own event loop)
    run_alembic_migrations()

    # 2. Run async seeding and pre-flight checks
    asyncio.run(init_database_async())


if __name__ == "__main__":
    main()

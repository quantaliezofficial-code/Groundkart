#!/usr/bin/env python3
"""
Production Readiness Verification Script for GroundKart
Checks environment secrets, database connection, Alembic migration state,
schema integrity, storage accessibility, and administrative setup before deploying.

Usage:
    python scripts/verify_production_readiness.py [--strict]
"""
import asyncio
import os
import sys
from pathlib import Path
from urllib.parse import urlparse

# Ensure backend root is in sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine

from app.config import settings


class TerminalColor:
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    CYAN = "\033[96m"
    BOLD = "\033[1m"
    RESET = "\033[0m"


def log_pass(message: str):
    print(f"  {TerminalColor.GREEN}[PASS]{TerminalColor.RESET} {message}")


def log_fail(message: str):
    print(f"  {TerminalColor.RED}[FAIL]{TerminalColor.RESET} {message}")


def log_warn(message: str):
    print(f"  {TerminalColor.YELLOW}[WARN]{TerminalColor.RESET} {message}")


def log_info(message: str):
    print(f"  {TerminalColor.CYAN}[INFO]{TerminalColor.RESET} {message}")


async def verify_production() -> int:
    is_strict = "--strict" in sys.argv
    failures = 0
    warnings = 0

    print(f"\n{TerminalColor.BOLD}======================================================{TerminalColor.RESET}")
    print(f"{TerminalColor.BOLD}   GroundKart Production Readiness Pre-Flight Check   {TerminalColor.RESET}")
    print(f"{TerminalColor.BOLD}======================================================{TerminalColor.RESET}\n")

    env = settings.environment.lower()
    is_prod = env in ("prod", "production")

    print(f"{TerminalColor.BOLD}1. Environment & Configuration Check{TerminalColor.RESET}")
    print(f"   Target Environment: {TerminalColor.CYAN}{settings.environment}{TerminalColor.RESET}")

    # 1.1 JWT Secret Key
    jwt_secret = settings.jwt_secret_key
    if jwt_secret == "dev-only-not-for-production-CHANGE-ME":
        if is_prod or is_strict:
            log_fail("JWT_SECRET_KEY is using the insecure dev placeholder secret.")
            failures += 1
        else:
            log_warn("JWT_SECRET_KEY is using dev default. (Must be changed for production).")
            warnings += 1
    elif len(jwt_secret) < 32:
        log_fail(f"JWT_SECRET_KEY is too short ({len(jwt_secret)} chars). Must be at least 32 characters.")
        failures += 1
    else:
        log_pass(f"JWT_SECRET_KEY is securely configured ({len(jwt_secret)} chars).")

    # 1.2 Public App URL
    parsed_pub = urlparse(settings.public_app_url)
    if is_prod or is_strict:
        if parsed_pub.scheme != "https":
            log_fail(f"PUBLIC_APP_URL must use HTTPS in production (current: {settings.public_app_url})")
            failures += 1
        elif parsed_pub.hostname in ("localhost", "127.0.0.1", "0.0.0.0"):
            log_fail(f"PUBLIC_APP_URL points to localhost in production: {settings.public_app_url}")
            failures += 1
        else:
            log_pass(f"PUBLIC_APP_URL is configured for HTTPS: {settings.public_app_url}")
    else:
        log_pass(f"PUBLIC_APP_URL: {settings.public_app_url} (development mode)")

    # 1.3 CORS Allowed Origins
    origins = [o.strip() for o in settings.cors_allowed_origins.split(",") if o.strip()]
    if is_prod or is_strict:
        cors_err = False
        for o in origins:
            if not o.startswith("https://") or "localhost" in o or "127.0.0.1" in o:
                cors_err = True
                log_fail(f"Invalid production CORS origin: '{o}' (Must use HTTPS and cannot be localhost)")
                failures += 1
        if not cors_err:
            log_pass(f"CORS origins configured securely ({len(origins)} HTTPS origin(s)).")
    else:
        log_pass(f"CORS origins configured ({len(origins)} origin(s)).")

    print(f"\n{TerminalColor.BOLD}2. Database Connectivity & Migration Check{TerminalColor.RESET}")
    # 2.1 Database URL
    parsed_db = urlparse(settings.database_url)
    db_host = parsed_db.hostname or ""
    db_name = parsed_db.path.lstrip("/")
    if is_prod and db_host in ("localhost", "127.0.0.1"):
        log_warn(f"DATABASE_URL points to localhost ({db_host}). Ensure you attach your production managed database.")
        warnings += 1
    else:
        log_pass(f"DATABASE_URL target host: {db_host}, database: {db_name}")

    engine = None
    try:
        engine = create_async_engine(settings.database_url, pool_pre_ping=True)
        async with engine.connect() as conn:
            # 2.2 Live Ping
            await conn.execute(select(1))
            log_pass("Database connection established successfully.")

            # 2.3 Check Alembic migration table
            res = await conn.execute(
                text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'alembic_version';")
            )
            has_alembic = bool(res.scalar())
            if not has_alembic:
                log_fail("Table 'alembic_version' is MISSING! The database has not been initialized. Run 'alembic upgrade head'.")
                failures += 1
            else:
                log_pass("Table 'alembic_version' exists.")

                # Check current revision vs repo head
                cur_res = await conn.execute(text("SELECT version_num FROM alembic_version;"))
                current_rev = cur_res.scalar()

                alembic_cfg = Config(str(backend_dir / "alembic.ini"))
                alembic_cfg.set_main_option("script_location", str(backend_dir / "alembic"))
                script = ScriptDirectory.from_config(alembic_cfg)
                head_rev = script.get_current_head()

                if current_rev == head_rev:
                    log_pass(f"Database schema is at latest Alembic HEAD revision: {current_rev}")
                else:
                    log_fail(f"Database schema is OUTDATED! Current: {current_rev}, Head: {head_rev}. Run 'alembic upgrade head'.")
                    failures += 1

            # 2.4 Check Core Required Tables
            required_tables = [
                "users", "venues", "bookings", "inventory_units", "payments",
                "payouts", "refunds", "reviews", "venue_media", "venue_amenities",
                "categories", "venue_types", "system_configuration", "audit_logs"
            ]
            res_tables = await conn.execute(
                text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';")
            )
            existing_tables = {row[0] for row in res_tables.fetchall()}
            missing_tables = set(required_tables) - existing_tables

            if missing_tables:
                log_fail(f"Missing core database tables: {sorted(list(missing_tables))}")
                failures += 1
            else:
                log_pass(f"All {len(required_tables)} core schema tables verified.")

            # 2.5 Admin Account Check
            admin_res = await conn.execute(
                text("SELECT count(*) FROM users WHERE role = 'admin' AND deleted_at IS NULL;")
            )
            admin_count = admin_res.scalar() or 0
            if admin_count == 0:
                log_fail("No active Administrator accounts found in the database. Run 'python scripts/admin_setup.py' to create an admin.")
                failures += 1
            else:
                log_pass(f"Administrator account(s) present ({admin_count} active admin(s)).")

            # 2.6 System Configuration Check
            sys_config = await conn.execute(
                text("SELECT count(*) FROM system_configuration;")
            )
            if (sys_config.scalar() or 0) == 0:
                log_warn("Table 'system_configuration' has no rows. Baseline configuration should be seeded.")
                warnings += 1
            else:
                log_pass("System configuration record initialized.")

    except Exception as exc:
        log_fail(f"Could not connect to database: {exc}")
        failures += 1
    finally:
        if engine:
            await engine.dispose()

    print(f"\n{TerminalColor.BOLD}3. Storage & Uploads Check{TerminalColor.RESET}")
    storage_backend = settings.storage_backend.lower()
    log_info(f"Storage backend: {storage_backend}")

    if storage_backend == "s3":
        if not settings.s3_bucket_name:
            log_fail("STORAGE_BACKEND is 's3' but S3_BUCKET_NAME is not set.")
            failures += 1
        elif not settings.s3_access_key_id or not settings.s3_secret_access_key:
            log_fail("STORAGE_BACKEND is 's3' but AWS credentials are missing.")
            failures += 1
        else:
            log_pass(f"S3 configuration verified (Bucket: {settings.s3_bucket_name}, Region: {settings.s3_region}).")
    elif storage_backend == "local":
        uploads_dir = Path(settings.uploads_dir).resolve()
        private_uploads_dir = Path(settings.private_uploads_dir).resolve()

        if is_prod and (settings.uploads_dir.startswith("/tmp") or settings.uploads_dir.startswith("\\tmp")):
            log_warn(
                f"UPLOADS_DIR is set to a temporary folder ('{settings.uploads_dir}'). "
                f"On production containers or multiple server instances, temporary folders are wiped on restart. "
                f"Mount a persistent volume or configure S3."
            )
            warnings += 1

        try:
            uploads_dir.mkdir(parents=True, exist_ok=True)
            test_file = uploads_dir / ".prod_readiness_test"
            test_file.write_text("write_test")
            test_file.unlink()
            log_pass(f"Public uploads directory writable: {uploads_dir}")
        except Exception as e:
            log_fail(f"Public uploads directory not writable ({uploads_dir}): {e}")
            failures += 1

        try:
            private_uploads_dir.mkdir(parents=True, exist_ok=True)
            test_priv = private_uploads_dir / ".prod_readiness_test"
            test_priv.write_text("write_test")
            test_priv.unlink()
            log_pass(f"Private uploads directory writable: {private_uploads_dir}")
        except Exception as e:
            log_fail(f"Private uploads directory not writable ({private_uploads_dir}): {e}")
            failures += 1

    print(f"\n{TerminalColor.BOLD}======================================================{TerminalColor.RESET}")
    if failures == 0:
        print(f"{TerminalColor.GREEN}{TerminalColor.BOLD}READY FOR PRODUCTION: All {TerminalColor.RESET}{TerminalColor.GREEN}critical checks passed!{TerminalColor.RESET}")
        if warnings > 0:
            print(f"{TerminalColor.YELLOW}Found {warnings} non-blocking warning(s). Review recommendations above.{TerminalColor.RESET}")
        print(f"{TerminalColor.BOLD}======================================================{TerminalColor.RESET}\n")
        return 0
    else:
        print(f"{TerminalColor.RED}{TerminalColor.BOLD}NOT READY FOR PRODUCTION: {failures} critical check(s) failed.{TerminalColor.RESET}")
        print(f"Please address the failures above before attaching this database to production.")
        print(f"{TerminalColor.BOLD}======================================================{TerminalColor.RESET}\n")
        return 1


if __name__ == "__main__":
    code = asyncio.run(verify_production())
    sys.exit(code)

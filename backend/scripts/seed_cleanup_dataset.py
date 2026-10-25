import argparse
import asyncio
import os
import sys
from urllib.parse import urlparse

# Ensure backend directory is in sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.config import settings
from app.db import SessionLocal, engine
from sqlalchemy import select, delete, text, or_
from app.models.core import (
    User, Venue, InventoryUnit, Booking, BookingEvent, BookingActionRequest,
    Payment, Refund, Review, VenueMedia, VenueContentBlock, VenueRentalOption,
    VenuePurpose, PricingRule, HomepagePlacement, OwnerVerification,
    OwnerBankAccount, Payout, RefreshToken, LoginRateLimit, Block,
    AuditLog, venue_amenities, venue_use_cases
)

def check_dev_guard(yes_this_is_dev: bool):
    if not yes_this_is_dev:
        sys.exit("ABORT: Cleanup script requires explicit '--yes-this-is-dev' flag.")

    env = settings.environment.lower()
    if env in ("prod", "production"):
        sys.exit(f"ABORT: Refusing to run cleanup in production environment (ENVIRONMENT={settings.environment}).")

    parsed = urlparse(settings.database_url)
    host = parsed.hostname or ""
    allowed_hosts = {"localhost", "127.0.0.1", "db", "postgres", "host.docker.internal"}
    if host not in allowed_hosts and not host.endswith(".local"):
        sys.exit(f"ABORT: Target database host '{host}' is not a local/dev host. Aborting.")

    # Mask password for display
    netloc = parsed.netloc
    if "@" in netloc and ":" in netloc.split("@")[0]:
        user_part, rest = netloc.split("@", 1)
        username = user_part.split(":")[0]
        netloc = f"{username}:****@{rest}"
    target_display = f"{parsed.scheme}://{netloc}{parsed.path}"
    print(f"[GUARD] Environment: {settings.environment}")
    print(f"[GUARD] Database Target: {target_display}")

async def cleanup_demo_data(dry_run: bool = False, include_admin: bool = False):
    print(f"\n{'[DRY-RUN] ' if dry_run else ''}Starting GroundKart seed data cleanup...")

    async with SessionLocal() as session:
        async with session.begin():
            # 1. Identify demo users
            query = select(User).where(
                (User.email.ilike("%@groundkart.demo")) |
                (User.phone.like("900001%")) |
                (User.phone.like("900002%"))
            )
            if not include_admin:
                query = query.where(User.role != "admin")

            users_res = await session.execute(query)
            demo_users = users_res.scalars().all()
            demo_user_ids = [u.id for u in demo_users]
            demo_emails = [u.email for u in demo_users if u.email]
            demo_phones = [u.phone for u in demo_users if u.phone]

            print(f"Found {len(demo_users)} demo users (owners/customers).")

            # 2. Identify demo venues owned by demo users or from dataset
            venues_res = await session.execute(
                select(Venue).where(
                    (Venue.owner_id.in_(demo_user_ids)) if demo_user_ids else text("false")
                )
            )
            demo_venues = venues_res.scalars().all()
            demo_venue_ids = [v.id for v in demo_venues]
            print(f"Found {len(demo_venues)} demo venues.")

            # 3. Identify guest bookings or bookings by demo users or on demo venues
            guest_emails = ["rakesh.gupta@groundkart.demo"]
            booking_conds = [Booking.guest_email.in_(guest_emails)]
            if demo_user_ids:
                booking_conds.append(Booking.customer_id.in_(demo_user_ids))
            if demo_venue_ids:
                booking_conds.append(Booking.venue_id.in_(demo_venue_ids))
            bookings_res = await session.execute(select(Booking).where(or_(*booking_conds)))
            demo_bookings = bookings_res.scalars().all()
            demo_booking_ids = [b.id for b in demo_bookings]
            print(f"Found {len(demo_bookings)} demo bookings.")

            if dry_run:
                print("\n[DRY RUN SUMMARY]")
                print(f"  Users to delete: {len(demo_users)}")
                print(f"  Venues to delete: {len(demo_venues)}")
                print(f"  Bookings to delete: {len(demo_bookings)}")
                return

            # Execute deletes in reverse FK dependency order
            if demo_booking_ids:
                await session.execute(delete(Refund).where(Refund.booking_id.in_(demo_booking_ids)))
                await session.execute(delete(Payment).where(Payment.booking_id.in_(demo_booking_ids)))
                await session.execute(delete(BookingActionRequest).where(BookingActionRequest.booking_id.in_(demo_booking_ids)))
                await session.execute(delete(BookingEvent).where(BookingEvent.booking_id.in_(demo_booking_ids)))
                await session.execute(delete(Booking).where(Booking.id.in_(demo_booking_ids)))
                print(f"Deleted {len(demo_booking_ids)} bookings and related financial/event records.")

            if demo_venue_ids:
                await session.execute(delete(HomepagePlacement).where(HomepagePlacement.venue_id.in_(demo_venue_ids)))
                await session.execute(delete(PricingRule).where(PricingRule.venue_id.in_(demo_venue_ids)))
                await session.execute(delete(VenueRentalOption).where(VenueRentalOption.venue_id.in_(demo_venue_ids)))
                await session.execute(delete(VenuePurpose).where(VenuePurpose.venue_id.in_(demo_venue_ids)))
                await session.execute(delete(VenueContentBlock).where(VenueContentBlock.venue_id.in_(demo_venue_ids)))
                await session.execute(delete(VenueMedia).where(VenueMedia.venue_id.in_(demo_venue_ids)))
                await session.execute(delete(Review).where(Review.venue_id.in_(demo_venue_ids)))
                await session.execute(delete(Block).where(Block.venue_id.in_(demo_venue_ids)))
                await session.execute(delete(InventoryUnit).where(InventoryUnit.venue_id.in_(demo_venue_ids)))
                await session.execute(text("DELETE FROM venue_amenities WHERE venue_id = ANY(:vids)"), {"vids": demo_venue_ids})
                await session.execute(text("DELETE FROM venue_use_cases WHERE venue_id = ANY(:vids)"), {"vids": demo_venue_ids})
                await session.execute(delete(Venue).where(Venue.id.in_(demo_venue_ids)))
                print(f"Deleted {len(demo_venue_ids)} venues and associated child entities.")

            if demo_user_ids:
                # Any remaining reviews by demo users
                await session.execute(delete(Review).where(Review.user_id.in_(demo_user_ids)))
                await session.execute(delete(OwnerVerification).where(OwnerVerification.user_id.in_(demo_user_ids)))
                await session.execute(delete(OwnerBankAccount).where(OwnerBankAccount.owner_id.in_(demo_user_ids)))
                await session.execute(delete(Payout).where(Payout.owner_id.in_(demo_user_ids)))
                await session.execute(delete(RefreshToken).where(RefreshToken.user_id.in_(demo_user_ids)))
                # Clean login rate limit keys for demo users
                await session.execute(
                    delete(LoginRateLimit).where(
                        or_(
                            LoginRateLimit.key.like("%groundkart.demo%"),
                            LoginRateLimit.key.like("%900001%"),
                            LoginRateLimit.key.like("%900002%"),
                            LoginRateLimit.key.like("%900003%"),
                        )
                    )
                )
                await session.execute(delete(User).where(User.id.in_(demo_user_ids)))
                print(f"Deleted {len(demo_user_ids)} users and their credentials/tokens/verifications.")

    await engine.dispose()
    print("Cleanup completed successfully.")

def main():
    parser = argparse.ArgumentParser(description="Cleanup GroundKart demo seed data.")
    parser.add_argument("--yes-this-is-dev", action="store_true", required=True, help="Explicit confirmation of dev environment")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be deleted without mutating")
    parser.add_argument("--include-admin", action="store_true", help="Also delete demo admin if using @groundkart.demo")
    args = parser.parse_args()

    check_dev_guard(args.yes_this_is_dev)
    asyncio.run(cleanup_demo_data(dry_run=args.dry_run, include_admin=args.include_admin))

if __name__ == "__main__":
    main()

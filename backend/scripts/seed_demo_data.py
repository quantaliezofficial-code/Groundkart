"""
Seeds a handful of realistic, active venues with real availability into
the dev database, so the app isn't empty the first time someone actually
opens it against real data. Dev-only — never run against a database that
matters. Idempotent-ish: safe to re-run, just creates more data each time
(no uniqueness assumptions beyond what the schema itself enforces, e.g.
distinct slugs via a random suffix).
"""
import asyncio
import uuid
from datetime import date, time, timedelta
from decimal import Decimal

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.config import settings
from app.models.core import InventoryUnit, User, Venue
from app.modules.auth.security import hash_password

VENUES = [
    dict(
        name="The Grand Turf Arena", category="sports", unit_type="hour",
        city="Lucknow", address="Gomti Nagar Extension, Sector 5", base_price=Decimal("1800.00"),
        description="A full-size FIFA-certified turf with floodlights, built for evening five-a-side leagues and weekend tournaments alike.",
        capacity=22,
    ),
    dict(
        name="Skyline Tennis Courts", category="sports", unit_type="hour",
        city="Lucknow", address="Hazratganj, Near Kaiserbagh", base_price=Decimal("900.00"),
        description="Two hard courts with night lighting, a short walk from the metro.",
        capacity=8,
    ),
    dict(
        name="The Grand Setu Hall", category="banquet_hall", unit_type="full_day",
        city="Lucknow", address="Vibhuti Khand, Gomti Nagar", base_price=Decimal("85000.00"),
        description="A 400-guest banquet hall with an in-house catering kitchen and dedicated parking for 60 cars.",
        capacity=400,
    ),
    dict(
        name="Riverside Farmhouse", category="farmhouse", unit_type="full_day",
        city="Lucknow", address="Kursi Road, near Gomti Barrage", base_price=Decimal("45000.00"),
        description="A green, riverside farmhouse for weddings, sangeet nights, and corporate offsites.",
        capacity=250,
    ),
    dict(
        name="Metropolis Conference Hub", category="corporate", unit_type="half_day",
        city="Lucknow", address="Vipin Khand, Gomti Nagar", base_price=Decimal("12000.00"),
        description="A fully wired conference space with a 40-seat boardroom and breakout rooms.",
        capacity=60,
    ),
]


async def main() -> None:
    engine = create_async_engine(settings.database_url)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with session_factory() as session:
        async with session.begin():
            for v in VENUES:
                owner = User(
                    name=f"{v['name']} Team",
                    email=f"owner-{uuid.uuid4().hex[:8]}@groundbooking.demo",
                    password_hash=hash_password("demo-password-not-real"),
                    role="owner",
                    is_verified=True,
                )
                session.add(owner)
                await session.flush()

                venue = Venue(
                    owner_id=owner.id,
                    name=v["name"],
                    slug=f"{v['name'].lower().replace(' ', '-')}-{uuid.uuid4().hex[:6]}",
                    category=v["category"],
                    description=v["description"],
                    address=v["address"],
                    city=v["city"],
                    state="Uttar Pradesh",
                    pincode="226010",
                    capacity=v["capacity"],
                    unit_type=v["unit_type"],
                    base_price=v["base_price"],
                    status="active",
                )
                session.add(venue)
                await session.flush()

                today = date.today()
                if v["unit_type"] == "hour":
                    for day_offset in range(1, 15):
                        d = today + timedelta(days=day_offset)
                        for hour in (18, 19, 20, 21):
                            session.add(InventoryUnit(
                                venue_id=venue.id, date=d, start_time=time(hour, 0), end_time=time(hour + 1, 0),
                                price=v["base_price"], status="available",
                            ))
                else:
                    for day_offset in range(1, 60, 3):
                        d = today + timedelta(days=day_offset)
                        session.add(InventoryUnit(
                            venue_id=venue.id, date=d, start_time=None, end_time=None,
                            price=v["base_price"], status="available",
                        ))

    await engine.dispose()
    print(f"Seeded {len(VENUES)} venues with real availability.")


if __name__ == "__main__":
    asyncio.run(main())

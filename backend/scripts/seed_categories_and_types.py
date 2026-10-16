"""
Idempotent script to seed comprehensive, generalized categories, venue types,
and use cases for GroundBooking across both dev and test databases.
"""
import asyncio
import os
import uuid
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

CATEGORIES_DATA = [
    {
        "name": "Sports & Fitness",
        "types": [
            "Football Turf",
            "Cricket Ground & Nets",
            "Badminton Court",
            "Tennis Court",
            "Swimming Pool",
            "Basketball Court",
            "Gym & Fitness Studio",
            "Box Cricket",
            "Pickleball Court",
            "Multi-Sport Arena",
        ],
    },
    {
        "name": "Weddings & Celebrations",
        "types": [
            "Banquet Hall",
            "Party Lawn & Garden",
            "Farmhouse",
            "Marriage Palace / Resort",
            "Luxury Villa",
            "Rooftop & Terrace Lounge",
            "Ballroom",
            "Poolside Venue",
            "Community Hall",
        ],
    },
    {
        "name": "Corporate & Professional",
        "types": [
            "Meeting Room",
            "Conference Center",
            "Training & Seminar Hall",
            "Co-working Event Space",
            "Auditorium",
            "Executive Boardroom",
        ],
    },
    {
        "name": "Shoots & Creative Spaces",
        "types": [
            "Photography Studio",
            "Film & Video Set",
            "Art Gallery & Exhibition Hall",
            "Podcast & Audio Studio",
            "Vintage / Heritage Space",
        ],
    },
    {
        "name": "Social & Community",
        "types": [
            "Community Center",
            "Clubhouse",
            "Amphitheatre",
            "Dining & Banquet Space",
        ],
    },
]

USE_CASES_DATA = [
    "Weddings & Receptions",
    "Birthday & Private Parties",
    "Corporate Meetings & Conferences",
    "Sports Matches & Tournaments",
    "Photo & Video Shoots",
    "Workshops & Seminars",
    "Live Performances & Concerts",
    "Exhibitions & Pop-ups",
    "Casual Games & Fitness",
    "Dinners & Social Mixers",
    "Wedding",
    "Meeting",
    "Casual Game",
]

async def seed_db(db_url: str):
    print(f"Seeding database at {db_url}...")
    engine = create_async_engine(db_url)
    async with engine.begin() as conn:
        for cat_info in CATEGORIES_DATA:
            cat_name = cat_info["name"]
            # Insert or get category
            await conn.execute(
                text("INSERT INTO categories (id, name) VALUES (gen_random_uuid(), :name) ON CONFLICT (name) DO NOTHING"),
                {"name": cat_name}
            )
            cat_row = (await conn.execute(text("SELECT id FROM categories WHERE name = :name"), {"name": cat_name})).fetchone()
            if cat_row:
                cat_id = cat_row[0]
                for vt_name in cat_info["types"]:
                    # check if venue type exists for this category
                    vt_row = (await conn.execute(
                        text("SELECT id FROM venue_types WHERE category_id = :cat_id AND name = :name"),
                        {"cat_id": cat_id, "name": vt_name}
                    )).fetchone()
                    if not vt_row:
                        await conn.execute(
                            text("INSERT INTO venue_types (id, category_id, name) VALUES (gen_random_uuid(), :cat_id, :name)"),
                            {"cat_id": cat_id, "name": vt_name}
                        )

        # Also support legacy category names if needed
        await conn.execute(text("INSERT INTO categories (id, name) VALUES (gen_random_uuid(), 'Weddings & Events') ON CONFLICT (name) DO NOTHING"))
        await conn.execute(text("INSERT INTO categories (id, name) VALUES (gen_random_uuid(), 'Corporate') ON CONFLICT (name) DO NOTHING"))

        for uc_name in USE_CASES_DATA:
            await conn.execute(
                text("INSERT INTO use_cases (id, name) VALUES (gen_random_uuid(), :name) ON CONFLICT (name) DO NOTHING"),
                {"name": uc_name}
            )
    await engine.dispose()
    print(f"Finished seeding {db_url}")

async def main():
    dev_url = os.environ.get("DATABASE_URL", "postgresql+asyncpg://groundbooking:devpassword@localhost:5432/groundbooking")
    test_url = "postgresql+asyncpg://groundbooking:devpassword@localhost:5432/groundbooking_test"
    try:
        await seed_db(dev_url)
    except Exception as e:
        print(f"Error seeding dev db: {e}")
    try:
        await seed_db(test_url)
    except Exception as e:
        print(f"Error seeding test db: {e}")

if __name__ == "__main__":
    asyncio.run(main())

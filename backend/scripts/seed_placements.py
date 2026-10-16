import asyncio
from app.db import SessionLocal
from sqlalchemy import text

async def main():
    async with SessionLocal() as db:
        res = await db.execute(text("SELECT id FROM venues WHERE status = 'active'"))
        venues = res.fetchall()
        if not venues: return
        await db.execute(text("DELETE FROM homepage_placements"))
        await db.execute(text("""
            INSERT INTO homepage_placements (venue_id, section, enabled, priority, badge)
            VALUES (:v_id, 'featured', true, 0, 'Top Pick')
        """), {'v_id': venues[0][0]})
        for i in range(1, min(5, len(venues))):
            await db.execute(text("""
                INSERT INTO homepage_placements (venue_id, section, enabled, priority)
                VALUES (:v_id, 'trending', true, :p)
            """), {'v_id': venues[i][0], 'p': i-1})
        await db.commit()
        print('Seeded placements successfully!')

asyncio.run(main())

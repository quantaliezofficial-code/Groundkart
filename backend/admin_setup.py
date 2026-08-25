import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.models.core import User
from app.modules.auth.security import hash_password

async def main():
    engine = create_async_engine('postgresql+asyncpg://groundbooking:devpassword@localhost:5432/groundbooking')
    Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as session:
        async with session.begin():
            admin = User(
                name='Admin',
                email='admin@example.com',
                phone='1234567890',
                password_hash=hash_password('changeme123'),
                role='admin',
            )
            session.add(admin)
    print('Admin account created: admin@example.com / changeme123')

asyncio.run(main())

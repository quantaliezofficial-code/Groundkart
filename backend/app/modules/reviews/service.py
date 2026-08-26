import uuid
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.core import Review, Venue


async def create_review(
    session: AsyncSession,
    venue_id: uuid.UUID,
    user_id: uuid.UUID,
    rating: int,
    content: str,
) -> Review:
    """Creates a review, recalculates the venue average rating, and returns the Review."""
    # Verify venue exists and is active (anyone browsing can only see active venues)
    venue_result = await session.execute(select(Venue).where(Venue.id == venue_id, Venue.deleted_at.is_(None)))
    venue = venue_result.scalar_one_or_none()
    if venue is None:
        raise HTTPException(status_code=404, detail="Venue not found.")

    review = Review(
        venue_id=venue_id,
        user_id=user_id,
        rating=rating,
        content=content,
    )
    session.add(review)
    await session.flush()  # get review.id before the avg query

    # Recalculate avg_rating on venue
    avg_result = await session.execute(
        select(func.avg(Review.rating)).where(Review.venue_id == venue_id)
    )
    new_avg = avg_result.scalar() or Decimal("0")
    venue.avg_rating = round(Decimal(str(new_avg)), 2)

    await session.commit()
    await session.refresh(review)

    # eager-load user so we can fill user_name
    result = await session.execute(
        select(Review).where(Review.id == review.id).options(selectinload(Review.user))
    )
    return result.scalar_one()


async def list_reviews(
    session: AsyncSession,
    venue_id: uuid.UUID,
    limit: int = 20,
    offset: int = 0,
) -> list[Review]:
    """Lists reviews for a specific venue."""
    result = await session.execute(
        select(Review)
        .where(Review.venue_id == venue_id)
        .options(selectinload(Review.user))
        .order_by(Review.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(result.scalars().all())


async def delete_review(
    session: AsyncSession,
    review_id: uuid.UUID,
    admin_id: uuid.UUID,
) -> None:
    """Admin-only review moderation endpoint. Recalculates venue avg_rating after deletion."""
    result = await session.execute(
        select(Review).where(Review.id == review_id).options(selectinload(Review.venue))
    )
    review = result.scalar_one_or_none()
    if review is None:
        raise HTTPException(status_code=404, detail="Review not found.")

    venue_id = review.venue_id
    await session.execute(delete(Review).where(Review.id == review_id))

    # Recalculate avg_rating after deletion
    avg_result = await session.execute(
        select(func.avg(Review.rating)).where(Review.venue_id == venue_id)
    )
    new_avg = avg_result.scalar() or Decimal("0")
    venue_result = await session.execute(select(Venue).where(Venue.id == venue_id))
    venue = venue_result.scalar_one_or_none()
    if venue:
        venue.avg_rating = round(Decimal(str(new_avg)), 2)

    await session.commit()


async def list_all_reviews_admin(
    session: AsyncSession,
    venue_id: uuid.UUID | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Review]:
    """Admin-only endpoint to fetch all reviews globally, optionally filtered by venue."""
    stmt = select(Review).options(selectinload(Review.user), selectinload(Review.venue))
    if venue_id:
        stmt = stmt.where(Review.venue_id == venue_id)
    stmt = stmt.order_by(Review.created_at.desc()).limit(limit).offset(offset)
    
    result = await session.execute(stmt)
    return list(result.scalars().all())

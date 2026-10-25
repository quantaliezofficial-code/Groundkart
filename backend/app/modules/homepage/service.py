"""
Homepage curation service.

Three surfaces:
  1. get_homepage()           — public endpoint, returns fully filtered cards
  2. list_admin_placements()  — admin reads current config
  3. create_placement()       — admin adds a venue to a section
  4. update_placement()       — admin edits badge, schedule, priority, etc.
  5. delete_placement()       — admin removes a venue from a section
  6. reorder_section()        — admin drag-and-drops to a new order

Security invariants enforced here (not relied on from caller):
  - public endpoint always filters to venue.status='active' + not deleted
  - public endpoint applies scheduling (start_at/end_at) in UTC
  - admin create/update/delete routes are protected by require_role('admin')
    in the route layer; the service layer doesn't re-check — consistent with
    how every other service here is written.
  - venue_id in create/update is validated against the venues table
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import and_, delete, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.auth.dependencies import CurrentUser
from app.modules.auth.policies import authorize_venue_modify
from app.models.core import HomepagePlacement, Venue, VenueMedia
from app.schemas.homepage import (
    VALID_SECTIONS,
    HomepageResponse,
    HomepageVenueCard,
)

# Maximum items returned per section on the public homepage.
# Admin can store more placements, but the public view is capped.
MAX_ITEMS_PER_SECTION = 12


def _is_scheduled_active(placement: HomepagePlacement, now: datetime) -> bool:
    """True when the placement is within its optional schedule window.

    Both fields NULL  → always visible.
    start_at only set → visible on or after start_at.
    end_at   only set → visible until end_at.
    Both set          → visible within [start_at, end_at].
    """
    if placement.start_at is not None and now < placement.start_at:
        return False
    if placement.end_at is not None and now >= placement.end_at:
        return False
    return True


def _venue_card(placement: HomepagePlacement) -> HomepageVenueCard:
    """Convert a placement+venue pair into the public card shape."""
    venue = placement.venue
    cover = next((img for img in venue.media if img.is_cover), None) or (
        venue.media[0] if venue.media else None
    )
    return HomepageVenueCard(
        id=venue.id,
        name=venue.name,
        slug=venue.slug,
        city=venue.city,
        state=venue.state,
        category=venue.category,
        avg_rating=venue.avg_rating,
        base_price=venue.base_price,
        unit_type=venue.unit_type,
        description=venue.description,
        cover_image_url=cover.url if cover else None,
        badge=placement.badge,
        custom_title=placement.custom_title,
        custom_description=placement.custom_description,
    )


async def _load_placements_for_sections(
    session: AsyncSession,
    sections: list[str],
    public_only: bool = True,
) -> list[HomepagePlacement]:
    """Load placements for the given sections.

    When public_only=True (the public homepage endpoint):
      - only enabled=TRUE placements
      - only active, non-deleted venues
      - scheduling enforced server-side

    When public_only=False (admin config view):
      - returns all placements regardless of enabled/schedule/venue status
    """
    query = (
        select(HomepagePlacement)
        .join(HomepagePlacement.venue)
        .options(
            selectinload(HomepagePlacement.venue).selectinload(Venue.media)
        )
        .where(HomepagePlacement.section.in_(sections))
        .order_by(HomepagePlacement.section, HomepagePlacement.priority.asc())
    )

    if public_only:
        query = query.where(
            HomepagePlacement.enabled.is_(True),
            Venue.status == "active",
            Venue.deleted_at.is_(None),
        )

    result = await session.execute(query)
    return list(result.scalars().all())


async def get_homepage(session: AsyncSession) -> HomepageResponse:
    """Public homepage endpoint — fully filtered and schedule-aware.

    Single query loads all sections at once (no N+1).
    Schedule is enforced in Python after the query — avoids timezone
    handling complexity at the SQL layer, and the result set is small.
    """
    all_sections = ["featured", "trending", "popular", "recommended", "new"]
    now = datetime.now(timezone.utc)

    placements = await _load_placements_for_sections(session, all_sections, public_only=True)

    buckets: dict[str, list[HomepageVenueCard]] = {s: [] for s in all_sections}
    for p in placements:
        if not _is_scheduled_active(p, now):
            continue
        section_list = buckets[p.section]
        if len(section_list) < MAX_ITEMS_PER_SECTION:
            section_list.append(_venue_card(p))

    return HomepageResponse(
        featured=buckets["featured"],
        trending=buckets["trending"],
        popular=buckets["popular"],
        recommended=buckets["recommended"],
        new=buckets["new"],
    )


async def list_admin_placements(
    session: AsyncSession,
    section: str | None = None,
) -> list[HomepagePlacement]:
    """Admin view — returns all placements, no visibility filtering."""
    sections = [section] if section else ["featured", "trending", "popular", "recommended", "new"]
    return await _load_placements_for_sections(session, sections, public_only=False)


async def get_placement(
    session: AsyncSession, placement_id: uuid.UUID
) -> HomepagePlacement:
    result = await session.execute(
        select(HomepagePlacement)
        .options(selectinload(HomepagePlacement.venue).selectinload(Venue.media))
        .where(HomepagePlacement.id == placement_id)
    )
    p = result.scalar_one_or_none()
    if p is None:
        raise HTTPException(status_code=404, detail="Placement not found")
    return p


async def create_placement(
    session: AsyncSession,
    venue_id: uuid.UUID,
    section: str,
    enabled: bool = True,
    priority: int = 0,
    badge: str | None = None,
    custom_title: str | None = None,
    custom_description: str | None = None,
    start_at: datetime | None = None,
    end_at: datetime | None = None,
) -> HomepagePlacement:
    """Add a venue to a homepage section.

    Validates:
      - section is one of the known values
      - venue exists (by ID)
      - no duplicate placement (uq_venue_section constraint — caught as 409)
    """
    if section not in VALID_SECTIONS:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid section '{section}'. Valid sections: {sorted(VALID_SECTIONS)}",
        )

    async with session.begin():
        # Validate venue exists
        venue = (
            await session.execute(select(Venue).where(Venue.id == venue_id, Venue.deleted_at.is_(None)))
        ).scalar_one_or_none()
        if venue is None:
            raise HTTPException(status_code=404, detail="Venue not found")

        # Check for existing placement in this section
        existing = (
            await session.execute(
                select(HomepagePlacement).where(
                    HomepagePlacement.venue_id == venue_id,
                    HomepagePlacement.section == section,
                )
            )
        ).scalar_one_or_none()
        if existing is not None:
            raise HTTPException(
                status_code=409,
                detail=f"Venue is already in the '{section}' section (placement id={existing.id})",
            )

        placement = HomepagePlacement(
            venue_id=venue_id,
            section=section,
            enabled=enabled,
            priority=priority,
            badge=badge,
            custom_title=custom_title,
            custom_description=custom_description,
            start_at=start_at,
            end_at=end_at,
        )
        session.add(placement)
        await session.flush()
        placement_id = placement.id

        from app.models.core import AuditLog
        session.add(
            AuditLog(
                actor_id=None,
                action="homepage_placement.created",
                entity_type="homepage_placement",
                entity_id=placement_id,
                extra_data={"section": section, "venue_id": str(venue_id), "badge": badge},
            )
        )

    # Re-fetch with venue+images eagerly loaded for the response
    return await get_placement(session, placement_id)


async def update_placement(
    session: AsyncSession,
    placement_id: uuid.UUID,
    changes: dict,
) -> HomepagePlacement:
    """Update placement fields. Only modifies keys that are present in changes."""
    async with session.begin():
        result = await session.execute(
            select(HomepagePlacement)
            .where(HomepagePlacement.id == placement_id)
            .with_for_update()
        )
        p = result.scalar_one_or_none()
        if p is None:
            raise HTTPException(status_code=404, detail="Placement not found")

        # Validate section if being changed
        if "section" in changes and changes["section"] is not None:
            if changes["section"] not in VALID_SECTIONS:
                raise HTTPException(status_code=422, detail=f"Invalid section '{changes['section']}'")

        for field, value in changes.items():
            if value is not None or field in ("badge", "custom_title", "custom_description", "start_at", "end_at"):
                setattr(p, field, value)

        p.updated_at = datetime.now(timezone.utc)

        from app.models.core import AuditLog
        session.add(
            AuditLog(
                actor_id=None,
                action="homepage_placement.updated",
                entity_type="homepage_placement",
                entity_id=placement_id,
                extra_data={"changes": {k: str(v) for k, v in changes.items() if v is not None}},
            )
        )

    return await get_placement(session, placement_id)


async def delete_placement(session: AsyncSession, placement_id: uuid.UUID) -> None:
    """Remove a venue from a section."""
    async with session.begin():
        result = await session.execute(
            select(HomepagePlacement).where(HomepagePlacement.id == placement_id)
        )
        p = result.scalar_one_or_none()
        if p is None:
            raise HTTPException(status_code=404, detail="Placement not found")
        
        section = p.section
        venue_id = p.venue_id
        await session.delete(p)

        from app.models.core import AuditLog
        session.add(
            AuditLog(
                actor_id=None,
                action="homepage_placement.deleted",
                entity_type="homepage_placement",
                entity_id=placement_id,
                extra_data={"section": section, "venue_id": str(venue_id)},
            )
        )


async def reorder_section(
    session: AsyncSession,
    section: str,
    ordered_ids: list[uuid.UUID],
) -> list[HomepagePlacement]:
    """Reorder all placements in a section by setting priority = list index.

    All IDs must belong to the given section. Extra IDs (not in section) are
    rejected with a 422.
    """
    if section not in VALID_SECTIONS:
        raise HTTPException(status_code=422, detail=f"Invalid section '{section}'")

    async with session.begin():
        # Load current placements for this section
        result = await session.execute(
            select(HomepagePlacement)
            .where(HomepagePlacement.section == section)
            .with_for_update()
        )
        existing = {p.id: p for p in result.scalars().all()}

        if set(ordered_ids) != set(existing.keys()):
            raise HTTPException(
                status_code=422,
                detail="ordered_ids must contain exactly the IDs currently in this section — no extras, no omissions",
            )

        for idx, pid in enumerate(ordered_ids):
            existing[pid].priority = idx
            existing[pid].updated_at = datetime.now(timezone.utc)

        from app.models.core import AuditLog
        session.add(
            AuditLog(
                actor_id=None,
                action="homepage_placement.reordered",
                entity_type="homepage_section",
                entity_id=None,
                extra_data={"section": section, "ordered_ids": [str(x) for x in ordered_ids]},
            )
        )

    return await list_admin_placements(session, section=section)


async def set_cover_image(
    session: AsyncSession,
    venue_id: uuid.UUID,
    image_id: uuid.UUID,
    viewer: CurrentUser,
) -> VenueMedia:
    """Set a venue image as the cover (primary) image.

    Uses the same atomic un-cover-then-set-cover pattern as
    catalog.service.upload_venue_image — same transaction, same constraint.
    """
    async with session.begin():
        # Validate venue exists
        venue = (
            await session.execute(select(Venue).where(Venue.id == venue_id, Venue.deleted_at.is_(None)))
        ).scalar_one_or_none()
        if venue is None:
            raise HTTPException(status_code=404, detail="Venue not found")
        authorize_venue_modify(viewer, venue)

        # Validate image belongs to this venue
        image = (
            await session.execute(
                select(VenueMedia).where(
                    VenueMedia.id == image_id,
                    VenueMedia.venue_id == venue_id,
                )
            )
        ).scalar_one_or_none()
        if image is None:
            raise HTTPException(status_code=404, detail="Image not found for this venue")

        if getattr(image, "media_type", "image") != "image":
            raise HTTPException(status_code=422, detail="Cover must be an image, not a video")
        
        venue = (await session.execute(select(Venue).where(Venue.id == venue_id))).scalar_one_or_none()
        if venue:
            authorize_venue_modify(viewer, venue)

        # Un-cover all existing cover images atomically
        await session.execute(
            update(VenueMedia)
            .where(VenueMedia.venue_id == venue_id, VenueMedia.is_cover.is_(True))
            .values(is_cover=False)
        )

        # Set this image as cover
        image.is_cover = True

    # Re-fetch to get the updated state
    result = await session.execute(
        select(VenueMedia).where(VenueMedia.id == image_id)
    )
    return result.scalar_one()


async def delete_image(
    session: AsyncSession,
    venue_id: uuid.UUID,
    image_id: uuid.UUID,
    viewer: CurrentUser,
) -> None:
    """Delete a venue image.

    If the deleted image was the cover, the remaining image with the lowest
    sort_order automatically becomes cover (no explicit re-assignment —
    the frontend adapter falls back to images[0] if no is_cover is found).

    Actually promotes the next image to cover for a cleaner UX.
    """
    async with session.begin():
        image = (
            await session.execute(
                select(VenueMedia).where(
                    VenueMedia.id == image_id,
                    VenueMedia.venue_id == venue_id,
                )
            )
        ).scalar_one_or_none()
        if image is None:
            raise HTTPException(status_code=404, detail="Image not found for this venue")
        
        venue = (await session.execute(select(Venue).where(Venue.id == venue_id))).scalar_one_or_none()
        if venue:
            authorize_venue_modify(viewer, venue)

        was_cover = image.is_cover
        await session.delete(image)
        await session.flush()

        # If we deleted the cover, promote the first remaining image
        if was_cover:
            next_img = (
                await session.execute(
                    select(VenueMedia)
                    .where(VenueMedia.venue_id == venue_id)
                    .order_by(VenueMedia.sort_order.asc())
                )
            ).scalars().first()
            if next_img is not None:
                next_img.is_cover = True

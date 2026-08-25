"""
07_design.md §3.2. The interesting parts aren't the CRUD plumbing — it's
three rules that are easy to get subtly wrong:
1. Visibility (get_venue): a non-active listing is invisible to the public
   but previewable by its owner or an admin — not a blanket "auth
   required."
2. Re-review on edit (update_venue): only an ACTUAL content change should
   knock a listing back to pending_review. A no-op PATCH (resubmitting the
   same values) shouldn't silently re-trigger review.
3. Cover image uniqueness (upload_venue_image): setting a new cover image
   has to atomically un-cover the old one, in the same transaction as the
   insert, or uq_one_cover_image_per_venue will reject it.
"""
from __future__ import annotations

import re
import uuid
from datetime import date as date_, time
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.core import Amenity, AuditLog, InventoryUnit, Venue, VenueImage
from app.modules.auth.dependencies import CurrentUser
from app.modules.notifications.service import notify
from app.modules.storage.base import FileStorage, UnsupportedFileError

# Fields that, if changed, mean the listing needs re-review. Deliberately
# explicit rather than "any field changed" — avg_rating, for instance,
# changes from review activity and must never trigger a re-review cycle.
CONTENT_FIELDS = (
    "name",
    "description",
    "category",
    "address",
    "city",
    "state",
    "pincode",
    "capacity",
    "unit_type",
    "base_price",
)


def _slugify(name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return base or "venue"


async def _unique_slug(session: AsyncSession, name: str) -> str:
    base = _slugify(name)
    candidate = base
    suffix = 1
    while (
        await session.execute(select(Venue.id).where(Venue.slug == candidate))
    ).scalar_one_or_none() is not None:
        suffix += 1
        candidate = f"{base}-{suffix}"
    return candidate


async def _get_or_create_amenities(session: AsyncSession, names: list[str]) -> list[Amenity]:
    if not names:
        return []
    result = await session.execute(select(Amenity).where(Amenity.name.in_(names)))
    existing = {a.name: a for a in result.scalars().all()}
    amenities = []
    for name in names:
        if name in existing:
            amenities.append(existing[name])
        else:
            amenity = Amenity(name=name)
            session.add(amenity)
            await session.flush()
            existing[name] = amenity
            amenities.append(amenity)
    return amenities


async def _get_with_relations(session: AsyncSession, venue_id: uuid.UUID) -> Venue | None:
    """Shared by create_venue/get_venue/update_venue/etc — eager-loads
    images+amenities with no visibility gate. get_venue() is the only
    caller that applies the gate on top of this; everything else here
    already knows the caller is entitled to see the row (it's the owner who
    just created/edited it, or an admin who just acted on it)."""
    result = await session.execute(
        select(Venue)
        .options(selectinload(Venue.images), selectinload(Venue.amenities))
        .where(Venue.id == venue_id, Venue.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def create_venue(
    session: AsyncSession,
    owner_id: uuid.UUID,
    name: str,
    category: str,
    address: str,
    city: str,
    unit_type: str,
    base_price: Decimal,
    description: str | None = None,
    state: str | None = None,
    pincode: str | None = None,
    capacity: int | None = None,
    amenity_names: list[str] | None = None,
) -> Venue:
    async with session.begin():
        slug = await _unique_slug(session, name)
        venue = Venue(
            owner_id=owner_id,
            name=name,
            slug=slug,
            category=category,
            description=description,
            address=address,
            city=city,
            state=state,
            pincode=pincode,
            capacity=capacity,
            unit_type=unit_type,
            base_price=base_price,
            status="pending_review",  # 07_design.md §3.2 — never anything else on creation
        )
        venue.amenities = await _get_or_create_amenities(session, amenity_names or [])
        session.add(venue)
        await session.flush()
        venue_id = venue.id

    # Re-fetch with images/amenities eagerly loaded — venue.images is an
    # empty, never-touched lazy collection at this point. Accessing it
    # after this function returns (the route immediately serializes the
    # venue via VenueResponse.from_venue) would trigger an implicit lazy
    # load outside any async-safe greenlet context -> MissingGreenlet.
    # Deliberately calling _get_with_relations directly, NOT get_venue —
    # get_venue's visibility gate would 404 this same venue we just
    # created, since it's always 'pending_review' at this point and we
    # have no CurrentUser to prove ownership with here (the caller/route
    # already knows it's the owner; that's what authorized the INSERT).
    return await _get_with_relations(session, venue_id)


async def get_venue(
    session: AsyncSession, venue_id: uuid.UUID, viewer: CurrentUser | None
) -> Venue:
    venue = await _get_with_relations(session, venue_id)
    if venue is None:
        raise HTTPException(status_code=404, detail="Venue not found")

    if venue.status != "active":
        is_owner = viewer is not None and viewer.id == venue.owner_id
        is_admin = viewer is not None and viewer.role == "admin"
        if not (is_owner or is_admin):
            # 404, not 403 — a non-owner shouldn't learn that an unapproved
            # listing with this id exists at all.
            raise HTTPException(status_code=404, detail="Venue not found")

    return venue


async def list_venues(
    session: AsyncSession,
    city: str | None = None,
    category: str | None = None,
    available_on: date_ | None = None,
    price_max: Decimal | None = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[Venue], int]:
    """Only ever returns 'active' listings — this is the public search,
    not the owner's own listing management view."""
    query = select(Venue).where(Venue.status == "active", Venue.deleted_at.is_(None))

    if city:
        query = query.where(Venue.city.ilike(city))
    if category:
        query = query.where(Venue.category == category)
    if price_max is not None:
        query = query.where(Venue.base_price <= price_max)
    if available_on is not None:
        # PRD §7 story #1: "unavailable venues for the selected date are
        # excluded." A venue counts as available on a date if it has at
        # least one inventory_unit on that date still in 'available' status.
        query = query.where(
            Venue.id.in_(
                select(InventoryUnit.venue_id).where(
                    InventoryUnit.date == available_on, InventoryUnit.status == "available"
                )
            )
        )

    total = (
        await session.execute(select(func.count()).select_from(query.subquery()))
    ).scalar_one()

    query = query.options(
        selectinload(Venue.images), selectinload(Venue.amenities)
    ).order_by(Venue.created_at.desc())
    query = query.limit(limit).offset(offset)
    venues = (await session.execute(query)).scalars().all()

    return list(venues), total


async def list_venues_for_owner(session: AsyncSession, owner_id: uuid.UUID) -> list[Venue]:
    """GET /api/v1/owner/venues — a real gap, same shape as
    list_inventory_units_for_venue above: list_venues() (public search)
    deliberately only ever returns 'active' listings, so an owner has no
    way to see their own draft/pending_review/suspended venues anywhere.
    Unlike the public search, this returns every status for the owner's
    own rows — a draft an owner is still editing, or a suspended listing
    they need to see the reason for, is exactly what this view is for.
    Most-recently-created first, matching how an owner naturally scans
    their own listings (what did I just add/edit)."""
    query = (
        select(Venue)
        .where(Venue.owner_id == owner_id, Venue.deleted_at.is_(None))
        .options(selectinload(Venue.images), selectinload(Venue.amenities))
        .order_by(Venue.created_at.desc())
    )
    result = await session.execute(query)
    return list(result.scalars().all())


async def list_venues_for_admin(
    session: AsyncSession, status: str | None = None, *, limit: int = 50, offset: int = 0
) -> list[Venue]:
    """GET /api/v1/admin/venues — a real gap found while wiring the Admin
    dashboard, same shape as list_venues_for_owner just above:
    list_venues_for_owner is scoped to a single owner_id, so an admin
    calling it sees only venues *they themselves* own (normally none) —
    it does not become "every venue" just because the caller's role is
    'admin'. There was no route anywhere that returned every owner's
    venues regardless of status, which the approval queue
    (status='pending_review') and listings-moderation view (every status,
    so a suspended venue doesn't disappear from admin's view with no way
    back to reactivate it) both need. Most-recently-created first, same
    ordering convention as list_venues_for_owner. limit/offset (added
    later, same keyword-only/50-default convention as get_audit_log) —
    this was returning everything unpaginated at first, fine for a demo,
    not at real scale."""
    query = (
        select(Venue)
        .where(Venue.deleted_at.is_(None))
        .options(selectinload(Venue.images), selectinload(Venue.amenities), selectinload(Venue.owner))
        .order_by(Venue.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if status is not None:
        query = query.where(Venue.status == status)
    result = await session.execute(query)
    return list(result.scalars().all())


async def update_venue(
    session: AsyncSession,
    venue_id: uuid.UUID,
    owner_id: uuid.UUID,
    changes: dict,
) -> Venue:
    async with session.begin():
        result = await session.execute(
            select(Venue)
            .options(selectinload(Venue.amenities))  # needed for the amenity-diff below
            .where(Venue.id == venue_id)
            .with_for_update()
        )
        venue = result.scalar_one_or_none()
        if venue is None:
            raise HTTPException(status_code=404, detail="Venue not found")
        if venue.owner_id != owner_id:
            raise HTTPException(status_code=403, detail="Not your venue")

        content_changed = False
        # Accumulate a before/after diff for each changed content field so
        # the admin review panel can show exactly what the owner changed,
        # not just "something changed."
        diff: dict = {}

        for field, value in changes.items():
            if value is None:
                continue
            if field == "amenity_names":
                continue
            old_value = getattr(venue, field)
            if field in CONTENT_FIELDS and old_value != value:
                content_changed = True
                diff[field] = {"old": str(old_value) if old_value is not None else None, "new": str(value)}
            setattr(venue, field, value)

        if "amenity_names" in changes and changes["amenity_names"] is not None:
            new_names = sorted(changes["amenity_names"])
            current_names = sorted(a.name for a in venue.amenities)
            if new_names != current_names:
                content_changed = True
                diff["amenities"] = {"old": current_names, "new": new_names}
            venue.amenities = await _get_or_create_amenities(session, changes["amenity_names"])

        if content_changed:
            venue.status = "pending_review"
            venue.rejection_reason = None
            # Only store the diff when we're re-submitting an already-saved
            # venue (i.e. there WAS a previous state). A brand-new venue going
            # through pending_review for the first time gets None — the admin
            # doesn't need a diff for something that's never been approved.
            venue.pending_changes = diff if diff else None

    return venue


async def upload_venue_image(
    session: AsyncSession,
    venue_id: uuid.UUID,
    owner_id: uuid.UUID,
    content: bytes,
    content_type: str,
    storage: FileStorage,
    is_cover: bool = False,
) -> VenueImage:
    async with session.begin():
        result = await session.execute(select(Venue).where(Venue.id == venue_id))
        venue = result.scalar_one_or_none()
        if venue is None:
            raise HTTPException(status_code=404, detail="Venue not found")
        if venue.owner_id != owner_id:
            raise HTTPException(status_code=403, detail="Not your venue")

        try:
            url = await storage.save(content, content_type, key_prefix=f"venues/{venue_id}")
        except UnsupportedFileError as exc:
            raise HTTPException(status_code=422, detail=str(exc))

        if is_cover:
            # Un-cover any existing cover image first, in the SAME
            # transaction as the insert below — otherwise
            # uq_one_cover_image_per_venue rejects the new row.
            await session.execute(
                update(VenueImage)
                .where(VenueImage.venue_id == venue_id, VenueImage.is_cover.is_(True))
                .values(is_cover=False)
            )

        image = VenueImage(venue_id=venue_id, url=url, is_cover=is_cover)
        session.add(image)
        await session.flush()

    return image


async def add_inventory_units(
    session: AsyncSession,
    venue_id: uuid.UUID,
    owner_id: uuid.UUID,
    units: list[dict],
) -> list[InventoryUnit]:
    async with session.begin():
        result = await session.execute(select(Venue).where(Venue.id == venue_id))
        venue = result.scalar_one_or_none()
        if venue is None:
            raise HTTPException(status_code=404, detail="Venue not found")
        if venue.owner_id != owner_id:
            raise HTTPException(status_code=403, detail="Not your venue")

        created = []
        for unit_data in units:
            start_time: time | None = unit_data.get("start_time")
            end_time: time | None = unit_data.get("end_time")

            # Decision B-1's assumption (PHASE_B_SUMMARY.md), enforced here
            # instead of just hoped for: half_day/full_day units must have
            # NULL start/end time, or the grace-period calculation's "no
            # slot to cap against" branch silently stops being true.
            if venue.unit_type == "hour" and (start_time is None or end_time is None):
                raise HTTPException(
                    status_code=422,
                    detail="Hourly venues require start_time and end_time on every inventory unit",
                )
            if venue.unit_type in ("half_day", "full_day") and (
                start_time is not None or end_time is not None
            ):
                raise HTTPException(
                    status_code=422,
                    detail=f"{venue.unit_type} venues must not set start_time/end_time",
                )

            unit = InventoryUnit(
                venue_id=venue_id,
                date=unit_data["date"],
                start_time=start_time,
                end_time=end_time,
                price=unit_data.get("price") if unit_data.get("price") is not None else venue.base_price,
            )
            session.add(unit)
            created.append(unit)

        await session.flush()

    return created


async def list_inventory_units_for_venue(
    session: AsyncSession,
    venue_id: uuid.UUID,
    viewer: CurrentUser | None,
    date_from: date_ | None = None,
    date_to: date_ | None = None,
) -> list[InventoryUnit]:
    """GET /api/v1/venues/{id}/inventory-units — a real gap found while
    starting frontend integration: add_inventory_units() (owner creates
    slots) existed with no way for anyone, including a browsing customer,
    to actually list them. Reuses get_venue's exact visibility gate rather
    than inventing a separate rule — a stranger gets the same 404 on a
    non-active venue's units as they would on the venue itself.

    Returns every unit regardless of status (available/held/booked) —
    the caller decides how to render each state; a booked slot showing as
    unavailable is a display concern, not a reason to hide it from the
    response entirely.
    """
    await get_venue(session, venue_id, viewer)  # raises 404 under the same rule if not visible

    query = select(InventoryUnit).where(InventoryUnit.venue_id == venue_id)
    if date_from is not None:
        query = query.where(InventoryUnit.date >= date_from)
    if date_to is not None:
        query = query.where(InventoryUnit.date <= date_to)
    query = query.order_by(InventoryUnit.date, InventoryUnit.start_time)

    result = await session.execute(query)
    return list(result.scalars().all())


async def _load_pending_for_review(session: AsyncSession, venue_id: uuid.UUID) -> Venue:
    result = await session.execute(select(Venue).where(Venue.id == venue_id).with_for_update())
    venue = result.scalar_one_or_none()
    if venue is None:
        raise HTTPException(status_code=404, detail="Venue not found")
    if venue.status != "pending_review":
        raise HTTPException(status_code=409, detail=f"This venue is currently '{venue.status}', not pending review")
    return venue


async def approve_venue(session: AsyncSession, venue_id: uuid.UUID, admin_id: uuid.UUID) -> Venue:
    async with session.begin():
        venue = await _load_pending_for_review(session, venue_id)
        venue.status = "active"
        venue.rejection_reason = None
        venue.pending_changes = None  # diff resolved — no longer pending
        session.add(
            AuditLog(
                actor_id=admin_id,
                action="venue.approved",
                entity_type="venue",
                entity_id=venue.id,
            )
        )
        session.add(
            notify(
                venue.owner_id,
                "venue_approved",
                f"Your venue '{venue.name}' was approved and is now live.",
                entity_type="venue",
                entity_id=venue.id,
            )
        )
    return venue


async def reject_venue(
    session: AsyncSession, venue_id: uuid.UUID, admin_id: uuid.UUID, reason: str
) -> Venue:
    async with session.begin():
        venue = await _load_pending_for_review(session, venue_id)
        venue.status = "draft"
        venue.rejection_reason = reason
        venue.pending_changes = None  # diff resolved — owner will make new changes on resubmit
        session.add(
            AuditLog(
                actor_id=admin_id,
                action="venue.rejected",
                entity_type="venue",
                entity_id=venue.id,
                extra_data={"reason": reason},
            )
        )
        session.add(
            notify(
                venue.owner_id,
                "venue_rejected",
                f"Your venue '{venue.name}' was not approved: {reason}",
                entity_type="venue",
                entity_id=venue.id,
            )
        )
    return venue

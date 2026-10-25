"""
07_design.md §3.2. The interesting parts aren't the CRUD plumbing — it's
three rules that are easy to get subtly wrong:
1. Visibility (get_venue): a non-active listing is invisible to the public
   but previewable by its owner or an admin — not a blanket "auth
   required."
2. Re-review on edit (update_venue): only an ACTUAL content change should
   knock a listing back to pending_review. A no-op PATCH (resubmitting the
   same values) shouldn't silently re-trigger review.
3. Cover image uniqueness (upload_venue_media): setting a new cover image
   has to atomically un-cover the old one, in the same transaction as the
   insert, or uq_one_cover_image_per_venue will reject it.
"""
from __future__ import annotations

import re
import uuid
from datetime import date as date_, time, datetime, timezone, timedelta
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import func, select, update, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.core import (
    Amenity,
    AuditLog,
    Category,
    InventoryUnit,
    UseCase,
    User,
    Venue,
    VenueContentBlock,
    VenueMedia,
    VenuePurpose,
    VenueRentalOption,
    VenueType,
)
from app.modules.auth.dependencies import CurrentUser
from app.modules.notifications.service import notify
from app.modules.storage.base import FileStorage, UnsupportedFileError

CONTENT_FIELDS = (
    "name",
    "display_name",
    "tagline",
    "description",
    "category",
    "category_id",
    "venue_type_id",
    "address",
    "city",
    "state",
    "pincode",
    "capacity",
    "unit_type",
    "base_price",
)

ACTIVE_REREVIEW_FIELDS = (
    "name",
    "display_name",
    "tagline",
    "description",
    "address",
    "category",
    "category_id",
    "venue_type_id",
)


async def venue_submission_problems(session: AsyncSession, venue: Venue) -> list[str]:
    problems = []
    if not venue.name or not venue.name.strip():
        problems.append("name")
    if (not venue.category or not venue.category.strip()) and not venue.category_id:
        problems.append("category")
    if not venue.address or not venue.address.strip():
        problems.append("address")
    if not venue.city or not venue.city.strip():
        problems.append("city")
    if venue.base_price is None or venue.base_price <= 0:
        problems.append("price")

    media_result = await session.execute(
        select(VenueMedia).where(VenueMedia.venue_id == venue.id)
    )
    media_items = list(media_result.scalars().all())
    photos = [
        m for m in media_items
        if not (m.url.lower().endswith(".mp4") or m.url.lower().endswith(".webm"))
    ]
    has_cover = any(m.is_cover for m in photos)
    if len(photos) < 3 or not has_cover:
        problems.append("photos")

    today = date_.today()
    unit_result = await session.execute(
        select(func.count(InventoryUnit.id)).where(
            InventoryUnit.venue_id == venue.id,
            InventoryUnit.date >= today,
            InventoryUnit.status == "available",
        )
    )
    available_units_count = unit_result.scalar_one()
    if available_units_count < 1:
        problems.append("inventory")

    return problems


def _merge_pending_changes(venue: Venue, new_diff: dict):
    if not new_diff:
        return
    current = dict(venue.pending_changes or {})
    for field, change in new_diff.items():
        if field in current:
            orig_old = current[field]["old"]
            new_val = change["new"]
            if orig_old == new_val:
                del current[field]
            else:
                current[field] = {"old": orig_old, "new": new_val}
        else:
            orig_old = change["old"]
            new_val = change["new"]
            if orig_old != new_val:
                current[field] = {"old": orig_old, "new": new_val}
    venue.pending_changes = current if current else None


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


async def _get_with_relations(session: AsyncSession, venue_id: uuid.UUID | str) -> Venue | None:
    """Shared by create_venue/get_venue/update_venue/etc — eager-loads
    images+amenities with no visibility gate. get_venue() is the only
    caller that applies the gate on top of this; everything else here
    already knows the caller is entitled to see the row (it's the owner who
    just created/edited it, or an admin who just acted on it).
    Supports either UUID or slug identifier for SEO-friendly URLs.
    """
    if isinstance(venue_id, str):
        try:
            parsed_uuid = uuid.UUID(venue_id)
            clause = (Venue.id == parsed_uuid)
        except ValueError:
            clause = (Venue.slug == venue_id)
    else:
        clause = (Venue.id == venue_id)

    result = await session.execute(
        select(Venue)
        .options(
            selectinload(Venue.media),
            selectinload(Venue.amenities),
            selectinload(Venue.content_blocks),
            selectinload(Venue.venue_type),
            selectinload(Venue.use_cases),
            selectinload(Venue.rental_options),
            selectinload(Venue.purposes).selectinload(VenuePurpose.use_case),
            selectinload(Venue.reviews),
        )
        .where(clause, Venue.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()



async def create_venue(
    session: AsyncSession,
    owner_id: uuid.UUID,
    name: str,
    address: str,
    city: str,
    unit_type: str,
    base_price: Decimal,
    category: str | None = None,
    display_name: str | None = None,
    tagline: str | None = None,
    category_id: uuid.UUID | None = None,
    venue_type_id: uuid.UUID | None = None,
    use_case_ids: list[uuid.UUID] | None = None,
    description: str | None = None,
    state: str | None = None,
    pincode: str | None = None,
    capacity: int | None = None,
    amenity_names: list[str] | None = None,
    content_blocks: list[dict] | None = None,
    status: str = "pending_review",
    save_as_draft: bool = False,
) -> Venue:
    if unit_type not in ("hour", "half_day", "full_day"):
        raise HTTPException(
            status_code=422,
            detail="unit_type must be one of 'hour', 'half_day', 'full_day'",
        )

    async with session.begin():
        cat = None
        if category_id is not None:
            cat = (
                await session.execute(select(Category).where(Category.id == category_id))
            ).scalar_one_or_none()
            if not cat:
                raise HTTPException(status_code=422, detail="Category not found")
            if not category or not category.strip():
                category = cat.name

        if venue_type_id is not None:
            vt = (
                await session.execute(select(VenueType).where(VenueType.id == venue_type_id))
            ).scalar_one_or_none()
            if not vt:
                raise HTTPException(status_code=422, detail="Venue type not found")
            if category_id is not None and vt.category_id != category_id:
                raise HTTPException(
                    status_code=422,
                    detail="Venue type does not belong to the selected category",
                )
            if category_id is None:
                category_id = vt.category_id
                if not category or not category.strip():
                    if not cat:
                        cat = (
                            await session.execute(
                                select(Category).where(Category.id == category_id)
                            )
                        ).scalar_one_or_none()
                    if cat:
                        category = cat.name

        if not category or not category.strip():
            raise HTTPException(status_code=422, detail="Category is required")

        use_case_objects = []
        if use_case_ids:
            uc_res = await session.execute(
                select(UseCase).where(UseCase.id.in_(use_case_ids))
            )
            use_case_objects = list(uc_res.scalars().all())
            if len(use_case_objects) != len(set(use_case_ids)):
                raise HTTPException(status_code=422, detail="Unknown use case id in use_case_ids")

        actual_status = "draft" if save_as_draft else (status or "pending_review")

        slug = await _unique_slug(session, name)
        venue = Venue(
            owner_id=owner_id,
            name=name,
            display_name=display_name,
            tagline=tagline,
            slug=slug,
            category=category,
            category_id=category_id,
            venue_type_id=venue_type_id,
            description=description,
            address=address,
            city=city,
            state=state,
            pincode=pincode,
            capacity=capacity,
            unit_type=unit_type,
            base_price=base_price,
            status=actual_status,
        )
        venue.amenities = await _get_or_create_amenities(session, amenity_names or [])
        if use_case_objects:
            venue.use_cases = use_case_objects

        if content_blocks:
            blocks = []
            for i, b in enumerate(content_blocks):
                blocks.append(
                    VenueContentBlock(
                        venue=venue,
                        type=b.get("type"),
                        title=b.get("title"),
                        subtitle=b.get("subtitle"),
                        body=b.get("body"),
                        media_reference=b.get("media_reference"),
                        settings=b.get("settings"),
                        sort_order=b.get("sort_order", i),
                        enabled=b.get("enabled", True),
                    )
                )
            venue.content_blocks = blocks

        session.add(venue)
        await session.flush()
        refreshed = await _get_with_relations(session, venue.id)
        return refreshed or venue


async def get_venue(
    session: AsyncSession, venue_id: uuid.UUID | str, viewer: CurrentUser | None
) -> Venue:
    venue = await _get_with_relations(session, venue_id)
    if venue is None:
        raise HTTPException(status_code=404, detail="Venue not found")

    from app.modules.auth.policies import authorize_venue_view
    authorize_venue_view(viewer, venue)

    return venue



async def list_categories(session: AsyncSession) -> list[Category]:
    from app.models.core import Category
    from sqlalchemy import select
    result = await session.execute(select(Category).order_by(Category.name))
    return list(result.scalars().all())

async def list_venue_types(session: AsyncSession) -> list[VenueType]:
    from app.models.core import VenueType
    from sqlalchemy import select
    result = await session.execute(select(VenueType).order_by(VenueType.name))
    return list(result.scalars().all())

async def list_use_cases(session: AsyncSession) -> list[UseCase]:
    from app.models.core import UseCase
    from sqlalchemy import select
    result = await session.execute(select(UseCase).order_by(UseCase.name))
    return list(result.scalars().all())

async def list_venues(
    session: AsyncSession,
    city: str | None = None,
    category: str | None = None,
    category_id: uuid.UUID | None = None,
    venue_type_id: uuid.UUID | None = None,
    available_on: date_ | None = None,
    price_max: Decimal | None = None,
    sort_by: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[Venue], int]:
    """Only ever returns 'active' listings — this is the public search,
    not the owner's own listing management view."""
    query = (
        select(Venue)
        .where(Venue.status == "active", Venue.deleted_at.is_(None))
    )

    if city:
        query = query.where(Venue.city.ilike(city))
    if category:
        # Filter on the string `category` column, not the UUID `category_id` FK.
        # The UI and search API both pass the human-readable slug/name string.
        query = query.where(Venue.category.ilike(category))
    if category_id:
        query = query.where(Venue.category_id == category_id)
    if venue_type_id:
        query = query.where(Venue.venue_type_id == venue_type_id)
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

    data_query = query.options(
        selectinload(Venue.media),
        selectinload(Venue.amenities),
        selectinload(Venue.content_blocks),
        selectinload(Venue.venue_type),
        selectinload(Venue.use_cases),
        selectinload(Venue.reviews),
    )
    if sort_by == "newest":
        data_query = data_query.order_by(Venue.created_at.desc())
    elif sort_by == "price_asc":
        data_query = data_query.order_by(Venue.base_price.asc(), Venue.created_at.desc())
    elif sort_by == "price_desc":
        data_query = data_query.order_by(Venue.base_price.desc(), Venue.created_at.desc())
    elif sort_by == "rating_desc":
        data_query = data_query.order_by(Venue.avg_rating.desc(), Venue.created_at.desc())
    else:
        data_query = data_query.order_by(Venue.created_at.desc())
    data_query = data_query.limit(limit).offset(offset)
    venues = (await session.execute(data_query)).scalars().all()

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
        .options(selectinload(Venue.media), selectinload(Venue.amenities), selectinload(Venue.content_blocks))
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
        .options(selectinload(Venue.media), selectinload(Venue.amenities), selectinload(Venue.owner))
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
    viewer: CurrentUser,
    changes: dict,
) -> Venue:
    async with session.begin():
        result = await session.execute(
            select(Venue)
            .options(
                selectinload(Venue.media),
                selectinload(Venue.amenities),
                selectinload(Venue.content_blocks),
                selectinload(Venue.venue_type),
                selectinload(Venue.use_cases),
            )
            .where(Venue.id == venue_id)
            .with_for_update()
        )
        venue = result.scalar_one_or_none()
        if venue is None:
            raise HTTPException(status_code=404, detail="Venue not found")

        from app.modules.auth.policies import authorize_venue_modify
        authorize_venue_modify(viewer, venue)

        if "unit_type" in changes and changes["unit_type"] is not None:
            if changes["unit_type"] not in ("hour", "half_day", "full_day"):
                raise HTTPException(
                    status_code=422,
                    detail="unit_type must be one of 'hour', 'half_day', 'full_day'",
                )

        content_changed = False
        diff: dict = {}

        # Handle taxonomy updates
        if "category_id" in changes:
            cat_id = changes["category_id"]
            if cat_id is not None:
                cat = (
                    await session.execute(select(Category).where(Category.id == cat_id))
                ).scalar_one_or_none()
                if not cat:
                    raise HTTPException(status_code=422, detail="Category not found")
                old_cat_id = venue.category_id
                if old_cat_id != cat_id:
                    content_changed = True
                    diff["category_id"] = {
                        "old": str(old_cat_id) if old_cat_id else None,
                        "new": str(cat_id),
                    }
                venue.category_id = cat_id
                if "category" not in changes or not changes.get("category"):
                    if venue.category != cat.name:
                        content_changed = True
                        diff["category"] = {
                            "old": venue.category,
                            "new": cat.name,
                        }
                    venue.category = cat.name
            else:
                if venue.category_id is not None:
                    content_changed = True
                    diff["category_id"] = {"old": str(venue.category_id), "new": None}
                venue.category_id = None

        if "venue_type_id" in changes:
            vt_id = changes["venue_type_id"]
            if vt_id is not None:
                vt = (
                    await session.execute(select(VenueType).where(VenueType.id == vt_id))
                ).scalar_one_or_none()
                if not vt:
                    raise HTTPException(status_code=422, detail="Venue type not found")
                target_cat_id = venue.category_id
                if target_cat_id is not None and vt.category_id != target_cat_id:
                    if "category_id" not in changes:
                        venue.category_id = vt.category_id
                        cat_res = await session.execute(select(Category).where(Category.id == vt.category_id))
                        cat_obj = cat_res.scalar_one_or_none()
                        if cat_obj:
                            venue.category = cat_obj.name
                    else:
                        raise HTTPException(
                            status_code=422,
                            detail="Venue type does not belong to the selected category",
                        )
                old_vt_id = venue.venue_type_id
                if old_vt_id != vt_id:
                    content_changed = True
                    diff["venue_type_id"] = {
                        "old": str(old_vt_id) if old_vt_id else None,
                        "new": str(vt_id),
                    }
                venue.venue_type_id = vt_id
            else:
                if venue.venue_type_id is not None:
                    content_changed = True
                    diff["venue_type_id"] = {"old": str(venue.venue_type_id), "new": None}
                venue.venue_type_id = None

        if "use_case_ids" in changes and changes["use_case_ids"] is not None:
            uc_ids = changes["use_case_ids"]
            uc_res = await session.execute(select(UseCase).where(UseCase.id.in_(uc_ids)))
            ucs = list(uc_res.scalars().all())
            if len(ucs) != len(set(uc_ids)):
                raise HTTPException(status_code=422, detail="Unknown use case id in use_case_ids")
            new_uc_sorted = sorted(str(u) for u in uc_ids)
            current_uc_sorted = sorted(str(u.id) for u in venue.use_cases)
            if new_uc_sorted != current_uc_sorted:
                content_changed = True
                diff["use_case_ids"] = {"old": current_uc_sorted, "new": new_uc_sorted}
            venue.use_cases = ucs

        # Scalar field updates
        for field, value in changes.items():
            if value is None:
                continue
            if field in (
                "amenity_names",
                "content_blocks",
                "status",
                "use_case_ids",
                "category_id",
                "venue_type_id",
            ):
                continue
            old_value = getattr(venue, field)
            if field in CONTENT_FIELDS and old_value != value:
                content_changed = True
                diff[field] = {
                    "old": str(old_value) if old_value is not None else None,
                    "new": str(value),
                }
            setattr(venue, field, value)

        if "amenity_names" in changes and changes["amenity_names"] is not None:
            new_names = sorted(changes["amenity_names"])
            current_names = sorted(a.name for a in venue.amenities)
            if new_names != current_names:
                content_changed = True
                diff["amenities"] = {"old": current_names, "new": new_names}
            venue.amenities = await _get_or_create_amenities(session, changes["amenity_names"])

        if "content_blocks" in changes and changes["content_blocks"] is not None:
            content_changed = True
            diff["content_blocks"] = {"old": "...", "new": "..."}

            # Delete old blocks
            await session.execute(
                VenueContentBlock.__table__.delete().where(VenueContentBlock.venue_id == venue.id)
            )

            blocks = []
            for i, b in enumerate(changes["content_blocks"]):
                blocks.append(
                    VenueContentBlock(
                        venue=venue,
                        type=b.get("type"),
                        title=b.get("title"),
                        subtitle=b.get("subtitle"),
                        body=b.get("body"),
                        media_reference=b.get("media_reference"),
                        settings=b.get("settings"),
                        sort_order=b.get("sort_order", i),
                        enabled=b.get("enabled", True),
                    )
                )
            venue.content_blocks = blocks

        # Status transition and diff tracking logic:
        submitting_to_review = (changes.get("status") == "pending_review")

        if venue.status == "draft":
            if submitting_to_review:
                problems = await venue_submission_problems(session, venue)
                if problems:
                    raise HTTPException(
                        status_code=422,
                        detail={"code": "incomplete", "missing": problems},
                    )
                venue.status = "pending_review"
                venue.rejection_reason = None
                venue.pending_changes = None
            else:
                # Content edit on draft keeps status as draft
                pass

        elif venue.status == "active":
            # Check if any trigger field changed
            trigger_rereview = any(f in diff for f in ACTIVE_REREVIEW_FIELDS) or ("content_blocks" in diff)
            if trigger_rereview:
                venue.status = "pending_review"
                _merge_pending_changes(venue, diff)
            elif diff:
                # Non-rereview fields changed while active (e.g. price)
                # Keep active, without pending_changes
                pass

        elif venue.status == "pending_review":
            if diff:
                _merge_pending_changes(venue, diff)

    return venue


async def upload_venue_media(
    session: AsyncSession,
    venue_id: uuid.UUID,
    viewer: CurrentUser,
    content: bytes,
    content_type: str,
    storage: FileStorage,
    is_cover: bool = False,
    duration: float | None = None,
) -> Venue:
    async with session.begin():
        result = await session.execute(select(Venue).where(Venue.id == venue_id))
        venue = result.scalar_one_or_none()
        if venue is None:
            raise HTTPException(status_code=404, detail="Venue not found")
            
        from app.modules.auth.policies import authorize_venue_modify
        authorize_venue_modify(viewer, venue)

        is_video = content_type.startswith("video/")
        media_type = "video" if is_video else "image"

        if media_type == "video" and is_cover:
            raise HTTPException(status_code=422, detail="Cover must be an image, not a video")

        if media_type == "video" and duration is not None:
            if duration < 10.0:
                raise HTTPException(
                    status_code=422,
                    detail=f"Video duration is too short ({duration:.1f}s). Minimum video duration is 10 seconds",
                )
            if duration > 90.0:
                raise HTTPException(
                    status_code=422,
                    detail=f"Video duration is too long ({duration:.1f}s). Maximum video duration is 1 minute 30 seconds (90s)",
                )

        existing_media = list(
            (
                await session.execute(
                    select(VenueMedia).where(VenueMedia.venue_id == venue_id)
                )
            ).scalars().all()
        )
        image_count = sum(1 for m in existing_media if getattr(m, "media_type", "image") == "image")
        video_count = sum(1 for m in existing_media if getattr(m, "media_type", "image") == "video")

        if media_type == "image" and image_count >= 15:
            raise HTTPException(status_code=422, detail="Maximum of 15 images allowed per venue")
        if media_type == "video" and video_count >= 3:
            raise HTTPException(status_code=422, detail="Maximum of 3 videos allowed per venue")

        if media_type == "image" and image_count == 0:
            is_cover = True

        try:
            url, storage_key = await storage.save(content, content_type, key_prefix=f"venues/{venue_id}")
        except UnsupportedFileError as exc:
            raise HTTPException(status_code=422, detail=str(exc))

        if is_cover:
            # Un-cover any existing cover image first, in the SAME
            # transaction as the insert below — otherwise
            # uq_one_cover_media_per_venue rejects the new row.
            await session.execute(
                update(VenueMedia)
                .where(VenueMedia.venue_id == venue_id, VenueMedia.is_cover.is_(True))
                .values(is_cover=False)
            )

        media_item = VenueMedia(
            venue_id=venue_id,
            url=url,
            storage_key=storage_key,
            media_type=media_type,
            is_cover=is_cover,
            sort_order=len(existing_media),
        )
        session.add(media_item)
        await session.flush()
        refreshed = await _get_with_relations(session, venue_id)
        return refreshed or venue


async def add_inventory_units(
    session: AsyncSession,
    venue_id: uuid.UUID,
    viewer: CurrentUser,
    units: list[dict],
) -> list[InventoryUnit]:
    async with session.begin():
        result = await session.execute(
            select(Venue)
            .options(
                selectinload(Venue.rental_options),
                selectinload(Venue.purposes),
            )
            .where(Venue.id == venue_id)
        )
        venue = result.scalar_one_or_none()
        if venue is None:
            raise HTTPException(status_code=404, detail="Venue not found")
            
        from app.modules.auth.policies import authorize_venue_modify
        authorize_venue_modify(viewer, venue)

        enabled_modes = set()
        if getattr(venue, "rental_options", None):
            enabled_modes.update(ro.mode for ro in venue.rental_options if ro.enabled)
        if getattr(venue, "purposes", None):
            for p in venue.purposes:
                if p.enabled and p.allowed_modes:
                    enabled_modes.update(p.allowed_modes)
        if not enabled_modes:
            enabled_modes.add(venue.unit_type)

        created = []
        for unit_data in units:
            start_time: time | None = unit_data.get("start_time")
            end_time: time | None = unit_data.get("end_time")

            if (start_time is None) != (end_time is None):
                raise HTTPException(
                    status_code=422,
                    detail="Both start_time and end_time must be provided together, or neither",
                )

            if start_time is not None and end_time is not None:
                if start_time >= end_time:
                    raise HTTPException(
                        status_code=422,
                        detail="start_time must be earlier than end_time",
                    )
                if not getattr(venue, "rental_options", None) and venue.unit_type in ("half_day", "full_day"):
                    raise HTTPException(
                        status_code=422,
                        detail="Full-day and half-day venues must not have start_time or end_time",
                    )
            else:
                if "half_day" not in enabled_modes and "full_day" not in enabled_modes:
                    raise HTTPException(
                        status_code=422,
                        detail="Hourly venues require start_time and end_time on every inventory unit",
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
    venue_id: uuid.UUID | str,
    viewer: CurrentUser | None,
    date_from: date_ | None = None,
    date_to: date_ | None = None,
    include_all: bool = False,
) -> list[InventoryUnit]:
    """GET /api/v1/venues/{id}/inventory-units — Guide 11 availability rules:
    1. Returns ONLY bookable units for customers:
       - Status must be 'available'
       - No active block covers it
       - No overlapping unit for the same venue is held or booked
    2. Hidden means not returned at all, so nothing about who or when leaks.
    3. Owners and admins can see all units to manage their venue.
    """
    from zoneinfo import ZoneInfo
    VENUE_LOCAL_TZ = ZoneInfo("Asia/Kolkata")
    from app.models.core import Block
    
    venue = await get_venue(session, venue_id, viewer)
    actual_venue_id = venue.id

    is_owner_or_admin = viewer is not None and (
        viewer.role == "admin" or (viewer.role == "owner" and venue.owner_id == viewer.id)
    )
    show_all = is_owner_or_admin

    query = select(InventoryUnit).where(InventoryUnit.venue_id == actual_venue_id)
    if date_from is not None:
        query = query.where(InventoryUnit.date >= date_from)
    if date_to is not None:
        query = query.where(InventoryUnit.date <= date_to)
    query = query.order_by(InventoryUnit.date, InventoryUnit.start_time)

    result = await session.execute(query)
    units = list(result.scalars().all())

    if not units:
        return units

    # Fetch active blocks
    blocks_result = await session.execute(
        select(Block).where(Block.venue_id == actual_venue_id, Block.status == "active")
    )
    blocks = list(blocks_result.scalars().all())

    for unit in units:
        if unit.status == "available":
            unit_start_naive = datetime.combine(unit.date, unit.start_time) if unit.start_time else datetime.combine(unit.date, time.min)
            unit_end_naive = datetime.combine(unit.date, unit.end_time) if unit.end_time else datetime.combine(unit.date, time.max)
            unit_start = unit_start_naive.replace(tzinfo=VENUE_LOCAL_TZ)
            unit_end = unit_end_naive.replace(tzinfo=VENUE_LOCAL_TZ)
            
            for block in blocks:
                if block.inventory_unit_id and block.inventory_unit_id != unit.id:
                    continue
                b_start = block.start_time if block.start_time.tzinfo else block.start_time.replace(tzinfo=VENUE_LOCAL_TZ)
                b_end = block.end_time if block.end_time.tzinfo else block.end_time.replace(tzinfo=VENUE_LOCAL_TZ)
                if max(unit_start, b_start) < min(unit_end, b_end):
                    unit.status = "blocked"
                    break

    if show_all:
        return units

    # Customer view: return ONLY bookable units!
    occupied_result = await session.execute(
        select(InventoryUnit).where(
            InventoryUnit.venue_id == actual_venue_id,
            InventoryUnit.status.in_(["held", "booked"]),
        )
    )
    occupied_units = list(occupied_result.scalars().all())

    bookable_units = []
    for unit in units:
        if unit.status != "available":
            continue
        unit_start_ts = unit.starts_at or datetime.combine(unit.date, unit.start_time or time.min)
        unit_end_ts = unit.ends_at or (datetime.combine(unit.date, unit.end_time) if unit.end_time else datetime.combine(unit.date + timedelta(days=1), time.min))

        has_overlap = False
        for occ in occupied_units:
            if occ.id == unit.id:
                continue
            occ_start = occ.starts_at or datetime.combine(occ.date, occ.start_time or time.min)
            occ_end = occ.ends_at or (datetime.combine(occ.date, occ.end_time) if occ.end_time else datetime.combine(occ.date + timedelta(days=1), time.min))
            if max(unit_start_ts, occ_start) < min(unit_end_ts, occ_end):
                has_overlap = True
                break
        if not has_overlap:
            bookable_units.append(unit)

    return bookable_units


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
        session.add_all(
            notify(
                venue.owner_id,
                "venue_approved",
                f"Your venue '{venue.name}' was approved and is now live.",
                entity_type="venue",
                entity_id=venue.id,
            )
        )
        refreshed = await _get_with_relations(session, venue_id)
        return refreshed or venue


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
        session.add_all(
            notify(
                venue.owner_id,
                "venue_rejected",
                f"Your venue '{venue.name}' was not approved: {reason}",
                entity_type="venue",
                entity_id=venue.id,
            )
        )
        refreshed = await _get_with_relations(session, venue_id)
        return refreshed or venue

async def create_block(
    session: AsyncSession,
    venue_id: uuid.UUID,
    viewer: CurrentUser,
    start_time: datetime,
    end_time: datetime,
    reason: str,
    inventory_unit_id: uuid.UUID | None = None,
):
    from app.models.core import Block, Booking, InventoryUnit
    from zoneinfo import ZoneInfo
    VENUE_LOCAL_TZ = ZoneInfo("Asia/Kolkata")
    
    if start_time >= end_time:
        raise HTTPException(status_code=422, detail="start_time must be before end_time")
        
    async with session.begin():
        # Manual inline get_venue to avoid autobegin conflict
        result = await session.execute(select(Venue).where(Venue.id == venue_id, Venue.deleted_at.is_(None)))
        venue = result.scalar_one_or_none()
        if venue is None:
            raise HTTPException(status_code=404, detail="Venue not found")
        from app.modules.auth.policies import authorize_venue_modify
        authorize_venue_modify(viewer, venue)

        query = select(Booking).join(InventoryUnit).where(
            Booking.venue_id == venue_id,
            Booking.status.in_(["confirmed", "pending_payment"]),
        )
        if inventory_unit_id:
            query = query.where(Booking.inventory_unit_id == inventory_unit_id)
            
        result = await session.execute(query.options(selectinload(Booking.inventory_unit)))
        bookings = result.scalars().all()
        
        # Ensure start_time and end_time are timezone-aware before comparison.
        # FastAPI may pass timezone-aware (UTC) datetimes; the unit datetimes
        # are built with VENUE_LOCAL_TZ. Mixing aware and naive raises TypeError.
        from datetime import timezone as _tz
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=_tz.utc)
        if end_time.tzinfo is None:
            end_time = end_time.replace(tzinfo=_tz.utc)

        for b in bookings:
            unit = b.inventory_unit
            unit_start_naive = datetime.combine(unit.date, unit.start_time) if unit.start_time else datetime.combine(unit.date, time.min)
            unit_end_naive = datetime.combine(unit.date, unit.end_time) if unit.end_time else datetime.combine(unit.date, time.max)
            unit_start = unit_start_naive.replace(tzinfo=VENUE_LOCAL_TZ)
            unit_end = unit_end_naive.replace(tzinfo=VENUE_LOCAL_TZ)
            
            if max(unit_start, start_time) < min(unit_end, end_time):
                raise HTTPException(status_code=409, detail="Cannot create block: overlaps with an existing booking")

        block = Block(
            venue_id=venue_id,
            inventory_unit_id=inventory_unit_id,
            start_time=start_time,
            end_time=end_time,
            reason=reason,
            status="active",
            created_by=viewer.id,
        )
        session.add(block)
        
        session.add(
            AuditLog(
                actor_id=viewer.id,
                action="venue.blocked",
                entity_type="venue",
                entity_id=venue_id,
                extra_data={"start_time": start_time.isoformat(), "end_time": end_time.isoformat(), "reason": reason}
            )
        )
        await session.flush()
        
    return block

async def list_blocks(
    session: AsyncSession,
    venue_id: uuid.UUID,
    viewer: CurrentUser,
):
    from app.models.core import Block
    await get_venue(session, venue_id, viewer)
    
    result = await session.execute(
        select(Block).where(Block.venue_id == venue_id).order_by(Block.start_time)
    )
    return list(result.scalars().all())

async def update_block(
    session: AsyncSession,
    venue_id: uuid.UUID,
    block_id: uuid.UUID,
    viewer: CurrentUser,
    status: str,
):
    from app.models.core import Block
    
    async with session.begin():
        result = await session.execute(select(Venue).where(Venue.id == venue_id, Venue.deleted_at.is_(None)))
        venue = result.scalar_one_or_none()
        if venue is None:
            raise HTTPException(status_code=404, detail="Venue not found")
        from app.modules.auth.policies import authorize_venue_modify
        authorize_venue_modify(viewer, venue)

        result = await session.execute(
            select(Block).where(Block.id == block_id, Block.venue_id == venue_id).with_for_update()
        )
        block = result.scalar_one_or_none()
        if not block:
            raise HTTPException(status_code=404, detail="Block not found")
            
        if block.status != status:
            block.status = status
            session.add(
                AuditLog(
                    actor_id=viewer.id,
                    action="block.status_changed",
                    entity_type="block",
                    entity_id=block.id,
                    extra_data={"status": status}
                )
            )
        await session.flush()
        
    return block

from app.models.core import PricingRule

async def create_pricing_rule(
    session: AsyncSession,
    venue_id: uuid.UUID,
    viewer: CurrentUser,
    rule_data: dict
) -> PricingRule:
    venue = await get_venue(session, venue_id, viewer)
    rule = PricingRule(venue_id=venue.id, **rule_data)
    session.add(rule)
    await session.commit()
    await session.refresh(rule)
    return rule

async def list_pricing_rules(
    session: AsyncSession,
    venue_id: uuid.UUID,
    viewer: CurrentUser
) -> list[PricingRule]:
    await get_venue(session, venue_id, viewer)
    result = await session.execute(
        select(PricingRule).where(PricingRule.venue_id == venue_id).order_by(PricingRule.priority.desc())
    )
    return list(result.scalars().all())

async def update_pricing_rule(
    session: AsyncSession,
    venue_id: uuid.UUID,
    rule_id: uuid.UUID,
    viewer: CurrentUser,
    rule_data: dict
) -> PricingRule:
    await get_venue(session, venue_id, viewer)
    result = await session.execute(
        select(PricingRule).where(PricingRule.id == rule_id, PricingRule.venue_id == venue_id)
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Pricing rule not found")
        
    for key, value in rule_data.items():
        setattr(rule, key, value)
        
    await session.commit()
    await session.refresh(rule)
    return rule

async def delete_pricing_rule(
    session: AsyncSession,
    venue_id: uuid.UUID,
    rule_id: uuid.UUID,
    viewer: CurrentUser
) -> None:
    await get_venue(session, venue_id, viewer)
    result = await session.execute(
        select(PricingRule).where(PricingRule.id == rule_id, PricingRule.venue_id == venue_id)
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Pricing rule not found")
        
    await session.delete(rule)
    await session.commit()


# ---------------------------------------------------------------------------
# Guide 11: Multi-Purpose & Flexible Rental System
# ---------------------------------------------------------------------------

async def _sync_venue_pricing_from_rental_options(session: AsyncSession, venue_id: uuid.UUID) -> None:
    """Updates venue.unit_type and venue.base_price from the cheapest enabled rental option."""
    result = await session.execute(
        select(VenueRentalOption)
        .where(VenueRentalOption.venue_id == venue_id, VenueRentalOption.enabled.is_(True))
        .order_by(VenueRentalOption.price.asc())
    )
    cheapest = result.scalars().first()
    if cheapest:
        venue = (await session.execute(select(Venue).where(Venue.id == venue_id))).scalar_one_or_none()
        if venue:
            venue.unit_type = cheapest.mode
            venue.base_price = cheapest.price


async def list_rental_options(
    session: AsyncSession,
    venue_id: uuid.UUID,
) -> list[VenueRentalOption]:
    result = await session.execute(
        select(VenueRentalOption)
        .where(VenueRentalOption.venue_id == venue_id)
        .order_by(VenueRentalOption.created_at.asc())
    )
    return list(result.scalars().all())


async def create_rental_option(
    session: AsyncSession,
    venue_id: uuid.UUID,
    viewer: CurrentUser,
    data: dict,
) -> VenueRentalOption:
    async with session.begin():
        venue = (await session.execute(select(Venue).where(Venue.id == venue_id))).scalar_one_or_none()
        if not venue:
            raise HTTPException(status_code=404, detail="Venue not found")
        from app.modules.auth.policies import authorize_venue_modify
        authorize_venue_modify(viewer, venue)

        mode = data.get("mode")
        existing = (
            await session.execute(
                select(VenueRentalOption).where(
                    VenueRentalOption.venue_id == venue_id,
                    VenueRentalOption.mode == mode,
                )
            )
        ).scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=409, detail=f"Rental option for mode '{mode}' already exists")

        opt = VenueRentalOption(venue_id=venue_id, **data)
        session.add(opt)
        await session.flush()
        await _sync_venue_pricing_from_rental_options(session, venue_id)
        opt_id = opt.id

    res = await session.execute(select(VenueRentalOption).where(VenueRentalOption.id == opt_id))
    return res.scalar_one()


async def update_rental_option(
    session: AsyncSession,
    venue_id: uuid.UUID,
    option_id: uuid.UUID,
    viewer: CurrentUser,
    data: dict,
) -> VenueRentalOption:
    async with session.begin():
        venue = (await session.execute(select(Venue).where(Venue.id == venue_id))).scalar_one_or_none()
        if not venue:
            raise HTTPException(status_code=404, detail="Venue not found")
        from app.modules.auth.policies import authorize_venue_modify
        authorize_venue_modify(viewer, venue)

        opt = (
            await session.execute(
                select(VenueRentalOption).where(
                    VenueRentalOption.id == option_id,
                    VenueRentalOption.venue_id == venue_id,
                )
            )
        ).scalar_one_or_none()
        if not opt:
            raise HTTPException(status_code=404, detail="Rental option not found")

        for k, v in data.items():
            if v is not None:
                setattr(opt, k, v)
        opt.updated_at = datetime.now(timezone.utc)
        await session.flush()
        await _sync_venue_pricing_from_rental_options(session, venue_id)

    res = await session.execute(select(VenueRentalOption).where(VenueRentalOption.id == option_id))
    return res.scalar_one()


async def delete_rental_option(
    session: AsyncSession,
    venue_id: uuid.UUID,
    option_id: uuid.UUID,
    viewer: CurrentUser,
) -> None:
    async with session.begin():
        venue = (await session.execute(select(Venue).where(Venue.id == venue_id))).scalar_one_or_none()
        if not venue:
            raise HTTPException(status_code=404, detail="Venue not found")
        from app.modules.auth.policies import authorize_venue_modify
        authorize_venue_modify(viewer, venue)

        opt = (
            await session.execute(
                select(VenueRentalOption).where(
                    VenueRentalOption.id == option_id,
                    VenueRentalOption.venue_id == venue_id,
                )
            )
        ).scalar_one_or_none()
        if not opt:
            raise HTTPException(status_code=404, detail="Rental option not found")

        await session.delete(opt)
        await session.flush()
        await _sync_venue_pricing_from_rental_options(session, venue_id)


async def list_purposes(
    session: AsyncSession,
    venue_id: uuid.UUID,
    viewer: CurrentUser | None = None,
) -> list[VenuePurpose]:
    venue = (await session.execute(select(Venue).where(Venue.id == venue_id))).scalar_one_or_none()
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    is_owner_or_admin = viewer is not None and (
        viewer.role == "admin" or (viewer.role == "owner" and venue.owner_id == viewer.id)
    )

    stmt = (
        select(VenuePurpose)
        .options(selectinload(VenuePurpose.use_case))
        .where(VenuePurpose.venue_id == venue_id)
    )
    if not is_owner_or_admin:
        stmt = stmt.where(
            VenuePurpose.enabled.is_(True),
            or_(
                VenuePurpose.use_case_id.isnot(None),
                VenuePurpose.is_custom_approved.is_(True),
            ),
        )
    stmt = stmt.order_by(VenuePurpose.created_at.asc())
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def create_purpose(
    session: AsyncSession,
    venue_id: uuid.UUID,
    viewer: CurrentUser,
    data: dict,
) -> VenuePurpose:
    async with session.begin():
        venue = (
            await session.execute(
                select(Venue).options(selectinload(Venue.use_cases)).where(Venue.id == venue_id)
            )
        ).scalar_one_or_none()
        if not venue:
            raise HTTPException(status_code=404, detail="Venue not found")
        from app.modules.auth.policies import authorize_venue_modify
        authorize_venue_modify(viewer, venue)

        use_case_id = data.get("use_case_id")
        custom_name = data.get("custom_name")
        if not use_case_id and not custom_name:
            raise HTTPException(status_code=422, detail="Must provide use_case_id or custom_name")

        is_custom_approved = None
        if custom_name and not use_case_id:
            is_custom_approved = False

        if use_case_id:
            uc = (await session.execute(select(UseCase).where(UseCase.id == use_case_id))).scalar_one_or_none()
            if not uc:
                raise HTTPException(status_code=404, detail="Use case not found")
            if uc not in venue.use_cases:
                venue.use_cases.append(uc)

        purpose = VenuePurpose(
            venue_id=venue_id,
            use_case_id=use_case_id,
            custom_name=custom_name,
            is_custom_approved=is_custom_approved,
            description=data.get("description"),
            max_guests=data.get("max_guests"),
            allowed_modes=data.get("allowed_modes"),
            price_override=data.get("price_override"),
            rules=data.get("rules"),
            enabled=data.get("enabled", True),
        )
        session.add(purpose)
        await session.flush()
        purpose_id = purpose.id

    stmt = select(VenuePurpose).options(selectinload(VenuePurpose.use_case)).where(VenuePurpose.id == purpose_id)
    return (await session.execute(stmt)).scalar_one()


async def update_purpose(
    session: AsyncSession,
    venue_id: uuid.UUID,
    purpose_id: uuid.UUID,
    viewer: CurrentUser,
    data: dict,
) -> VenuePurpose:
    async with session.begin():
        venue = (await session.execute(select(Venue).where(Venue.id == venue_id))).scalar_one_or_none()
        if not venue:
            raise HTTPException(status_code=404, detail="Venue not found")
        from app.modules.auth.policies import authorize_venue_modify
        authorize_venue_modify(viewer, venue)

        purpose = (
            await session.execute(
                select(VenuePurpose).where(
                    VenuePurpose.id == purpose_id,
                    VenuePurpose.venue_id == venue_id,
                )
            )
        ).scalar_one_or_none()
        if not purpose:
            raise HTTPException(status_code=404, detail="Purpose not found")

        for k, v in data.items():
            if v is not None:
                if k == "custom_name" and v != purpose.custom_name and purpose.use_case_id is None:
                    purpose.is_custom_approved = False
                setattr(purpose, k, v)
        purpose.updated_at = datetime.now(timezone.utc)

    stmt = select(VenuePurpose).options(selectinload(VenuePurpose.use_case)).where(VenuePurpose.id == purpose_id)
    return (await session.execute(stmt)).scalar_one()


async def delete_purpose(
    session: AsyncSession,
    venue_id: uuid.UUID,
    purpose_id: uuid.UUID,
    viewer: CurrentUser,
) -> None:
    async with session.begin():
        venue = (await session.execute(select(Venue).where(Venue.id == venue_id))).scalar_one_or_none()
        if not venue:
            raise HTTPException(status_code=404, detail="Venue not found")
        from app.modules.auth.policies import authorize_venue_modify
        authorize_venue_modify(viewer, venue)

        purpose = (
            await session.execute(
                select(VenuePurpose).where(
                    VenuePurpose.id == purpose_id,
                    VenuePurpose.venue_id == venue_id,
                )
            )
        ).scalar_one_or_none()
        if not purpose:
            raise HTTPException(status_code=404, detail="Purpose not found")

        await session.delete(purpose)


async def list_pending_custom_purposes(session: AsyncSession) -> list[VenuePurpose]:
    stmt = (
        select(VenuePurpose)
        .options(selectinload(VenuePurpose.venue))
        .where(
            VenuePurpose.is_custom_approved.is_(False),
            VenuePurpose.custom_name.isnot(None),
        )
        .order_by(VenuePurpose.created_at.desc())
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def moderate_custom_purpose(
    session: AsyncSession,
    purpose_id: uuid.UUID,
    approved: bool,
) -> VenuePurpose:
    async with session.begin():
        purpose = (
            await session.execute(select(VenuePurpose).where(VenuePurpose.id == purpose_id))
        ).scalar_one_or_none()
        if not purpose:
            raise HTTPException(status_code=404, detail="Purpose not found")

        purpose.is_custom_approved = approved
        purpose.updated_at = datetime.now(timezone.utc)

    stmt = select(VenuePurpose).options(selectinload(VenuePurpose.use_case)).where(VenuePurpose.id == purpose_id)
    return (await session.execute(stmt)).scalar_one()


async def add_venue_video_link(
    session: AsyncSession,
    venue_id: uuid.UUID,
    viewer: CurrentUser,
    url: str,
    thumbnail_url: str | None = None,
) -> VenueMedia:
    async with session.begin():
        venue = (await session.execute(select(Venue).where(Venue.id == venue_id))).scalar_one_or_none()
        if not venue:
            raise HTTPException(status_code=404, detail="Venue not found")
        from app.modules.auth.policies import authorize_venue_modify
        authorize_venue_modify(viewer, venue)

        existing = list(
            (
                await session.execute(
                    select(VenueMedia).where(VenueMedia.venue_id == venue_id)
                )
            ).scalars().all()
        )
        video_count = sum(1 for m in existing if getattr(m, "media_type", "image") == "video")
        if video_count >= 3:
            raise HTTPException(status_code=422, detail="Maximum 3 videos allowed per venue")

        media = VenueMedia(
            venue_id=venue_id,
            url=url,
            media_type="video",
            thumbnail_url=thumbnail_url,
            is_cover=False,
            sort_order=len(existing),
        )
        session.add(media)
        await session.flush()
        media_id = media.id

    return (await session.execute(select(VenueMedia).where(VenueMedia.id == media_id))).scalar_one()


async def reorder_venue_media(
    session: AsyncSession,
    venue_id: uuid.UUID,
    viewer: CurrentUser,
    ordered_ids: list[uuid.UUID],
) -> list[VenueMedia]:
    async with session.begin():
        venue = (await session.execute(select(Venue).where(Venue.id == venue_id))).scalar_one_or_none()
        if not venue:
            raise HTTPException(status_code=404, detail="Venue not found")
        from app.modules.auth.policies import authorize_venue_modify
        authorize_venue_modify(viewer, venue)

        existing = {
            m.id: m
            for m in (
                await session.execute(
                    select(VenueMedia).where(VenueMedia.venue_id == venue_id).with_for_update()
                )
            ).scalars().all()
        }

        for idx, mid in enumerate(ordered_ids):
            if mid in existing:
                existing[mid].sort_order = idx

    result = await session.execute(
        select(VenueMedia)
        .where(VenueMedia.venue_id == venue_id)
        .order_by(VenueMedia.sort_order.asc())
    )
    return list(result.scalars().all())


async def get_venue_availability(
    session: AsyncSession,
    venue_id: uuid.UUID | str,
    date_from: date_,
    date_to: date_,
    purpose_id: uuid.UUID | None = None,
    viewer: CurrentUser | None = None,
) -> list[dict]:
    venue = await get_venue(session, venue_id, viewer)
    actual_venue_id = venue.id

    ro_result = await session.execute(
        select(VenueRentalOption).where(
            VenueRentalOption.venue_id == actual_venue_id,
            VenueRentalOption.enabled.is_(True),
        )
    )
    rental_options = list(ro_result.scalars().all())
    enabled_modes = {ro.mode for ro in rental_options}
    if not enabled_modes:
        enabled_modes = {venue.unit_type}

    if purpose_id is not None:
        p_res = await session.execute(
            select(VenuePurpose).where(
                VenuePurpose.id == purpose_id,
                VenuePurpose.venue_id == actual_venue_id,
            )
        )
        purpose = p_res.scalar_one_or_none()
        if purpose and purpose.allowed_modes:
            enabled_modes = enabled_modes.intersection(set(purpose.allowed_modes))

    all_units_res = await session.execute(
        select(InventoryUnit).where(
            InventoryUnit.venue_id == actual_venue_id,
            InventoryUnit.date >= date_from,
            InventoryUnit.date <= date_to,
        )
    )
    all_units = list(all_units_res.scalars().all())

    bookable_units = await list_inventory_units_for_venue(
        session, actual_venue_id, viewer=None, date_from=date_from, date_to=date_to, include_all=False
    )
    bookable_by_id = {u.id for u in bookable_units}

    results = []
    curr = date_from
    while curr <= date_to:
        day_all = [u for u in all_units if u.date == curr]
        day_bookable = [u for u in day_all if u.id in bookable_by_id]

        hourly_all = [u for u in day_all if u.start_time is not None and u.end_time is not None]
        hourly_bookable = [u for u in day_bookable if u.start_time is not None and u.end_time is not None]

        full_day_unit = next((u for u in day_all if u.start_time is None or (u.start_time == time(0, 0) and u.end_time is None)), None)
        is_full_day_available = (
            ("full_day" in enabled_modes)
            and (full_day_unit is not None and full_day_unit.id in bookable_by_id)
        )

        modes = []
        if is_full_day_available:
            modes.append("full_day")
        if hourly_bookable and "hour" in enabled_modes:
            modes.append("hour")

        results.append({
            "date": curr,
            "is_full_day_available": is_full_day_available,
            "hourly_slots_total": len(hourly_all),
            "hourly_slots_available": len(hourly_bookable),
            "available_rental_modes": modes,
        })
        curr += timedelta(days=1)

    return results

"""
Pydantic schemas for the homepage curation system.

Design principles:
- HomepagePlacementCreate  — what admin POSTs to add a venue to a section
- HomepagePlacementUpdate  — what admin PATCHes to change a placement
- HomepagePlacementResponse — what admin reads back (full detail)
- HomepageVenueCard         — what the *public* homepage receives per venue
                             (minimal, no owner/internal data leaked)
- HomepageSectionResponse  — one section's ordered list (public)
- HomepageResponse          — all sections at once (public endpoint)
"""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

# Valid section keys — enforced in the service layer.
VALID_SECTIONS: set[str] = {"featured", "trending", "popular", "recommended", "new"}

HomepageSection = Literal["featured", "trending", "popular", "recommended", "new"]


# ---------------------------------------------------------------------------
# Admin-facing schemas
# ---------------------------------------------------------------------------

class HomepagePlacementCreate(BaseModel):
    venue_id: uuid.UUID
    section: HomepageSection
    enabled: bool = True
    priority: int = Field(default=0, ge=0)
    badge: str | None = Field(default=None, max_length=100)
    custom_title: str | None = Field(default=None, max_length=255)
    custom_description: str | None = Field(default=None, max_length=2000)
    start_at: datetime | None = None
    end_at: datetime | None = None


class HomepagePlacementUpdate(BaseModel):
    """Every field optional — PATCH semantics."""
    section: HomepageSection | None = None
    enabled: bool | None = None
    priority: int | None = Field(default=None, ge=0)
    badge: str | None = Field(default=None, max_length=100)
    custom_title: str | None = Field(default=None, max_length=255)
    custom_description: str | None = Field(default=None, max_length=2000)
    start_at: datetime | None = None
    end_at: datetime | None = None


class HomepageVenueMediaSummary(BaseModel):
    id: uuid.UUID
    url: str
    is_cover: bool

    model_config = {"from_attributes": True}


class HomepagePlacementVenueSummary(BaseModel):
    """Venue fields embedded in an admin placement response."""
    id: uuid.UUID
    name: str
    slug: str
    city: str
    state: str | None
    category: str
    status: str
    avg_rating: Decimal
    base_price: Decimal
    images: list[HomepageVenueMediaSummary] = []

    model_config = {"from_attributes": True}


from app.schemas.catalog import VenueMediaResponse

class HomepagePlacementResponse(BaseModel):
    """Admin-facing placement record — includes venue snapshot and all fields."""
    id: uuid.UUID
    venue_id: uuid.UUID
    section: str
    enabled: bool
    priority: int
    badge: str | None
    custom_title: str | None
    custom_description: str | None
    start_at: datetime | None
    end_at: datetime | None
    created_at: datetime
    updated_at: datetime
    venue: HomepagePlacementVenueSummary | None = None

    model_config = {"from_attributes": True}

    @classmethod
    def from_placement(cls, p) -> "HomepagePlacementResponse":
        venue_data = None
        if p.venue is not None:
            venue_data = HomepagePlacementVenueSummary(
                id=p.venue.id,
                name=p.venue.name,
                slug=p.venue.slug,
                city=p.venue.city,
                state=p.venue.state,
                category=p.venue.category,
                status=p.venue.status,
                avg_rating=p.venue.avg_rating,
                base_price=p.venue.base_price,
                images=[HomepageVenueMediaSummary.model_validate(i) for i in p.venue.media],
            )
        return cls(
            id=p.id,
            venue_id=p.venue_id,
            section=p.section,
            enabled=p.enabled,
            priority=p.priority,
            badge=p.badge,
            custom_title=p.custom_title,
            custom_description=p.custom_description,
            start_at=p.start_at,
            end_at=p.end_at,
            created_at=p.created_at,
            updated_at=p.updated_at,
            venue=venue_data,
        )


class SectionReorderRequest(BaseModel):
    """List of placement IDs in the desired new order for a section.
    The service sets priority = index position (0-based)."""
    ordered_ids: list[uuid.UUID] = Field(min_length=1)


# ---------------------------------------------------------------------------
# Public-facing schemas — no owner/internal data
# ---------------------------------------------------------------------------

class HomepageVenueCard(BaseModel):
    """Minimal venue shape for homepage rendering.

    Deliberately does NOT include: owner_id, owner details, rejection_reason,
    suspension_reason, pending_changes, or any internal audit fields.
    """
    id: uuid.UUID
    name: str
    slug: str
    city: str
    state: str | None
    category: str
    avg_rating: Decimal
    base_price: Decimal
    unit_type: str
    description: str | None
    cover_image_url: str | None
    # Placement-specific overlay fields
    badge: str | None
    custom_title: str | None
    custom_description: str | None


class HomepageSection(BaseModel):
    section: str
    venues: list[HomepageVenueCard]


class HomepageResponse(BaseModel):
    featured: list[HomepageVenueCard] = []
    trending: list[HomepageVenueCard] = []
    popular: list[HomepageVenueCard] = []
    recommended: list[HomepageVenueCard] = []
    new: list[HomepageVenueCard] = []

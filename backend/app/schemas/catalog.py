import uuid
from datetime import date as date_, datetime, time
from decimal import Decimal

from pydantic import BaseModel, Field


class VenueCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    category: str
    address: str
    city: str
    unit_type: str
    base_price: Decimal = Field(ge=0)
    description: str | None = None
    state: str | None = None
    pincode: str | None = None
    capacity: int | None = Field(default=None, gt=0)
    amenity_names: list[str] | None = None


class VenueUpdateRequest(BaseModel):
    """Every field optional — PATCH semantics. catalog.service.update_venue
    only treats a field as 'changed' if the new value differs from what's
    already stored, so resubmitting identical values is a no-op, not a
    re-review trigger."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    category: str | None = None
    description: str | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    pincode: str | None = None
    capacity: int | None = Field(default=None, gt=0)
    unit_type: str | None = None
    base_price: Decimal | None = Field(default=None, ge=0)
    amenity_names: list[str] | None = None


class VenueImageResponse(BaseModel):
    id: uuid.UUID
    url: str
    is_cover: bool
    sort_order: int

    model_config = {"from_attributes": True}


class VenueResponse(BaseModel):
    id: uuid.UUID
    owner_id: uuid.UUID
    name: str
    slug: str
    category: str
    description: str | None
    address: str
    city: str
    state: str | None
    pincode: str | None
    capacity: int | None
    unit_type: str
    base_price: Decimal
    status: str
    rejection_reason: str | None
    suspension_reason: str | None
    pending_changes: dict | None = None
    avg_rating: Decimal
    images: list[VenueImageResponse] = []
    amenities: list[str] = []
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_venue(cls, venue) -> "VenueResponse":
        return cls(
            id=venue.id,
            owner_id=venue.owner_id,
            name=venue.name,
            slug=venue.slug,
            category=venue.category,
            description=venue.description,
            address=venue.address,
            city=venue.city,
            state=venue.state,
            pincode=venue.pincode,
            capacity=venue.capacity,
            unit_type=venue.unit_type,
            base_price=venue.base_price,
            status=venue.status,
            rejection_reason=venue.rejection_reason,
            suspension_reason=venue.suspension_reason,
            pending_changes=getattr(venue, "pending_changes", None),
            avg_rating=venue.avg_rating,
            images=[VenueImageResponse.model_validate(i) for i in venue.images],
            amenities=[a.name for a in venue.amenities],
            created_at=venue.created_at,
        )


class VenueListResponse(BaseModel):
    """TRD §3's standard pagination envelope."""

    data: list[VenueResponse]
    total: int
    limit: int
    offset: int


class InventoryUnitCreateRequest(BaseModel):
    date: date_
    start_time: time | None = None
    end_time: time | None = None
    price: Decimal | None = Field(default=None, ge=0)


class InventoryUnitBatchCreateRequest(BaseModel):
    units: list[InventoryUnitCreateRequest] = Field(min_length=1, max_length=200)


class InventoryUnitResponse(BaseModel):
    id: uuid.UUID
    date: date_
    start_time: time | None
    end_time: time | None
    price: Decimal
    status: str

    model_config = {"from_attributes": True}


class VenueRejectRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=1000)


class ReviewCreateRequest(BaseModel):
    rating: int = Field(ge=1, le=5)
    content: str = Field(min_length=1, max_length=2000)


class ReviewResponse(BaseModel):
    id: uuid.UUID
    venue_id: uuid.UUID
    user_id: uuid.UUID
    user_name: str
    rating: int
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}

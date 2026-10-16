import uuid
from datetime import date as date_, datetime, time
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class VenueContentBlockCreate(BaseModel):
    type: str
    title: str | None = None
    subtitle: str | None = None
    body: str | None = None
    media_reference: str | None = None
    settings: dict | None = None
    sort_order: int = 0
    enabled: bool = True

class VenueContentBlockResponse(BaseModel):
    id: uuid.UUID
    venue_id: uuid.UUID
    type: str
    title: str | None
    subtitle: str | None
    body: str | None
    media_reference: str | None
    settings: dict | None
    sort_order: int
    enabled: bool

    model_config = {"from_attributes": True}


class VenueCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    display_name: str | None = None
    tagline: str | None = None
    category: str | None = None
    category_id: uuid.UUID | None = None
    venue_type_id: uuid.UUID | None = None
    use_case_ids: list[uuid.UUID] | None = None
    address: str
    city: str
    unit_type: Literal["hour", "half_day", "full_day"]
    base_price: Decimal = Field(ge=0)
    description: str | None = None
    state: str | None = None
    pincode: str | None = None
    capacity: int | None = Field(default=None, gt=0)
    amenity_names: list[str] | None = None
    content_blocks: list[VenueContentBlockCreate] | None = None
    status: str | None = None
    save_as_draft: bool = False

    @model_validator(mode="after")
    def validate_category_presence(self) -> "VenueCreateRequest":
        if not self.category and not self.category_id:
            raise ValueError("At least one of category or category_id must be provided")
        return self


class VenueUpdateRequest(BaseModel):
    """Every field optional — PATCH semantics. catalog.service.update_venue
    only treats a field as 'changed' if the new value differs from what's
    already stored, so resubmitting identical values is a no-op, not a
    re-review trigger."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    display_name: str | None = None
    tagline: str | None = None
    category: str | None = None
    category_id: uuid.UUID | None = None
    venue_type_id: uuid.UUID | None = None
    use_case_ids: list[uuid.UUID] | None = None
    description: str | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    pincode: str | None = None
    capacity: int | None = Field(default=None, gt=0)
    unit_type: Literal["hour", "half_day", "full_day"] | None = None
    base_price: Decimal | None = Field(default=None, ge=0)
    amenity_names: list[str] | None = None
    content_blocks: list[VenueContentBlockCreate] | None = None
    status: str | None = None




class CategoryResponse(BaseModel):
    id: uuid.UUID
    name: str
    model_config = {"from_attributes": True}

class VenueTypeResponse(BaseModel):
    id: uuid.UUID
    category_id: uuid.UUID
    name: str
    model_config = {"from_attributes": True}

class UseCaseResponse(BaseModel):
    id: uuid.UUID
    name: str
    model_config = {"from_attributes": True}

class VenueMediaResponse(BaseModel):
    id: uuid.UUID
    url: str
    is_cover: bool
    sort_order: int

    model_config = {"from_attributes": True}


class VenueResponse(BaseModel):
    id: uuid.UUID
    owner_id: uuid.UUID
    name: str
    display_name: str | None
    tagline: str | None
    slug: str
    category: str
    category_id: uuid.UUID | None = None
    venue_type_id: uuid.UUID | None = None
    use_case_ids: list[uuid.UUID] = []
    venue_type_name: str | None = None
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
    media: list[VenueMediaResponse] = []
    content_blocks: list[VenueContentBlockResponse] = []
    amenities: list[str] = []
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_venue(cls, venue) -> "VenueResponse | None":
        if venue is None:
            return None
        from sqlalchemy.orm import attributes
        state = attributes.instance_state(venue)
        use_cases = state.dict.get("use_cases") or []
        venue_type = state.dict.get("venue_type")
        media = state.dict.get("media") or []
        content_blocks = state.dict.get("content_blocks") or []
        amenities = state.dict.get("amenities") or []

        return cls(
            id=venue.id,
            owner_id=venue.owner_id,
            name=venue.name,
            display_name=getattr(venue, "display_name", None),
            tagline=getattr(venue, "tagline", None),
            slug=venue.slug,
            category=venue.category,
            category_id=getattr(venue, "category_id", None),
            venue_type_id=getattr(venue, "venue_type_id", None),
            use_case_ids=[uc.id for uc in use_cases],
            venue_type_name=venue_type.name if venue_type else None,
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
            media=[VenueMediaResponse.model_validate(i) for i in media],
            content_blocks=[VenueContentBlockResponse.model_validate(i) for i in content_blocks],
            amenities=[a.name for a in amenities],
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
    booking_id: uuid.UUID | None = None
    rating: int = Field(ge=1, le=5)
    content: str = Field(min_length=1, max_length=2000)


class ReviewResponse(BaseModel):
    id: uuid.UUID
    venue_id: uuid.UUID
    user_id: uuid.UUID
    booking_id: uuid.UUID | None = None
    user_name: str
    rating: int
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}

class BlockCreateRequest(BaseModel):
    start_time: datetime
    end_time: datetime
    reason: str = Field(min_length=1, max_length=1000)
    inventory_unit_id: uuid.UUID | None = None

class BlockResponse(BaseModel):
    id: uuid.UUID
    venue_id: uuid.UUID
    inventory_unit_id: uuid.UUID | None
    start_time: datetime
    end_time: datetime
    reason: str
    status: str
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

class PricingRuleCreate(BaseModel):
    name: str
    rule_type: str
    adjustment_type: str
    adjustment_value: Decimal
    start_date: date_ | None = None
    end_date: date_ | None = None
    start_time: time | None = None
    end_time: time | None = None
    days_of_week: list[int] | None = None
    priority: int = 0
    is_active: bool = True

class PricingRuleUpdate(BaseModel):
    name: str | None = None
    rule_type: str | None = None
    adjustment_type: str | None = None
    adjustment_value: Decimal | None = None
    start_date: date_ | None = None
    end_date: date_ | None = None
    start_time: time | None = None
    end_time: time | None = None
    days_of_week: list[int] | None = None
    priority: int | None = None
    is_active: bool | None = None

class PricingRuleResponse(PricingRuleCreate):
    id: uuid.UUID
    venue_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    
    model_config = {'from_attributes': True}


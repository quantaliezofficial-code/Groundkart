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


class VenueRentalOptionResponse(BaseModel):
    id: uuid.UUID
    venue_id: uuid.UUID
    mode: str
    price: Decimal
    open_time: time | None = None
    close_time: time | None = None
    slot_minutes: int | None = None
    min_minutes: int | None = None
    max_minutes: int | None = None
    buffer_minutes: int = 0
    enabled: bool = True
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class VenueRentalOptionCreate(BaseModel):
    mode: Literal["hour", "half_day", "full_day"]
    price: Decimal = Field(ge=0)
    open_time: time | None = None
    close_time: time | None = None
    slot_minutes: int | None = None
    min_minutes: int | None = None
    max_minutes: int | None = None
    buffer_minutes: int = 0
    enabled: bool = True


class VenueRentalOptionUpdate(BaseModel):
    price: Decimal | None = Field(default=None, ge=0)
    open_time: time | None = None
    close_time: time | None = None
    slot_minutes: int | None = None
    min_minutes: int | None = None
    max_minutes: int | None = None
    buffer_minutes: int | None = None
    enabled: bool | None = None


class VenuePurposeResponse(BaseModel):
    id: uuid.UUID
    venue_id: uuid.UUID
    use_case_id: uuid.UUID | None = None
    custom_name: str | None = None
    name: str | None = None
    is_custom_approved: bool | None = None
    description: str | None = None
    max_guests: int | None = None
    allowed_modes: list[str] | None = None
    price_override: Decimal | None = None
    rules: str | None = None
    enabled: bool = True
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class VenuePurposeCreate(BaseModel):
    use_case_id: uuid.UUID | None = None
    custom_name: str | None = None
    description: str | None = None
    max_guests: int | None = None
    allowed_modes: list[str] | None = None
    price_override: Decimal | None = Field(default=None, ge=0)
    rules: str | None = None
    enabled: bool = True


class VenuePurposeUpdate(BaseModel):
    custom_name: str | None = None
    description: str | None = None
    max_guests: int | None = None
    allowed_modes: list[str] | None = None
    price_override: Decimal | None = Field(default=None, ge=0)
    rules: str | None = None
    enabled: bool | None = None


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
    rental_options: list[VenueRentalOptionCreate] | None = None
    purposes: list[VenuePurposeCreate] | None = None
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
    rental_options: list[VenueRentalOptionCreate] | None = None
    purposes: list[VenuePurposeCreate] | None = None
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
    media_type: str = "image"
    thumbnail_url: str | None = None
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
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    capacity: int | None
    unit_type: str
    base_price: Decimal
    status: str
    rejection_reason: str | None
    suspension_reason: str | None
    pending_changes: dict | None = None
    avg_rating: Decimal
    review_count: int = 0
    media: list[VenueMediaResponse] = []
    content_blocks: list[VenueContentBlockResponse] = []
    rental_options: list[VenueRentalOptionResponse] = []
    purposes: list[VenuePurposeResponse] = []
    amenities: list[str] = []
    use_cases: list[str] = []
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
        raw_options = state.dict.get("rental_options") or []
        raw_purposes = state.dict.get("purposes") or []
        reviews = state.dict.get("reviews")
        review_count = len(reviews) if reviews is not None else 0

        purposes_out = []
        for p in raw_purposes:
            p_dict = {
                "id": p.id,
                "venue_id": p.venue_id,
                "use_case_id": p.use_case_id,
                "custom_name": p.custom_name,
                "name": p.use_case.name if (getattr(p, "use_case", None) and p.use_case) else p.custom_name,
                "is_custom_approved": p.is_custom_approved,
                "description": p.description,
                "max_guests": p.max_guests,
                "allowed_modes": p.allowed_modes,
                "price_override": p.price_override,
                "rules": p.rules,
                "enabled": p.enabled,
                "created_at": p.created_at,
                "updated_at": p.updated_at,
            }
            purposes_out.append(VenuePurposeResponse(**p_dict))

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
            latitude=getattr(venue, "latitude", None),
            longitude=getattr(venue, "longitude", None),
            capacity=venue.capacity,
            unit_type=venue.unit_type,
            base_price=venue.base_price,
            status=venue.status,
            rejection_reason=venue.rejection_reason,
            suspension_reason=venue.suspension_reason,
            pending_changes=getattr(venue, "pending_changes", None),
            avg_rating=venue.avg_rating,
            review_count=review_count,
            media=[VenueMediaResponse.model_validate(i) for i in media],
            content_blocks=[VenueContentBlockResponse.model_validate(i) for i in content_blocks],
            rental_options=[VenueRentalOptionResponse.model_validate(r) for r in raw_options],
            purposes=purposes_out,
            amenities=[a.name for a in amenities],
            use_cases=[uc.name for uc in use_cases] if use_cases else [],
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


class DateAvailabilityResponse(BaseModel):
    date: date_
    is_full_day_available: bool
    hourly_slots_total: int
    hourly_slots_available: int
    available_rental_modes: list[str] = []


class MediaLinkCreateRequest(BaseModel):
    url: str = Field(min_length=1)
    thumbnail_url: str | None = None


class MediaReorderRequest(BaseModel):
    ordered_ids: list[uuid.UUID]


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


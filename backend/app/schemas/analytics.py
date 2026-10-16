from datetime import date
from decimal import Decimal
from pydantic import BaseModel, Field
import uuid

class AnalyticsMetrics(BaseModel):
    gmv: Decimal = Field(default=Decimal("0.00"), description="Total gross merchandise value")
    retained_gmv: Decimal = Field(default=Decimal("0.00"), description="Total GMV minus refunds")
    refunds: Decimal = Field(default=Decimal("0.00"), description="Total amount refunded")
    platform_revenue: Decimal = Field(default=Decimal("0.00"), description="Platform commission revenue")
    owner_payout: Decimal = Field(default=Decimal("0.00"), description="Amount paid out or owed to owner")
    booking_count: int = Field(default=0, description="Number of bookings")
    utilization: float | None = Field(default=None, description="Percentage of capacity booked (0.0 to 1.0)")
    cancellation_rate: float = Field(default=0.0, description="Cancelled bookings / Total bookings (0.0 to 1.0)")
    average_booking_value: Decimal = Field(default=Decimal("0.00"), description="GMV / Booking count")
    repeat_rate: float | None = Field(default=None, description="Percentage of bookings made by repeat customers")

class AnalyticsFilter(BaseModel):
    start_date: date
    end_date: date
    venue_id: uuid.UUID | None = None
    owner_id: uuid.UUID | None = None

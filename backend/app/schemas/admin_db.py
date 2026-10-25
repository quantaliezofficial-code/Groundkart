from __future__ import annotations

import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import Any
from pydantic import BaseModel, Field


class TableCatalogItem(BaseModel):
    table_name: str
    row_count: int
    total_size: str
    table_size: str
    index_size: str
    columns_count: int = 0


class DatabaseStatsResponse(BaseModel):
    db_connected: bool
    database_name: str
    postgres_version: str
    alembic_version: str | None
    database_size: str
    active_connections: int
    cache_hit_ratio: float
    total_tables: int
    total_rows: int
    tables: list[TableCatalogItem]


class ColumnMetadata(BaseModel):
    name: str
    data_type: str
    is_nullable: bool
    is_primary_key: bool = False


class TableDataResponse(BaseModel):
    table_name: str
    columns: list[ColumnMetadata]
    total_rows: int
    limit: int
    offset: int
    rows: list[dict[str, Any]]


class SafeQueryRequest(BaseModel):
    sql: str = Field(..., min_length=1, max_length=5000, description="Read-only SQL query to execute")


class SafeQueryResponse(BaseModel):
    columns: list[str]
    rows: list[dict[str, Any]]
    row_count: int
    duration_ms: float
    truncated: bool = False


class DailyBookingMetric(BaseModel):
    day: str
    bookings_count: int
    gmv: float


class StatusCountMetric(BaseModel):
    status: str
    count: int
    percentage: float


class RoleCountMetric(BaseModel):
    role: str
    count: int


class TopVenueMetric(BaseModel):
    id: str
    name: str
    bookings_count: int
    gmv: float


class DatabaseAnalyticsResponse(BaseModel):
    days: int
    total_bookings: int
    total_gmv: float
    average_booking_value: float
    active_venues_count: int
    bookings_trend: list[DailyBookingMetric]
    booking_status_distribution: list[StatusCountMetric]
    user_roles_distribution: list[RoleCountMetric]
    venue_status_distribution: list[StatusCountMetric]
    top_venues: list[TopVenueMetric]

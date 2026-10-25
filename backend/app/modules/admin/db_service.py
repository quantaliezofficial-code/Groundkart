"""
Admin Database Studio Service
Provides database monitoring, live table inspection, safe read-only SQL query execution,
aggregated time-series analytics, and CSV exports for GroundKart.
"""
from __future__ import annotations

import csv
import io
import re
import time
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession


FORBIDDEN_SQL_PATTERN = re.compile(
    r"\b(ALTER|CREATE|DROP|TRUNCATE|DELETE|UPDATE|INSERT|REPLACE|GRANT|REVOKE|VACUUM|EXEC|EXECUTE|CALL|COPY|DO|REINDEX|RESET|SET|LISTEN|NOTIFY)\b",
    re.IGNORECASE,
)


def _serialize_value(val: Any) -> Any:
    """Serialize database types to JSON-safe primitives."""
    if val is None:
        return None
    if isinstance(val, (datetime, date)):
        return val.isoformat()
    if isinstance(val, uuid.UUID):
        return str(val)
    if isinstance(val, Decimal):
        return float(val)
    if isinstance(val, (bytes, memoryview)):
        return f"<binary {len(val)} bytes>"
    if isinstance(val, dict):
        return {k: _serialize_value(v) for k, v in val.items()}
    if isinstance(val, (list, tuple)):
        return [_serialize_value(v) for v in val]
    return val


async def get_database_stats(session: AsyncSession) -> dict:
    """Retrieve comprehensive database health, version, size, and table statistics."""
    # 1. Version and Database Name
    version_row = (await session.execute(text("SELECT version();"))).scalar() or "Unknown"
    dbname_row = (await session.execute(text("SELECT current_database();"))).scalar() or "Unknown"
    
    # 2. Alembic Version
    alembic_rev = None
    try:
        alembic_res = await session.execute(text("SELECT version_num FROM alembic_version LIMIT 1;"))
        alembic_rev = alembic_res.scalar()
    except Exception:
        pass

    # 3. Database Size
    db_size = (await session.execute(text("SELECT pg_size_pretty(pg_database_size(current_database()));"))).scalar() or "0 bytes"

    # 4. Active Connections
    conn_res = await session.execute(
        text("SELECT count(*) FROM pg_stat_activity WHERE datname = current_database();")
    )
    active_conns = conn_res.scalar() or 1

    # 5. Cache Hit Ratio
    cache_ratio = 99.8
    try:
        cache_res = await session.execute(text("""
            SELECT 
                round((sum(heap_blks_hit) * 100.0) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0), 2)
            FROM pg_statio_user_tables;
        """))
        ratio_val = cache_res.scalar()
        if ratio_val is not None:
            cache_ratio = float(ratio_val)
    except Exception:
        pass

    # 6. Public Table Catalog
    tables_query = text("""
        SELECT 
            c.relname AS table_name,
            pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
            pg_size_pretty(pg_relation_size(c.oid)) AS table_size,
            pg_size_pretty(pg_indexes_size(c.oid)) AS index_size
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
        ORDER BY c.relname;
    """)
    catalog_rows = (await session.execute(tables_query)).fetchall()

    # Get column counts
    col_counts_q = text("""
        SELECT table_name, count(*) 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        GROUP BY table_name;
    """)
    col_counts = dict((await session.execute(col_counts_q)).fetchall())

    # Get live row counts via UNION ALL
    counts_map = {}
    if catalog_rows:
        try:
            count_sqls = " UNION ALL ".join([
                f"SELECT '{row.table_name}' AS tbl, count(*)::bigint AS cnt FROM \"{row.table_name}\""
                for row in catalog_rows
            ])
            counts_res = (await session.execute(text(count_sqls))).fetchall()
            counts_map = {r[0]: int(r[1]) for r in counts_res}
        except Exception:
            pass

    tables = []
    total_rows = 0
    for r in catalog_rows:
        cnt = counts_map.get(r.table_name, 0)
        total_rows += cnt
        tables.append({
            "table_name": r.table_name,
            "row_count": cnt,
            "total_size": r.total_size,
            "table_size": r.table_size,
            "index_size": r.index_size,
            "columns_count": col_counts.get(r.table_name, 0),
        })

    return {
        "db_connected": True,
        "database_name": dbname_row,
        "postgres_version": version_row.split(",")[0],
        "alembic_version": alembic_rev,
        "database_size": db_size,
        "active_connections": int(active_conns),
        "cache_hit_ratio": cache_ratio,
        "total_tables": len(tables),
        "total_rows": total_rows,
        "tables": tables,
    }


async def _verify_table_exists(session: AsyncSession, table_name: str) -> None:
    """Ensure table exists in public schema to prevent arbitrary table access."""
    chk = await session.execute(
        text("SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = :t"),
        {"t": table_name},
    )
    if not chk.scalar():
        raise HTTPException(status_code=404, detail=f"Table '{table_name}' does not exist in public schema.")


async def get_table_data(
    session: AsyncSession,
    table_name: str,
    limit: int = 50,
    offset: int = 0,
    order_by: str | None = None,
    order_dir: str = "asc",
    search: str | None = None,
) -> dict:
    """Fetch paginated rows and schema metadata for any public table with filtering and sorting."""
    await _verify_table_exists(session, table_name)

    # 1. Fetch column metadata
    col_q = text("""
        SELECT 
            c.column_name, 
            c.data_type, 
            c.is_nullable,
            CASE WHEN pk.column_name IS NOT NULL THEN TRUE ELSE FALSE END AS is_pk
        FROM information_schema.columns c
        LEFT JOIN (
            SELECT kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
            WHERE tc.constraint_type = 'PRIMARY KEY' 
              AND tc.table_schema = 'public' 
              AND tc.table_name = :t
        ) pk ON pk.column_name = c.column_name
        WHERE c.table_schema = 'public' AND c.table_name = :t
        ORDER BY c.ordinal_position;
    """)
    cols_res = (await session.execute(col_q, {"t": table_name})).fetchall()
    columns = [
        {
            "name": r[0],
            "data_type": r[1],
            "is_nullable": r[2] == "YES",
            "is_primary_key": bool(r[3]),
        }
        for r in cols_res
    ]
    column_names = {c["name"] for c in columns}

    # 2. Build where clause if search is provided
    where_clauses = []
    params: dict[str, Any] = {"limit": min(limit, 200), "offset": max(offset, 0)}

    if search and search.strip():
        search_term = f"%{search.strip()}%"
        params["search"] = search_term
        # Search across text, varchar, and uuid columns
        text_cols = [c["name"] for c in columns if c["data_type"] in ("text", "character varying", "uuid")]
        if text_cols:
            or_parts = [f"CAST(\"{col}\" AS TEXT) ILIKE :search" for col in text_cols]
            where_clauses.append(f"({' OR '.join(or_parts)})")

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    # 3. Total count for this query
    count_q = text(f"SELECT count(*) FROM \"{table_name}\" {where_sql}")
    total_rows = (await session.execute(count_q, params)).scalar() or 0

    # 4. Sorting
    order_clause = ""
    if order_by and order_by in column_names:
        dir_sql = "DESC" if order_dir.lower() == "desc" else "ASC"
        order_clause = f"ORDER BY \"{order_by}\" {dir_sql}"
    else:
        # Default sort by primary key or created_at if available
        if "created_at" in column_names:
            order_clause = "ORDER BY \"created_at\" DESC"
        elif "id" in column_names:
            order_clause = "ORDER BY \"id\" DESC"

    # 5. Fetch rows
    data_sql = f"SELECT * FROM \"{table_name}\" {where_sql} {order_clause} LIMIT :limit OFFSET :offset"
    rows_res = await session.execute(text(data_sql), params)
    raw_rows = rows_res.fetchall()

    serialized_rows = []
    for r in raw_rows:
        row_dict = dict(r._mapping)
        serialized_rows.append({k: _serialize_value(v) for k, v in row_dict.items()})

    return {
        "table_name": table_name,
        "columns": columns,
        "total_rows": total_rows,
        "limit": params["limit"],
        "offset": params["offset"],
        "rows": serialized_rows,
    }


async def execute_safe_query(session: AsyncSession, sql: str) -> dict:
    """
    Execute an arbitrary read-only SQL query with safety validation,
    capped results, and execution performance metrics.
    """
    clean_sql = sql.strip().rstrip(";")
    if not clean_sql:
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    # 1. Structural check: Must start with SELECT or WITH (CTEs)
    if not re.match(r"^(SELECT|WITH)\b", clean_sql, re.IGNORECASE):
        raise HTTPException(
            status_code=400,
            detail="Forbidden query. Only read-only SELECT and WITH statements are permitted.",
        )

    # 2. Token check: Forbid any modifying or system operations
    forbidden_match = FORBIDDEN_SQL_PATTERN.search(clean_sql)
    if forbidden_match:
        raise HTTPException(
            status_code=400,
            detail=f"Forbidden keyword '{forbidden_match.group(0).upper()}' detected. Read-only queries only.",
        )

    # 3. Limit capping: Wrap or ensure limit <= 500
    capped_sql = f"SELECT * FROM ({clean_sql}) AS _safe_query_limit LIMIT 500;"

    start_time = time.perf_counter()
    try:
        # Set transaction read-only as database-level enforcement
        await session.execute(text("SET TRANSACTION READ ONLY;"))
        result = await session.execute(text(capped_sql))
        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

        keys = list(result.keys())
        raw_rows = result.fetchall()
        serialized_rows = [
            {k: _serialize_value(v) for k, v in dict(r._mapping).items()}
            for r in raw_rows
        ]

        return {
            "columns": keys,
            "rows": serialized_rows,
            "row_count": len(serialized_rows),
            "duration_ms": duration_ms,
            "truncated": len(serialized_rows) == 500,
        }
    except DBAPIError as exc:
        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        err_msg = str(exc.orig) if hasattr(exc, "orig") else str(exc)
        raise HTTPException(
            status_code=400,
            detail=f"SQL Execution Error ({duration_ms}ms): {err_msg}",
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Query error: {str(exc)}")


async def get_db_analytics(session: AsyncSession, days: int = 30) -> dict:
    """Aggregate platform analytics and time-series distributions for graphical rendering."""
    days = max(7, min(days, 365))
    delta = timedelta(days=days - 1)

    # 1. Bookings Trend over the last N days
    trend_q = text("""
        SELECT 
            TO_CHAR(d.day, 'YYYY-MM-DD') AS day,
            count(b.id) AS bookings_count,
            coalesce(sum(b.amount), 0) AS gmv
        FROM generate_series(CURRENT_DATE - CAST(:days_interval AS INTERVAL), CURRENT_DATE, '1 day'::interval) d(day)
        LEFT JOIN bookings b 
          ON TO_CHAR(b.created_at, 'YYYY-MM-DD') = TO_CHAR(d.day, 'YYYY-MM-DD')
        GROUP BY d.day
        ORDER BY d.day ASC;
    """)
    trend_rows = (await session.execute(trend_q, {"days_interval": delta})).fetchall()
    bookings_trend = [
        {
            "day": r[0],
            "bookings_count": int(r[1]),
            "gmv": float(r[2]),
        }
        for r in trend_rows
    ]

    # 2. Overall totals
    total_bookings = sum(b["bookings_count"] for b in bookings_trend)
    total_gmv = sum(b["gmv"] for b in bookings_trend)
    avg_booking_val = round(total_gmv / total_bookings, 2) if total_bookings > 0 else 0.0

    # 3. Booking Status Distribution
    status_q = text("""
        SELECT status, count(*) AS cnt
        FROM bookings
        GROUP BY status
        ORDER BY cnt DESC;
    """)
    status_rows = (await session.execute(status_q)).fetchall()
    total_all_bookings = sum(r[1] for r in status_rows) or 1
    booking_status_dist = [
        {
            "status": str(r[0]),
            "count": int(r[1]),
            "percentage": round((int(r[1]) / total_all_bookings) * 100, 1),
        }
        for r in status_rows
    ]

    # 4. User Role Distribution
    user_roles_q = text("""
        SELECT role, count(*) AS cnt
        FROM users
        WHERE deleted_at IS NULL
        GROUP BY role
        ORDER BY cnt DESC;
    """)
    roles_rows = (await session.execute(user_roles_q)).fetchall()
    user_roles_dist = [{"role": str(r[0]), "count": int(r[1])} for r in roles_rows]

    # 5. Venue Status Distribution
    venue_status_q = text("""
        SELECT status, count(*) AS cnt
        FROM venues
        WHERE deleted_at IS NULL
        GROUP BY status
        ORDER BY cnt DESC;
    """)
    v_rows = (await session.execute(venue_status_q)).fetchall()
    total_all_venues = sum(r[1] for r in v_rows) or 1
    venue_status_dist = [
        {
            "status": str(r[0]),
            "count": int(r[1]),
            "percentage": round((int(r[1]) / total_all_venues) * 100, 1),
        }
        for r in v_rows
    ]

    active_venues_count = next((v["count"] for v in venue_status_dist if v["status"] == "active"), 0)

    # 6. Top Venues by Bookings & Revenue
    top_venues_q = text("""
        SELECT 
            v.id,
            v.name,
            count(b.id) AS bookings_count,
            coalesce(sum(b.amount), 0) AS gmv
        FROM venues v
        JOIN bookings b ON b.venue_id = v.id
        WHERE v.deleted_at IS NULL
        GROUP BY v.id, v.name
        ORDER BY bookings_count DESC, gmv DESC
        LIMIT 5;
    """)
    top_rows = (await session.execute(top_venues_q)).fetchall()
    top_venues = [
        {
            "id": str(r[0]),
            "name": str(r[1]),
            "bookings_count": int(r[2]),
            "gmv": float(r[3]),
        }
        for r in top_rows
    ]

    return {
        "days": days,
        "total_bookings": total_bookings,
        "total_gmv": round(total_gmv, 2),
        "average_booking_value": avg_booking_val,
        "active_venues_count": active_venues_count,
        "bookings_trend": bookings_trend,
        "booking_status_distribution": booking_status_dist,
        "user_roles_distribution": user_roles_dist,
        "venue_status_distribution": venue_status_dist,
        "top_venues": top_venues,
    }


async def export_table_csv(session: AsyncSession, table_name: str, limit: int = 5000) -> str:
    """Generate CSV string with UTF-8 BOM for universal Excel and spreadsheet compatibility."""
    await _verify_table_exists(session, table_name)
    limit = max(1, min(limit, 10000))

    query = text(f"SELECT * FROM \"{table_name}\" LIMIT :limit")
    res = await session.execute(query, {"limit": limit})
    rows = res.fetchall()

    output = io.StringIO()
    # Write UTF-8 BOM so Excel on Windows recognizes formatting immediately
    output.write("\ufeff")

    if rows:
        fieldnames = list(res.keys())
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        for r in rows:
            row_dict = dict(r._mapping)
            serialized = {k: _serialize_value(v) for k, v in row_dict.items()}
            writer.writerow(serialized)
    else:
        # Just write column headers if empty
        cols_q = text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = :t 
            ORDER BY ordinal_position
        """)
        cols = [r[0] for r in (await session.execute(cols_q, {"t": table_name})).fetchall()]
        writer = csv.writer(output)
        writer.writerow(cols)

    return output.getvalue()

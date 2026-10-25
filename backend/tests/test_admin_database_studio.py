import pytest
import httpx
from app.main import app
from app.db import get_db, get_idem_db
from app.modules.auth.security import create_access_token


@pytest.fixture
async def client(test_session_factory):
    async def _override_get_db():
        async with test_session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_idem_db] = _override_get_db

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_admin_db_endpoints_rbac(client, seeded_customer, seeded_owner_with_unit):
    """Anonymous, customer, and owner cannot access database studio endpoints."""
    owner_id, _, _ = seeded_owner_with_unit
    owner_token = create_access_token(owner_id, "owner")
    customer_token = create_access_token(seeded_customer, "customer")

    # 1. Anonymous request -> 401
    anon_resp = await client.get("/api/v1/admin/db/stats")
    assert anon_resp.status_code == 401

    # 2. Customer request -> 403
    cust_resp = await client.get(
        "/api/v1/admin/db/stats",
        headers={"Authorization": f"Bearer {customer_token}"},
    )
    assert cust_resp.status_code == 403

    # 3. Owner request -> 403
    own_resp = await client.get(
        "/api/v1/admin/db/stats",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert own_resp.status_code == 403


@pytest.mark.asyncio
async def test_admin_db_stats(client, seeded_admin):
    """Admin can fetch database statistics and table catalog."""
    admin_token = create_access_token(seeded_admin, "admin")
    resp = await client.get(
        "/api/v1/admin/db/stats",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["db_connected"] is True
    assert "PostgreSQL" in data["postgres_version"]
    assert data["total_tables"] > 0
    table_names = [t["table_name"] for t in data["tables"]]
    assert "users" in table_names
    assert "venues" in table_names
    assert "bookings" in table_names


@pytest.mark.asyncio
async def test_admin_table_data_and_search(client, seeded_admin):
    """Admin can view table schema and rows, with search and pagination."""
    admin_token = create_access_token(seeded_admin, "admin")

    # 1. Get users table
    resp = await client.get(
        "/api/v1/admin/db/tables/users?limit=10&offset=0",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["table_name"] == "users"
    assert len(data["columns"]) > 0
    col_names = [c["name"] for c in data["columns"]]
    assert "email" in col_names
    assert "role" in col_names
    assert data["total_rows"] >= 1
    assert len(data["rows"]) >= 1

    # 2. Search filtering
    search_resp = await client.get(
        "/api/v1/admin/db/tables/users?search=admin",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert search_resp.status_code == 200
    search_data = search_resp.json()
    assert search_data["total_rows"] >= 1

    # 3. Nonexistent table returns 404
    non_existent = await client.get(
        "/api/v1/admin/db/tables/not_a_real_table",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert non_existent.status_code == 404


@pytest.mark.asyncio
async def test_admin_safe_query_execution(client, seeded_admin):
    """Admin can run safe read-only queries, but destructive queries are blocked."""
    admin_token = create_access_token(seeded_admin, "admin")

    # 1. Valid SELECT query
    valid_resp = await client.post(
        "/api/v1/admin/db/query",
        json={"sql": "SELECT id, email, role FROM users LIMIT 5;"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert valid_resp.status_code == 200
    valid_data = valid_resp.json()
    assert "email" in valid_data["columns"]
    assert valid_data["row_count"] >= 1
    assert valid_data["duration_ms"] >= 0

    # 2. Block mutating queries
    for forbidden_sql in [
        "DELETE FROM users;",
        "DROP TABLE users;",
        "UPDATE users SET role = 'admin';",
        "TRUNCATE users CASCADE;",
        "ALTER TABLE users ADD COLUMN test TEXT;",
    ]:
        bad_resp = await client.post(
            "/api/v1/admin/db/query",
            json={"sql": forbidden_sql},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert bad_resp.status_code == 400
        assert "Forbidden" in bad_resp.json()["detail"]


@pytest.mark.asyncio
async def test_admin_db_analytics(client, seeded_admin):
    """Admin can fetch aggregated time-series and distribution analytics."""
    admin_token = create_access_token(seeded_admin, "admin")
    resp = await client.get(
        "/api/v1/admin/db/analytics?days=30",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["days"] == 30
    assert len(data["bookings_trend"]) > 0
    assert "user_roles_distribution" in data
    assert "booking_status_distribution" in data


@pytest.mark.asyncio
async def test_admin_db_export_csv(client, seeded_admin):
    """Admin can export table data to CSV format with UTF-8 BOM."""
    admin_token = create_access_token(seeded_admin, "admin")
    resp = await client.get(
        "/api/v1/admin/db/export/users?limit=100",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert "attachment; filename=\"groundkart_users.csv\"" in resp.headers["content-disposition"]
    # Check that CSV contains headers
    assert "email" in resp.text
    assert "role" in resp.text

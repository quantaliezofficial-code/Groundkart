import pytest
import uuid
from datetime import date, timedelta
from decimal import Decimal
import httpx
from sqlalchemy import select

from app.main import app
from app.db import get_db, get_idem_db
from app.models.core import Payment
from app.modules.auth.security import create_access_token

def _admin_headers(seeded_admin):
    token = create_access_token(seeded_admin, "admin")
    return {"Authorization": f"Bearer {token}"}

def _owner_headers(seeded_verified_owner):
    token = create_access_token(seeded_verified_owner, "owner")
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
async def client(test_session_factory):
    async def _override_get_db():
        async with test_session_factory() as session:
            yield session

    async def _override_get_idem_db():
        async with test_session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_idem_db] = _override_get_idem_db
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_analytics_reconciliation(
    client, test_session_factory, seeded_admin, seeded_verified_owner
):
    end_date = date.today() + timedelta(days=30)
    start_date = end_date - timedelta(days=360)

    resp_all = await client.get(
        f"/api/v1/admin/analytics?start_date={start_date.isoformat()}&end_date={end_date.isoformat()}",
        headers=_admin_headers(seeded_admin)
    )
    assert resp_all.status_code == 200
    data_all = resp_all.json()

    assert "gmv" in data_all
    assert "retained_gmv" in data_all
    assert "platform_revenue" in data_all
    assert "owner_payout" in data_all
    assert "booking_count" in data_all

    async with test_session_factory() as db:
        payments = (await db.execute(select(Payment).where(Payment.status.in_(["success", "refunded"])))).scalars().all()
        # For simplicity in testing, we assume all payments fall within the last year for the seeded data.
        expected_retained = sum([p.amount - (p.refund_amount or Decimal("0.00")) for p in payments], Decimal("0.00"))

    actual_retained = Decimal(data_all["retained_gmv"])
    assert actual_retained == expected_retained

    platform_rev = Decimal(data_all["platform_revenue"])
    owner_pay = Decimal(data_all["owner_payout"])
    assert abs((platform_rev + owner_pay) - expected_retained) < Decimal("0.05")

    resp_owner = await client.get(
        f"/api/v1/owner/analytics?start_date={start_date.isoformat()}&end_date={end_date.isoformat()}",
        headers=_owner_headers(seeded_verified_owner)
    )
    assert resp_owner.status_code == 200
    owner_data = resp_owner.json()

    assert Decimal(owner_data["gmv"]) <= Decimal(data_all["gmv"])
    assert owner_data["booking_count"] <= data_all["booking_count"]

@pytest.mark.asyncio
async def test_analytics_date_bounds(client, seeded_admin):
    resp = await client.get(
        "/api/v1/admin/analytics?start_date=2024-01-01&end_date=2025-02-01",
        headers=_admin_headers(seeded_admin)
    )
    assert resp.status_code == 400
    assert "cannot exceed 1 year" in resp.json()["detail"]

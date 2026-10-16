import pytest
from httpx import AsyncClient
import uuid
from decimal import Decimal
import pytest_asyncio
from app.main import app
from app.db import get_db
import httpx

@pytest_asyncio.fixture
async def client(test_session_factory):
    async def _override_get_db():
        async with test_session_factory() as session:
            yield session
    app.dependency_overrides[get_db] = _override_get_db
    try:
        from app.db import get_idem_db
        app.dependency_overrides[get_idem_db] = _override_get_db
    except ImportError:
        pass
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as c:
        yield c

from app.modules.auth.security import create_access_token

from app.models.core import InventoryUnit
from sqlalchemy import select

@pytest.mark.asyncio
async def test_create_and_list_pricing_rules(
    client: AsyncClient,
    test_session_factory,
    seeded_owner_with_unit: tuple,
    seeded_admin
):
    owner_id, owner_email, unit_id = seeded_owner_with_unit
    
    async with test_session_factory() as session:
        result = await session.execute(select(InventoryUnit).where(InventoryUnit.id == unit_id))
        unit = result.scalar_one()
        venue_id = unit.venue_id

    owner_token = create_access_token(owner_id, "owner")
    admin_token = create_access_token(seeded_admin, "admin")

    # 1. Owner creates a pricing rule
    payload = {
        "name": "Weekend Spike",
        "rule_type": "weekend",
        "adjustment_type": "percentage",
        "adjustment_value": "15.00",
        "days_of_week": [5, 6],
        "priority": 1,
        "is_active": True
    }
    resp = await client.post(
        f"/api/v1/venues/{venue_id}/pricing-rules",
        json=payload,
        headers={"Authorization": f"Bearer {owner_token}"}
    )
    assert resp.status_code == 201
    rule_data = resp.json()
    rule_id = rule_data["id"]
    assert rule_data["name"] == "Weekend Spike"
    assert rule_data["rule_type"] == "weekend"
    
    # 2. Admin creates a pricing rule
    payload2 = {
        "name": "Admin Seasonal",
        "rule_type": "seasonal",
        "adjustment_type": "fixed",
        "adjustment_value": "-10.00",
        "priority": 2,
        "is_active": True
    }
    resp_admin = await client.post(
        f"/api/v1/venues/{venue_id}/pricing-rules",
        json=payload2,
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert resp_admin.status_code == 201
    
    # 3. List rules (Owner)
    list_resp = await client.get(
        f"/api/v1/venues/{venue_id}/pricing-rules",
        headers={"Authorization": f"Bearer {owner_token}"}
    )
    assert list_resp.status_code == 200
    rules = list_resp.json()
    assert len(rules) == 2
    # Check ordering by priority desc
    assert rules[0]["name"] == "Admin Seasonal"
    assert rules[1]["name"] == "Weekend Spike"
    
    # 4. Update rule (Owner)
    patch_payload = {
        "name": "Weekend Mega Spike",
        "rule_type": "weekend",
        "adjustment_type": "percentage",
        "adjustment_value": "20.00",
        "priority": 1,
        "is_active": True
    }
    patch_resp = await client.patch(
        f"/api/v1/venues/{venue_id}/pricing-rules/{rule_id}",
        json=patch_payload,
        headers={"Authorization": f"Bearer {owner_token}"}
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["name"] == "Weekend Mega Spike"
    
    # 5. Delete rule (Owner)
    del_resp = await client.delete(
        f"/api/v1/venues/{venue_id}/pricing-rules/{rule_id}",
        headers={"Authorization": f"Bearer {owner_token}"}
    )
    assert del_resp.status_code == 204
    
    list_resp2 = await client.get(
        f"/api/v1/venues/{venue_id}/pricing-rules",
        headers={"Authorization": f"Bearer {owner_token}"}
    )
    assert len(list_resp2.json()) == 1

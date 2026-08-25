import asyncio
from app.main import app
from fastapi.testclient import TestClient
from app.modules.auth.dependencies import get_current_user_optional, CurrentUser
import uuid

client = TestClient(app)

def test_create():
    print("Testing create booking...")
    app.dependency_overrides[get_current_user_optional] = lambda: CurrentUser(id=uuid.uuid4(), role="customer")
    dummy_uuid = str(uuid.uuid4())
    response = client.post("/api/v1/bookings", json={
        "inventory_unit_id": dummy_uuid
    })
    print("Response status:", response.status_code)
    print("Response json:", response.json())

if __name__ == "__main__":
    test_create()

"""
Production Readiness Verification Test (Guide 4 - Step 7):
Verifies:
1. Upload a venue image -> loads from its public URL.
2. Upload a verification document -> document URL is NOT publicly fetchable.
3. Admin can view the document via GET /api/v1/admin/owner-verifications/{id}/document.
"""
import uuid
import httpx
import pytest
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
async def test_end_to_end_production_readiness_flow(
    client, seeded_owner_with_unit, seeded_admin, seeded_customer
):
    owner_id, _, venue_id = seeded_owner_with_unit
    owner_token = create_access_token(owner_id, "owner")
    customer_token = create_access_token(seeded_customer, "customer")
    admin_token = create_access_token(seeded_admin, "admin")

    # 1. Create a venue and upload a venue image
    create_venue_resp = await client.post(
        "/api/v1/venues",
        json={
            "name": "The Grand Turf Arena",
            "category": "sports",
            "address": "123 Stadium Road",
            "city": "Lucknow",
            "unit_type": "hour",
            "base_price": "2000.00",
        },
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert create_venue_resp.status_code == 201
    venue_id = create_venue_resp.json()["id"]

    fake_image_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
    upload_resp = await client.post(
        f"/api/v1/venues/{venue_id}/images",
        files={"image": ("photo.png", fake_image_bytes, "image/png")},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert upload_resp.status_code == 201
    media_data = upload_resp.json()
    assert len(media_data["media"]) > 0
    image_url = media_data["media"][0]["url"]
    assert "/uploads/venues/" in image_url

    # Confirm the image loads publicly from its public URL
    relative_image_path = image_url.split("http://localhost:8000")[-1]
    image_fetch = await client.get(relative_image_path)
    assert image_fetch.status_code == 200
    assert image_fetch.content == fake_image_bytes

    # 2. Upload a verification document
    fake_doc_bytes = b"%PDF-1.4 confidential owner identity document"
    doc_upload_resp = await client.post(
        "/api/v1/owner/verification",
        files={"document": ("id.pdf", fake_doc_bytes, "application/pdf")},
        data={"business_name": "Test Sports Academy", "identification_type": "PAN", "identification_number": "ABCDE1234F"},
        headers={"Authorization": f"Bearer {customer_token}"},
    )
    assert doc_upload_resp.status_code == 201
    verif_data = doc_upload_resp.json()
    verification_id = verif_data["id"]

    # Confirm public document_url is NOT stored/returned
    assert verif_data.get("document_url") in (None, "")

    # Confirm the document is NOT publicly fetchable via /uploads/
    public_doc_attempt = await client.get(f"/uploads/owner-verifications/{seeded_customer}/id.pdf")
    assert public_doc_attempt.status_code == 404

    # 3. Confirm access control on GET /api/v1/admin/owner-verifications/{id}/document
    # Anonymous request -> 401
    anon_resp = await client.get(f"/api/v1/admin/owner-verifications/{verification_id}/document")
    assert anon_resp.status_code == 401

    # Customer request -> 403
    cust_resp = await client.get(
        f"/api/v1/admin/owner-verifications/{verification_id}/document",
        headers={"Authorization": f"Bearer {customer_token}"},
    )
    assert cust_resp.status_code == 403

    # Owner request -> 403
    own_resp = await client.get(
        f"/api/v1/admin/owner-verifications/{verification_id}/document",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert own_resp.status_code == 403

    # Admin request -> 200, successfully retrieves document content
    admin_resp = await client.get(
        f"/api/v1/admin/owner-verifications/{verification_id}/document",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert admin_resp.status_code == 200
    assert admin_resp.content == fake_doc_bytes
    assert admin_resp.headers["content-type"] == "application/pdf"

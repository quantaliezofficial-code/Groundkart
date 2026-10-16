"""
Tests for Guide 10: Owner Venue Onboarding, Listing Builder, and Draft/Review Lifecycle.
"""
import uuid
from datetime import date, timedelta
from decimal import Decimal

import httpx
import pytest
from sqlalchemy import select

from app.db import get_db, get_idem_db
from app.main import app
from app.models.core import Category, InventoryUnit, UseCase, Venue, VenueMedia, VenueType
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


@pytest.fixture
async def seeded_taxonomy(test_session_factory):
    """Seed sample categories, venue types, and use cases for onboarding tests."""
    async with test_session_factory() as session:
        async with session.begin():
            cat_sports = Category(name="Sports & Fitness")
            cat_weddings = Category(name="Weddings & Events")
            session.add_all([cat_sports, cat_weddings])
            await session.flush()

            vt_turf = VenueType(category_id=cat_sports.id, name="Football Turf")
            vt_banquet = VenueType(category_id=cat_weddings.id, name="Banquet Hall")
            session.add_all([vt_turf, vt_banquet])

            uc_match = UseCase(name="Friendly Match")
            uc_tournament = UseCase(name="Weekend Tournament")
            session.add_all([uc_match, uc_tournament])
            await session.flush()

            return {
                "cat_sports": cat_sports.id,
                "cat_weddings": cat_weddings.id,
                "vt_turf": vt_turf.id,
                "vt_banquet": vt_banquet.id,
                "uc_match": uc_match.id,
                "uc_tournament": uc_tournament.id,
            }


def _valid_venue_payload(taxonomy, **overrides):
    payload = {
        "name": "Lucknow Sports Arena",
        "display_name": "The Arena at Gomti Nagar",
        "tagline": "Premier FIFA-grade artificial turf",
        "category_id": str(taxonomy["cat_sports"]),
        "venue_type_id": str(taxonomy["vt_turf"]),
        "use_case_ids": [str(taxonomy["uc_match"]), str(taxonomy["uc_tournament"])],
        "address": "Plot 42, Gomti Nagar Bypass",
        "city": "Lucknow",
        "unit_type": "hour",
        "base_price": "1500.00",
        "content_blocks": [
            {
                "type": "faq",
                "title": "Is parking available?",
                "body": "Yes, 50 reserved parking spots available on premise.",
                "sort_order": 0,
            }
        ],
    }
    payload.update(overrides)
    return payload


async def test_create_venue_with_taxonomy_and_content_blocks_stored(
    client, seeded_verified_owner, seeded_taxonomy
):
    """Create with category_id, venue_type_id, use_case_ids, display_name, tagline,
    content_blocks, then GET the venue and assert every one is stored."""
    owner_token = create_access_token(seeded_verified_owner, "owner")
    payload = _valid_venue_payload(seeded_taxonomy)

    create_resp = await client.post(
        "/api/v1/venues", json=payload, headers={"Authorization": f"Bearer {owner_token}"}
    )
    assert create_resp.status_code == 201, create_resp.text
    venue_id = create_resp.json()["id"]

    get_resp = await client.get(
        f"/api/v1/venues/{venue_id}", headers={"Authorization": f"Bearer {owner_token}"}
    )
    assert get_resp.status_code == 200
    data = get_resp.json()

    assert data["display_name"] == "The Arena at Gomti Nagar"
    assert data["tagline"] == "Premier FIFA-grade artificial turf"
    assert data["category"] == "Sports & Fitness"
    assert data["category_id"] == str(seeded_taxonomy["cat_sports"])
    assert data["venue_type_id"] == str(seeded_taxonomy["vt_turf"])
    assert data["venue_type_name"] == "Football Turf"
    retrieved_use_cases = [str(u) for u in data["use_case_ids"]]
    assert str(seeded_taxonomy["uc_match"]) in retrieved_use_cases
    assert str(seeded_taxonomy["uc_tournament"]) in retrieved_use_cases
    assert len(data["content_blocks"]) == 1
    assert data["content_blocks"][0]["title"] == "Is parking available?"


async def test_invalid_venue_type_or_mismatched_category_returns_422(
    client, seeded_verified_owner, seeded_taxonomy
):
    """A venue_type_id that does not belong to the category_id returns 422, as do unknown ids."""
    owner_token = create_access_token(seeded_verified_owner, "owner")

    # Mismatched venue_type_id (Banquet Hall belongs to Weddings, not Sports)
    mismatched_payload = _valid_venue_payload(
        seeded_taxonomy,
        category_id=str(seeded_taxonomy["cat_sports"]),
        venue_type_id=str(seeded_taxonomy["vt_banquet"]),
    )
    resp = await client.post(
        "/api/v1/venues", json=mismatched_payload, headers={"Authorization": f"Bearer {owner_token}"}
    )
    assert resp.status_code == 422

    # Unknown category_id
    unknown_cat_payload = _valid_venue_payload(
        seeded_taxonomy, category_id=str(uuid.uuid4())
    )
    resp = await client.post(
        "/api/v1/venues", json=unknown_cat_payload, headers={"Authorization": f"Bearer {owner_token}"}
    )
    assert resp.status_code == 422

    # Unknown venue_type_id
    unknown_vt_payload = _valid_venue_payload(
        seeded_taxonomy, venue_type_id=str(uuid.uuid4())
    )
    resp = await client.post(
        "/api/v1/venues", json=unknown_vt_payload, headers={"Authorization": f"Bearer {owner_token}"}
    )
    assert resp.status_code == 422

    # Unknown use_case_ids
    unknown_uc_payload = _valid_venue_payload(
        seeded_taxonomy, use_case_ids=[str(uuid.uuid4())]
    )
    resp = await client.post(
        "/api/v1/venues", json=unknown_uc_payload, headers={"Authorization": f"Bearer {owner_token}"}
    )
    assert resp.status_code == 422


async def test_category_text_filled_from_category_name_when_only_category_id_sent(
    client, seeded_verified_owner, seeded_taxonomy
):
    """category text is filled from the category name when only category_id is sent."""
    owner_token = create_access_token(seeded_verified_owner, "owner")
    payload = _valid_venue_payload(seeded_taxonomy)
    payload.pop("category", None)

    resp = await client.post(
        "/api/v1/venues", json=payload, headers={"Authorization": f"Bearer {owner_token}"}
    )
    assert resp.status_code == 201
    assert resp.json()["category"] == "Sports & Fitness"


async def test_unit_type_validation_rejects_day(
    client, seeded_verified_owner, seeded_taxonomy
):
    """unit_type of day returns 422; hour, half_day, full_day pass."""
    owner_token = create_access_token(seeded_verified_owner, "owner")

    # Invalid unit_type: 'day'
    day_payload = _valid_venue_payload(seeded_taxonomy, unit_type="day")
    resp = await client.post(
        "/api/v1/venues", json=day_payload, headers={"Authorization": f"Bearer {owner_token}"}
    )
    assert resp.status_code == 422

    # Valid unit_types: 'hour', 'half_day', 'full_day'
    for valid_unit in ["hour", "half_day", "full_day"]:
        valid_payload = _valid_venue_payload(
            seeded_taxonomy, name=f"Venue {valid_unit}", unit_type=valid_unit
        )
        resp = await client.post(
            "/api/v1/venues", json=valid_payload, headers={"Authorization": f"Bearer {owner_token}"}
        )
        assert resp.status_code == 201
        assert resp.json()["unit_type"] == valid_unit


async def test_create_draft_does_not_appear_in_admin_pending_list(
    client, seeded_verified_owner, seeded_admin, seeded_taxonomy
):
    """Create with save_as_draft: true gives status draft and does not appear in the admin pending list."""
    owner_token = create_access_token(seeded_verified_owner, "owner")
    admin_token = create_access_token(seeded_admin, "admin")

    draft_payload = _valid_venue_payload(seeded_taxonomy, save_as_draft=True)
    resp = await client.post(
        "/api/v1/venues", json=draft_payload, headers={"Authorization": f"Bearer {owner_token}"}
    )
    assert resp.status_code == 201
    draft_data = resp.json()
    assert draft_data["status"] == "draft"
    draft_id = draft_data["id"]

    # Admin checks approval queue (pending_review)
    admin_resp = await client.get(
        "/api/v1/admin/venues?status=pending_review",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert admin_resp.status_code == 200
    pending_ids = [v["id"] for v in admin_resp.json()]
    assert draft_id not in pending_ids


async def test_submitting_incomplete_draft_returns_422_with_missing_items(
    client, seeded_verified_owner, seeded_taxonomy
):
    """Submitting an incomplete draft returns 422 with a list of missing items; a complete one becomes pending_review."""
    owner_token = create_access_token(seeded_verified_owner, "owner")

    draft_payload = _valid_venue_payload(seeded_taxonomy, save_as_draft=True)
    resp = await client.post(
        "/api/v1/venues", json=draft_payload, headers={"Authorization": f"Bearer {owner_token}"}
    )
    assert resp.status_code == 201
    venue_id = resp.json()["id"]

    # Submit incomplete draft (no photos, no inventory units)
    submit_resp = await client.patch(
        f"/api/v1/venues/{venue_id}",
        json={"status": "pending_review"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert submit_resp.status_code == 422
    err_body = submit_resp.json()
    detail = err_body.get("detail")
    missing = detail.get("missing") if isinstance(detail, dict) else err_body.get("missing")
    assert "photos" in missing
    assert "inventory" in missing

    # Complete the requirements: 3 photos (one cover) and 1 future inventory unit
    for i in range(3):
        await client.post(
            f"/api/v1/venues/{venue_id}/images",
            files={"image": (f"img_{i}.jpg", b"\xff\xd8\xff test image", "image/jpeg")},
            data={"is_cover": "true" if i == 0 else "false"},
            headers={"Authorization": f"Bearer {owner_token}"},
        )

    tomorrow = date.today() + timedelta(days=1)
    await client.post(
        f"/api/v1/venues/{venue_id}/inventory-units",
        json={
            "units": [
                {
                    "date": tomorrow.isoformat(),
                    "start_time": "18:00:00",
                    "end_time": "19:00:00",
                }
            ]
        },
        headers={"Authorization": f"Bearer {owner_token}"},
    )

    # Now submit the complete draft
    resubmit_resp = await client.patch(
        f"/api/v1/venues/{venue_id}",
        json={"status": "pending_review"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert resubmit_resp.status_code == 200
    assert resubmit_resp.json()["status"] == "pending_review"


async def test_content_edit_on_draft_preserves_draft_status_active_triggers_rereview(
    client, seeded_verified_owner, seeded_admin, seeded_taxonomy
):
    """A content edit on a draft does not change its status; a content edit on an active venue still triggers re-review."""
    owner_token = create_access_token(seeded_verified_owner, "owner")
    admin_token = create_access_token(seeded_admin, "admin")

    # 1. Draft venue
    draft_payload = _valid_venue_payload(seeded_taxonomy, save_as_draft=True)
    resp = await client.post(
        "/api/v1/venues", json=draft_payload, headers={"Authorization": f"Bearer {owner_token}"}
    )
    assert resp.status_code == 201
    venue_id = resp.json()["id"]

    edit_resp = await client.patch(
        f"/api/v1/venues/{venue_id}",
        json={"description": "Updated draft description"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert edit_resp.status_code == 200
    assert edit_resp.json()["status"] == "draft"

    # Complete and submit
    for i in range(3):
        await client.post(
            f"/api/v1/venues/{venue_id}/images",
            files={"image": (f"img_{i}.jpg", b"\xff\xd8\xff test image", "image/jpeg")},
            data={"is_cover": "true" if i == 0 else "false"},
            headers={"Authorization": f"Bearer {owner_token}"},
        )
    tomorrow = date.today() + timedelta(days=2)
    await client.post(
        f"/api/v1/venues/{venue_id}/inventory-units",
        json={
            "units": [
                {
                    "date": tomorrow.isoformat(),
                    "start_time": "18:00:00",
                    "end_time": "19:00:00",
                }
            ]
        },
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    await client.patch(
        f"/api/v1/venues/{venue_id}",
        json={"status": "pending_review"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )

    # Admin approves it -> active
    await client.post(
        f"/api/v1/admin/venues/{venue_id}/approve",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    # 2. Content edit on active venue (e.g. description) knocks it to pending_review
    active_edit_resp = await client.patch(
        f"/api/v1/venues/{venue_id}",
        json={"description": "Revamped field and updated pitch conditions"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert active_edit_resp.status_code == 200
    assert active_edit_resp.json()["status"] == "pending_review"


async def test_two_quick_patches_on_pending_venue_preserve_original_old_value_in_diff(
    client, seeded_verified_owner, seeded_taxonomy
):
    """Two quick PATCHes on a pending venue keep the first change's old value in pending_changes (see Step 4)."""
    owner_token = create_access_token(seeded_verified_owner, "owner")
    payload = _valid_venue_payload(seeded_taxonomy, name="Original Name")

    create_resp = await client.post(
        "/api/v1/venues", json=payload, headers={"Authorization": f"Bearer {owner_token}"}
    )
    assert create_resp.status_code == 201
    venue_id = create_resp.json()["id"]

    # First patch: change name from "Original Name" to "First Edit Name"
    patch1_resp = await client.patch(
        f"/api/v1/venues/{venue_id}",
        json={"name": "First Edit Name"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert patch1_resp.status_code == 200
    diff1 = patch1_resp.json()["pending_changes"]
    assert diff1 is not None
    assert diff1["name"]["old"] == "Original Name"
    assert diff1["name"]["new"] == "First Edit Name"

    # Second patch: change name from "First Edit Name" to "Second Edit Name"
    patch2_resp = await client.patch(
        f"/api/v1/venues/{venue_id}",
        json={"name": "Second Edit Name"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert patch2_resp.status_code == 200
    diff2 = patch2_resp.json()["pending_changes"]
    assert diff2 is not None
    # Crucial assertion: "old" must remain "Original Name", not "First Edit Name"!
    assert diff2["name"]["old"] == "Original Name"
    assert diff2["name"]["new"] == "Second Edit Name"

    # Third patch: revert back to "Original Name" -> diff should clear the field!
    patch3_resp = await client.patch(
        f"/api/v1/venues/{venue_id}",
        json={"name": "Original Name"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert patch3_resp.status_code == 200
    diff3 = patch3_resp.json()["pending_changes"]
    assert diff3 is None or "name" not in diff3

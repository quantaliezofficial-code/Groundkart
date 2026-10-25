"""
07_design.md §3.2. The three rules called out in catalog/service.py's
module docstring get their own focused tests below, not just generic
CRUD-works tests:
- visibility (non-active listing invisible to the public, previewable by
  owner/admin)
- re-review only on an actual content change, not a no-op PATCH
- cover-image uniqueness surviving a "switch the cover" request, not just
  "the first upload works"
"""
import uuid

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import select

from app.db import get_db, get_idem_db
from app.main import app
from app.models.core import Venue
from app.modules.auth.security import create_access_token


@pytest_asyncio.fixture
async def client(test_session_factory):
    async def _override_get_db():
        async with test_session_factory() as session:
            try:
                yield session
            finally:
                if session.in_transaction():
                    await session.rollback()
                await session.close()

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_idem_db] = _override_get_db

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


def _venue_payload(**overrides):
    payload = {
        "name": "The Grand Turf Arena",
        "category": "sports",
        "address": "123 Stadium Road",
        "city": "Lucknow",
        "unit_type": "hour",
        "base_price": "2000.00",
    }
    payload.update(overrides)
    return payload


async def test_owner_can_create_venue_lands_pending_review(client, seeded_verified_owner):
    token = create_access_token(seeded_verified_owner, "owner")
    resp = await client.post(
        "/api/v1/venues", json=_venue_payload(), headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "pending_review"
    assert body["slug"]  # auto-generated, non-empty


async def test_customer_cannot_create_venue(client, seeded_customer):
    """The exact gap TRD §7 names: 'any logged-in user can currently create
    venues/slots.' This proves require_role actually closes it."""
    token = create_access_token(seeded_customer, "customer")
    resp = await client.post(
        "/api/v1/venues", json=_venue_payload(), headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 403


async def test_pending_venue_is_invisible_to_anonymous_and_other_users(
    client, seeded_verified_owner, seeded_customer
):
    owner_token = create_access_token(seeded_verified_owner, "owner")
    create_resp = await client.post(
        "/api/v1/venues", json=_venue_payload(), headers={"Authorization": f"Bearer {owner_token}"}
    )
    venue_id = create_resp.json()["id"]

    anon_resp = await client.get(f"/api/v1/venues/{venue_id}")
    assert anon_resp.status_code == 404  # not 403 — see service docstring

    customer_token = create_access_token(seeded_customer, "customer")
    customer_resp = await client.get(
        f"/api/v1/venues/{venue_id}", headers={"Authorization": f"Bearer {customer_token}"}
    )
    assert customer_resp.status_code == 404


async def test_pending_venue_is_visible_to_its_own_owner_and_to_admin(
    client, seeded_verified_owner, seeded_admin
):
    owner_token = create_access_token(seeded_verified_owner, "owner")
    create_resp = await client.post(
        "/api/v1/venues", json=_venue_payload(), headers={"Authorization": f"Bearer {owner_token}"}
    )
    venue_id = create_resp.json()["id"]

    owner_view = await client.get(
        f"/api/v1/venues/{venue_id}", headers={"Authorization": f"Bearer {owner_token}"}
    )
    assert owner_view.status_code == 200

    admin_token = create_access_token(seeded_admin, "admin")
    admin_view = await client.get(
        f"/api/v1/venues/{venue_id}", headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert admin_view.status_code == 200


async def test_active_venue_is_publicly_visible(client, seeded_verified_owner, seeded_admin):
    owner_token = create_access_token(seeded_verified_owner, "owner")
    create_resp = await client.post(
        "/api/v1/venues", json=_venue_payload(), headers={"Authorization": f"Bearer {owner_token}"}
    )
    assert create_resp.status_code == 201, f"Create failed: {create_resp.status_code} {create_resp.text}"
    venue_id = create_resp.json()["id"]

    admin_token = create_access_token(seeded_admin, "admin")
    approve_resp = await client.post(
        f"/api/v1/admin/venues/{venue_id}/approve", headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert approve_resp.status_code == 200, f"Approve failed: {approve_resp.status_code} {approve_resp.text}"

    anon_resp = await client.get(f"/api/v1/venues/{venue_id}")
    assert anon_resp.status_code == 200
    assert anon_resp.json()["status"] == "active"


async def test_search_only_returns_active_venues(client, seeded_verified_owner, seeded_admin):
    owner_token = create_access_token(seeded_verified_owner, "owner")
    create_resp = await client.post(
        "/api/v1/venues",
        json=_venue_payload(name="Pending Hall"),
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    pending_id = create_resp.json()["id"]

    create_resp2 = await client.post(
        "/api/v1/venues",
        json=_venue_payload(name="Active Hall"),
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    active_id = create_resp2.json()["id"]
    admin_token = create_access_token(seeded_admin, "admin")
    await client.post(
        f"/api/v1/admin/venues/{active_id}/approve", headers={"Authorization": f"Bearer {admin_token}"}
    )

    search_resp = await client.get("/api/v1/venues", params={"city": "Lucknow"})
    ids_returned = {v["id"] for v in search_resp.json()["data"]}
    assert active_id in ids_returned
    assert pending_id not in ids_returned


async def test_rejecting_a_venue_sets_draft_and_reason_then_resubmit_returns_to_review(
    client, test_session_factory, seeded_verified_owner, seeded_admin
):
    owner_token = create_access_token(seeded_verified_owner, "owner")
    create_resp = await client.post(
        "/api/v1/venues", json=_venue_payload(), headers={"Authorization": f"Bearer {owner_token}"}
    )
    assert create_resp.status_code == 201, f"Create failed: {create_resp.status_code} {create_resp.text}"
    venue_id = create_resp.json()["id"]

    admin_token = create_access_token(seeded_admin, "admin")
    reject_resp = await client.post(
        f"/api/v1/admin/venues/{venue_id}/reject",
        json={"reason": "Photos are too dark, please retake in daylight."},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert reject_resp.status_code == 200, f"Reject failed: {reject_resp.status_code} {reject_resp.text}"
    assert reject_resp.json()["status"] == "draft"
    assert "daylight" in reject_resp.json()["rejection_reason"]

    # Upload 3 photos to satisfy the 3-photo rule before resubmission
    for i in range(3):
        await client.post(
            f"/api/v1/venues/{venue_id}/images",
            files={"image": (f"daylight_{i}.jpg", b"\xff\xd8\xff daylight photo", "image/jpeg")},
            data={"is_cover": "true" if i == 0 else "false"},
            headers={"Authorization": f"Bearer {owner_token}"},
        )

    from datetime import date, timedelta
    tomorrow = date.today() + timedelta(days=1)
    await client.post(
        f"/api/v1/venues/{venue_id}/inventory-units",
        json={"units": [{"date": tomorrow.isoformat(), "start_time": "18:00:00", "end_time": "19:00:00"}]},
        headers={"Authorization": f"Bearer {owner_token}"},
    )

    # A content edit on a draft leaves it in draft
    patch_draft = await client.patch(
        f"/api/v1/venues/{venue_id}",
        json={"description": "Freshly photographed in daylight, much improved."},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert patch_draft.status_code == 200
    assert patch_draft.json()["status"] == "draft"

    # Explicit submission moves it back to pending_review and clears rejection reason
    patch_resp = await client.patch(
        f"/api/v1/venues/{venue_id}",
        json={"status": "pending_review"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["status"] == "pending_review"
    assert patch_resp.json()["rejection_reason"] is None


async def test_noop_patch_does_not_trigger_re_review(client, seeded_verified_owner, seeded_admin):
    """The subtle rule: resubmitting the SAME values shouldn't silently
    re-trigger review on an already-active listing."""
    owner_token = create_access_token(seeded_verified_owner, "owner")
    create_resp = await client.post(
        "/api/v1/venues", json=_venue_payload(), headers={"Authorization": f"Bearer {owner_token}"}
    )
    venue_id = create_resp.json()["id"]
    admin_token = create_access_token(seeded_admin, "admin")
    await client.post(
        f"/api/v1/admin/venues/{venue_id}/approve", headers={"Authorization": f"Bearer {admin_token}"}
    )

    # PATCH with the exact same city value already on the venue.
    patch_resp = await client.patch(
        f"/api/v1/venues/{venue_id}",
        json={"city": "Lucknow"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["status"] == "active"  # unchanged, NOT bounced to pending_review


async def test_different_owner_cannot_edit_someone_elses_venue(
    client, seeded_verified_owner, seeded_owner_with_unit
):
    owner_token = create_access_token(seeded_verified_owner, "owner")
    create_resp = await client.post(
        "/api/v1/venues", json=_venue_payload(), headers={"Authorization": f"Bearer {owner_token}"}
    )
    venue_id = create_resp.json()["id"]

    other_owner_id, _, _ = seeded_owner_with_unit
    other_token = create_access_token(other_owner_id, "owner")
    resp = await client.patch(
        f"/api/v1/venues/{venue_id}",
        json={"description": "Trying to edit someone else's venue"},
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert resp.status_code == 403


async def test_cover_image_switch_is_atomic_not_two_covers(
    client, test_session_factory, seeded_verified_owner
):
    """uq_one_cover_image_per_venue exists specifically to prevent this —
    proves the service layer's un-cover-then-insert actually works inside
    one transaction, not just that the first upload succeeds."""
    owner_token = create_access_token(seeded_verified_owner, "owner")
    create_resp = await client.post(
        "/api/v1/venues", json=_venue_payload(), headers={"Authorization": f"Bearer {owner_token}"}
    )
    venue_id = create_resp.json()["id"]

    first = await client.post(
        f"/api/v1/venues/{venue_id}/images",
        files={"image": ("cover1.jpg", b"\xff\xd8\xff fake jpeg bytes", "image/jpeg")},
        data={"is_cover": "true"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert first.status_code == 201

    second = await client.post(
        f"/api/v1/venues/{venue_id}/images",
        files={"image": ("cover2.jpg", b"\xff\xd8\xff different fake jpeg", "image/jpeg")},
        data={"is_cover": "true"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert second.status_code == 201

    images = second.json()["media"]
    assert len(images) == 2
    covers = [img for img in images if img["is_cover"]]
    assert len(covers) == 1, f"expected exactly one cover image, found {len(covers)}: {images}"
    assert len({img["id"] for img in images}) == 2  # two genuinely distinct image rows


async def test_hourly_venue_requires_start_and_end_time(client, seeded_verified_owner):
    owner_token = create_access_token(seeded_verified_owner, "owner")
    create_resp = await client.post(
        "/api/v1/venues",
        json=_venue_payload(unit_type="hour"),
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    venue_id = create_resp.json()["id"]

    resp = await client.post(
        f"/api/v1/venues/{venue_id}/inventory-units",
        json={"units": [{"date": "2027-08-15"}]},  # no start_time/end_time
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert resp.status_code == 422


async def test_full_day_venue_rejects_start_time(client, seeded_verified_owner):
    """B-1's assumption (PHASE_B_SUMMARY.md): full_day units must have NULL
    start_time, or the grace-period 'no slot to cap against' branch
    silently stops being true. This is that assumption enforced at
    creation time, not just hoped for downstream."""
    owner_token = create_access_token(seeded_verified_owner, "owner")
    create_resp = await client.post(
        "/api/v1/venues",
        json=_venue_payload(name="Farmhouse Retreat", category="farmhouse", unit_type="full_day"),
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    venue_id = create_resp.json()["id"]

    resp = await client.post(
        f"/api/v1/venues/{venue_id}/inventory-units",
        json={"units": [{"date": "2027-08-15", "start_time": "09:00:00"}]},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert resp.status_code == 422


async def test_full_day_venue_accepts_date_only_unit(client, seeded_verified_owner):
    owner_token = create_access_token(seeded_verified_owner, "owner")
    create_resp = await client.post(
        "/api/v1/venues",
        json=_venue_payload(name="Farmhouse Retreat", category="farmhouse", unit_type="full_day"),
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    venue_id = create_resp.json()["id"]

    resp = await client.post(
        f"/api/v1/venues/{venue_id}/inventory-units",
        json={"units": [{"date": "2027-08-15"}]},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert resp.status_code == 201
    assert resp.json()[0]["start_time"] is None


async def test_search_excludes_venue_with_no_available_units_on_requested_date(
    client, seeded_verified_owner, seeded_admin, test_session_factory
):
    """PRD §7 story #1: 'unavailable venues for the selected date are
    excluded.'"""
    owner_token = create_access_token(seeded_verified_owner, "owner")
    create_resp = await client.post(
        "/api/v1/venues", json=_venue_payload(), headers={"Authorization": f"Bearer {owner_token}"}
    )
    assert create_resp.status_code == 201, f"Create failed: {create_resp.status_code} {create_resp.text}"
    venue_id = create_resp.json()["id"]

    admin_token = create_access_token(seeded_admin, "admin")
    approve_resp = await client.post(
        f"/api/v1/admin/venues/{venue_id}/approve", headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert approve_resp.status_code == 200, f"Approve failed: {approve_resp.status_code} {approve_resp.text}"

    # No inventory units created at all for this venue -> not available on
    # ANY date.
    search_resp = await client.get(
        "/api/v1/venues", params={"city": "Lucknow", "available_on": "2027-09-01"}
    )
    ids_returned = {v["id"] for v in search_resp.json()["data"]}
    assert venue_id not in ids_returned

    units_resp = await client.post(
        f"/api/v1/venues/{venue_id}/inventory-units",
        json={"units": [{"date": "2027-09-01", "start_time": "18:00:00", "end_time": "19:00:00"}]},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert units_resp.status_code == 201, f"Add units failed: {units_resp.status_code} {units_resp.text}"

    search_resp_2 = await client.get(
        "/api/v1/venues", params={"city": "Lucknow", "available_on": "2027-09-01"}
    )
    ids_returned_2 = {v["id"] for v in search_resp_2.json()["data"]}
    assert venue_id in ids_returned_2


async def test_submitting_venue_to_pending_review_requires_at_least_3_photos(
    client, seeded_verified_owner, seeded_admin
):
    owner_token = create_access_token(seeded_verified_owner, "owner")
    create_resp = await client.post(
        "/api/v1/venues", json=_venue_payload(), headers={"Authorization": f"Bearer {owner_token}"}
    )
    assert create_resp.status_code == 201, f"Create failed: {create_resp.status_code} {create_resp.text}"
    venue_id = create_resp.json()["id"]

    # Move to draft by rejecting (or updating)
    admin_token = create_access_token(seeded_admin, "admin")
    reject_resp = await client.post(
        f"/api/v1/admin/venues/{venue_id}/reject",
        json={"reason": "Need initial photos."},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert reject_resp.status_code == 200, f"Reject failed: {reject_resp.status_code} {reject_resp.text}"

    # 1. 0 photos: moving to pending_review must return 422
    resp_zero = await client.patch(
        f"/api/v1/venues/{venue_id}",
        json={"status": "pending_review"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert resp_zero.status_code == 422
    err_zero = resp_zero.json()
    detail_zero = err_zero.get("detail", {})
    missing_zero = detail_zero.get("missing") if isinstance(detail_zero, dict) else err_zero.get("missing", [])
    assert "photos" in missing_zero

    # 2. Upload 2 photos and 1 video (MP4) -> video does NOT count as a photo
    for i in range(2):
        await client.post(
            f"/api/v1/venues/{venue_id}/images",
            files={"image": (f"photo{i}.jpg", b"\xff\xd8\xff jpeg bytes", "image/jpeg")},
            data={"is_cover": "true" if i == 0 else "false"},
            headers={"Authorization": f"Bearer {owner_token}"},
        )
    await client.post(
        f"/api/v1/venues/{venue_id}/images",
        files={"image": ("tour.mp4", b"\x00\x00\x00\x18ftypmp42", "video/mp4")},
        data={"is_cover": "false"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )

    # 2 photos + 1 video still must return 422 because < 3 photos
    resp_two_photos = await client.patch(
        f"/api/v1/venues/{venue_id}",
        json={"status": "pending_review"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert resp_two_photos.status_code == 422
    err_two = resp_two_photos.json()
    detail_two = err_two.get("detail", {})
    missing_two = detail_two.get("missing") if isinstance(detail_two, dict) else err_two.get("missing", [])
    assert "photos" in missing_two

    # 3. Upload a 3rd photo and create a future inventory unit -> now submission succeeds
    await client.post(
        f"/api/v1/venues/{venue_id}/images",
        files={"image": ("photo2.jpg", b"\xff\xd8\xff jpeg bytes 3", "image/jpeg")},
        data={"is_cover": "false"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )

    from datetime import date, timedelta
    tomorrow = date.today() + timedelta(days=1)
    await client.post(
        f"/api/v1/venues/{venue_id}/inventory-units",
        json={"units": [{"date": tomorrow.isoformat(), "start_time": "18:00:00", "end_time": "19:00:00"}]},
        headers={"Authorization": f"Bearer {owner_token}"},
    )

    resp_three_photos = await client.patch(
        f"/api/v1/venues/{venue_id}",
        json={"status": "pending_review"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert resp_three_photos.status_code == 200
    assert resp_three_photos.json()["status"] == "pending_review"


async def test_list_venues_supports_sorting(client):
    """Verifies that the GET /api/v1/venues endpoint supports sort_by parameters."""
    resp_newest = await client.get("/api/v1/venues?sort_by=newest")
    assert resp_newest.status_code == 200
    assert "data" in resp_newest.json()

    resp_price_asc = await client.get("/api/v1/venues?sort_by=price_asc")
    assert resp_price_asc.status_code == 200
    venues_asc = resp_price_asc.json()["data"]
    if len(venues_asc) >= 2:
        prices = [float(v["base_price"]) for v in venues_asc]
        assert prices == sorted(prices)



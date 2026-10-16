import pytest
import xml.etree.ElementTree as ET
import httpx
from datetime import date
from decimal import Decimal

from app.main import app
from app.db import get_db, get_idem_db
from app.models.core import Venue


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
async def test_robots_txt_endpoint(client):
    from app.config import settings
    base_url = settings.public_app_url.rstrip("/")
    response = await client.get("/robots.txt")
    assert response.status_code == 200
    assert "text/plain" in response.headers.get("content-type", "")
    content = response.text

    assert "User-agent: *" in content
    assert "Allow: /" in content
    assert "Allow: /api/v1/venues" in content
    assert "Allow: /uploads/" not in content
    assert "Disallow: /admin" in content
    assert "Disallow: /owner" in content
    assert f"Sitemap: {base_url}/sitemap.xml" in content
    # Verify no outdated domain
    assert "groundbooking.com" not in content


@pytest.mark.asyncio
async def test_dynamic_sitemap_xml_endpoint(client, test_session_factory, seeded_verified_owner):
    from app.config import settings
    base_url = settings.public_app_url.rstrip("/")

    # Seed an active venue, pending_review venue, archived venue, and suspended venue
    async with test_session_factory() as session:
        active_venue = Venue(
            owner_id=seeded_verified_owner,
            name="Alpha Cricket Ground",
            slug="alpha-cricket-ground",
            category="sports",
            address="123 Pitch Way",
            city="Metropolis",
            unit_type="hour",
            base_price=Decimal("150.00"),
            status="active",
        )
        pending_venue = Venue(
            owner_id=seeded_verified_owner,
            name="Secret Unapproved Turf",
            slug="secret-unapproved-turf",
            category="sports",
            address="456 Hidden Ln",
            city="Metropolis",
            unit_type="hour",
            base_price=Decimal("120.00"),
            status="pending_review",
        )
        archived_venue = Venue(
            owner_id=seeded_verified_owner,
            name="Old Archived Turf",
            slug="old-archived-turf",
            category="sports",
            address="789 Closed Ave",
            city="Metropolis",
            unit_type="hour",
            base_price=Decimal("100.00"),
            status="archived",
        )
        suspended_venue = Venue(
            owner_id=seeded_verified_owner,
            name="Suspended Illegal Turf",
            slug="suspended-illegal-turf",
            category="sports",
            address="101 Banned St",
            city="Metropolis",
            unit_type="hour",
            base_price=Decimal("100.00"),
            status="suspended",
        )
        session.add_all([active_venue, pending_venue, archived_venue, suspended_venue])
        await session.commit()

    response = await client.get("/sitemap.xml")
    assert response.status_code == 200
    assert "application/xml" in response.headers.get("content-type", "")

    # Parse XML to verify syntax
    root = ET.fromstring(response.content)
    namespace = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    locs = [elem.text for elem in root.findall(".//sm:loc", namespace)]

    # Every <loc> starts with settings.public_app_url
    assert len(locs) > 0
    for loc in locs:
        assert loc.startswith(base_url), f"Expected loc '{loc}' to start with '{base_url}'"

    # Homepage and static pages present
    assert f"{base_url}/" in locs
    assert f"{base_url}/search" in locs
    assert f"{base_url}/categories/sports" in locs
    assert f"{base_url}/about" in locs
    assert f"{base_url}/contact" in locs
    assert f"{base_url}/terms" in locs
    assert f"{base_url}/privacy" in locs

    # Active venue is present
    assert f"{base_url}/venues/alpha-cricket-ground" in locs

    # Unapproved, archived, and suspended venues MUST be excluded
    assert f"{base_url}/venues/secret-unapproved-turf" not in locs
    assert f"{base_url}/venues/old-archived-turf" not in locs
    assert f"{base_url}/venues/suspended-illegal-turf" not in locs

    # No legacy domain or private routes
    assert not any("groundbooking.com" in loc for loc in locs)
    assert not any("/admin" in loc for loc in locs)
    assert not any("/owner" in loc for loc in locs)
    assert not any("/checkout" in loc for loc in locs)


@pytest.mark.asyncio
async def test_venue_lookup_by_slug_and_uuid(client, test_session_factory, seeded_verified_owner):
    async with test_session_factory() as session:
        venue = Venue(
            owner_id=seeded_verified_owner,
            name="Zeta Badminton Court",
            slug="zeta-badminton-court",
            category="sports",
            address="789 Shuttle Way",
            city="Lucknow",
            unit_type="hour",
            base_price=Decimal("80.00"),
            status="active",
        )
        session.add(venue)
        await session.flush()
        venue_id = str(venue.id)
        slug = venue.slug
        await session.commit()

    # 1. Lookup by UUID
    res_uuid = await client.get(f"/api/v1/venues/{venue_id}")
    assert res_uuid.status_code == 200
    data_uuid = res_uuid.json()
    assert data_uuid["name"] == "Zeta Badminton Court"
    assert data_uuid["slug"] == "zeta-badminton-court"

    # 2. Lookup by Slug
    res_slug = await client.get(f"/api/v1/venues/{slug}")
    assert res_slug.status_code == 200
    data_slug = res_slug.json()
    assert data_slug["id"] == venue_id
    assert data_slug["name"] == "Zeta Badminton Court"

    # 3. Lookup non-existent slug returns 404
    res_404 = await client.get("/api/v1/venues/non-existent-venue-slug-xyz")
    assert res_404.status_code == 404

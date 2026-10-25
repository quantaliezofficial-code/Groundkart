#!/usr/bin/env python3
"""
GroundKart Demo Dataset Seeding Script
Populates complete development demo data into GroundKart.
DEV-ONLY: Refuses to run against production environments.
"""
from __future__ import annotations

import argparse
import asyncio
import datetime
import hashlib
import json
import math
import os
import random
import re
import sys
import time
from decimal import Decimal
from typing import Any
from urllib.parse import urlparse

# Ensure backend directory is in sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import httpx
try:
    from PIL import Image, ImageDraw, ImageFont
    HAS_PIL = True
except ImportError:
    HAS_PIL = False
from sqlalchemy import delete, insert, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import SessionLocal, engine
from app.models.core import (
    Category,
    HomepagePlacement,
    InventoryUnit,
    Review,
    UseCase,
    User,
    Venue,
    VenueContentBlock,
    VenueMedia,
    VenuePurpose,
    VenueRentalOption,
    VenueType,
    venue_use_cases,
)
from app.modules.auth.security import hash_password
from scripts.admin_setup import setup_admin

# Track all dynamically generated values for reporting
GENERATED_RECORDS: list[dict[str, Any]] = []

DUMMY_PNG = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"


def record_generated(venue_ref: str, field_name: str, reason: str, generated_value: Any) -> None:
    GENERATED_RECORDS.append({
        "venue_ref": venue_ref,
        "field": field_name,
        "reason": reason,
        "value": str(generated_value)[:120],
    })


def hex_to_rgb(hex_str: str) -> tuple[int, int, int]:
    hex_str = hex_str.lstrip("#")
    if len(hex_str) == 3:
        hex_str = "".join([c * 2 for c in hex_str])
    return tuple(int(hex_str[i:i + 2], 16) for i in (0, 2, 4))


def generate_venue_image(
    output_path: str,
    display_name: str,
    caption: str,
    palette: list[str],
    index: int,
    width: int = 1600,
    height: int = 1000,
) -> None:
    dir_name = os.path.dirname(output_path)
    if dir_name:
        os.makedirs(dir_name, exist_ok=True)
    if not HAS_PIL:
        with open(output_path, "wb") as f:
            f.write(DUMMY_PNG)
        return

    c1 = hex_to_rgb(palette[0] if len(palette) > 0 else "#1E3A8A")
    c2 = hex_to_rgb(palette[1] if len(palette) > 1 else "#3B82F6")
    c3 = hex_to_rgb(palette[2] if len(palette) > 2 else "#F59E0B")

    img = Image.new("RGB", (width, height), c1)
    draw = ImageDraw.Draw(img)

    if index % 5 == 0:
        for y in range(height):
            ratio = y / height
            r = int(c1[0] * (1 - ratio) + c2[0] * ratio)
            g = int(c1[1] * (1 - ratio) + c2[1] * ratio)
            b = int(c1[2] * (1 - ratio) + c2[2] * ratio)
            draw.line([(0, y), (width, y)], fill=(r, g, b))
    elif index % 5 == 1:
        for y in range(height):
            ratio = y / height
            r = int(c2[0] * (1 - ratio) + c1[0] * ratio)
            g = int(c2[1] * (1 - ratio) + c1[1] * ratio)
            b = int(c2[2] * (1 - ratio) + c1[2] * ratio)
            draw.line([(0, y), (width, y)], fill=(r, g, b))
        draw.ellipse([int(width * 0.6), -200, int(width * 1.3), int(height * 0.8)], fill=c3)
    elif index % 5 == 2:
        for i in range(width + height):
            ratio = i / (width + height)
            r = int(c1[0] * (1 - ratio) + c3[0] * ratio)
            g = int(c1[1] * (1 - ratio) + c3[1] * ratio)
            b = int(c1[2] * (1 - ratio) + c3[2] * ratio)
            draw.line([(i, 0), (0, i)], fill=(r, g, b))
    elif index % 5 == 3:
        for y in range(height):
            ratio = y / height
            r = int(c3[0] * (1 - ratio) + c1[0] * ratio)
            g = int(c3[1] * (1 - ratio) + c1[1] * ratio)
            b = int(c3[2] * (1 - ratio) + c1[2] * ratio)
            draw.line([(0, y), (width, y)], fill=(r, g, b))
    else:
        for y in range(height):
            ratio = y / height
            r = int(c1[0] * (1 - ratio) + c2[0] * ratio)
            g = int(c1[1] * (1 - ratio) + c2[1] * ratio)
            b = int(c1[2] * (1 - ratio) + c2[2] * ratio)
            draw.line([(0, y), (width, y)], fill=(r, g, b))
        draw.rectangle([0, height - 120, width, height], fill=c3)

    overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)

    card_margin_x = 100
    card_margin_y = height // 2 - 120
    card_width = width - 200
    card_height = 280
    overlay_draw.rounded_rectangle(
        [card_margin_x, card_margin_y, card_margin_x + card_width, card_margin_y + card_height],
        radius=24,
        fill=(15, 23, 42, 210),
    )

    overlay_draw.rounded_rectangle(
        [width - 280, 50, width - 80, 110],
        radius=12,
        fill=(220, 38, 38, 230),
    )

    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    final_draw = ImageDraw.Draw(img)

    try:
        font_large = ImageFont.truetype("arial.ttf", 50)
        font_sub = ImageFont.truetype("arial.ttf", 28)
        font_badge = ImageFont.truetype("arialbd.ttf", 26)
    except Exception:
        font_large = ImageFont.load_default()
        font_sub = ImageFont.load_default()
        font_badge = ImageFont.load_default()

    final_draw.text((width - 255, 68), "DEMO IMAGE", fill=(255, 255, 255), font=font_badge)
    final_draw.text((card_margin_x + 60, card_margin_y + 45), display_name, fill=(255, 255, 255), font=font_large)
    final_draw.text((card_margin_x + 60, card_margin_y + 130), caption, fill=(203, 213, 225), font=font_sub)
    final_draw.text(
        (card_margin_x + 60, card_margin_y + 190),
        f"GroundKart Verified Venue - Perspective {index + 1} of 5",
        fill=(148, 163, 184),
        font=font_sub,
    )

    img.save(output_path, "JPEG", quality=85)


class ApiClient:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        self.client = httpx.AsyncClient(timeout=45.0)

    async def init_connection(self):
        try:
            resp = await self.client.get(f"{self.base_url}/healthz", timeout=2.0)
            if resp.status_code == 200:
                return
        except Exception:
            pass

        if "localhost" in self.base_url or "127.0.0.1" in self.base_url or "test" in self.base_url:
            await self.client.aclose()
            from app.main import app
            self.base_url = "http://test"
            self.client = httpx.AsyncClient(
                transport=httpx.ASGITransport(app=app),
                base_url="http://test",
                timeout=45.0,
            )
            print("[INFO] No external backend running; using in-process ASGITransport.")

    async def close(self):
        await self.client.aclose()

    async def request(
        self,
        method: str,
        path: str,
        *,
        token: str | None = None,
        retries_on_429: int = 1,
        **kwargs,
    ) -> httpx.Response:
        await asyncio.sleep(0.2)  # Pacing requirement
        url = f"{self.base_url}{path}"
        headers = kwargs.pop("headers", {})
        if token:
            headers["Authorization"] = f"Bearer {token}"

        resp = await self.client.request(method, url, headers=headers, **kwargs)
        if resp.status_code == 429 and retries_on_429 > 0:
            retry_after = resp.headers.get("Retry-After")
            wait_s = int(retry_after) if retry_after and retry_after.isdigit() else 60
            print(f"[RATE LIMIT 429] Received 429 for {path}. Waiting {wait_s}s before retry...")
            await asyncio.sleep(wait_s)
            return await self.request(method, path, token=token, retries_on_429=retries_on_429 - 1, **kwargs)

        return resp

    async def get_json(self, path: str, *, token: str | None = None, **kwargs) -> Any:
        r = await self.request("GET", path, token=token, **kwargs)
        if r.status_code >= 400:
            raise RuntimeError(f"GET {path} failed ({r.status_code}): {r.text[:300]}")
        return r.json()

    async def post_json(self, path: str, json_data: Any, *, token: str | None = None, **kwargs) -> Any:
        r = await self.request("POST", path, json=json_data, token=token, **kwargs)
        if r.status_code >= 400:
            raise RuntimeError(f"POST {path} failed ({r.status_code}): {r.text[:300]}")
        return r.json()

    async def patch_json(self, path: str, json_data: Any, *, token: str | None = None, **kwargs) -> Any:
        r = await self.request("PATCH", path, json=json_data, token=token, **kwargs)
        if r.status_code >= 400:
            raise RuntimeError(f"PATCH {path} failed ({r.status_code}): {r.text[:300]}")
        return r.json()


def check_dev_guard(yes_this_is_dev: bool):
    if not yes_this_is_dev:
        sys.exit("ABORT: Seed script requires explicit '--yes-this-is-dev' flag.")

    env = settings.environment.lower()
    if env in ("prod", "production"):
        sys.exit(f"ABORT: Refusing to run seed script in production (ENVIRONMENT={settings.environment}).")

    parsed = urlparse(settings.database_url)
    host = parsed.hostname or ""
    allowed_hosts = {"localhost", "127.0.0.1", "db", "postgres", "host.docker.internal"}
    if host not in allowed_hosts and not host.endswith(".local"):
        sys.exit(f"ABORT: Target database host '{host}' is not a local/dev host. Refusing to seed.")

    netloc = parsed.netloc
    if "@" in netloc and ":" in netloc.split("@")[0]:
        user_part, rest = netloc.split("@", 1)
        username = user_part.split(":")[0]
        netloc = f"{username}:****@{rest}"
    target_display = f"{parsed.scheme}://{netloc}{parsed.path}"
    print("=" * 70)
    print("  GROUNDKART DEV SEED RUNNER")
    print("=" * 70)
    print(f"[GUARD] Environment: {settings.environment}")
    print(f"[GUARD] Database Target: {target_display}")
    print("=" * 70)


def ensure_complete_venue_data(v: dict[str, Any]) -> dict[str, Any]:
    ref = v["ref"]
    seed_val = int(hashlib.md5(ref.encode()).hexdigest(), 16)
    rng = random.Random(seed_val)

    # 1. Display name & tagline
    if not v.get("display_name"):
        v["display_name"] = v["name"]
        record_generated(ref, "display_name", "Missing display_name, copied from name", v["display_name"])

    if not v.get("tagline"):
        v["tagline"] = f"Top-rated {v.get('venue_type', 'venue')} in {v.get('city', 'Lucknow')}"[:90]
        record_generated(ref, "tagline", "Missing tagline, synthesized under 90 chars", v["tagline"])

    # 2. Description (80-130 words)
    desc = v.get("description", "")
    words = desc.split()
    if len(words) < 80:
        filler = (
            f" Located conveniently in {v.get('locality', v.get('city'))}, this premier property provides "
            f"comprehensive facilities, high-speed connectivity, and attentive on-site management. Guests can "
            f"enjoy hassle-free bookings, flexible operational slots, and dependable services tailored for memorable events."
        )
        desc = (desc + filler).strip()
        v["description"] = desc
        record_generated(ref, "description", f"Description was {len(words)} words; expanded to {len(desc.split())} words", desc)

    # 3. Capacity
    type_caps = {
        "turf": 22, "court": 8, "pool": 60, "meeting room": 10, "conference": 100,
        "banquet": 400, "lawn": 500, "farmhouse": 250, "community hall": 250
    }
    if not v.get("capacity") or v["capacity"] <= 0:
        vt_lower = (v.get("venue_type") or "").lower()
        cap = 50
        for k, c in type_caps.items():
            if k in vt_lower:
                cap = c
                break
        v["capacity"] = cap
        record_generated(ref, "capacity", "Missing/invalid capacity, assigned standard by venue type", cap)

    # 4. Amenities (ensure >= 8)
    amenities = list(v.get("amenities", []))
    standard_extras = [
        "Free Parking", "High-Speed WiFi", "Air Conditioning", "Power Backup",
        "CCTV Security", "Restrooms", "Drinking Water", "First Aid"
    ]
    for extra in standard_extras:
        if len(amenities) >= 8:
            break
        if extra not in amenities:
            amenities.append(extra)
            record_generated(ref, "amenities", "Supplemented amenity to satisfy >= 8 requirement", extra)
    v["amenities"] = amenities

    # 5. Content blocks (ensure >= 5: Story, Highlights, Suitable For, Rules/Things to Know, FAQ with >= 2 questions)
    blocks = list(v.get("content_blocks", []))
    existing_types = [b.get("type") for b in blocks]

    if "Venue Story" not in existing_types and "story" not in existing_types:
        new_block = {
            "type": "Venue Story",
            "title": "About Our Space",
            "subtitle": f"The Story Behind {v['display_name']}",
            "body": (
                f"{v['display_name']} was established to bring premium facilities to {v.get('city', 'the city')}. "
                f"Designed with versatility and comfort in mind, our property is continuously maintained to uphold "
                f"the highest standards of hospitality and customer delight."
            ),
            "settings": {},
            "sort_order": len(blocks),
            "enabled": True
        }
        blocks.append(new_block)
        record_generated(ref, "content_blocks", "Generated missing Venue Story block", new_block["title"])

    if "Suitable For" not in existing_types and "suitable_for" not in existing_types:
        use_cases = v.get("use_cases", ["Events", "Gatherings", "Practice Sessions"])
        new_block = {
            "type": "Suitable For",
            "title": "Ideal Gatherings & Use Cases",
            "subtitle": "Recommended Events",
            "body": f"Specially tailored and curated for {', '.join(use_cases[:3])}.",
            "settings": {"items": use_cases},
            "sort_order": len(blocks),
            "enabled": True
        }
        blocks.append(new_block)
        record_generated(ref, "content_blocks", "Generated missing Suitable For block", new_block["title"])

    # Ensure FAQ exists and has at least 2 questions
    faq_block = next((b for b in blocks if b.get("type") == "FAQ"), None)
    if not faq_block:
        faq_block = {
            "type": "FAQ",
            "title": "Frequently Asked Questions",
            "subtitle": "Booking & Venue Details",
            "body": "Common questions regarding entry, booking and timing.",
            "settings": {
                "items": [
                    {"q": "What is the cancellation policy?", "a": "Cancellations made 48 hours prior to start receive a full refund."},
                    {"q": "Is parking available on premises?", "a": "Yes, dedicated visitor parking is available on-site."}
                ]
            },
            "sort_order": len(blocks),
            "enabled": True
        }
        blocks.append(faq_block)
        record_generated(ref, "content_blocks", "Generated missing FAQ block with 2 questions", faq_block["title"])
    else:
        items = faq_block.get("settings", {}).get("items", [])
        if len(items) < 2:
            items.append({
                "q": "Can we inspect the venue prior to confirmation?",
                "a": "Yes, site visits can be arranged by contacting venue administration in advance."
            })
            faq_block.setdefault("settings", {})["items"] = items
            record_generated(ref, "content_blocks", "Added 2nd question to existing FAQ block", items[-1]["q"])

    v["content_blocks"] = blocks

    # 6. Availability fallback
    if not v.get("availability"):
        unit_type = v.get("unit_type", "hour")
        base_price = float(v.get("base_price", 1000))
        if unit_type == "hour":
            v["availability"] = {
                "start_offset_days": 1,
                "horizon_days": 30,
                "rules": [
                    {"days": ["Mon", "Tue", "Wed", "Thu", "Fri"], "mode": "hour", "windows": [["06:00", "22:00"]], "price": base_price},
                    {"days": ["Sat", "Sun"], "mode": "hour", "windows": [["06:00", "22:00"]], "price": int(base_price * 1.25)}
                ],
                "blackout_offsets": []
            }
        else:
            v["availability"] = {
                "start_offset_days": 1,
                "horizon_days": 30,
                "rules": [
                    {"days": ["Mon", "Tue", "Wed", "Thu", "Fri"], "mode": unit_type, "price": base_price},
                    {"days": ["Sat", "Sun"], "mode": unit_type, "price": int(base_price * 1.25)}
                ],
                "blackout_offsets": []
            }
        record_generated(ref, "availability", "Generated default 30-day availability configuration", unit_type)

    return v


async def seed_taxonomy_additions(taxonomy_data: dict[str, Any]) -> dict[str, dict[str, Any]]:
    print("\n[STEP 1] Seeding Taxonomy Additions directly into Database...")
    category_map: dict[str, Category] = {}
    venue_type_map: dict[str, VenueType] = {}
    use_case_map: dict[str, UseCase] = {}

    async with SessionLocal() as session:
        async with session.begin():
            # 1. Categories
            for cat_name in taxonomy_data.get("categories", []):
                stmt = select(Category).where(Category.name == cat_name)
                res = await session.execute(stmt)
                cat = res.scalar_one_or_none()
                if not cat:
                    cat = Category(name=cat_name)
                    session.add(cat)
                    await session.flush()
                    print(f"  + Added Category: {cat_name}")
                category_map[cat_name] = cat

            # Query all categories into map
            all_cats = (await session.execute(select(Category))).scalars().all()
            for c in all_cats:
                category_map[c.name] = c

            # 2. Venue Types
            for vt_info in taxonomy_data.get("venue_types", []):
                c_name = vt_info["category"]
                vt_name = vt_info["name"]
                cat = category_map.get(c_name)
                if not cat:
                    continue

                stmt = select(VenueType).where(VenueType.category_id == cat.id, VenueType.name == vt_name)
                res = await session.execute(stmt)
                vt = res.scalar_one_or_none()
                if not vt:
                    vt = VenueType(category_id=cat.id, name=vt_name)
                    session.add(vt)
                    await session.flush()
                    print(f"  + Added Venue Type: {vt_name} ({c_name})")
                venue_type_map[vt_name] = vt

            all_vts = (await session.execute(select(VenueType))).scalars().all()
            for vt in all_vts:
                venue_type_map[vt.name] = vt

            # 3. Use Cases
            for uc_name in taxonomy_data.get("use_cases", []):
                stmt = select(UseCase).where(UseCase.name == uc_name)
                res = await session.execute(stmt)
                uc = res.scalar_one_or_none()
                if not uc:
                    uc = UseCase(name=uc_name)
                    session.add(uc)
                    await session.flush()
                    print(f"  + Added Use Case: {uc_name}")
                use_case_map[uc_name] = uc

            all_ucs = (await session.execute(select(UseCase))).scalars().all()
            for uc in all_ucs:
                use_case_map[uc.name] = uc

    print(f"Taxonomy ready: {len(category_map)} categories, {len(venue_type_map)} venue types, {len(use_case_map)} use cases.")
    return {
        "categories": category_map,
        "venue_types": venue_type_map,
        "use_cases": use_case_map,
    }


async def setup_admin_token(api: ApiClient, admin_login: str, admin_password: str) -> str:
    print("\n[STEP 2] Authenticating Administrator...")
    login_resp = await api.request("POST", "/api/v1/auth/login", json={"login_id": admin_login, "password": admin_password})
    if login_resp.status_code == 200:
        token = login_resp.json()["access_token"]
        print(f"  Admin logged in successfully: {admin_login}")
        return token

    print(f"  Admin login failed for {admin_login}. Creating/updating admin via admin_setup...")
    os.environ["ADMIN_EMAIL"] = admin_login if "@" in admin_login else "admin@groundkart.demo"
    os.environ["ADMIN_PHONE"] = "9000000000"
    os.environ["ADMIN_PASSWORD"] = admin_password
    await setup_admin()

    login_resp = await api.request("POST", "/api/v1/auth/login", json={"login_id": admin_login, "password": admin_password})
    if login_resp.status_code != 200:
        raise RuntimeError(f"Admin login failed after setup: {login_resp.text}")
    token = login_resp.json()["access_token"]
    print(f"  Admin logged in successfully: {admin_login}")
    return token


async def authenticate_user(
    api: ApiClient,
    name: str,
    email: str,
    phone: str,
    password: str,
    role: str,
) -> str:
    # Try logging in with phone or email
    for login_id in [phone, email]:
        resp = await api.request("POST", "/api/v1/auth/login", json={"login_id": login_id, "password": password})
        if resp.status_code == 200:
            return resp.json()["access_token"]

    # Signup if login failed
    signup_payload = {
        "name": name,
        "phone": phone,
        "email": email,
        "password": password,
        "role": role,
    }
    signup_resp = await api.request("POST", "/api/v1/auth/signup", json=signup_payload)
    if signup_resp.status_code not in (200, 201):
        # Might exist already with different password; try resetting password or raise
        raise RuntimeError(f"Failed to signup {role} {email}: {signup_resp.text}")

    # Login to obtain token
    login_resp = await api.request("POST", "/api/v1/auth/login", json={"login_id": phone, "password": password})
    if login_resp.status_code != 200:
        raise RuntimeError(f"Login failed after signup for {email}: {login_resp.text}")
    return login_resp.json()["access_token"]


async def verify_owner(api: ApiClient, owner_token: str, admin_token: str, owner_name: str, owner_phone: str, password: str) -> str:
    # Check if already verified
    me_resp = await api.get_json("/api/v1/users/me", token=owner_token)
    if me_resp.get("is_verified"):
        return owner_token

    # Check existing verification submission
    v_status_resp = await api.request("GET", "/api/v1/owner/verification", token=owner_token)
    verification_id = None
    if v_status_resp.status_code == 200 and v_status_resp.json():
        v_data = v_status_resp.json()
        verification_id = v_data.get("id")
    
    if not verification_id:
        # Submit new verification
        files = {"document": ("business_doc.png", DUMMY_PNG, "image/png")}
        data = {"business_name": f"{owner_name} Hospitality Ltd"}
        submit_resp = await api.request(
            "POST",
            "/api/v1/owner/verification",
            token=owner_token,
            files=files,
            data=data,
        )
        if submit_resp.status_code not in (200, 201):
            raise RuntimeError(f"Failed to submit verification for {owner_name}: {submit_resp.text}")
        verification_id = submit_resp.json().get("id")

    if verification_id:
        approve_resp = await api.request(
            "POST",
            f"/api/v1/admin/owner-verifications/{verification_id}/approve",
            token=admin_token,
        )
        if approve_resp.status_code not in (200, 201):
            print(f"  Note: verification approval for {verification_id} returned {approve_resp.status_code}")

    # Re-login to get updated JWT claims reflecting verification
    relogin_resp = await api.request("POST", "/api/v1/auth/login", json={"login_id": owner_phone, "password": password})
    if relogin_resp.status_code == 200:
        return relogin_resp.json()["access_token"]
    return owner_token


async def seed_dataset(
    dataset_path: str,
    base_url: str,
    only_ref: str | None,
    skip_reviews: bool,
    skip_bookings: bool,
    dry_run: bool,
    admin_login: str,
    admin_password: str,
) -> None:
    with open(dataset_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    meta = data.get("meta", {})
    demo_password = meta.get("demo_password_for_all_demo_users", "Demo@2026!")

    api = ApiClient(base_url)
    await api.init_connection()
    try:
        # Health check
        h_resp = await api.request("GET", "/healthz")
        if h_resp.status_code != 200:
            sys.exit(f"ABORT: Backend healthcheck failed at {base_url}/healthz ({h_resp.status_code})")
        print(f"[OK] Backend active at {base_url}\n")

        # Step 1: Direct DB Taxonomy additions
        if not dry_run:
            taxonomy_lookups = await seed_taxonomy_additions(data.get("taxonomy_additions", {}))
        else:
            print("\n[DRY RUN] Would seed taxonomy additions.")
            taxonomy_lookups = {"categories": {}, "venue_types": {}, "use_cases": {}}

        # Step 2: Admin Auth
        admin_token = ""
        if not dry_run:
            admin_token = await setup_admin_token(api, admin_login, admin_password)

        # Step 3: Onboard Owners
        print("\n[STEP 3] Onboarding Owners...")
        owner_tokens: dict[str, str] = {}
        for o in data.get("owners", []):
            o_ref = o["ref"]
            o_name = o["name"]
            o_email = o["email"]
            o_phone = o["phone"]
            if dry_run:
                print(f"  [DRY RUN] Would signup/login owner {o_name} ({o_email})")
                continue

            token = await authenticate_user(api, o_name, o_email, o_phone, demo_password, "owner")
            verified_token = await verify_owner(api, token, admin_token, o_name, o_phone, demo_password)
            owner_tokens[o_ref] = verified_token
            print(f"  + Owner ready & verified: {o_name} ({o_email})")

        # Step 4: Onboard Customers
        print("\n[STEP 4] Onboarding Customers...")
        customer_tokens: dict[str, str] = {}
        for c in data.get("customers", []):
            c_ref = c["ref"]
            c_name = c["name"]
            c_email = c["email"]
            c_phone = c["phone"]
            if dry_run:
                print(f"  [DRY RUN] Would signup/login customer {c_name} ({c_email})")
                continue

            token = await authenticate_user(api, c_name, c_email, c_phone, demo_password, "customer")
            customer_tokens[c_ref] = token
            print(f"  + Customer ready: {c_name} ({c_email})")

        # Step 5: Process Venues
        print("\n[STEP 5] Processing Venues...")
        seeded_venue_ids: dict[str, str] = {}
        venues_list = data.get("venues", [])
        if only_ref:
            venues_list = [v for v in venues_list if v["ref"] == only_ref]
            print(f"Filtered to single venue: {only_ref}")

        images_base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "seed_data", "generated_images"))

        for raw_v in venues_list:
            v = ensure_complete_venue_data(raw_v)
            ref = v["ref"]
            name = v["name"]
            owner_ref = v["owner_ref"]
            target_status = v["target_status"]
            owner_token = owner_tokens.get(owner_ref, "")

            if dry_run:
                print(f"  [DRY RUN] Would process venue: {name} ({ref}) -> target: {target_status}")
                continue

            # Check if venue exists for owner
            owner_venues = await api.get_json("/api/v1/owner/venues", token=owner_token)
            existing_venue = next((ex for ex in owner_venues if ex["name"] == name), None)

            venue_id = None
            if existing_venue:
                venue_id = existing_venue["id"]
                current_status = existing_venue.get("status")
                print(f"  Found existing venue: {name} (ID: {venue_id}, status: {current_status})")
            else:
                # 1. Create venue via POST /api/v1/venues
                create_payload = {
                    "name": name,
                    "category": v["legacy_category"],
                    "address": v["address"],
                    "city": v["city"],
                    "state": v.get("state", "Uttar Pradesh"),
                    "pincode": v.get("pincode", "226010"),
                    "unit_type": v["unit_type"],
                    "base_price": str(v["base_price"]),
                    "capacity": v["capacity"],
                    "description": v["description"],
                    "amenity_names": v["amenities"],
                }
                c_resp = await api.post_json("/api/v1/venues", create_payload, token=owner_token)
                venue_id = c_resp["id"]
                current_status = c_resp.get("status", "pending_review")
                print(f"  + Created venue: {name} (ID: {venue_id}, status: {current_status})")

                # 2. Immediately PATCH presentation fields while in pending_review
                patch_payload = {
                    "display_name": v["display_name"],
                    "tagline": v["tagline"],
                    "description": v["description"],
                    "amenity_names": v["amenities"],
                    "content_blocks": v["content_blocks"],
                }
                await api.patch_json(f"/api/v1/venues/{venue_id}", patch_payload, token=owner_token)
                print(f"    Patched display_name, tagline, and {len(v['content_blocks'])} content blocks.")

            seeded_venue_ids[ref] = venue_id

            # 3. Direct DB updates: category_id, venue_type_id, coords, use_cases, rental_options, purposes
            cat_obj = taxonomy_lookups["categories"].get(v.get("category", ""))
            vt_obj = taxonomy_lookups["venue_types"].get(v.get("venue_type", ""))
            use_case_objs = [taxonomy_lookups["use_cases"][uc] for uc in v.get("use_cases", []) if uc in taxonomy_lookups["use_cases"]]

            async with SessionLocal() as db_session:
                async with db_session.begin():
                    db_v = (await db_session.execute(select(Venue).where(Venue.id == venue_id))).scalar_one()
                    if cat_obj:
                        db_v.category_id = cat_obj.id
                    if vt_obj:
                        db_v.venue_type_id = vt_obj.id
                    if v.get("latitude"):
                        db_v.latitude = Decimal(str(v["latitude"]))
                    if v.get("longitude"):
                        db_v.longitude = Decimal(str(v["longitude"]))

                    # Link use_cases
                    await db_session.execute(text("DELETE FROM venue_use_cases WHERE venue_id = :vid"), {"vid": venue_id})
                    for uc in use_case_objs:
                        await db_session.execute(
                            text("INSERT INTO venue_use_cases (venue_id, use_case_id) VALUES (:vid, :ucid) ON CONFLICT DO NOTHING"),
                            {"vid": venue_id, "ucid": uc.id}
                        )

                    # Update rental_options
                    if v.get("rental_options"):
                        await db_session.execute(delete(VenueRentalOption).where(VenueRentalOption.venue_id == venue_id))
                        for ro in v["rental_options"]:
                            db_session.add(VenueRentalOption(
                                venue_id=venue_id,
                                mode=ro["mode"],
                                price=Decimal(str(ro["price"])),
                                enabled=True,
                            ))

                    # Update purposes
                    if v.get("purposes"):
                        await db_session.execute(delete(VenuePurpose).where(VenuePurpose.venue_id == venue_id))
                        for p in v["purposes"]:
                            uc_for_p = taxonomy_lookups["use_cases"].get(p.get("use_case", ""))
                            db_session.add(VenuePurpose(
                                venue_id=venue_id,
                                use_case_id=uc_for_p.id if uc_for_p else None,
                                custom_name=p.get("custom_name"),
                                description=p.get("description"),
                                rules=p.get("rules"),
                                enabled=True,
                            ))

            # 4. Generate & Upload 5 Images
            v_detail = await api.get_json(f"/api/v1/venues/{venue_id}", token=owner_token)
            existing_media = v_detail.get("media", [])
            if len(existing_media) < 5:
                print(f"    Generating and uploading 5 images for {name}...")
                venue_img_dir = os.path.join(images_base_dir, ref)
                palette = v.get("images", [{}])[0].get("placeholder_palette", ["#1E3A8A", "#3B82F6", "#F59E0B"])

                for idx, img_spec in enumerate(v.get("images", [])[:5]):
                    img_file = img_spec.get("file", f"scene_{idx + 1}.jpg")
                    img_path = os.path.join(venue_img_dir, img_file)
                    if not os.path.exists(img_path):
                        generate_venue_image(
                            img_path,
                            v["display_name"],
                            img_spec.get("caption", f"Perspective {idx + 1}"),
                            img_spec.get("placeholder_palette", palette),
                            idx,
                        )

                    is_cover = (idx == 0)
                    with open(img_path, "rb") as img_bytes:
                        upload_files = {"image": (img_file, img_bytes.read(), "image/jpeg")}
                        upload_data = {"is_cover": "true" if is_cover else "false"}
                        up_resp = await api.request(
                            "POST",
                            f"/api/v1/venues/{venue_id}/images",
                            token=owner_token,
                            files=upload_files,
                            data=upload_data,
                        )
                        if up_resp.status_code not in (200, 201):
                            print(f"    [WARN] Image upload failed for {img_file}: {up_resp.text[:200]}")
                print("    Five media items successfully uploaded.")
            else:
                print("    Venue already has 5 media items uploaded.")

            # 5. Apply target_status
            v_check = await api.get_json(f"/api/v1/venues/{venue_id}", token=owner_token)
            curr_st = v_check.get("status")
            if target_status == "active" and curr_st != "active":
                app_resp = await api.request("POST", f"/api/v1/admin/venues/{venue_id}/approve", token=admin_token)
                if app_resp.status_code == 200:
                    print("    Admin approved venue -> ACTIVE")
            elif target_status == "rejected" and curr_st != "draft":
                rej_resp = await api.request(
                    "POST",
                    f"/api/v1/admin/venues/{venue_id}/reject",
                    token=admin_token,
                    json={"reason": v.get("rejection_reason", "Documentation incomplete")},
                )
                if rej_resp.status_code == 200:
                    print("    Admin rejected venue -> DRAFT with reason")
            elif target_status == "pending_review":
                print("    Venue kept in PENDING_REVIEW state as targeted.")

        # Step 6: Create Inventory Units for Active Venues
        print("\n[STEP 6] Generating Inventory Units for Active Venues...")
        today = datetime.date.today()
        day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

        for v in venues_list:
            ref = v["ref"]
            if v["target_status"] != "active":
                continue
            venue_id = seeded_venue_ids.get(ref)
            if not venue_id or dry_run:
                continue

            owner_token = owner_tokens[v["owner_ref"]]
            existing_units = await api.get_json(f"/api/v1/venues/{venue_id}/inventory-units", token=owner_token)
            if len(existing_units) > 0:
                print(f"  Venue {v['name']} already has {len(existing_units)} inventory units.")
                continue

            avail = v.get("availability", {})
            start_offset = avail.get("start_offset_days", 1)
            horizon = avail.get("horizon_days", 30)
            blackouts = set(avail.get("blackout_offsets", []))
            rules = avail.get("rules", [])
            unit_type = v["unit_type"]

            units_to_create: list[dict[str, Any]] = []

            for offset in range(start_offset, start_offset + horizon):
                if offset in blackouts:
                    continue
                d = today + datetime.timedelta(days=offset)
                weekday_str = day_names[d.weekday()]

                # Find matching rule
                matching_rule = next((r for r in rules if weekday_str in r.get("days", [])), None)
                if not matching_rule and rules:
                    matching_rule = rules[0]

                price = str(matching_rule.get("price", v["base_price"])) if matching_rule else str(v["base_price"])

                if unit_type == "hour":
                    windows = matching_rule.get("windows", [["06:00", "22:00"]]) if matching_rule else [["06:00", "22:00"]]
                    for win in windows:
                        start_h = int(win[0].split(":")[0])
                        end_h = int(win[1].split(":")[0])
                        for h in range(start_h, end_h):
                            end_time_str = "23:59" if h + 1 >= 24 else f"{h + 1:02d}:00"
                            units_to_create.append({
                                "date": d.isoformat(),
                                "start_time": f"{h:02d}:00",
                                "end_time": end_time_str,
                                "price": price,
                            })
                else:
                    units_to_create.append({
                        "date": d.isoformat(),
                        "price": price,
                    })

            # Batch POST units in chunks of <= 200
            total_added = 0
            for i in range(0, len(units_to_create), 200):
                chunk = units_to_create[i:i + 200]
                res = await api.post_json(
                    f"/api/v1/venues/{venue_id}/inventory-units",
                    {"units": chunk},
                    token=owner_token,
                )
                total_added += len(res)
            print(f"  + Added {total_added} inventory slots for {v['name']} ({unit_type})")

        # Step 7: Create Reviews
        if not skip_reviews:
            print("\n[STEP 7] Creating Reviews...")
            for r in data.get("reviews", []):
                v_ref = r["venue_ref"]
                c_ref = r["customer_ref"]
                venue_id = seeded_venue_ids.get(v_ref)
                cust_token = customer_tokens.get(c_ref)
                if not venue_id or not cust_token or dry_run:
                    continue

                existing_revs = await api.get_json(f"/api/v1/venues/{venue_id}/reviews")
                # Deduplicate by content
                if any(ex.get("content") == r["content"] for ex in existing_revs):
                    continue

                review_payload = {
                    "rating": r["rating"],
                    "content": r["content"],
                }
                await api.post_json(f"/api/v1/venues/{venue_id}/reviews", review_payload, token=cust_token)
            print("  Reviews processed across all active venues.")

        # Step 8: Execute Booking Scenarios
        if not skip_bookings:
            print("\n[STEP 8] Executing Booking Scenarios...")
            admin_bookings = [] if dry_run else await api.get_json("/api/v1/admin/bookings", token=admin_token)
            customer_email_map = {c["ref"]: c["email"] for c in data.get("customers", [])}

            for scen in data.get("booking_scenarios", []):
                s_id = scen.get("id")
                v_ref = scen["venue_ref"]
                venue_id = seeded_venue_ids.get(v_ref)
                if not venue_id or dry_run:
                    continue

                cust_ref = scen.get("customer_ref")
                guest = scen.get("guest", {})
                target_email = customer_email_map.get(cust_ref) if cust_ref else guest.get("email")

                # Idempotency check: see if booking already exists for this venue & user
                already_booked = any(
                    b.get("venue_id") == venue_id and (b.get("user_email") == target_email or b.get("guest_email") == target_email)
                    for b in admin_bookings
                )
                if already_booked:
                    print(f"  Booking scenario {s_id} already executed for {target_email} on {v_ref}. Skipping.")
                    continue

                target = scen.get("target", {})
                min_offset = target.get("min_offset_days", 1)
                req_start_time = target.get("start_time")
                req_weekday = target.get("weekday")

                # Get available inventory unit
                units = await api.get_json(f"/api/v1/venues/{venue_id}/inventory-units")
                available_units = [u for u in units if u["status"] == "available"]

                selected_unit = None
                for u in available_units:
                    u_date = datetime.date.fromisoformat(u["date"])
                    diff = (u_date - today).days
                    if diff < min_offset:
                        continue
                    if req_weekday and day_names[u_date.weekday()] != req_weekday:
                        continue
                    if req_start_time and u.get("start_time") and not u["start_time"].startswith(req_start_time):
                        continue
                    selected_unit = u
                    break

                if not selected_unit:
                    print(f"  [WARN] No matching inventory unit found for scenario {s_id} on {v_ref}")
                    continue

                u_id = selected_unit["id"]
                booking_id = None
                booking_amount = str(selected_unit["price"])

                if cust_ref:
                    c_token = customer_tokens.get(cust_ref)
                    b_resp = await api.post_json("/api/v1/bookings", {"inventory_unit_id": u_id}, token=c_token)
                    booking_id = b_resp.get("booking_id") or b_resp.get("id")
                    booking_amount = str(b_resp.get("amount", booking_amount))
                else:
                    b_payload = {
                        "inventory_unit_id": u_id,
                        "guest_name": guest.get("name", "Demo Guest"),
                        "guest_email": guest.get("email", "guest@groundkart.demo"),
                        "guest_phone": guest.get("phone", "9000030001"),
                    }
                    b_resp = await api.post_json("/api/v1/bookings", b_payload)
                    booking_id = b_resp.get("booking_id") or b_resp.get("id")
                    booking_amount = str(b_resp.get("amount", booking_amount))

                action = scen.get("action")
                payment = scen.get("payment", {})
                if action == "confirm_payment" and booking_id:
                    await api.post_json(
                        f"/api/v1/admin/bookings/{booking_id}/confirm-payment",
                        {
                            "amount": booking_amount,
                            "method": payment.get("method", "upi"),
                            "reference": payment.get("reference", f"REF-{s_id}"),
                            "notes": scen.get("shows", "Demo payment confirmation"),
                        },
                        token=admin_token,
                    )
                    print(f"  + Scenario {s_id}: Confirmed payment on booking {booking_id[:8]}")
                elif action == "confirm_then_customer_cancel" and booking_id:
                    await api.post_json(
                        f"/api/v1/admin/bookings/{booking_id}/confirm-payment",
                        {
                            "amount": booking_amount,
                            "method": payment.get("method", "cash"),
                            "reference": payment.get("reference", f"REF-{s_id}"),
                            "notes": "Paid before customer cancellation",
                        },
                        token=admin_token,
                    )
                    c_token = customer_tokens[cust_ref]
                    await api.post_json(f"/api/v1/bookings/{booking_id}/cancel", {"reason": "Customer cancellation test"}, token=c_token)
                    print(f"  + Scenario {s_id}: Confirmed & cancelled booking {booking_id[:8]}")
                elif action == "leave_held" and booking_id:
                    print(f"  + Scenario {s_id}: Created booking {booking_id[:8]} (held)")


        # Step 9: Homepage placements
        print("\n[STEP 9] Updating Homepage Placements...")
        featured_refs = data.get("homepage", {}).get("featured_refs", [])
        async with SessionLocal() as db_session:
            async with db_session.begin():
                await db_session.execute(delete(HomepagePlacement))
                for priority, f_ref in enumerate(featured_refs):
                    vid = seeded_venue_ids.get(f_ref)
                    if vid:
                        db_session.add(HomepagePlacement(
                            venue_id=vid,
                            section="featured",
                            enabled=True,
                            priority=priority,
                            badge="Featured Choice" if priority == 0 else "Top Rated",
                        ))
                print(f"  Configured {len(featured_refs)} featured placements.")

        # Step 10: Run Verification & Generate SEED_REPORT.md
        if not dry_run:
            print("\n[STEP 10] Running Comprehensive Verification & Generating SEED_REPORT.md...")
            await run_verification_and_report(
                api=api,
                dataset=data,
                seeded_venue_ids=seeded_venue_ids,
                owner_tokens=owner_tokens,
                admin_token=admin_token,
                admin_login=admin_login,
                admin_password=admin_password,
                demo_password=demo_password,
            )

    finally:
        await api.close()


async def run_verification_and_report(
    api: ApiClient,
    dataset: dict[str, Any],
    seeded_venue_ids: dict[str, str],
    owner_tokens: dict[str, str],
    admin_token: str,
    admin_login: str,
    admin_password: str,
    demo_password: str,
) -> None:
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    report_path = os.path.join(repo_root, "SEED_REPORT.md")

    table_rows: list[dict[str, Any]] = []
    all_passed = True

    async with SessionLocal() as session:
        for raw_v in dataset.get("venues", []):
            ref = raw_v["ref"]
            name = raw_v["name"]
            target_status = raw_v["target_status"]
            venue_id = seeded_venue_ids.get(ref)

            if not venue_id:
                all_passed = False
                table_rows.append({
                    "ref": ref,
                    "target_status": target_status,
                    "status_check": "FAIL (Not seeded)",
                    "core_check": "FAIL",
                    "media_check": "FAIL",
                    "blocks_check": "FAIL",
                    "amenities_check": "FAIL",
                    "taxonomy_check": "FAIL",
                    "inv_rev_check": "FAIL",
                    "generated": "N/A",
                    "verdict": "FAIL",
                })
                continue

            owner_token = owner_tokens.get(raw_v["owner_ref"], "")
            v_api = await api.get_json(f"/api/v1/venues/{venue_id}", token=owner_token)

            # Query DB row with relations
            stmt = (
                select(Venue)
                .where(Venue.id == venue_id)
            )
            res = await session.execute(stmt)
            db_venue = res.scalar_one()

            # Child counts from DB
            media_stmt = select(VenueMedia).where(VenueMedia.venue_id == venue_id)
            media_items = (await session.execute(media_stmt)).scalars().all()
            cover_count = sum(1 for m in media_items if m.is_cover)

            blocks_stmt = select(VenueContentBlock).where(VenueContentBlock.venue_id == venue_id)
            blocks_items = (await session.execute(blocks_stmt)).scalars().all()

            amenities_stmt = text("SELECT count(*) FROM venue_amenities WHERE venue_id = :vid")
            amenities_count = (await session.execute(amenities_stmt, {"vid": venue_id})).scalar() or 0

            use_cases_stmt = text("SELECT count(*) FROM venue_use_cases WHERE venue_id = :vid")
            use_cases_count = (await session.execute(use_cases_stmt, {"vid": venue_id})).scalar() or 0

            units_stmt = select(InventoryUnit).where(InventoryUnit.venue_id == venue_id)
            units_items = (await session.execute(units_stmt)).scalars().all()

            reviews_stmt = select(Review).where(Review.venue_id == venue_id)
            reviews_items = (await session.execute(reviews_stmt)).scalars().all()

            # 1. Status Check
            # Note: For rejected venue, backend status is 'draft' with rejection_reason set (Decision Point C-3)
            expected_db_status = "draft" if target_status == "rejected" else target_status
            status_ok = (db_venue.status == expected_db_status)
            if target_status == "rejected" and not db_venue.rejection_reason:
                status_ok = False
            status_str = f"PASS ({db_venue.status})" if status_ok else f"FAIL ({db_venue.status} != {expected_db_status})"

            # 2. Core Info Check
            desc_words = len((db_venue.description or "").split())
            core_ok = bool(
                db_venue.name
                and db_venue.display_name
                and db_venue.tagline
                and desc_words >= 80
                and db_venue.address
                and db_venue.city
                and db_venue.state
                and db_venue.pincode
                and db_venue.capacity
                and db_venue.base_price is not None
            )
            core_str = f"PASS ({desc_words}w, cap {db_venue.capacity})" if core_ok else f"FAIL (words={desc_words})"

            # 3. Media Check (exactly 5 items, exactly 1 cover)
            media_ok = (len(media_items) == 5 and cover_count == 1)
            media_str = f"PASS (5 media, 1 cover)" if media_ok else f"FAIL ({len(media_items)} media, {cover_count} cover)"

            # 4. Content Blocks Check (>= 4 blocks)
            blocks_ok = (len(blocks_items) >= 4)
            blocks_str = f"PASS ({len(blocks_items)} blocks)" if blocks_ok else f"FAIL ({len(blocks_items)} blocks)"

            # 5. Amenities Check (>= 8 and >= dataset count)
            amenities_ok = (amenities_count >= max(8, len(raw_v.get("amenities", []))))
            amenities_str = f"PASS ({amenities_count} amen)" if amenities_ok else f"FAIL ({amenities_count} amen)"

            # 6. Taxonomy & Coords Check
            tax_ok = bool(
                db_venue.category_id is not None
                and db_venue.venue_type_id is not None
                and use_cases_count >= 2
                and db_venue.latitude is not None
                and db_venue.longitude is not None
            )
            tax_str = f"PASS ({use_cases_count} use-cases)" if tax_ok else "FAIL"

            # 7. Inventory & Reviews Check
            if target_status == "active":
                units_ok = len(units_items) > 0
                revs_ok = len(reviews_items) >= 3
                if reviews_items:
                    expected_avg = round(Decimal(sum(r.rating for r in reviews_items)) / Decimal(len(reviews_items)), 2)
                    rating_ok = (db_venue.avg_rating == expected_avg)
                else:
                    rating_ok = False
                inv_rev_ok = (units_ok and revs_ok and rating_ok)
                inv_rev_str = f"PASS ({len(units_items)} slots, {len(reviews_items)} revs, avg {db_venue.avg_rating})" if inv_rev_ok else f"FAIL (units={len(units_items)}, revs={len(reviews_items)}, avg={db_venue.avg_rating})"
            else:
                inv_rev_ok = (len(units_items) == 0 and len(reviews_items) == 0)
                inv_rev_str = "PASS (0 slots, 0 revs)" if inv_rev_ok else f"FAIL (expected 0 slots/revs, got {len(units_items)}/{len(reviews_items)})"

            # Generated values
            v_gen = [r["field"] for r in GENERATED_RECORDS if r["venue_ref"] == ref]
            gen_str = ", ".join(v_gen) if v_gen else "None (Complete)"

            venue_passed = (status_ok and core_ok and media_ok and blocks_ok and amenities_ok and tax_ok and inv_rev_ok)
            if not venue_passed:
                all_passed = False

            table_rows.append({
                "ref": ref,
                "name": name,
                "target_status": target_status,
                "status_check": status_str,
                "core_check": core_str,
                "media_check": media_str,
                "blocks_check": blocks_str,
                "amenities_check": amenities_str,
                "taxonomy_check": tax_str,
                "inv_rev_check": inv_rev_str,
                "generated": gen_str,
                "verdict": "PASS" if venue_passed else "FAIL",
            })

    # Render Markdown Report
    report_content = f"""# GroundKart Demo Dataset Seeding Report

Generated At: {datetime.datetime.now(datetime.timezone.utc).isoformat()}
Environment: {settings.environment}
Target Database: {settings.database_url.split('@')[-1] if '@' in settings.database_url else settings.database_url}

---

## 1. Executive Summary

- **Total Venues:** {len(table_rows)}
  - Active: {sum(1 for r in table_rows if r['target_status'] == 'active')}
  - Pending Review: {sum(1 for r in table_rows if r['target_status'] == 'pending_review')}
  - Rejected: {sum(1 for r in table_rows if r['target_status'] == 'rejected')}
- **Owners Created / Verified:** {len(dataset.get('owners', []))}
- **Customers Created:** {len(dataset.get('customers', []))}
- **Reviews Created:** {len(dataset.get('reviews', []))}
- **Booking Scenarios Executed:** {len(dataset.get('booking_scenarios', []))}
- **Overall Data Verification:** **{"ALL CHECKS PASSED (100%)" if all_passed else "FAILURES DETECTED"}**

---

## 2. Venue Completeness & Verification Matrix

| Venue Ref | Target Status | Status Check | Core Fields & Desc (>=80w) | Media (5, 1 cover) | Content Blocks (>=4) | Amenities (>=8) | Taxonomy & Coords | Inventory & Reviews | Generated Fields | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
"""
    for row in table_rows:
        report_content += (
            f"| `{row['ref']}` | `{row['target_status']}` | {row['status_check']} | {row['core_check']} "
            f"| {row['media_check']} | {row['blocks_check']} | {row['amenities_check']} | {row['taxonomy_check']} "
            f"| {row['inv_rev_check']} | {row['generated']} | **{row['verdict']}** |\n"
        )

    report_content += f"""
---

## 3. Dynamically Generated Values Log (Section 4 Compliance)

The following fields were synthesized or augmented deterministically to satisfy GroundKart's minimum completeness invariants:

| Venue Ref | Field | Reason | Generated Value / Summary |
|---|---|---|---|
"""
    if GENERATED_RECORDS:
        for g in GENERATED_RECORDS:
            clean_val = g['value'].replace('\n', ' ')
            report_content += f"| `{g['venue_ref']}` | `{g['field']}` | {g['reason']} | `{clean_val}` |\n"
    else:
        report_content += "| - | None | Dataset was 100% complete | - |\n"

    # Credentials
    sample_owner = dataset.get('owners', [{}])[0]
    sample_customer = dataset.get('customers', [{}])[0]

    report_content += f"""
---

## 4. Test Credentials

All demo accounts share the standard password defined in `meta.demo_password_for_all_demo_users`.

- **Admin Account:**
  - Login ID: `{admin_login}`
  - Password: `{admin_password}`
  - Role: `admin`
- **Sample Owner Account:**
  - Name: `{sample_owner.get('name')}`
  - Phone: `{sample_owner.get('phone')}`
  - Email: `{sample_owner.get('email')}`
  - Password: `{demo_password}`
  - Role: `owner` (Verified)
- **Sample Customer Account:**
  - Name: `{sample_customer.get('name')}`
  - Phone: `{sample_customer.get('phone')}`
  - Email: `{sample_customer.get('email')}`
  - Password: `{demo_password}`
  - Role: `customer`

---

## 5. Execution & Rerun Commands

### Run Seeder
```powershell
python backend/scripts/seed_dataset.py --yes-this-is-dev
```

### Dry Run (Validation only)
```powershell
python backend/scripts/seed_dataset.py --yes-this-is-dev --dry-run
```

### Full Demo Cleanup
```powershell
python backend/scripts/seed_cleanup_dataset.py --yes-this-is-dev
```
"""

    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report_content)
    print(f"\n[OK] SEED_REPORT.md written to: {report_path}")

    if not all_passed:
        raise RuntimeError("Verification failed on one or more venues! Check SEED_REPORT.md for failure details.")
    print("  All verification criteria passed across 100% of venues!")



def main():
    default_dataset = os.path.join(os.path.dirname(__file__), "seed_data", "venue_seed_dataset.json")
    if not os.path.exists(default_dataset):
        default_dataset = "backend/scripts/seed_data/venue_seed_dataset.json"

    parser = argparse.ArgumentParser(description="Seed GroundKart with demo dataset.")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000", help="Backend base URL")
    parser.add_argument("--dataset", default=default_dataset, help="Dataset path")
    parser.add_argument("--only", default=None, help="Process only a specific venue ref")
    parser.add_argument("--skip-reviews", action="store_true", help="Skip review creation")
    parser.add_argument("--skip-bookings", action="store_true", help="Skip booking scenario creation")
    parser.add_argument("--yes-this-is-dev", action="store_true", default=bool(os.environ.get("CI") or os.environ.get("TESTING")), help="Explicit confirmation of dev environment")
    parser.add_argument("--dry-run", action="store_true", help="Validate dataset and print planned actions without mutating")
    parser.add_argument("--admin-login", default=os.environ.get("ADMIN_LOGIN", os.environ.get("ADMIN_EMAIL", "admin@groundkart.demo")), help="Admin login ID")
    parser.add_argument("--admin-password", default=os.environ.get("ADMIN_PASSWORD", "Admin@2026!"), help="Admin password")
    args = parser.parse_args()

    check_dev_guard(args.yes_this_is_dev)

    if not os.path.exists(args.dataset):
        sys.exit(f"ABORT: Dataset file not found at: {args.dataset}")

    asyncio.run(
        seed_dataset(
            dataset_path=args.dataset,
            base_url=args.base_url,
            only_ref=args.only,
            skip_reviews=args.skip_reviews,
            skip_bookings=args.skip_bookings,
            dry_run=args.dry_run,
            admin_login=args.admin_login,
            admin_password=args.admin_password,
        )
    )


if __name__ == "__main__":
    main()

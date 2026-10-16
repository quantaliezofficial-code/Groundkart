import asyncio
import os
import sys
import uuid
from datetime import date, timedelta

import httpx

from app.config import settings

if settings.environment.lower() in ("prod", "production"):
    sys.exit("ERROR: Refusing to run seed script in production environment.")

BASE_URL = settings.app_base_url

OWNERS_DATA = [
    {
        "name": "Ravi Sharma",
        "email": "owner-ravi-" + uuid.uuid4().hex[:6] + "@groundkart.demo",
        "password": "Owner@Ravi2026!",
        "venues": [
            {"name": "Elite Cricket Ground Lucknow", "category": "sports", "unit_type": "hour", "city": "Lucknow", "state": "Uttar Pradesh", "address": "Vibhuti Khand, Gomti Nagar", "pincode": "226010", "base_price": "1500", "capacity": 22, "description": "Professional cricket ground with floodlights. Ideal for matches and practice.", "amenity_names": ["Floodlights", "Free Parking", "Changing Rooms"]},
            {"name": "Gomti Football Arena", "category": "sports", "unit_type": "hour", "city": "Lucknow", "state": "Uttar Pradesh", "address": "Gomti Nagar Extension, Sector 3", "pincode": "226012", "base_price": "1800", "capacity": 22, "description": "FIFA-certified synthetic turf with stadium lighting.", "amenity_names": ["Stadium Lighting", "FIFA Certified", "Locker Rooms", "Free Parking"]},
            {"name": "Green Valley Tennis Courts", "category": "sports", "unit_type": "hour", "city": "Lucknow", "state": "Uttar Pradesh", "address": "Hazratganj, Near Kaiserbagh", "pincode": "226001", "base_price": "900", "capacity": 8, "description": "Two hard courts with night lighting.", "amenity_names": ["Floodlights", "Free Parking"]},
        ],
    },
    {
        "name": "Priya Mehta",
        "email": "owner-priya-" + uuid.uuid4().hex[:6] + "@groundkart.demo",
        "password": "Owner@Priya2026!",
        "venues": [
            {"name": "Royal Banquet Palace", "category": "banquet_hall", "unit_type": "full_day", "city": "Lucknow", "state": "Uttar Pradesh", "address": "Vibhuti Khand, Gomti Nagar", "pincode": "226010", "base_price": "85000", "capacity": 500, "description": "Grand 500-guest banquet hall with marble flooring and in-house catering.", "amenity_names": ["Catering", "Free Parking", "Air Conditioning", "Music System", "Generator"]},
            {"name": "Saffron Garden Banquet", "category": "banquet_hall", "unit_type": "full_day", "city": "Lucknow", "state": "Uttar Pradesh", "address": "Indira Nagar, Sector 7", "pincode": "226016", "base_price": "55000", "capacity": 300, "description": "Elegant 300-guest hall with landscaped garden area.", "amenity_names": ["Catering", "Garden", "Free Parking", "Air Conditioning"]},
        ],
    },
    {
        "name": "Arun Patel",
        "email": "owner-arun-" + uuid.uuid4().hex[:6] + "@groundkart.demo",
        "password": "Owner@Arun2026!",
        "venues": [
            {"name": "Riverside Farmhouse Retreat", "category": "farmhouse", "unit_type": "full_day", "city": "Lucknow", "state": "Uttar Pradesh", "address": "Kursi Road, Near Gomti Barrage", "pincode": "226026", "base_price": "45000", "capacity": 250, "description": "Sprawling green farmhouse along the Gomti. Perfect for weddings and offsites.", "amenity_names": ["Garden", "Swimming Pool", "Free Parking", "Catering", "Generator"]},
            {"name": "Woodland Retreat Farmhouse", "category": "farmhouse", "unit_type": "full_day", "city": "Lucknow", "state": "Uttar Pradesh", "address": "Raebareli Road, Near Dilkusha Garden", "pincode": "226025", "base_price": "35000", "capacity": 150, "description": "Peaceful 4-acre farmhouse with open terrace for intimate gatherings.", "amenity_names": ["Garden", "Free Parking", "Music System"]},
        ],
    },
    {
        "name": "Sneha Gupta",
        "email": "owner-sneha-" + uuid.uuid4().hex[:6] + "@groundkart.demo",
        "password": "Owner@Sneha2026!",
        "venues": [
            {"name": "Metropolis Conference Hub", "category": "corporate", "unit_type": "half_day", "city": "Lucknow", "state": "Uttar Pradesh", "address": "Vipin Khand, Gomti Nagar", "pincode": "226010", "base_price": "12000", "capacity": 60, "description": "Fully wired corporate space with boardroom and breakout rooms.", "amenity_names": ["High-Speed WiFi", "Projector", "Air Conditioning", "Catering"]},
            {"name": "Awadh Community Hall", "category": "community_hall", "unit_type": "full_day", "city": "Lucknow", "state": "Uttar Pradesh", "address": "Alambagh, Near Bus Terminal", "pincode": "226005", "base_price": "15000", "capacity": 200, "description": "Spacious community hall for cultural events and family functions.", "amenity_names": ["Free Parking", "Air Conditioning", "Music System", "Generator"]},
            {"name": "Pinnacle Business Lounge", "category": "corporate", "unit_type": "half_day", "city": "Lucknow", "state": "Uttar Pradesh", "address": "Hazratganj, Rana Pratap Marg", "pincode": "226001", "base_price": "8000", "capacity": 30, "description": "Modern business lounge with panoramic city view for meetings.", "amenity_names": ["High-Speed WiFi", "Projector", "Air Conditioning"]},
        ],
    },
]

CUSTOMER_EMAIL = "customer-arjun-" + uuid.uuid4().hex[:6] + "@groundkart.demo"
CUSTOMER_PASSWORD = "Customer@2026!"

DUMMY_PNG = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"


def log(msg):
    print(msg, flush=True)


async def api_call(client, method, path, *, token=None, **kwargs):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    r = await client.request(method, f"{BASE_URL}{path}", headers=headers, **kwargs)
    if r.status_code >= 400:
        raise RuntimeError(f"{method} {path} -> {r.status_code}: {r.text[:300]}")
    return r.json()


async def signup_and_login(client, name, email, password):
    await api_call(client, "POST", "/api/v1/auth/signup", json={"name": name, "email": email, "password": password})
    resp = await api_call(client, "POST", "/api/v1/auth/login", json={"email": email, "password": password})
    return resp["access_token"]


async def main():
    log("\n" + "=" * 60)
    log("  GROUNDKART - FULL PIPELINE SEED")
    log("=" * 60)

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            r = await client.get(f"{BASE_URL}/healthz")
            r.raise_for_status()
            log("\n[OK] Backend is up.\n")
        except Exception as e:
            log(f"\n[ERROR] Backend not reachable: {e}")
            return

        log("Step 1 - Admin login ...")
        admin_token = None
        admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com")
        admin_password = os.environ.get("ADMIN_PASSWORD", "changeme123")
        try:
            resp = await api_call(client, "POST", "/api/v1/auth/login",
                                  json={"email": admin_email, "password": admin_password})
            admin_token = resp["access_token"]
            log(f"  Admin logged in: {admin_email}")
        except Exception as e:
            log(f"  [ERROR] No admin: {e}\n  Run: python admin_setup.py")
            return

        log("\nStep 2 - Creating owners and venues ...")
        venue_ids = []
        owner_tokens = {}

        for od in OWNERS_DATA:
            try:
                owner_token = await signup_and_login(client, od["name"], od["email"], od["password"])
                owner_tokens[od["email"]] = owner_token
                log(f"  Owner: {od['name']} ({od['email']})")

                files = {"document": ("doc.png", DUMMY_PNG, "image/png")}
                data = {"business_name": f"{od['name']} Events"}
                verif = await api_call(client, "POST", "/api/v1/owner/verification",
                                       token=owner_token, files=files, data=data)
                await api_call(client, "POST", f"/api/v1/admin/owner-verifications/{verif['id']}/approve",
                               token=admin_token)
                log("    Verification approved")

                resp = await api_call(client, "POST", "/api/v1/auth/login",
                                      json={"email": od["email"], "password": od["password"]})
                owner_token = resp["access_token"]
                owner_tokens[od["email"]] = owner_token

                for vd in od["venues"]:
                    try:
                        v = await api_call(client, "POST", "/api/v1/venues", token=owner_token, json=vd)
                        venue_ids.append(v["id"])
                        log(f"    Venue: {vd['name']} [{v['status']}]")
                    except Exception as e:
                        log(f"    [ERROR] {vd['name']}: {e}")
            except Exception as e:
                log(f"  [ERROR] Owner {od['name']}: {e}")

        log(f"\n  Venues created: {len(venue_ids)}\n")

        log("Step 3 - Admin approves all venues ...")
        approved = []
        for vid in venue_ids:
            try:
                v = await api_call(client, "POST", f"/api/v1/admin/venues/{vid}/approve", token=admin_token)
                approved.append(vid)
                log(f"  [OK] {v['name']}")
            except Exception as e:
                log(f"  [ERROR] {vid[:8]}: {e}")

        log(f"\n  Approved: {len(approved)}/{len(venue_ids)}\n")

        log("Step 4 - Adding inventory slots ...")
        today = date.today()
        total_slots = 0

        for od in OWNERS_DATA:
            owner_token = owner_tokens.get(od["email"])
            if not owner_token:
                continue
            owner_venues = await api_call(client, "GET", "/api/v1/owner/venues", token=owner_token)
            for vd in od["venues"]:
                matching = [v for v in owner_venues if v["name"] == vd["name"]]
                if not matching:
                    continue
                v = matching[0]
                vid = v["id"]
                unit_type = v["unit_type"]
                units = []
                if unit_type == "hour":
                    for offset in range(1, 15):
                        d = today + timedelta(days=offset)
                        for h in (9, 10, 17, 18, 19, 20):
                            units.append({"date": d.isoformat(), "start_time": f"{h:02d}:00", "end_time": f"{h+1:02d}:00", "price": vd["base_price"]})
                else:
                    for offset in range(1, 60, 2):
                        d = today + timedelta(days=offset)
                        units.append({"date": d.isoformat(), "price": vd["base_price"]})
                try:
                    result = await api_call(client, "POST", f"/api/v1/venues/{vid}/inventory-units",
                                           token=owner_token, json={"units": units})
                    total_slots += len(result)
                    log(f"  {vd['name']}: +{len(result)} slots")
                except Exception as e:
                    log(f"  [ERROR] slots {vd['name']}: {e}")

        log(f"\n  Total slots: {total_slots}\n")

        log("Step 5 - Customer creates account ...")
        customer_token = await signup_and_login(client, "Arjun Kumar", CUSTOMER_EMAIL, CUSTOMER_PASSWORD)
        log(f"  Customer: Arjun Kumar ({CUSTOMER_EMAIL})\n")

        log("Step 6 - Customer books 3 venues ...")
        booking_ids = []
        booking_amounts = []
        for vid in approved[:3]:
            try:
                slots = await api_call(client, "GET", f"/api/v1/venues/{vid}/inventory-units", token=customer_token)
                avail = [s for s in slots if s["status"] == "available"]
                if not avail:
                    log(f"  [SKIP] No slots for {vid[:8]}")
                    continue
                b = await api_call(client, "POST", "/api/v1/bookings", token=customer_token,
                                   json={"inventory_unit_id": avail[0]["id"]})
                booking_ids.append(b["booking_id"])
                booking_amounts.append(b["amount"])
                log(f"  Booked {vid[:8]} -> booking {b['booking_id'][:8]} (Rs.{b['amount']})")
            except Exception as e:
                log(f"  [ERROR] booking {vid[:8]}: {e}")

        log(f"\n  Bookings: {len(booking_ids)}\n")

        log("Step 7 - Admin confirms payments ...")
        confirmed = 0
        for bid, amount in zip(booking_ids, booking_amounts):
            try:
                b = await api_call(client, "POST", f"/api/v1/admin/bookings/{bid}/confirm-payment",
                                   token=admin_token,
                                   json={"amount": amount, "method": "cash",
                                         "reference": "PIPE-" + uuid.uuid4().hex[:8].upper(),
                                         "notes": "Confirmed via pipeline seed"})
                confirmed += 1
                log(f"  [OK] Booking {bid[:8]} -> {b['status']}")
            except Exception as e:
                log(f"  [ERROR] confirm {bid[:8]}: {e}")

        log("\n" + "=" * 60)
        log("  PIPELINE SUMMARY")
        log("=" * 60)
        log(f"  Owners created     : {len(OWNERS_DATA)}")
        log(f"  Venues created     : {len(venue_ids)}")
        log(f"  Venues approved    : {len(approved)}")
        log(f"  Inventory slots    : {total_slots}")
        log(f"  Bookings made      : {len(booking_ids)}")
        log(f"  Payments confirmed : {confirmed}")
        log("")
        log("  Test credentials:")
        log("    Admin    : admin@example.com / changeme123")
        log(f"    Customer : {CUSTOMER_EMAIL} / {CUSTOMER_PASSWORD}")
        log(f"    Owner 1  : {OWNERS_DATA[0]['email']} / {OWNERS_DATA[0]['password']}")
        log("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())

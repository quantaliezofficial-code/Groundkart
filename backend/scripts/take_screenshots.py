import asyncio
import os
import sys
import time

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.db import engine
from sqlalchemy import text
from playwright.sync_api import sync_playwright

def get_venue_slugs():
    import asyncio
    async def _query():
        async with engine.connect() as conn:
            res = await conn.execute(text(
                "SELECT name, slug, id FROM venues WHERE name IN ("
                "'Gomti Greens Multi-Purpose Lawn', "
                "'Awadh Sports Arena - Turf and Box Cricket', "
                "'The Capital Conference Hub')"
            ))
            return {row[0]: (row[1], str(row[2])) for row in res.fetchall()}
    return asyncio.run(_query())

def main():
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    out_dir = os.path.join(repo_root, "seed_screenshots")
    os.makedirs(out_dir, exist_ok=True)
    
    venues_map = get_venue_slugs()
    print("Found venues:", venues_map)
    
    gomti_slug = venues_map.get("Gomti Greens Multi-Purpose Lawn", ("", ""))[0]
    awadh_slug = venues_map.get("Awadh Sports Arena - Turf and Box Cricket", ("", ""))[0]
    capital_slug = venues_map.get("The Capital Conference Hub", ("", ""))[0]

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1400, "height": 900})
        page = context.new_page()

        # 1. Home page
        print("Capturing 01_home_page.png...")
        page.goto("http://localhost:3000/", wait_until="networkidle")
        page.wait_for_timeout(2000)
        page.screenshot(path=os.path.join(out_dir, "01_home_page.png"), full_page=False)

        # 2. Search / browse page
        print("Capturing 02_search_browse.png...")
        page.goto("http://localhost:3000/search", wait_until="networkidle")
        page.wait_for_timeout(2000)
        page.screenshot(path=os.path.join(out_dir, "02_search_browse.png"), full_page=False)

        # 3. Gomti Greens
        if gomti_slug:
            print(f"Capturing 03_venue_gomti_greens.png (/venues/{gomti_slug})...")
            page.goto(f"http://localhost:3000/venues/{gomti_slug}", wait_until="networkidle")
            page.wait_for_timeout(2000)
            page.screenshot(path=os.path.join(out_dir, "03_venue_gomti_greens.png"), full_page=False)

        # 4. Awadh Sports Arena
        if awadh_slug:
            print(f"Capturing 04_venue_awadh_sports.png (/venues/{awadh_slug})...")
            page.goto(f"http://localhost:3000/venues/{awadh_slug}", wait_until="networkidle")
            page.wait_for_timeout(2000)
            page.screenshot(path=os.path.join(out_dir, "04_venue_awadh_sports.png"), full_page=False)

        # 5. The Capital Conference Hub
        if capital_slug:
            print(f"Capturing 05_venue_capital_conference.png (/venues/{capital_slug})...")
            page.goto(f"http://localhost:3000/venues/{capital_slug}", wait_until="networkidle")
            page.wait_for_timeout(2000)
            page.screenshot(path=os.path.join(out_dir, "05_venue_capital_conference.png"), full_page=False)

        # 6. Owner Dashboard (Anita Srivastava)
        print("Logging in as owner anita.srivastava@groundkart.demo...")
        # Authenticate via API to get token, and store in localStorage
        import httpx
        login_r = httpx.post("http://127.0.0.1:8000/api/v1/auth/login", json={
            "login_id": "anita.srivastava@groundkart.demo",
            "password": "Demo@2026!"
        })
        if login_r.status_code == 200:
            token = login_r.json()["access_token"]
            user_r = httpx.get("http://127.0.0.1:8000/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})
            user_data = user_r.json()
            
            # Inject auth token into page localStorage
            page.goto("http://localhost:3000/")
            page.evaluate(f"""() => {{
                localStorage.setItem('groundkart_token', '{token}');
                localStorage.setItem('groundkart_user', JSON.stringify({user_r.text}));
                localStorage.setItem('groundkart_active_role', 'owner');
            }}""")
            
            print("Capturing 06_owner_dashboard.png (/owner)...")
            page.goto("http://localhost:3000/owner", wait_until="networkidle")
            page.wait_for_timeout(2500)
            page.screenshot(path=os.path.join(out_dir, "06_owner_dashboard.png"), full_page=False)

        # 7. Admin Screens (Venue Approvals & Bookings)
        print("Logging in as admin admin@groundkart.demo...")
        admin_login_r = httpx.post("http://127.0.0.1:8000/api/v1/auth/login", json={
            "login_id": "admin@groundkart.demo",
            "password": "Admin@2026!"
        })
        if admin_login_r.status_code == 200:
            admin_token = admin_login_r.json()["access_token"]
            admin_user_r = httpx.get("http://127.0.0.1:8000/api/v1/users/me", headers={"Authorization": f"Bearer {admin_token}"})
            
            page.goto("http://localhost:3000/")
            page.evaluate(f"""() => {{
                localStorage.setItem('groundkart_token', '{admin_token}');
                localStorage.setItem('groundkart_user', JSON.stringify({admin_user_r.text}));
                localStorage.setItem('groundkart_active_role', 'admin');
            }}""")
            
            print("Capturing 07_admin_venues.png (/admin)...")
            page.goto("http://localhost:3000/admin", wait_until="networkidle")
            page.wait_for_timeout(2500)
            page.screenshot(path=os.path.join(out_dir, "07_admin_venues.png"), full_page=False)
            
            # Switch to bookings tab in admin if possible
            try:
                bookings_tab = page.query_selector("button:has-text('Bookings')") or page.query_selector("text=Bookings")
                if bookings_tab:
                    bookings_tab.click()
                    page.wait_for_timeout(1500)
            except Exception as e:
                print("Could not click Bookings tab:", e)

            print("Capturing 08_admin_bookings.png...")
            page.screenshot(path=os.path.join(out_dir, "08_admin_bookings.png"), full_page=False)

        browser.close()
        print(f"Screenshots saved successfully in {out_dir}!")

if __name__ == "__main__":
    main()

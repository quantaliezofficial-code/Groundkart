"""
GroundKart Comprehensive Browser Verification Script using Playwright
Verifies all 5 journeys specified in Phase 22 of the recovery specification.
"""
import asyncio
import random
import sys
from playwright.async_api import async_playwright


async def run_journeys():
    results = {}
    console_errors = []
    failed_requests = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        print("--- JOURNEY 1: Application Startup ---")
        try:
            context1 = await browser.new_context(viewport={"width": 1280, "height": 800})
            page1 = await context1.new_page()
            page1.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
            page1.on("requestfailed", lambda req: failed_requests.append(f"{req.method} {req.url}: {req.failure}"))

            response = await page1.goto("http://localhost:3000/", wait_until="networkidle", timeout=15000)
            status = response.status if response else 0
            assert status == 200, f"Expected HTTP 200, got {status}"

            brand = await page1.wait_for_selector("text=GroundKart", timeout=5000)
            assert brand is not None, "GroundKart brand header not found"
            print(f"  [PASS] App loaded successfully (HTTP {status})")
            results["Journey 1 - App Startup"] = "PASS"
            await context1.close()
        except Exception as e:
            print(f"  [FAIL] Journey 1 failed: {e}")
            results["Journey 1 - App Startup"] = f"FAIL: {e}"

        print("\n--- JOURNEY 2: Public Venue Loading ---")
        try:
            context2 = await browser.new_context(viewport={"width": 1280, "height": 800})
            page2 = await context2.new_page()
            await page2.goto("http://localhost:3000/", wait_until="networkidle", timeout=15000)

            # Check venue price tags are present
            price_tags = await page2.wait_for_selector("text=₹", timeout=8000)
            assert price_tags is not None, "No venue price tags found"

            # Check trending section is visible
            trending = await page2.wait_for_selector("text=Trending in Metropolis", timeout=5000)
            assert trending is not None, "'Trending in Metropolis' section missing"

            # Click on the featured venue banner to view details
            featured_venue = await page2.wait_for_selector("text=View Details", timeout=5000)
            await featured_venue.click()
            await page2.wait_for_timeout(1500)

            # Verify detail view loaded with 'About the Venue'
            detail_about = await page2.wait_for_selector("text=About the Venue", timeout=8000)
            assert detail_about is not None, "Venue detail view did not render"
            print("  [PASS] Venue Detail interaction verified (About the Venue loaded)")

            results["Journey 2 - Venue Loading"] = "PASS"
            await context2.close()
        except Exception as e:
            print(f"  [FAIL] Journey 2 failed: {e}")
            results["Journey 2 - Venue Loading"] = f"FAIL: {e}"

        print("\n--- JOURNEY 3: Authentication (Login & Session) ---")
        try:
            context3 = await browser.new_context(viewport={"width": 1280, "height": 800})
            page3 = await context3.new_page()
            await page3.goto("http://localhost:3000/", wait_until="networkidle", timeout=15000)

            login_btn = await page3.wait_for_selector("button:has-text('Log in')", timeout=5000)
            await login_btn.click()
            await page3.wait_for_selector("#auth-modal-title", timeout=5000)
            print("  [PASS] Auth modal opened")

            # Fill in valid admin credentials
            await page3.fill("#auth-email", "admin@example.com")
            await page3.fill("#auth-password", "changeme123")
            await page3.click("button[type='submit']")
            await page3.wait_for_timeout(2500)

            # Check admin dashboard header rendered
            admin_heading = await page3.wait_for_selector("h1:has-text('Admin Dashboard')", timeout=8000)
            assert admin_heading is not None, "Admin Dashboard heading not found"
            print("  [PASS] Logged in successfully; Admin Dashboard loaded")

            # Test logout
            logout_btn = await page3.query_selector("button[title='Log out']")
            if logout_btn:
                await logout_btn.click()
                await page3.wait_for_timeout(1000)
                print("  [PASS] Admin logout succeeded")

            results["Journey 3 - Login"] = "PASS"
            await context3.close()
        except Exception as e:
            print(f"  [FAIL] Journey 3 failed: {e}")
            results["Journey 3 - Login"] = f"FAIL: {e}"

        print("\n--- JOURNEY 4: Registration (Signup Flow) ---")
        try:
            context4 = await browser.new_context(viewport={"width": 1280, "height": 800})
            page4 = await context4.new_page()
            await page4.goto("http://localhost:3000/", wait_until="networkidle", timeout=15000)

            btn = await page4.wait_for_selector("button:has-text('Log in')", timeout=5000)
            await btn.click()
            await page4.wait_for_selector("#auth-modal-title", timeout=5000)

            switch_btn = await page4.wait_for_selector("button:has-text('Create one free')", timeout=5000)
            await switch_btn.click()
            await page4.wait_for_timeout(500)

            rand_id = random.randint(10000, 99999)
            test_name = f"Browser Test User {rand_id}"
            test_email = f"btest_{rand_id}@example.com"
            test_phone = f"98{random.randint(10000000, 99999999)}"
            test_pass = "TestPass2026!#"

            await page4.fill("#auth-name", test_name)
            await page4.fill("#auth-email", test_email)
            await page4.fill("#auth-phone", test_phone)
            await page4.fill("#auth-password", test_pass)
            await page4.click("button[type='submit']")
            await page4.wait_for_timeout(3000)

            # Check that signup modal closed
            signup_modal = await page4.query_selector("#auth-modal-title")
            assert signup_modal is None or not await signup_modal.is_visible(), "Signup modal still visible"

            # Check user account menu appears in header
            account_btn = await page4.wait_for_selector("button[aria-label='Account menu']", timeout=8000)
            assert account_btn is not None, "Customer account menu not visible in header after signup"
            print(f"  [PASS] Successfully registered and established session for: {test_name}")

            results["Journey 4 - Registration"] = "PASS"
            await context4.close()
        except Exception as e:
            print(f"  [FAIL] Journey 4 failed: {e}")
            results["Journey 4 - Registration"] = f"FAIL: {e}"

        print("\n--- JOURNEY 5: Failure Handling (Graceful Degrade) ---")
        try:
            context5 = await browser.new_context(viewport={"width": 1280, "height": 800})
            page5 = await context5.new_page()

            await page5.route("**/api/v1/venues*", lambda route: route.abort("failed"))
            await page5.goto("http://localhost:3000/", wait_until="load")
            await page5.wait_for_timeout(1500)

            header = await page5.query_selector("header")
            assert header is not None, "Page crashed completely on API failure"
            print("  [PASS] App shell rendered gracefully without white-screen crash")

            results["Journey 5 - Failure Handling"] = "PASS"
            await context5.close()
        except Exception as e:
            print(f"  [FAIL] Journey 5 failed: {e}")
            results["Journey 5 - Failure Handling"] = f"FAIL: {e}"

        await browser.close()

    print("\n===================================================")
    print("FINAL BROWSER VERIFICATION SUMMARY:")
    all_passed = True
    for k, v in results.items():
        print(f"  {k}: {v}")
        if not v.startswith("PASS"):
            all_passed = False
    print("===================================================")
    return all_passed


if __name__ == "__main__":
    success = asyncio.run(run_journeys())
    sys.exit(0 if success else 1)

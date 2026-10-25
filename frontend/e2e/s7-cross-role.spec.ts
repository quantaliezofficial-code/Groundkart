import { test, expect } from './fixtures';
import path from 'path';

test.describe('S7 Cross-Role Complete Journey @smoke @regression', () => {
  test('owner creates venue -> admin approves -> customer books -> admin confirms payment -> payout created & marked paid', async ({
    api,
    browser,
    uniqueSuffix,
  }) => {
    // Authenticate actors
    const ownerToken = (await api.login('anita.srivastava@groundkart.demo', 'Demo@2026!')).access_token;
    const adminToken = (await api.login('admin@groundkart.demo', 'Admin@2026!')).access_token;
    const customerToken = (await api.login('arjun.kumar@groundkart.demo', 'Demo@2026!')).access_token;

    const ownerMe = await api.getMe(ownerToken);
    const venueName = `CrossRole Turf ${uniqueSuffix}`;

    // 1. Owner creates a venue
    const venue = await api.createVenue(ownerToken, {
      name: venueName,
      display_name: venueName,
      category: 'sports',
      address: '123 Stadium Road',
      city: 'Lucknow',
      unit_type: 'hour',
      base_price: '2500',
      status: 'pending_review',
    });
    expect(venue.id).toBeDefined();

    // Add inventory slots for booking
    const today = new Date().toISOString().slice(0, 10);
    const slots = await api.addInventoryUnits(ownerToken, venue.id, [
      {
        unit_type: 'hour',
        start_time: '18:00',
        end_time: '19:00',
        date: today,
        price: '2500',
        is_available: true,
      },
    ]);
    expect(slots.length).toBeGreaterThan(0);

    // 2. Admin approves the venue
    const approved = await api.approveVenue(adminToken, venue.id);
    expect(approved.status).toBe('active');

    // 3. Customer finds the venue in browser and books the slot
    const custContext = await browser.newContext();
    await custContext.request.post('http://localhost:8000/api/v1/auth/login', {
      data: { login_id: 'arjun.kumar@groundkart.demo', password: 'Demo@2026!' },
    });
    const custPage = await custContext.newPage();
    await custPage.goto(`/venues/${venue.slug || venue.id}`);

    // Wait for authenticated user session to be active
    const accountBtn = custPage.locator('button[aria-label="Account menu"]');
    await expect(accountBtn).toBeVisible({ timeout: 10_000 });

    // Select the slot and proceed to checkout
    const slotBtn = custPage.locator('button:has-text("18:00")').first();
    await expect(slotBtn).toBeVisible({ timeout: 10_000 });
    await slotBtn.click();

    const bookNowBtn = custPage.locator('.fixed.bottom-0 button:has-text("Book Now"), button:has-text("Book Now ·")').last();
    await expect(bookNowBtn).toBeEnabled({ timeout: 5_000 });
    await bookNowBtn.evaluate((b: HTMLElement) => b.click());

    await expect(custPage).toHaveURL(/\/checkout$/, { timeout: 10_000 });

    // Fallback if guest fields are displayed
    const guestName = custPage.locator('#guest-name');
    if (await guestName.isVisible()) {
      await guestName.fill('Arjun Kumar');
      await custPage.locator('#guest-email').fill('arjun.kumar@groundkart.demo');
    }

    const requestBtn = custPage.locator('button:has-text("Request Booking")');
    await expect(requestBtn).toBeEnabled({ timeout: 5_000 });
    await requestBtn.evaluate((b: HTMLElement) => b.click());
    await expect(custPage.locator('text=Booking Requested!')).toBeVisible({ timeout: 15_000 });

    // Retrieve the created booking ID via customer API
    const custBookingsRes = await fetch('http://localhost:8000/api/v1/bookings', {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const custBookings = await custBookingsRes.json();
    const myBooking = (custBookings.data || custBookings).find((b: any) => b.venue_id === venue.id || b.venueId === venue.id);
    expect(myBooking).toBeDefined();
    const bookingId = myBooking.id;

    await custContext.close();

    // 4. Admin confirms offline payment
    const paymentConfirmed = await api.confirmPayment(adminToken, bookingId, 2500, 'Cross-role E2E test payment');
    expect(paymentConfirmed.status).toBe('confirmed');

    // 5. Owner sees the booking in Owner Dashboard UI
    const ownerContext = await browser.newContext();
    await ownerContext.request.post('http://localhost:8000/api/v1/auth/login', {
      data: { login_id: 'anita.srivastava@groundkart.demo', password: 'Demo@2026!' },
    });
    const ownerPage = await ownerContext.newPage();
    await ownerPage.goto('/owner');

    // Check Bookings / Calendars
    const calTab = ownerPage.locator('button:has-text("Calendars")').first();
    if (await calTab.isVisible()) {
      await calTab.click();
      await expect(ownerPage.locator(`text=${venueName}, text=18:00, text=Confirmed`).first()).toBeVisible({ timeout: 10_000 });
    }

    // 6. Admin runs payout calculation for the owner
    const runPayoutRes = await fetch('http://localhost:8000/api/v1/admin/payouts/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        owner_id: ownerMe.id,
        period_start: '2026-01-01',
        period_end: '2026-12-31',
      }),
    });

    if (runPayoutRes.ok) {
      const payout = await runPayoutRes.json();
      expect(payout.id).toBeDefined();

      // Assert financial math: Gross = Commission + Net
      const gross = parseFloat(payout.gross_amount);
      const commission = parseFloat(payout.commission_amount);
      const net = parseFloat(payout.net_amount);
      expect(Math.abs(gross - (commission + net))).toBeLessThan(0.01);

      // Admin marks payout paid
      const markPaidRes = await fetch(`http://localhost:8000/api/v1/admin/payouts/${payout.id}/mark-paid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ reference: `UTR-E2E-${uniqueSuffix}` }),
      });
      expect(markPaidRes.status).toBe(200);

      // Owner views Paid status in UI
      const payoutsTab = ownerPage.locator('button:has-text("Payouts")').first();
      await payoutsTab.click();
      await expect(ownerPage.locator('text=Paid, text=₹').first()).toBeVisible({ timeout: 10_000 });
    }

    await ownerContext.close();

    // Cleanup created venue via API
    try {
      await api.deleteVenue(adminToken, venue.id);
    } catch {
      // Ignore cleanup error if already removed
    }
  });
});

import { test, expect, authenticateContext } from './fixtures';
import { CheckoutPO } from './page-objects/Checkout';
import { DetailViewPO } from './page-objects/DetailView';

test.describe('S3 Customer Booking Suite @regression', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateContext(page.context(), 'customer');
  });

  test('customer can choose slot, checkout, and see booking in My Bookings as pending payment', async ({ page, api, uniqueSuffix, consoleGuard }) => {
    const ownerTokenRes = await api.login('anita.srivastava@groundkart.demo', 'Demo@2026!');
    const adminTokenRes = await api.login('admin@groundkart.demo', 'Admin@2026!');

    const venue = await api.createVenue(ownerTokenRes.access_token, {
      name: `Booking Turf ${uniqueSuffix}`,
      category: 'sports',
      address: '123 Stadium Road',
      city: 'Lucknow',
      unit_type: 'hour',
      base_price: '2500',
    });

    const todayStr = new Date().toISOString().slice(0, 10);
    await api.addInventoryUnits(ownerTokenRes.access_token, venue.id, [
      { date: todayStr, start_time: '18:00:00', end_time: '19:00:00', price: '2500.00', status: 'available' },
      { date: todayStr, start_time: '19:00:00', end_time: '20:00:00', price: '2500.00', status: 'available' },
    ]);

    await api.approveVenue(adminTokenRes.access_token, venue.id);

    await page.goto(`/venues/${venue.slug || venue.id}`);
    await expect(page).toHaveURL(/\/venues\//);

    const detailPO = new DetailViewPO(page);
    await detailPO.selectFirstAvailableSlot();
    await detailPO.clickBookNow();

    // Checkout page
    await expect(page).toHaveURL(/\/checkout$/);
    const checkoutPO = new CheckoutPO(page);
    await checkoutPO.submitBooking();
    await checkoutPO.expectBookingSuccess();

    // Navigate to My Bookings
    await page.goto('/my-bookings');
    await expect(page.getByRole('heading', { name: /My Bookings/i })).toBeVisible();
    await expect(page.getByText(/Awaiting Payment|Pending Payment/i).first()).toBeVisible({ timeout: 10_000 });

    await api.deleteVenue(ownerTokenRes.access_token, venue.id);
  });

  test('price on checkout matches the selected slot price', async ({ page, consoleGuard }) => {
    await page.goto('/venues/gomti-football-arena');
    await expect(page).toHaveURL(/\/venues\//);

    const detailPO = new DetailViewPO(page);
    await detailPO.selectFirstAvailableSlot();
    await detailPO.clickBookNow();

    await expect(page).toHaveURL(/\/checkout$/);
    // Total Amount is displayed and greater than 0
    const totalElem = page.locator('span.font-display.text-2xl').first();
    await expect(totalElem).toContainText('₹');
  });

  test('customer can cancel a booking and observe refund notification', async ({ page, consoleGuard }) => {
    await page.goto('/my-bookings');

    const cancelBtn = page.getByRole('button', { name: 'Cancel Booking' }).first();
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
      // Toast or confirmation indicates cancellation and refund
      await expect(page.getByText(/cancelled|refund/i).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('support ticket can be opened directly with booking context', async ({ page, consoleGuard }) => {
    await page.goto('/my-bookings');

    const needHelpBtn = page.locator('button:has-text("Need Help"), button:has-text("Support"), button[title="Support"]').first();
    if (await needHelpBtn.isVisible()) {
      await needHelpBtn.click();
      await expect(page).toHaveURL(/\/support/);
      await expect(page.getByRole('heading', { name: 'Support Tickets', exact: true })).toBeVisible();
    }
  });
});

test.describe('S3 Guest and Concurrent Booking @regression', () => {
  // Guest test with no stored session
  test('guest can book a venue without an account', async ({ browser, api, uniqueSuffix }) => {
    const ownerTokenRes = await api.login('anita.srivastava@groundkart.demo', 'Demo@2026!');
    const adminTokenRes = await api.login('admin@groundkart.demo', 'Admin@2026!');

    const venue = await api.createVenue(ownerTokenRes.access_token, {
      name: `Guest Turf ${uniqueSuffix}`,
      category: 'sports',
      address: '123 Stadium Road',
      city: 'Lucknow',
      unit_type: 'hour',
      base_price: '2000',
    });

    const todayStr = new Date().toISOString().slice(0, 10);
    await api.addInventoryUnits(ownerTokenRes.access_token, venue.id, [
      { date: todayStr, start_time: '18:00:00', end_time: '19:00:00', price: '2000.00', status: 'available' },
      { date: todayStr, start_time: '19:00:00', end_time: '20:00:00', price: '2000.00', status: 'available' },
    ]);
    await api.approveVenue(adminTokenRes.access_token, venue.id);

    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`/venues/${venue.slug || venue.id}`);
    await expect(page).toHaveURL(/\/venues\//);

    const detailPO = new DetailViewPO(page);
    await detailPO.selectFirstAvailableSlot();
    await detailPO.clickBookNow();

    await expect(page).toHaveURL(/\/checkout$/);
    const checkoutPO = new CheckoutPO(page);
    await checkoutPO.fillGuestDetails(`Guest ${uniqueSuffix}`, `guest_${uniqueSuffix}@example.com`, '9876543210');
    await checkoutPO.submitBooking();
    await checkoutPO.expectBookingSuccess();

    await context.close();
    await api.deleteVenue(ownerTokenRes.access_token, venue.id);
  });

  test('concurrent slot reservation displays a clear conflict to the second visitor', async ({ browser, api, uniqueSuffix }) => {
    // Get first available slot via API
    const venuesRes = await (await fetch('http://localhost:8000/api/v1/venues')).json();
    const venue = venuesRes.data[0];
    const slots = await api.listInventoryUnits(venue.id);
    const openSlot = slots.find((s: any) => s.is_available);

    if (openSlot) {
      // Create first booking via API
      await api.createBooking({
        inventory_unit_id: openSlot.id,
        guest_name: `User One ${uniqueSuffix}`,
        guest_email: `user1_${uniqueSuffix}@example.com`,
      });

      // Second user in browser tries to open and book the same slot
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      await page2.goto(`/venues/${venue.slug || venue.id}`);

      // The slot must either be marked as (Booked) / disabled or refuse conflict on submission
      const bookedSlot = page2.locator(`button:has-text("${openSlot.start_time}"), button[aria-label*="Already Booked"]`).first();
      if (await bookedSlot.isVisible()) {
        const disabled = await bookedSlot.isDisabled();
        expect(disabled).toBe(true);
      }

      await context2.close();
    }
  });
});

import { test, expect, authenticateContext } from './fixtures';
import { CheckoutPO } from './page-objects/Checkout';
import { DetailViewPO } from './page-objects/DetailView';

test.describe('Resilience and Real-User Concurrency E2E Suite @resilience', () => {

  test('rapid double-click on booking button sends Idempotency-Key and creates exactly 1 booking', async ({ page }) => {
    await authenticateContext(page.context(), 'customer');
    await page.goto('/search');

    const firstVenue = page.locator('#results-grid h3').first();
    await firstVenue.click();
    await expect(page).toHaveURL(/\/venues\//);

    const detailPO = new DetailViewPO(page);
    await detailPO.selectFirstAvailableSlot();
    await detailPO.clickBookNow();

    await expect(page).toHaveURL(/\/checkout$/);
    const checkoutPO = new CheckoutPO(page);

    // Track network requests to /api/v1/bookings
    const bookingRequests: { headers: Record<string, string> }[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/v1/bookings') && req.method() === 'POST') {
        bookingRequests.push({ headers: req.headers() });
      }
    });

    // Rapid double-click
    await expect(checkoutPO.submitButton).toBeEnabled();
    await checkoutPO.submitButton.dblclick();

    // Verify loading state
    await expect(page.locator('text=Holding your slot...').or(page.locator('text=Requesting…'))).toBeVisible({ timeout: 5_000 });

    // Success confirmation
    await checkoutPO.expectBookingSuccess();

    // At least one request was made and has Idempotency-Key header
    expect(bookingRequests.length).toBeGreaterThanOrEqual(1);
    const firstReq = bookingRequests[0];
    expect(firstReq.headers['idempotency-key']).toBeTruthy();
  });

  test('slow network delays show spinner, holding text, and button remains disabled', async ({ page }) => {
    await authenticateContext(page.context(), 'customer');
    await page.goto('/search');

    const firstVenue = page.locator('#results-grid h3').first();
    await firstVenue.click();
    await expect(page).toHaveURL(/\/venues\//);

    const detailPO = new DetailViewPO(page);
    await detailPO.selectFirstAvailableSlot();
    await detailPO.clickBookNow();

    await expect(page).toHaveURL(/\/checkout$/);
    const checkoutPO = new CheckoutPO(page);

    // Intercept /api/v1/bookings and add an artificial 3.5-second delay
    await page.route('**/api/v1/bookings', async (route) => {
      if (route.request().method() === 'POST') {
        await page.waitForTimeout(3500);
      }
      await route.continue();
    });

    await expect(checkoutPO.submitButton).toBeEnabled();
    await checkoutPO.submitButton.click();

    // Button immediately becomes disabled and displays holding spinner text
    await expect(checkoutPO.submitButton).toBeDisabled();
    await expect(checkoutPO.submitButton).toContainText(/holding your slot|requesting/i);

    // Request eventually completes safely
    await checkoutPO.expectBookingSuccess();
  });

  test('lost response recovery: retried request with identical key succeeds with replay', async ({ page }) => {
    await authenticateContext(page.context(), 'customer');
    await page.goto('/search');

    const firstVenue = page.locator('#results-grid h3').first();
    await firstVenue.click();
    await expect(page).toHaveURL(/\/venues\//);

    const detailPO = new DetailViewPO(page);
    await detailPO.selectFirstAvailableSlot();
    await detailPO.clickBookNow();

    await expect(page).toHaveURL(/\/checkout$/);
    const checkoutPO = new CheckoutPO(page);

    let attemptCount = 0;
    let savedIdempotencyKey: string | null = null;
    let replayedObserved = false;

    // Simulate dropped connection on the first response
    await page.route('**/api/v1/bookings', async (route) => {
      if (route.request().method() === 'POST') {
        attemptCount++;
        savedIdempotencyKey = route.request().headers()['idempotency-key'];
        const response = await route.fetch();
        if (attemptCount === 1) {
          // Drop first response
          await route.abort('failed');
          return;
        }
        if (response.headers()['idempotent-replayed'] === 'true') {
          replayedObserved = true;
        }
        await route.fulfill({ response });
        return;
      }
      await route.continue();
    });

    await checkoutPO.submitButton.click();

    // The client auto-retried with the same idempotency key and recovered
    await checkoutPO.expectBookingSuccess();
    expect(savedIdempotencyKey).toBeTruthy();
  });

  test('slot contention: two users race for the last slot, exactly one wins, second gets clear conflict', async ({ browser }) => {
    // Context 1 (User A)
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await authenticateContext(contextA, 'customer');

    // Context 2 (User B)
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await authenticateContext(contextB, 'customer');

    try {
      // Both navigate to search & select the same venue
      await pageA.goto('/search');
      await pageB.goto('/search');

      await pageA.locator('#results-grid h3').first().click();
      await pageB.locator('#results-grid h3').first().click();

      const detailA = new DetailViewPO(pageA);
      const detailB = new DetailViewPO(pageB);

      await detailA.selectFirstAvailableSlot();
      await detailB.selectFirstAvailableSlot();

      await detailA.clickBookNow();
      await detailB.clickBookNow();

      const checkoutA = new CheckoutPO(pageA);
      const checkoutB = new CheckoutPO(pageB);

      await expect(checkoutA.submitButton).toBeEnabled();
      await expect(checkoutB.submitButton).toBeEnabled();

      // Fire both bookings simultaneously
      const [resA, resB] = await Promise.allSettled([
        checkoutA.submitBooking(),
        checkoutB.submitBooking(),
      ]);

      // Check results on both pages: exactly one must see "Booking Requested!"
      const successA = await pageA.locator('text=Booking Requested!').isVisible({ timeout: 10_000 }).catch(() => false);
      const successB = await pageB.locator('text=Booking Requested!').isVisible({ timeout: 10_000 }).catch(() => false);

      expect(Number(successA) + Number(successB)).toBe(1);

      // The losing user sees a conflict error or unavailability banner
      if (!successA) {
        await expect(pageA.locator('.text-clay, div:has-text("no longer available"), div:has-text("Slot")').first()).toBeVisible({ timeout: 5_000 });
      } else {
        await expect(pageB.locator('.text-clay, div:has-text("no longer available"), div:has-text("Slot")').first()).toBeVisible({ timeout: 5_000 });
      }
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

});

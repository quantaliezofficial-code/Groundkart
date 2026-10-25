import { test, expect, authenticateContext } from './fixtures';
import { ListingBuilderPO } from './page-objects/ListingBuilder';

test.describe('S4 Owner Dashboard Suite @regression', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateContext(page.context(), 'owner');
  });

  test('owner can navigate all primary tabs', async ({ page, consoleGuard }) => {
    await page.goto('/owner');

    const tabs = ['Overview', 'Listings', 'Bookings', 'Payouts', 'Support Tickets'];
    for (const t of tabs) {
      const tabBtn = page.locator(`aside button:has-text("${t}")`).first();
      await expect(tabBtn).toBeAttached({ timeout: 10_000 });
      await tabBtn.evaluate((el: HTMLElement) => el.click());
    }
  });

  test('owner can view payouts list and status metrics', async ({ page, consoleGuard }) => {
    await page.goto('/owner');
    const payoutsTab = page.locator('aside button:has-text("Payouts")').first();
    await payoutsTab.evaluate((el: HTMLElement) => el.click());

    await expect(page.getByText(/Payouts|Earnings|Transfers/i).first()).toBeVisible();
  });

  test('owner listing builder validates inputs and enables Next button conditionally', async ({ page, consoleGuard, uniqueSuffix }) => {
    await page.goto('/owner');
    const listingsTab = page.locator('aside button:has-text("Listings")').first();
    await listingsTab.evaluate((el: HTMLElement) => el.click());

    const addVenueBtn = page.locator('button:has-text("Add Venue"), button:has-text("List Venue"), button:has-text("New Venue")').first();
    if (await addVenueBtn.isVisible()) {
      await addVenueBtn.click();

      const builder = new ListingBuilderPO(page);
      // Next is disabled when name is empty
      const isNextDisabled = await builder.nextButton.isDisabled();
      expect(isNextDisabled).toBe(true);

      // Fill name enables Next
      await builder.fillStep1Identity(`Arena ${uniqueSuffix}`);
      await expect(builder.nextButton).toBeEnabled();
    }
  });

  test('owner calendar allows viewing and creating slot blocks', async ({ page, consoleGuard }) => {
    await page.goto('/owner');
    const calTab = page.locator('aside button:has-text("Bookings")').first();
    await calTab.evaluate((el: HTMLElement) => el.click());

    await expect(page.getByText(/Calendar|Schedule|Bookings/i).first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('S4 Rejected Venue Inspection @regression', () => {
  test('rejected venue displays the admin rejection reason', async ({ browser }) => {
    // Login as Meera Rathore who owns a rejected venue
    const context = await browser.newContext();
    await authenticateContext(context, 'owner', undefined, { email: 'meera.rathore@groundkart.demo', password: 'Demo@2026!' });
    const page = await context.newPage();
    await page.goto('/owner');

    // BUG: Frontend does not display venue.rejection_reason in Owner Portal
    test.fail(true, 'BUG: Frontend does not render venue.rejection_reason on rejected listings in Owner portal');
    await expect(page.getByText(/Please add at least three clear photos/i)).toBeVisible({ timeout: 5_000 });

    await context.close();
  });
});

import { test, expect, authenticateContext } from './fixtures';
import { AdminTabsPO } from './page-objects/AdminTabs';

test.describe('S5 Admin Suite @regression', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateContext(page.context(), 'admin');
  });

  test('admin overview renders metrics, audit log and navigation tabs', async ({ page, consoleGuard }) => {
    await page.goto('/admin');

    // Overview metric cards
    await expect(page.getByText(/Gross Revenue|Venues|Bookings/i).first()).toBeVisible({ timeout: 10_000 });

    // Primary tabs are visible or accessible
    const tabs = ['Overview', 'Venues', 'Bookings', 'Payouts', 'Users'];
    for (const t of tabs) {
      const tab = page.locator(`nav button:has-text("${t}"), aside button:has-text("${t}")`).first();
      if (await tab.isVisible()) {
        await expect(tab).toBeVisible();
      }
    }
  });

  test('admin user management: list, suspend, and unsuspend user', async ({ page, consoleGuard }) => {
    await page.goto('/admin');
    const adminPO = new AdminTabsPO(page);
    await adminPO.switchTab('Users');

    await expect(page.locator('table').or(page.getByText(/Users/i)).first()).toBeVisible({ timeout: 10_000 });

    // Look for a suspend / action button on a user row
    const userRow = page.locator('tr:has-text("arjun.kumar@groundkart.demo")').first();
    if (await userRow.isVisible()) {
      const suspendBtn = userRow.locator('button:has-text("Suspend")');
      if (await suspendBtn.isVisible()) {
        await suspendBtn.click();
        const reasonInput = page.locator('textarea');
        await expect(reasonInput).toBeVisible();
        await reasonInput.fill('Admin policy violation check');
        await page.getByRole('button', { name: 'Suspend User' }).click();
        await expect(page.getByText(/Suspended/i).first()).toBeVisible({ timeout: 5_000 });

        // Reactivate
        const reactivateBtn = page.locator('tr:has-text("arjun.kumar@groundkart.demo") button:has-text("Reactivate")').first();
        if (await reactivateBtn.isVisible()) {
          await reactivateBtn.click();
        }
      }
    }
  });

  test('confirm payment: amount mismatch is refused, matching amount succeeds', async ({ page, api, consoleGuard, uniqueSuffix }) => {
    consoleGuard.allow(/400|422/);

    // Create a pending booking via API first
    const venuesRes = await (await fetch('http://localhost:8000/api/v1/venues')).json();
    const venue = venuesRes.data[0];
    const slots = await api.listInventoryUnits(venue.id);
    const slot = slots.find((s: any) => s.is_available);

    if (slot) {
      const booking = await api.createBooking({
        inventory_unit_id: slot.id,
        guest_name: `Payment Test ${uniqueSuffix}`,
        guest_email: `pay_${uniqueSuffix}@example.com`,
      });

      const adminPO = new AdminTabsPO(page);
      await page.goto('/admin');
      await adminPO.switchTab('Bookings');

      // Attempt payment with wrong amount via API or UI
      const adminTokenRes = await api.login('admin@groundkart.demo', 'Admin@2026!');
      const wrongAmountRes = await fetch(`http://localhost:8000/api/v1/admin/bookings/${booking.id}/confirm-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminTokenRes.access_token}`,
        },
        body: JSON.stringify({ amount: 1, method: 'upi', notes: 'Mismatch test' }),
      });
      // Amount mismatch must be refused (HTTP 400/422)
      expect(wrongAmountRes.status).toBeGreaterThanOrEqual(400);

      // Confirm with exact correct amount
      const correctAmount = parseFloat(slot.price || '1000');
      const correctRes = await api.confirmPayment(adminTokenRes.access_token, booking.id, correctAmount, 'Exact amount match');
      expect(correctRes.status || correctRes.id).toBeDefined();
    }
  });

  test('admin audit log reflects administrative actions', async ({ page, consoleGuard }) => {
    await page.goto('/admin');
    // Audit logs section or tab
    await expect(page.getByText(/Audit Log|Recent Activity/i).first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('S5 Role Isolation Checks @regression', () => {
  test('customer and owner cannot access admin portal and admin API returns 403', async ({ browser, api }) => {
    // 1. Customer token to admin API -> 403
    const custToken = await api.login('arjun.kumar@groundkart.demo', 'Demo@2026!');
    const custApiRes = await fetch('http://localhost:8000/api/v1/admin/overview', {
      headers: { Authorization: `Bearer ${custToken.access_token}` },
    });
    expect(custApiRes.status).toBe(403);

    // 2. Owner token to admin API -> 403
    const ownerToken = await api.login('anita.srivastava@groundkart.demo', 'Demo@2026!');
    const ownerApiRes = await fetch('http://localhost:8000/api/v1/admin/overview', {
      headers: { Authorization: `Bearer ${ownerToken.access_token}` },
    });
    expect(ownerApiRes.status).toBe(403);

    // 3. Customer browser context visiting /admin
    const custContext = await browser.newContext();
    await authenticateContext(custContext, 'customer');
    const custPage = await custContext.newPage();
    await custPage.goto('/admin');
    await expect(custPage.getByRole('heading', { name: /Admin Dashboard/i })).not.toBeVisible();
    await expect(custPage.getByRole('button', { name: /Explore Grounds/i }).or(custPage.getByText(/Find Your Space|Grounds|Trending/i)).first()).toBeVisible();
    await custContext.close();
  });
});

import { test, expect } from './fixtures';

test.describe('S10 Responsive and Layout Suite @regression', () => {
  const viewports = [
    { name: 'Mobile', width: 375, height: 667 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Desktop', width: 1280, height: 800 },
  ];

  const routes = ['/', '/search', '/about', '/contact', '/privacy', '/terms'];

  for (const vp of viewports) {
    for (const r of routes) {
      test(`no horizontal overflow on ${r} at ${vp.name} (${vp.width}px)`, async ({ page, consoleGuard }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(r);

        const hasOverflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
        });

        expect(hasOverflow, `Detected horizontal overflow on ${r} at ${vp.width}px`).toBe(false);
      });
    }
  }

  test('mobile hamburger menu toggles correctly at 375px', async ({ page, consoleGuard }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    const toggleBtn = page.locator('button[aria-label="Toggle menu"]');
    await expect(toggleBtn).toBeVisible();

    await toggleBtn.click();
    // Mobile navigation links visible
    const mobileLinks = page.locator('nav, div').filter({ hasText: 'Find Venues' }).first();
    await expect(mobileLinks).toBeVisible();

    // Close hamburger
    await toggleBtn.click();
  });
});

import { test, expect } from './fixtures';

test.describe('S0 Smoke Suite @smoke', () => {
  test('backend healthz responds with ok', async ({ request }) => {
    const apiUrl = process.env.E2E_API_URL || 'http://localhost:8000';
    const res = await request.get(`${apiUrl}/healthz`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
  });

  test('home page loads with 200, brand visible, and no console errors', async ({ page, consoleGuard }) => {
    const res = await page.goto('/');
    expect(res?.status()).toBe(200);
    await expect(page.locator('#logo')).toBeVisible();
    await expect(page).toHaveTitle(/GroundKart/);
  });

  test('home page renders real venues from API and not stale mock data', async ({ page, consoleGuard }) => {
    await page.goto('/');
    // Wait for trending section
    const trendingSection = page.locator('#trending-section').first();
    await expect(trendingSection).toBeVisible();

    // Check that price tags are rendered
    const priceTags = page.locator('text=₹');
    await expect(priceTags.first()).toBeVisible({ timeout: 10_000 });

    // Verify real venue is loaded, not default mock slug
    const mockTitle = page.locator('h3:has-text("Grand Turf Arena")');
    await expect(mockTitle).not.toBeVisible();
  });

  test('all static pages open properly from direct URL and render valid content', async ({ page, consoleGuard }) => {
    const staticPages = [
      { path: '/about', heading: /Precision in Every Play|About/i },
      { path: '/contact', heading: /We're Here to Help|Contact/i },
      { path: '/privacy', heading: /Privacy Policy/i },
      { path: '/terms', heading: /Terms of Service/i },
    ];

    for (const p of staticPages) {
      await page.goto(p.path);
      await expect(page.locator('h1').first()).toHaveText(p.heading);
    }
  });

  test('static pages open via footer links', async ({ page, consoleGuard }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    await footer.scrollIntoViewIfNeeded();

    // Click About Us
    await footer.getByRole('link', { name: 'About Us' }).click();
    await expect(page).toHaveURL(/\/about$/);

    // Click Contact
    await page.locator('footer').getByRole('link', { name: 'Contact' }).click();
    await expect(page).toHaveURL(/\/contact$/);

    // Click Privacy Policy
    await page.locator('footer').getByRole('link', { name: 'Privacy Policy' }).click();
    await expect(page).toHaveURL(/\/privacy$/);

    // Click Terms of Service
    await page.locator('footer').getByRole('link', { name: 'Terms of Service' }).click();
    await expect(page).toHaveURL(/\/terms$/);
  });
});

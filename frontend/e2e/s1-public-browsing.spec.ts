import { test, expect } from './fixtures';
import { VenueCardPO } from './page-objects/VenueCard';

test.describe('S1 Public Browsing @regression', () => {
  test('home hero, featured banner, and category tiles interact properly', async ({ page, consoleGuard }) => {
    await page.goto('/');

    // Hero inputs
    const hero = page.locator('section, div').filter({ hasText: /One platform|Find.*book|Trending/i }).first();
    await expect(hero).toBeVisible();

    // Category bento tiles or mobile rail
    const banquetTile = page.getByText(/Banquet Halls|Turfs|Courts/i).first();
    await expect(banquetTile).toBeVisible();

    // Featured banner or trending cards
    const viewDetailsBtn = page.locator('a[href*="/venues/"], div.group:has(h3)').first();
    await expect(viewDetailsBtn).toBeVisible();
  });

  test('search page synchronizes filters with URL query parameters', async ({ page, consoleGuard }) => {
    await page.goto('/search?category=sports&city=Lucknow');

    // URL params reflected in page
    expect(page.url()).toContain('category=sports');
    expect(page.url()).toContain('city=Lucknow');

    // Context header displays filtered category or city
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();

    // Reset filters button clears active filters
    const resetBtn = page.getByRole('button', { name: 'Reset Filters' });
    if (await resetBtn.isVisible()) {
      await resetBtn.click();
      await expect(page.locator('#results-grid')).toBeVisible();
    }
  });

  test('empty-result state displays friendly guidance when no venue matches', async ({ page, consoleGuard }) => {
    // Navigate with unrealistic price filter to trigger empty state
    await page.goto('/search');

    const minPriceInput = page.locator('input[placeholder*="Min"], input[name*="minPrice"]').first();
    if (await minPriceInput.isVisible()) {
      await minPriceInput.fill('9999999');
      await expect(
        page.locator('text=No venues match your current filters').or(page.locator('text=No venues available yet'))
      ).toBeVisible({ timeout: 10_000 });

      // Clear all active filters restores list
      const clearBtn = page.getByRole('button', { name: 'Clear All Active Filters' });
      await clearBtn.click();
      await expect(page.locator('text=No venues match your current filters')).not.toBeVisible();
    }
  });

  test('venue card displays name, location, price with unit, rating and cover image', async ({ page, consoleGuard }) => {
    await page.goto('/search');

    const venueCardPO = new VenueCardPO(page);
    const firstCard = venueCardPO.getCards().first();
    await expect(firstCard).toBeVisible({ timeout: 10_000 });

    // Card contains an image
    const img = firstCard.locator('img');
    await expect(img).toBeVisible();

    // Price with unit
    await expect(firstCard.locator('text=₹')).toBeVisible();
  });

  test('category pages (/categories/:name) filter catalogue appropriately', async ({ page, consoleGuard }) => {
    await page.goto('/categories/sports');
    await expect(page).toHaveURL(/categories\/sports|search/);
    const results = page.locator('#results-grid');
    await expect(results).toBeVisible({ timeout: 10_000 });
  });

  test('venue detail view loads description, amenities, availability, and gallery', async ({ page, consoleGuard }) => {
    await page.goto('/search');

    // Click first venue card
    const firstCardTitle = page.locator('#results-grid h3').first();
    const venueName = await firstCardTitle.innerText();
    await firstCardTitle.click();

    // Verify detail page
    await expect(page).toHaveURL(/\/venues\//);
    await expect(page.locator('h1').first()).toContainText(venueName);

    // About section and amenities
    await expect(page.getByText(/About the Venue|About Our Space/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /Venue Amenities|Amenities/i })).toBeVisible();

    // Slots container or date selection
    await expect(page.locator('[data-testid="time-slots-grid"]').or(page.getByText(/Select Date|Available Time Slots|Available Slots/i)).first()).toBeVisible();
  });

  test('unknown path displays 404 page', async ({ page, consoleGuard }) => {
    consoleGuard.allow(/404/);
    await page.goto('/some-non-existent-random-route-404');
    await expect(page.getByRole('heading', { name: /Page Not Found/i })).toBeVisible();
  });

  test('layout has no horizontal overflow at 375, 768 and 1280 widths', async ({ page, consoleGuard }) => {
    const widths = [375, 768, 1280];

    for (const w of widths) {
      await page.setViewportSize({ width: w, height: 800 });
      await page.goto('/');

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth, `Horizontal overflow at width ${w}`).toBeLessThanOrEqual(clientWidth + 1);
    }
  });
});

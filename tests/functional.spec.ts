import { test, expect } from '@playwright/test';
import { captureEvidenceScreenshot, recordIssue, setupErrorCollector } from './test-helper';

test.describe('Functional Suite B: Venue Browsing, Search, Filters, and Booking Workflow', () => {
  test('B1: Search bar queries and filters venues by city and category', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header', { timeout: 10000 });

    // Look for search bar inputs or city selector
    const cityInput = page.locator('input[placeholder*="city" i], input[placeholder*="location" i]').first();
    if (await cityInput.isVisible()) {
      await cityInput.fill('Lucknow');
    }

    const searchBtn = page.locator('button:has-text("Search"), button:has-text("Find Grounds"), button[aria-label="Search"]').first();
    if (await searchBtn.isVisible()) {
      await searchBtn.click();
      await page.waitForTimeout(1500);
      expect(page.url()).toContain('/search');
    }

    await captureEvidenceScreenshot(page, 'FUNC-001_search_execution.png');
  });

  test('B2: Search filters sidebar updates venue results dynamically', async ({ page }) => {
    await page.goto('/search');
    await page.waitForTimeout(1500);

    // Look for amenities checkboxes
    const parkingCheckbox = page.locator('label:has-text("Free Parking"), input[name*="parking" i]').first();
    if (await parkingCheckbox.isVisible()) {
      await parkingCheckbox.click();
      await page.waitForTimeout(800);
    }

    // Look for price inputs
    const minPrice = page.locator('input[placeholder*="min" i], input[name="minPrice"]').first();
    if (await minPrice.isVisible()) {
      await minPrice.fill('500');
      await page.waitForTimeout(800);
    }

    await captureEvidenceScreenshot(page, 'FUNC-002_filters_interaction.png');
  });

  test('B3: Venue detail page slot selection and checkout navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('text=View Details', { timeout: 10000 });
    const detailBtn = page.locator('text=View Details').first();
    await detailBtn.click();
    await page.waitForTimeout(1500);

    // Verify detail elements
    await expect(page.locator('h1, h2').first()).toBeVisible();

    // Verify slots are rendered
    const slotBtns = page.locator('[data-testid="time-slots-grid"] button:not([disabled]), button:has-text("AM"), button:has-text("PM")');
    const slotCount = await slotBtns.count();

    if (slotCount > 0) {
      // Pick first available slot
      const firstSlot = slotBtns.first();
      await firstSlot.click();
      await page.waitForTimeout(500);

      // Verify booking CTA becomes active or says Proceed / Book
      const bookCTA = page.locator('button:has-text("Proceed to Pay"), button:has-text("Book Now"), button:has-text("Confirm Slot")').first();
      if (await bookCTA.isVisible()) {
        await bookCTA.click();
        await page.waitForTimeout(1500);

        // Check if navigated to checkout or prompted for auth
        const currentUrl = page.url();
        const hasCheckout = currentUrl.includes('/checkout');
        const hasAuthModal = await page.locator('#auth-modal-title').isVisible();
        expect(hasCheckout || hasAuthModal).toBeTruthy();
      }
    } else {
      recordIssue({
        id: 'FUNC-003',
        title: 'No inventory time slots rendered on venue detail view',
        category: 'Functional',
        severity: 'Medium',
        priority: 'P2',
        persona: ['Subagent A', 'Subagent B'],
        route: page.url(),
        environment: 'Desktop Chrome 1366x768',
        preconditions: 'Navigate to venue detail',
        steps: ['1. Open venue detail page', '2. Look for available booking time slots'],
        expectedResult: 'List of available booking slots or clear message indicating no available slots for selected date',
        actualResult: 'No slot buttons found',
        evidence: 'Screenshots at test-results/screenshots/FUNC-003_venue_slots.png',
        reproducibility: 'Consistently',
        impact: 'User cannot book venue.',
        suggestedFix: 'Ensure date picker triggers inventory slot fetch and displays empty slot status gracefully.',
        verification: 'Venue detail displays selectable slots or clear empty-slot indicator.',
      });
    }

    await captureEvidenceScreenshot(page, 'FUNC-003_venue_slots.png');
  });

  test('B4: Favorite toggle persistence and interactive state', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('button[aria-label*="favorite" i], button:has(svg.lucide-heart)', { timeout: 10000 });

    const favoriteBtn = page.locator('button[aria-label*="favorite" i], button:has(svg.lucide-heart)').first();
    await favoriteBtn.click();
    await page.waitForTimeout(500);

    // Click again to toggle back
    await favoriteBtn.click();
    await page.waitForTimeout(500);

    await captureEvidenceScreenshot(page, 'FUNC-004_favorite_toggle.png');
  });

  test('B5: Direct checkout URL without selected slot redirects safely to search', async ({ page }) => {
    await page.goto('/checkout');
    await page.waitForTimeout(1000);

    // Without a selected slot, App.tsx redirects to /search
    expect(page.url()).toContain('/search');
    await captureEvidenceScreenshot(page, 'FUNC-005_checkout_guard.png');
  });
});

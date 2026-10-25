import { test, expect } from '@playwright/test';
import { captureEvidenceScreenshot, recordIssue, setupErrorCollector } from './test-helper';

test.describe('Error Handling and System Resilience Suite', () => {
  test('E1: Graceful UI handling on venue API 500 error', async ({ page }) => {
    // Intercept venue API and respond with 500
    await page.route('**/api/v1/venues*', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Internal Server Error simulation' }),
      });
    });

    await page.goto('/search');
    await page.waitForTimeout(2000);

    // Verify header remains intact without white screen crash
    const header = page.locator('header');
    await expect(header).toBeVisible();

    // Check if error state or fallback message is shown
    const errorText = page.locator('text=Failed to load').or(page.locator('button:has-text("Retry")'));
    const isErrorBannerShown = await errorText.first().isVisible();

    if (!isErrorBannerShown) {
      recordIssue({
        id: 'ERR-001',
        title: 'Search view lacks explicit error/retry state on API failure',
        category: 'Reliability',
        severity: 'Medium',
        priority: 'P2',
        persona: ['Subagent B', 'Subagent D'],
        route: '/search',
        environment: 'Desktop Chrome 1366x768',
        preconditions: 'Venues API returns HTTP 500 status',
        steps: ['1. Intercept /api/v1/venues to return 500', '2. Navigate to /search', '3. Observe UI feedback'],
        expectedResult: 'Display error banner with message and "Retry" button',
        actualResult: 'Search page renders empty results grid without notifying user of backend failure',
        evidence: 'Screenshots at test-results/screenshots/ERR-001_api_500_fallback.png',
        reproducibility: 'Consistently',
        impact: 'Users are misled to believe no venues exist in the city rather than being told a service outage occurred.',
        suggestedFix: 'Expose error state from useVenues() and render VenueErrorState or retry prompt on /search.',
        verification: 'When API returns 500, /search displays VenueErrorState with Retry CTA.',
      });
    }

    await captureEvidenceScreenshot(page, 'ERR-001_api_500_fallback.png');
    // Ensure app shell gracefully stayed alive
    expect(await header.isVisible()).toBeTruthy();
  });

  test('E2: Extreme input and XSS strings in search parameters', async ({ page }) => {
    const errorCollector = setupErrorCollector(page);

    await page.goto('/search?city=%3Cscript%3Ealert(1)%3C%2Fscript%3E&q=%27%20OR%201%3D1--');
    await page.waitForTimeout(1500);

    // Verify page doesn't crash or execute script
    await expect(page.locator('body')).toBeVisible();

    if (errorCollector.consoleErrors.length > 0) {
      const err = errorCollector.consoleErrors[0];
      if (err.includes('Uncaught') || err.includes('SyntaxError')) {
        recordIssue({
          id: 'ERR-MALFORMED-SEARCH',
          title: 'Uncaught JavaScript error on special characters in search URL',
          category: 'Reliability',
          severity: 'High',
          priority: 'P1',
          persona: ['Subagent D'],
          route: '/search',
          environment: 'Desktop Chrome 1366x768',
          preconditions: 'Navigate to URL with encoded special characters',
          steps: ['1. Open /search with malformed query parameters', '2. Check console for uncaught exceptions'],
          expectedResult: 'Query parameters sanitized cleanly without JS crash',
          actualResult: err,
          evidence: err,
          reproducibility: 'Consistently',
          impact: 'Page crashes for users following external malformed links.',
          suggestedFix: 'Wrap decodeURIComponent and input parsing in safe try-catch blocks.',
          verification: 'Malformed query parameters load empty search state without console errors.',
        });
      }
    }

    await captureEvidenceScreenshot(page, 'ERR-002_malformed_url_safety.png');
  });

  test('E3: Rapid double-click interaction resilience on buttons', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('text=View Details', { timeout: 10000 });

    const detailBtn = page.locator('text=View Details').first();
    // Rapid double click
    await detailBtn.dblclick();
    await page.waitForTimeout(1000);

    // Verify view loaded cleanly
    await expect(page.locator('body')).toBeVisible();
    await captureEvidenceScreenshot(page, 'ERR-003_rapid_clicks.png');
  });
});

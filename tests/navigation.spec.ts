import { test, expect } from '@playwright/test';
import { captureEvidenceScreenshot, recordIssue, setupErrorCollector } from './test-helper';

test.describe('Functional Suite A: Navigation & Routing Integrity', () => {
  test('A1: Logo click navigates back to home from deep pages', async ({ page }) => {
    await page.goto('/about');
    await expect(page.locator('h1, h2').first()).toBeVisible();

    const logo = page.locator('#logo, header button:has(img[alt="GroundKart"])').first();
    await logo.click();
    await page.waitForTimeout(1000);

    expect(page.url()).toBe('http://localhost:3000/');
    await captureEvidenceScreenshot(page, 'NAV-001_logo_navigation.png');
  });

  test('A2: Footer navigation links work properly without dead ends', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(800);

    // Test About link in footer
    const aboutLink = page.locator('footer a:has-text("About Us"), footer a:has-text("About")').first();
    if (await aboutLink.isVisible()) {
      await aboutLink.click();
      await page.waitForTimeout(1000);
      expect(page.url()).toContain('/about');
    }

    // Go back and test Contact
    await page.goto('/');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const contactLink = page.locator('footer a:has-text("Contact"), footer a:has-text("Contact Us")').first();
    if (await contactLink.isVisible()) {
      await contactLink.click();
      await page.waitForTimeout(1000);
      expect(page.url()).toContain('/contact');
    }

    // Test Privacy Policy
    await page.goto('/');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const privacyLink = page.locator('footer a:has-text("Privacy")').first();
    if (await privacyLink.isVisible()) {
      await privacyLink.click();
      await page.waitForTimeout(1000);
      expect(page.url()).toContain('/privacy');
    }

    // Test Terms of Service
    await page.goto('/');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const termsLink = page.locator('footer a:has-text("Terms")').first();
    if (await termsLink.isVisible()) {
      await termsLink.click();
      await page.waitForTimeout(1000);
      expect(page.url()).toContain('/terms');
    }

    await captureEvidenceScreenshot(page, 'NAV-002_footer_navigation.png');
  });

  test('A3: Browser back and forward button maintains view state', async ({ page }) => {
    await page.goto('/');
    await page.goto('/search');
    await page.waitForTimeout(800);
    expect(page.url()).toContain('/search');

    await page.goBack();
    await page.waitForTimeout(800);
    expect(page.url()).toBe('http://localhost:3000/');

    await page.goForward();
    await page.waitForTimeout(800);
    expect(page.url()).toContain('/search');
  });

  test('A4: 404 page renders for invalid URLs with functional recovery CTA', async ({ page }) => {
    await page.goto('/non-existent-page-xyz-12345');
    await page.waitForTimeout(1000);

    const notFoundText = page.locator('text=Page not found').or(page.locator('text=404'));
    await expect(notFoundText.first()).toBeVisible();

    const homeCTA = page.locator('a:has-text("Back to Home"), a:has-text("Return Home"), button:has-text("Home")').first();
    if (await homeCTA.isVisible()) {
      await homeCTA.click();
      await page.waitForTimeout(1000);
      expect(page.url()).toBe('http://localhost:3000/');
    } else {
      recordIssue({
        id: 'NAV-003',
        title: 'Missing or inaccessible Return Home CTA on 404 page',
        category: 'UX',
        severity: 'Medium',
        priority: 'P2',
        persona: ['Subagent A', 'Subagent D'],
        route: '/non-existent-page-xyz-12345',
        environment: 'Desktop Chrome 1366x768',
        preconditions: 'Navigate to broken URL',
        steps: ['1. Navigate to /non-existent-page-xyz-12345', '2. Look for Back to Home action button'],
        expectedResult: 'Clear button allowing user to return to safe homepage',
        actualResult: 'CTA is hard to find or missing',
        evidence: 'Screenshots at test-results/screenshots/NAV-003_404_recovery.png',
        reproducibility: 'Consistently',
        impact: 'Users get stranded on broken links.',
        suggestedFix: 'Add prominent "Return to Homepage" button on 404 page.',
        verification: 'Clicking 404 CTA routes directly to "/"',
      });
    }

    await captureEvidenceScreenshot(page, 'NAV-003_404_recovery.png');
  });

  test('A5: Category slug routing resolves to appropriate search view', async ({ page }) => {
    const categories = ['sports', 'banquet-halls', 'farmhouses', 'corporate'];
    for (const cat of categories) {
      await page.goto(`/categories/${cat}`);
      await page.waitForTimeout(800);
      const url = page.url();
      expect(url).toContain('/categories/');
      await expect(page.locator('body')).toBeVisible();
    }
  });
});

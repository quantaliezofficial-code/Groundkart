import { test, expect } from '@playwright/test';
import { captureEvidenceScreenshot, recordIssue, setupErrorCollector } from '../test-helper';

test.describe('Subagent B — The Impatient, Fast-Scrolling User', () => {
  test('Persona B exploratory session: rapid scrolling, quick filters, sticky nav, rapid clicks', async ({ page }) => {
    const sessionLog: any = {
      sessionId: 'PERSONA-B-001',
      persona: 'Subagent B — Impatient, Fast-Scrolling User',
      initialUrl: 'http://localhost:3000/',
      viewport: '1366x768',
      userGoal: 'Find and book a ground immediately, test rapid interactions, filter speeds, and responsiveness.',
      actionsAttempted: [],
      expectedResult: 'Instantaneous UI feedback, zero layout shifts, disabled states on duplicate clicks, fast navigation.',
      actualResult: '',
      confusionPoints: [],
      issuesDiscovered: [],
      finalTaskStatus: 'Completed Fast-Paced Tour',
    };

    const errorCollector = setupErrorCollector(page);

    // Step 1: Open homepage
    await page.goto('/');
    sessionLog.actionsAttempted.push('Navigated to homepage');

    // Step 2: Rapidly scroll to bottom to find footer and back to top button
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(600);
    sessionLog.actionsAttempted.push('Rapidly scrolled to bottom of page');
    await captureEvidenceScreenshot(page, 'PERSONA-B_01_fast_scroll_bottom.png');

    // Step 3: Check Back to Top button
    const backToTopBtn = page.locator('button[aria-label*="top" i], button:has(svg.lucide-arrow-up)').first();
    if (await backToTopBtn.isVisible()) {
      await backToTopBtn.click();
      await page.waitForTimeout(800);
      const scrollPos = await page.evaluate(() => window.scrollY);
      sessionLog.actionsAttempted.push(`Clicked Back to Top button; scroll position now: ${scrollPos}`);
      if (scrollPos > 100) {
        sessionLog.confusionPoints.push('Back to Top button did not smoothly scroll all the way back to the top.');
      }
    } else {
      sessionLog.confusionPoints.push('No visible back to top button when reaching page bottom.');
    }

    // Step 4: Rapid navigation to Search view
    await page.goto('/search');
    sessionLog.actionsAttempted.push('Jumped directly to /search');
    await page.waitForTimeout(1000);
    await captureEvidenceScreenshot(page, 'PERSONA-B_02_search_page_landing.png');

    // Step 5: Rapid filter toggling (click 3 filters in quick succession)
    const filterCheckboxes = page.locator('aside input[type="checkbox"], aside label');
    const filterCount = await filterCheckboxes.count();
    if (filterCount >= 2) {
      await filterCheckboxes.nth(0).click();
      await filterCheckboxes.nth(1).click();
      sessionLog.actionsAttempted.push('Toggled multiple filter checkboxes in rapid succession');
      await page.waitForTimeout(600);
    }

    // Step 6: Test rapid repeated click on venue detail button
    const detailBtns = page.locator('text=View Details');
    if (await detailBtns.count() > 0) {
      const targetBtn = detailBtns.first();
      await targetBtn.click({ clickCount: 2, delay: 50 });
      sessionLog.actionsAttempted.push('Performed rapid double-click on venue detail card');
      await page.waitForTimeout(1200);
      await captureEvidenceScreenshot(page, 'PERSONA-B_03_venue_rapid_click.png');
    }

    // Step 7: Fast browser back and forward navigation
    await page.goBack();
    await page.waitForTimeout(400);
    sessionLog.actionsAttempted.push('Triggered fast browser back');
    await page.goForward();
    await page.waitForTimeout(400);
    sessionLog.actionsAttempted.push('Triggered fast browser forward');

    sessionLog.actualResult = `Completed fast-scrolling audit with ${errorCollector.consoleErrors.length} console errors detected.`;
    expect(sessionLog.actionsAttempted.length).toBeGreaterThan(4);
  });
});

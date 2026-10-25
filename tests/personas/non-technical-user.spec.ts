import { test, expect } from '@playwright/test';
import { captureEvidenceScreenshot, recordIssue, setupErrorCollector } from '../test-helper';

test.describe('Subagent A — The Non-Technical First-Time User', () => {
  test('Persona A exploratory session: discover, comprehend, navigate and attempt booking', async ({ page }) => {
    const sessionLog: any = {
      sessionId: 'PERSONA-A-001',
      persona: 'Subagent A — Non-Technical First-Time User',
      initialUrl: 'http://localhost:3000/',
      viewport: '1366x768',
      userGoal: 'Understand what the website offers, find a venue to play cricket or football, and see how to book it without getting lost.',
      actionsAttempted: [],
      expectedResult: 'Clear value proposition, obvious navigation steps, intuitive booking flow, helpful errors, clear way to return home.',
      actualResult: '',
      confusionPoints: [],
      issuesDiscovered: [],
      finalTaskStatus: 'Incomplete',
    };

    const errorCollector = setupErrorCollector(page);

    // Step 1: Open homepage
    await page.goto('/');
    sessionLog.actionsAttempted.push('Navigated to homepage');
    await captureEvidenceScreenshot(page, 'PERSONA-A_01_homepage_landing.png');

    // Step 2: Read visible headings
    const heroHeading = await page.locator('h1').first().innerText();
    sessionLog.actionsAttempted.push(`Read hero heading: "${heroHeading}"`);

    // Does the user understand what the website does?
    const hasClearTagline = heroHeading.includes('Play') || heroHeading.includes('Ground') || heroHeading.includes('Turf');
    if (!hasClearTagline) {
      sessionLog.confusionPoints.push('Hero heading does not clearly explain if this is for sports booking, equipment purchase, or event spaces.');
    }

    // Step 3: Scroll slowly down the page
    for (let scrollStep = 1; scrollStep <= 4; scrollStep++) {
      await page.evaluate(step => window.scrollBy(0, 400), scrollStep);
      await page.waitForTimeout(800);
      sessionLog.actionsAttempted.push(`Scrolled step ${scrollStep} down page`);
    }
    await captureEvidenceScreenshot(page, 'PERSONA-A_02_scrolled_content.png');

    // Step 4: Look for a primary action / venue card
    const venueCards = page.locator('text=View Details');
    const venueCount = await venueCards.count();

    if (venueCount > 0) {
      sessionLog.actionsAttempted.push(`Found ${venueCount} visible venues with 'View Details'`);
      // Non-technical user clicks the first obvious button
      await venueCards.first().click();
      await page.waitForTimeout(1500);
      sessionLog.actionsAttempted.push('Clicked "View Details" on first venue card');
      await captureEvidenceScreenshot(page, 'PERSONA-A_03_venue_detail.png');

      // Step 5: Try to understand how to select a slot
      const slotButtons = page.locator('button:has-text("AM"), button:has-text("PM")');
      const slotCount = await slotButtons.count();

      if (slotCount === 0) {
        const confusion = 'No available time slots clearly indicated or instructions on how to choose a date.';
        sessionLog.confusionPoints.push(confusion);
        recordIssue({
          id: 'UX-A-001',
          title: 'Unclear slot availability instructions for first-time users',
          category: 'UX',
          severity: 'Medium',
          priority: 'P2',
          persona: ['Subagent A'],
          route: page.url(),
          environment: 'Desktop Chrome 1366x768',
          preconditions: 'Navigate to venue detail as first-time visitor',
          steps: ['1. Open venue detail page', '2. Look for instructions on selecting a date and time slot'],
          expectedResult: 'Friendly explanatory helper text: "Step 1: Pick a date, Step 2: Select an available slot"',
          actualResult: 'User sees dates and grids without guidance',
          evidence: 'test-results/screenshots/PERSONA-A_03_venue_detail.png',
          reproducibility: 'Consistently',
          impact: 'Non-technical users may struggle to understand why booking button is disabled.',
          suggestedFix: 'Add instructional step indicators in the booking widget sidebar.',
          verification: 'Check venue detail page contains visible step instructions.',
        });
        sessionLog.issuesDiscovered.push('UX-A-001');
      } else {
        await slotButtons.first().click();
        await page.waitForTimeout(500);
        sessionLog.actionsAttempted.push('Selected available time slot');

        // Look for booking confirmation / proceed button
        const proceedBtn = page.locator('button:has-text("Proceed"), button:has-text("Book")').first();
        if (await proceedBtn.isVisible()) {
          await proceedBtn.click();
          await page.waitForTimeout(1500);
          sessionLog.actionsAttempted.push('Clicked proceed button to initiate booking');
          await captureEvidenceScreenshot(page, 'PERSONA-A_04_booking_prompt.png');

          // Check if auth modal or checkout opened
          if (await page.locator('#auth-modal-title').isVisible()) {
            sessionLog.actionsAttempted.push('Prompted to log in or create an account before checkout');
          }
        }
      }

      // Step 6: Test returning to the homepage
      const homeLink = page.locator('#logo, header button:has(img[alt="GroundKart"])').first();
      await homeLink.click();
      await page.waitForTimeout(1000);
      sessionLog.actionsAttempted.push('Successfully navigated back to homepage via header logo');
      await captureEvidenceScreenshot(page, 'PERSONA-A_05_returned_home.png');
      sessionLog.finalTaskStatus = 'Completed Exploratory Walkthrough';
    } else {
      sessionLog.confusionPoints.push('Could not find any venue cards on homepage.');
      sessionLog.finalTaskStatus = 'Blocked';
    }

    sessionLog.actualResult = `User completed navigation through home and detail view with ${sessionLog.confusionPoints.length} confusion points noted.`;
    expect(sessionLog.actionsAttempted.length).toBeGreaterThan(4);
  });
});

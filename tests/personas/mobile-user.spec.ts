import { test, expect } from '@playwright/test';
import { captureEvidenceScreenshot, recordIssue, setupErrorCollector } from '../test-helper';

test.describe('Subagent C — The Mobile-First, Less-Experienced User', () => {
  test('Persona C mobile session: 390x844 mobile navigation, drawer, tap targets, and horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const sessionLog: any = {
      sessionId: 'PERSONA-C-001',
      persona: 'Subagent C — Mobile-First User',
      initialUrl: 'http://localhost:3000/',
      viewport: '390x844 (Typical Smartphone)',
      userGoal: 'Browse grounds and venues comfortably from mobile phone without confusing desktop-only UI or tiny tap targets.',
      actionsAttempted: [],
      expectedResult: 'Clean responsive layout, working mobile hamburger drawer, appropriately sized buttons, no horizontal scrolling.',
      actualResult: '',
      confusionPoints: [],
      issuesDiscovered: [],
      finalTaskStatus: 'Completed Mobile Exploration',
    };

    // Step 1: Open homepage on mobile viewport
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    sessionLog.actionsAttempted.push('Opened homepage on 390x844 viewport');
    await captureEvidenceScreenshot(page, 'PERSONA-C_01_mobile_homepage.png');

    // Step 2: Check for horizontal overflow
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    if (hasHorizontalOverflow) {
      const issue = 'Horizontal overflow detected on mobile: content spills past screen width.';
      sessionLog.confusionPoints.push(issue);
      recordIssue({
        id: 'RESP-MOB-001',
        title: 'Mobile horizontal scrolling artifact on homepage',
        category: 'Visual',
        severity: 'High',
        priority: 'P1',
        persona: ['Subagent C'],
        route: '/',
        environment: 'Mobile Chrome (390x844)',
        preconditions: 'Open homepage on mobile device',
        steps: ['1. Load http://localhost:3000/ on 390px width viewport', '2. Swipe left/right or inspect scrollWidth'],
        expectedResult: 'Page width bounded strictly to 100vw without horizontal panning',
        actualResult: 'document.documentElement.scrollWidth exceeds window.innerWidth',
        evidence: 'test-results/screenshots/PERSONA-C_01_mobile_homepage.png',
        reproducibility: 'Consistently',
        impact: 'User accidentally pans sideways while trying to scroll vertically.',
        suggestedFix: 'Add overflow-x: hidden to root container and check fixed width sub-elements.',
        verification: 'Assert scrollWidth equals clientWidth on 390x844 viewport.',
      });
      sessionLog.issuesDiscovered.push('RESP-MOB-001');
    }

    // Step 3: Open Mobile Drawer Navigation
    const hamburgerBtn = page.locator('button[aria-label="Toggle menu"], button:has(svg.lucide-menu), button[aria-label*="menu" i]').first();
    await hamburgerBtn.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
    if (await hamburgerBtn.isVisible()) {
      await hamburgerBtn.click();
      await page.waitForTimeout(600);
      sessionLog.actionsAttempted.push('Opened mobile hamburger drawer navigation');
      await captureEvidenceScreenshot(page, 'PERSONA-C_02_mobile_drawer.png');

      // Check drawer links
      const drawerLinks = page.locator('nav a, div[role="dialog"] a');
      const drawerCount = await drawerLinks.count();
      sessionLog.actionsAttempted.push(`Found ${drawerCount} links in mobile drawer navigation`);

      // Close mobile drawer
      const closeDrawerBtn = page.locator('button:has(svg.lucide-x), button[aria-label*="close" i]').first();
      if (await closeDrawerBtn.isVisible()) {
        await closeDrawerBtn.click();
        await page.waitForTimeout(500);
        sessionLog.actionsAttempted.push('Closed mobile drawer navigation cleanly');
      }
    } else {
      sessionLog.confusionPoints.push('Hamburger menu button was not found or visible on mobile viewport.');
    }

    // Step 4: Scroll through mobile content
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(600);
    sessionLog.actionsAttempted.push('Scrolled down mobile feed');
    await captureEvidenceScreenshot(page, 'PERSONA-C_03_mobile_feed_scroll.png');

    // Step 5: Check tap targets for buttons on mobile
    const buttons = page.locator('button');
    const btnCount = await buttons.count();
    let smallButtonsCount = 0;

    for (let i = 0; i < Math.min(btnCount, 10); i++) {
      const box = await buttons.nth(i).boundingBox();
      if (box && (box.width < 32 || box.height < 32)) {
        smallButtonsCount++;
      }
    }

    if (smallButtonsCount > 0) {
      recordIssue({
        id: 'A11Y-MOB-TAP-001',
        title: 'Small touch targets detected on mobile (<32px)',
        category: 'Accessibility',
        severity: 'Medium',
        priority: 'P2',
        persona: ['Subagent C'],
        route: '/',
        environment: 'Mobile Chrome (390x844)',
        preconditions: 'View interactive buttons on mobile viewport',
        steps: ['1. Measure button bounding boxes on 390x844 viewport', '2. Verify minimum 44x44px touch target guidelines'],
        expectedResult: 'All interactive elements meet standard touch target size',
        actualResult: `${smallButtonsCount} buttons have dimensions smaller than 32px`,
        evidence: `Small tap targets detected in mobile audit`,
        reproducibility: 'Consistently',
        impact: 'Users on mobile touch screens may misclick or struggle to tap controls accurately.',
        suggestedFix: 'Increase padding or min-h-[44px] min-w-[44px] on mobile action buttons.',
        verification: 'All mobile buttons have bounding box >= 40x40px.',
      });
      sessionLog.issuesDiscovered.push('A11Y-MOB-TAP-001');
    }

    sessionLog.actualResult = `Mobile user session completed with ${sessionLog.issuesDiscovered.length} issues discovered.`;
    expect(sessionLog.actionsAttempted.length).toBeGreaterThan(3);
  });

  test('Persona C compact mobile session: 320x568 small screen check', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    await captureEvidenceScreenshot(page, 'PERSONA-C_04_320x568_compact_screen.png');
    await expect(page.locator('header')).toBeVisible();
  });
});

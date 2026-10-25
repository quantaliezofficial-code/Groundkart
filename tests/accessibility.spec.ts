import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { captureEvidenceScreenshot, recordIssue } from './test-helper';

test.describe('Accessibility Suite (WCAG 2.1 AA & Keyboard Usability)', () => {
  const auditPages = ['/', '/search', '/about', '/contact', '/privacy', '/terms'];

  for (const pagePath of auditPages) {
    test(`Axe automated accessibility check on ${pagePath}`, async ({ page }) => {
      await page.goto(pagePath, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const violations = accessibilityScanResults.violations;

      if (violations.length > 0) {
        for (const v of violations) {
          recordIssue({
            id: `A11Y-${v.id}-${pagePath.replace(/[^a-zA-Z0-9]/g, '_')}`,
            title: `A11Y violation: ${v.help} on ${pagePath}`,
            category: 'Accessibility',
            severity: v.impact === 'critical' ? 'Critical' : v.impact === 'serious' ? 'High' : 'Medium',
            priority: v.impact === 'critical' ? 'P0' : v.impact === 'serious' ? 'P1' : 'P2',
            persona: ['Subagent A', 'Subagent D'],
            route: pagePath,
            environment: 'Desktop Chrome 1366x768',
            preconditions: `Navigate to ${pagePath}`,
            steps: [`1. Open ${pagePath}`, `2. Run axe-core accessibility analysis for rule: ${v.id}`],
            expectedResult: `Complies with WCAG rule ${v.id}`,
            actualResult: `${v.nodes.length} element(s) violated rule ${v.id}: ${v.description}`,
            evidence: JSON.stringify(v.nodes.slice(0, 3).map(n => n.target), null, 2),
            reproducibility: 'Consistently',
            impact: `${v.help}. Affects screen reader users and keyboard navigation.`,
            suggestedFix: `${v.helpUrl} - Fix flagged elements.`,
            verification: `Rerun axe analysis on ${pagePath} and ensure zero violations for ${v.id}.`,
          });
        }
      }

      await captureEvidenceScreenshot(page, `A11Y_${pagePath.replace(/[^a-zA-Z0-9]/g, '_') || 'home'}.png`);
      // Note: we record violations in the report without failing test hard so full suite finishes
    });
  }

  test('Keyboard-only Tab navigation across Header and Primary Controls', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header');

    // Press Tab multiple times and verify activeElement changes
    const focusedElements: string[] = [];
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      const tag = await page.evaluate(() => document.activeElement?.tagName);
      const text = await page.evaluate(() => document.activeElement?.textContent?.slice(0, 30));
      if (tag) focusedElements.push(`${tag}:${text?.trim()}`);
    }

    expect(focusedElements.length).toBeGreaterThan(0);
    await captureEvidenceScreenshot(page, 'A11Y_keyboard_tab_focus.png');
  });

  test('Check that all content images have non-empty alt text', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    const imagesWithoutAlt = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return imgs
        .filter(img => !img.hasAttribute('alt') || img.getAttribute('alt')?.trim() === '')
        .map(img => img.src);
    });

    if (imagesWithoutAlt.length > 0) {
      recordIssue({
        id: 'A11Y-IMG-NO-ALT',
        title: 'Missing or empty alt text on images',
        category: 'Accessibility',
        severity: 'Medium',
        priority: 'P2',
        persona: ['Subagent A'],
        route: '/',
        environment: 'Desktop Chrome 1366x768',
        preconditions: 'Inspect homepage images',
        steps: ['1. Load homepage', '2. Inspect img elements for alt attributes'],
        expectedResult: 'All images have descriptive alt text or aria-hidden="true" if decorative',
        actualResult: `Found ${imagesWithoutAlt.length} image(s) lacking descriptive alt text`,
        evidence: imagesWithoutAlt.slice(0, 5).join('\n'),
        reproducibility: 'Consistently',
        impact: 'Screen reader users cannot understand image content.',
        suggestedFix: 'Provide meaningful alt descriptions for all venue and hero imagery.',
        verification: 'Verify all <img> tags include non-empty alt attributes.',
      });
    }

    await captureEvidenceScreenshot(page, 'A11Y_image_alt_audit.png');
  });
});

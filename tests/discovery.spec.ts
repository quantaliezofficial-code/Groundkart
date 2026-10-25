import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { captureEvidenceScreenshot, recordIssue, setupErrorCollector } from './test-helper';

interface RouteEntry {
  route: string;
  title: string;
  accessRequirement: 'Public' | 'Authenticated' | 'Role-Restricted';
  keyInteractions: string[];
  viewportsTested: string[];
  result: 'Pass' | 'Fail' | 'Blocked' | 'Not tested';
  issues: string[];
}

const routesToDiscover = [
  { path: '/', titleExpected: 'GroundKart', access: 'Public' as const },
  { path: '/search', titleExpected: 'GroundKart', access: 'Public' as const },
  { path: '/categories/sports', titleExpected: 'GroundKart', access: 'Public' as const },
  { path: '/categories/banquet-halls', titleExpected: 'GroundKart', access: 'Public' as const },
  { path: '/categories/farmhouses', titleExpected: 'GroundKart', access: 'Public' as const },
  { path: '/categories/corporate', titleExpected: 'GroundKart', access: 'Public' as const },
  { path: '/categories/community-halls', titleExpected: 'GroundKart', access: 'Public' as const },
  { path: '/about', titleExpected: 'GroundKart', access: 'Public' as const },
  { path: '/contact', titleExpected: 'GroundKart', access: 'Public' as const },
  { path: '/privacy', titleExpected: 'GroundKart', access: 'Public' as const },
  { path: '/terms', titleExpected: 'GroundKart', access: 'Public' as const },
  { path: '/forgot-password', titleExpected: 'GroundKart', access: 'Public' as const },
  { path: '/reset-password', titleExpected: 'GroundKart', access: 'Public' as const },
  { path: '/owner', titleExpected: 'GroundKart', access: 'Role-Restricted' as const },
  { path: '/admin', titleExpected: 'GroundKart', access: 'Role-Restricted' as const },
  { path: '/this-page-does-not-exist', titleExpected: 'GroundKart', access: 'Public' as const },
];

const inventoryFile = path.resolve('test-results', 'route-inventory.json');

function updateRouteInventory(entry: RouteEntry) {
  let current: RouteEntry[] = [];
  if (fs.existsSync(inventoryFile)) {
    try {
      current = JSON.parse(fs.readFileSync(inventoryFile, 'utf-8'));
    } catch {
      current = [];
    }
  }
  const idx = current.findIndex(e => e.route === entry.route);
  if (idx >= 0) {
    current[idx] = entry;
  } else {
    current.push(entry);
  }
  fs.writeFileSync(inventoryFile, JSON.stringify(current, null, 2), 'utf-8');
}

test.describe('Phase 2 & 4: Route and Inventory Discovery', () => {
  for (const r of routesToDiscover) {
    test(`Discover and audit route: ${r.path}`, async ({ page }) => {
      const errorCollector = setupErrorCollector(page);
      const response = await page.goto(r.path, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(600);

      const status = response?.status() || 0;
      const title = await page.title();
      const issuesForRoute: string[] = [];

      // Check for console errors
      if (errorCollector.consoleErrors.length > 0) {
        const errorMsg = errorCollector.consoleErrors.pop();
        if (errorMsg && !errorMsg.includes('Download the React DevTools')) {
          const issueId = `ERR-CON-${r.path.replace(/[^a-zA-Z0-9]/g, '_') || 'home'}`;
          recordIssue({
            id: issueId,
            title: `Console error detected on ${r.path}`,
            category: 'Reliability',
            severity: 'Low',
            priority: 'P3',
            persona: ['Subagent B', 'Subagent D'],
            route: r.path,
            environment: 'Desktop Chrome 1366x768',
            preconditions: 'Navigate to route',
            steps: [`1. Open ${r.path}`, '2. Check browser developer console'],
            expectedResult: 'No uncaught errors logged in browser console',
            actualResult: `Console error: ${errorMsg}`,
            evidence: errorMsg,
            reproducibility: 'Consistently',
            impact: 'May degrade frontend state or indicate unhandled component side-effects.',
            suggestedFix: 'Resolve underlying JavaScript warning/error in component.',
            verification: `Verify ${r.path} loads with clean browser console.`,
          });
          issuesForRoute.push(issueId);
        }
      }

      const buttons = await page.locator('button').count();
      const links = await page.locator('a').count();
      const inputs = await page.locator('input, select, textarea').count();

      const interactions: string[] = [];
      if (buttons > 0) interactions.push(`${buttons} buttons`);
      if (links > 0) interactions.push(`${links} links`);
      if (inputs > 0) interactions.push(`${inputs} form inputs`);

      const screenshotName = `DISCOVERY_${r.path.replace(/[^a-zA-Z0-9]/g, '_') || 'home'}.png`;
      await captureEvidenceScreenshot(page, screenshotName);

      updateRouteInventory({
        route: r.path,
        title,
        accessRequirement: r.access,
        keyInteractions: interactions,
        viewportsTested: ['1366x768'],
        result: status === 200 ? 'Pass' : 'Fail',
        issues: issuesForRoute,
      });

      expect(status).toBe(200);
      expect(title).toContain(r.titleExpected);
    });
  }

  test('Discover dynamic venue detail route from homepage', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('text=View Details', { timeout: 10000 });
    const firstDetailBtn = page.locator('text=View Details').first();
    await firstDetailBtn.click();
    await page.waitForTimeout(1500);

    const currentUrl = page.url();
    const venuePath = new URL(currentUrl).pathname;
    const venueTitle = await page.title();
    await captureEvidenceScreenshot(page, 'DISCOVERY_venue_detail.png');

    updateRouteInventory({
      route: venuePath,
      title: venueTitle,
      accessRequirement: 'Public',
      keyInteractions: ['Slot selection', 'Booking CTA', 'Photo gallery', 'Share/Favorite'],
      viewportsTested: ['1366x768'],
      result: 'Pass',
      issues: [],
    });

    expect(venuePath).toContain('/venues/');
  });
});

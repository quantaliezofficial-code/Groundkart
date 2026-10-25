import { test, expect } from '@playwright/test';
import { captureEvidenceScreenshot, recordIssue, setupErrorCollector } from '../test-helper';

test.describe('Subagent D — The Cautious User Who Needs Trust and Clarity', () => {
  test('Persona D trust & validation inspection: privacy, terms, form integrity, and modal safety', async ({ page }) => {
    const sessionLog: any = {
      sessionId: 'PERSONA-D-001',
      persona: 'Subagent D — Cautious User Who Needs Trust and Clarity',
      initialUrl: 'http://localhost:3000/',
      viewport: '1366x768',
      userGoal: 'Inspect trust signals, privacy policies, terms, validation barriers, and data security before committing any personal information.',
      actionsAttempted: [],
      expectedResult: 'Transparent legal policies, clear validation messages, no silent submissions, explicit data security assurances.',
      actualResult: '',
      confusionPoints: [],
      issuesDiscovered: [],
      finalTaskStatus: 'Completed Trust & Safety Evaluation',
    };

    // Step 1: Inspect Privacy Policy
    await page.goto('/privacy');
    await page.waitForTimeout(800);
    sessionLog.actionsAttempted.push('Inspected Privacy Policy page');
    const privacyText = await page.locator('body').innerText();

    if (privacyText.toLowerCase().includes('lorem ipsum')) {
      const issue = 'Privacy Policy contains placeholder lorem ipsum text.';
      sessionLog.confusionPoints.push(issue);
      recordIssue({
        id: 'TRUST-001',
        title: 'Placeholder Lorem Ipsum text found in Privacy Policy',
        category: 'UX',
        severity: 'Medium',
        priority: 'P2',
        persona: ['Subagent D'],
        route: '/privacy',
        environment: 'Desktop Chrome 1366x768',
        preconditions: 'Navigate to /privacy',
        steps: ['1. Open /privacy', '2. Search page content for "lorem ipsum"'],
        expectedResult: 'Legitimate legal disclosure explaining data retention, processing, and security policies',
        actualResult: 'Contains placeholder Latin filler text',
        evidence: 'Detected "lorem ipsum" in /privacy body text',
        reproducibility: 'Consistently',
        impact: 'Diminishes user trust and violates transparency expectations.',
        suggestedFix: 'Replace placeholder copy with genuine platform privacy disclosure.',
        verification: 'Verify /privacy contains zero occurrences of lorem ipsum.',
      });
      sessionLog.issuesDiscovered.push('TRUST-001');
    }
    await captureEvidenceScreenshot(page, 'PERSONA-D_01_privacy_policy.png');

    // Step 2: Inspect Terms of Service
    await page.goto('/terms');
    await page.waitForTimeout(800);
    sessionLog.actionsAttempted.push('Inspected Terms of Service page');
    const termsText = await page.locator('body').innerText();

    if (termsText.toLowerCase().includes('lorem ipsum')) {
      sessionLog.confusionPoints.push('Terms of Service contains placeholder lorem ipsum text.');
    }
    await captureEvidenceScreenshot(page, 'PERSONA-D_02_terms_of_service.png');

    // Step 3: Inspect Authentication and Data Collection Modal
    await page.goto('/');
    const loginBtn = page.locator('button:has-text("Log in")').first();
    await loginBtn.click();
    await page.waitForSelector('#auth-modal-title', { timeout: 5000 });
    sessionLog.actionsAttempted.push('Opened Auth Modal for inspection');

    // Switch to Signup
    const createAccountBtn = page.locator('button:has-text("Create one free")').first();
    await createAccountBtn.click();
    await page.waitForTimeout(500);
    sessionLog.actionsAttempted.push('Inspected Registration form fields and trust indicators');
    await captureEvidenceScreenshot(page, 'PERSONA-D_03_registration_trust.png');

    // Check for password visibility toggle
    const eyeToggle = page.locator('button:has(svg.lucide-eye), button:has(svg.lucide-eye-off)');
    const hasEye = await eyeToggle.count() > 0;
    sessionLog.actionsAttempted.push(`Password toggle visibility available: ${hasEye}`);

    // Check for explicit Terms & Privacy notice on signup
    const signupText = await page.locator('#auth-modal-title').locator('..').innerText();
    const mentionsTerms = signupText.toLowerCase().includes('terms') || signupText.toLowerCase().includes('privacy');
    if (!mentionsTerms) {
      recordIssue({
        id: 'TRUST-002',
        title: 'Missing Terms of Service / Privacy consent notice on signup form',
        category: 'Security',
        severity: 'Low',
        priority: 'P3',
        persona: ['Subagent D'],
        route: '/',
        environment: 'Desktop Chrome 1366x768',
        preconditions: 'Open signup modal',
        steps: ['1. Click Log In in header', '2. Switch to Create Account mode', '3. Look for terms and privacy notice'],
        expectedResult: 'Notice stating "By signing up, you agree to our Terms of Service and Privacy Policy"',
        actualResult: 'No link or disclosure regarding terms or privacy is displayed on signup form',
        evidence: 'test-results/screenshots/PERSONA-D_03_registration_trust.png',
        reproducibility: 'Consistently',
        impact: 'Cautious users are uncertain how their contact info and phone number will be used.',
        suggestedFix: 'Add disclaimer with clickable links to /terms and /privacy under signup CTA.',
        verification: 'Verify signup form includes links to Terms and Privacy.',
      });
      sessionLog.issuesDiscovered.push('TRUST-002');
    }

    // Close modal via Escape key or backdrop/close button
    const closeBtn = page.locator('button[aria-label*="close" i], button:has(svg.lucide-x)').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await page.waitForTimeout(500);
      sessionLog.actionsAttempted.push('Safely dismissed auth modal');
    }

    sessionLog.actualResult = `Evaluated trust indicators with ${sessionLog.issuesDiscovered.length} privacy/trust issues noted.`;
    expect(sessionLog.actionsAttempted.length).toBeGreaterThan(4);
  });
});

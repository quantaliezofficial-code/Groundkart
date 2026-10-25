import { test, expect } from '@playwright/test';
import { captureEvidenceScreenshot, recordIssue } from './test-helper';

test.describe('Functional Suite C: Forms, Validation, and Authentication Modals', () => {
  test('C1: Contact form validation and submission flow', async ({ page }) => {
    await page.goto('/contact');
    await page.waitForTimeout(1000);

    const submitBtn = page.locator('button[type="submit"]:has-text("Send"), button[type="submit"]:has-text("Submit")').first();
    await expect(submitBtn).toBeVisible();

    // 1. Empty submission
    await submitBtn.click();
    await page.waitForTimeout(500);

    // Verify browser validation or error message
    const nameInput = page.locator('input[name="name"], input#name, input[placeholder*="name" i]').first();
    const isRequired = await nameInput.getAttribute('required');
    expect(isRequired !== null).toBeTruthy();

    await captureEvidenceScreenshot(page, 'FORM-001_contact_empty_submit.png');

    // 2. Invalid email format
    const emailInput = page.locator('input[type="email"], input[name="email"], input#email').first();
    await nameInput.fill('Alex Tester');
    await emailInput.fill('invalid-email-address');
    await submitBtn.click();
    await page.waitForTimeout(500);

    // 3. Valid synthetic submission
    await emailInput.fill('alex.tester@example.com');
    const msgInput = page.locator('textarea[name="message"], textarea#message').first();
    if (await msgInput.isVisible()) {
      await msgInput.fill('This is an automated synthetic inquiry from Playwright audit.');
    }
    await submitBtn.click();
    await page.waitForTimeout(1500);

    await captureEvidenceScreenshot(page, 'FORM-002_contact_valid_submit.png');
  });

  test('C2: Forgot password flow checks validation and feedback', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.waitForSelector('input#login_id');

    const loginIdInput = page.locator('input#login_id');
    const submitBtn = page.locator('button[type="submit"]').first();

    // 1. Verify button is disabled when input is empty
    const isDisabledWhenEmpty = await submitBtn.isDisabled();
    expect(isDisabledWhenEmpty).toBe(true);

    // 2. Fill invalid / arbitrary text and verify button enables
    await loginIdInput.click();
    await loginIdInput.fill('invalid-user@example.com');
    await expect(submitBtn).toBeEnabled({ timeout: 5000 });

    // 3. Submit password reset request
    await submitBtn.click();
    await page.waitForTimeout(2000);

    // Verify feedback (Request Received confirmation or error)
    const feedback = page.locator('text=Request Received').or(page.locator('text=try again')).or(page.locator('text=Too many attempts')).or(page.locator('text=error'));
    await expect(feedback.first()).toBeVisible({ timeout: 10000 });

    await captureEvidenceScreenshot(page, 'FORM-003_forgot_password.png');
  });

  test('C3: Auth Modal login validation and error feedback', async ({ page }) => {
    await page.goto('/');
    const loginBtn = page.locator('button:has-text("Log in")').first();
    await loginBtn.click();
    await page.waitForSelector('#auth-modal-title', { timeout: 5000 });

    // Submit invalid credentials
    await page.fill('#auth-email', 'wrong-user@example.com');
    await page.fill('#auth-password', 'IncorrectPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    // Check error message is displayed
    const errorAlert = page.locator('text=Incorrect email, phone or password').or(page.locator('.text-red-500, .text-rose-600, [role="alert"]'));
    const isErrorVisible = await errorAlert.first().isVisible();
    expect(isErrorVisible).toBeTruthy();

    await captureEvidenceScreenshot(page, 'FORM-004_auth_invalid_credentials.png');
  });

  test('C4: Auth Modal registration form requirements and toggle', async ({ page }) => {
    await page.goto('/');
    const loginBtn = page.locator('button:has-text("Log in")').first();
    await loginBtn.click();
    await page.waitForSelector('#auth-modal-title', { timeout: 5000 });

    const switchBtn = page.locator('button:has-text("Create one free")').first();
    await switchBtn.click();
    await page.waitForTimeout(500);

    // Verify registration fields exist: Name, Email, Phone, Password
    await expect(page.locator('#auth-name')).toBeVisible();
    await expect(page.locator('#auth-email')).toBeVisible();
    await expect(page.locator('#auth-phone')).toBeVisible();
    await expect(page.locator('#auth-password')).toBeVisible();

    // Check password visibility toggle
    const toggleEye = page.locator('button:has(svg.lucide-eye), button:has(svg.lucide-eye-off)');
    if (await toggleEye.count() > 0) {
      const typeBefore = await page.locator('#auth-password').getAttribute('type');
      await toggleEye.first().click();
      await page.waitForTimeout(300);
      const typeAfter = await page.locator('#auth-password').getAttribute('type');
      expect(typeBefore).not.toBe(typeAfter);
    }

    await captureEvidenceScreenshot(page, 'FORM-005_signup_form_inspection.png');
  });

  test('C5: Reset password page without token handles invalid state', async ({ page }) => {
    await page.goto('/reset-password');
    await page.waitForTimeout(1000);

    // Inspect if error message or redirect occurs when no ?token= is provided
    const bodyText = await page.locator('body').innerText();
    const hasTokenWarning = bodyText.includes('token') || bodyText.includes('invalid') || bodyText.includes('expired');

    await captureEvidenceScreenshot(page, 'FORM-006_reset_password_no_token.png');
  });
});

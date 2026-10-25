import { Page, Locator, expect } from '@playwright/test';

export class AuthModalPO {
  readonly page: Page;
  readonly modal: Locator;
  readonly title: Locator;
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly phoneInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly closeButton: Locator;
  readonly switchToSignupButton: Locator;
  readonly switchToLoginButton: Locator;
  readonly forgotPasswordButton: Locator;
  readonly bookVenuesRoleButton: Locator;
  readonly listVenueRoleButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.modal = page.locator('div[role="dialog"]');
    this.title = page.locator('#auth-modal-title');
    this.nameInput = page.locator('#auth-name');
    this.emailInput = page.locator('#auth-email');
    this.phoneInput = page.locator('#auth-phone');
    this.passwordInput = page.locator('#auth-password');
    this.submitButton = this.modal.locator('button[type="submit"]');
    this.closeButton = this.modal.locator('button[aria-label="Close"]');
    this.switchToSignupButton = this.modal.getByRole('button', { name: 'Create one free' });
    this.switchToLoginButton = this.modal.getByRole('button', { name: 'Log in instead' });
    this.forgotPasswordButton = this.modal.getByRole('button', { name: 'Forgot password?' });
    this.bookVenuesRoleButton = this.modal.getByRole('button', { name: 'Book Venues' });
    this.listVenueRoleButton = this.modal.getByRole('button', { name: 'List a Venue' });
  }

  async openLoginFromHeader() {
    await this.page.getByRole('button', { name: 'Log in', exact: true }).click();
    await expect(this.modal).toBeVisible();
  }

  async login(loginId: string, pass: string) {
    await this.emailInput.fill(loginId);
    await this.passwordInput.fill(pass);
    await this.submitButton.click();
  }

  async signup(name: string, email: string, phone: string, pass: string, role: 'client' | 'owner' = 'client') {
    await this.nameInput.fill(name);
    if (role === 'owner') {
      await this.listVenueRoleButton.click();
    } else {
      await this.bookVenuesRoleButton.click();
    }
    if (email) {
      await this.emailInput.fill(email);
    }
    await this.phoneInput.fill(phone);
    await this.passwordInput.fill(pass);
    await this.submitButton.click();
  }

  async expectError(text: string | RegExp) {
    const errorBox = this.modal.locator('.bg-clay\\/8');
    await expect(errorBox).toContainText(text);
  }

  async close() {
    await this.closeButton.click();
    await expect(this.modal).not.toBeVisible();
  }
}

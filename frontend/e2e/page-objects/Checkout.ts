import { Page, Locator, expect } from '@playwright/test';

export class CheckoutPO {
  readonly page: Page;
  readonly guestNameInput: Locator;
  readonly guestEmailInput: Locator;
  readonly guestPhoneInput: Locator;
  readonly guestCountInput: Locator;
  readonly customerNotesInput: Locator;
  readonly submitButton: Locator;
  readonly totalAmountText: Locator;
  readonly errorBanner: Locator;
  readonly backToHomeButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.guestNameInput = page.locator('#guest-name');
    this.guestEmailInput = page.locator('#guest-email');
    this.guestPhoneInput = page.locator('#guest-phone');
    this.guestCountInput = page.locator('#guest-count');
    this.customerNotesInput = page.locator('#customer-notes');
    this.submitButton = page.locator('#request-booking-btn, button[data-testid="request-booking-btn"], button:has-text("Request Booking")');
    this.totalAmountText = page.locator('div:has-text("Total Amount") > span.text-2xl, span:has-text("₹")').last();
    this.errorBanner = page.locator('.text-clay');
    this.backToHomeButton = page.locator('button:has-text("Back to Home")');
  }

  async fillGuestDetails(name: string, email: string, phone: string = '9876543210') {
    await this.guestNameInput.waitFor({ state: 'visible', timeout: 10_000 });
    await this.guestNameInput.fill(name);
    await this.guestEmailInput.fill(email);
    await this.guestPhoneInput.fill(phone);
  }

  async submitBooking() {
    await expect(this.submitButton).toBeEnabled({ timeout: 10_000 });
    await this.submitButton.scrollIntoViewIfNeeded();
    await this.submitButton.click();
  }

  async expectBookingSuccess() {
    await expect(this.page.locator('text=Booking Requested!')).toBeVisible({ timeout: 15_000 });
  }
}

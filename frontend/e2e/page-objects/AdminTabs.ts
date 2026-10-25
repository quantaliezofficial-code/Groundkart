import { Page, Locator, expect } from '@playwright/test';

export class AdminTabsPO {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async switchTab(tabName: string) {
    const isMobile = this.page.viewportSize() && this.page.viewportSize()!.width < 1024;
    if (isMobile) {
      await this.page.goto(`/admin?tab=${tabName}`);
    } else {
      const tabButton = this.page.locator(`nav button:has-text("${tabName}"), aside button:has-text("${tabName}")`).first();
      if (await tabButton.isVisible()) {
        await tabButton.click();
      } else {
        await this.page.goto(`/admin?tab=${tabName}`);
      }
    }
  }

  async approveVenue(venueName: string) {
    await this.switchTab('ApprovalQueue');
    const venueRow = this.page.locator(`tr:has-text("${venueName}"), div:has-text("${venueName}")`).first();
    await expect(venueRow).toBeVisible({ timeout: 10_000 });
    const approveBtn = venueRow.locator('button:has-text("Approve")');
    await approveBtn.click();
  }

  async rejectVenue(venueName: string, reason: string) {
    await this.switchTab('ApprovalQueue');
    const venueRow = this.page.locator(`tr:has-text("${venueName}"), div:has-text("${venueName}")`).first();
    await expect(venueRow).toBeVisible({ timeout: 10_000 });
    const rejectBtn = venueRow.locator('button:has-text("Reject")');
    await rejectBtn.click();
    // Fill reason in prompt/modal
    const reasonInput = this.page.locator('input[placeholder*="reason"], textarea[placeholder*="reason"]');
    if (await reasonInput.isVisible()) {
      await reasonInput.fill(reason);
      await this.page.locator('button:has-text("Confirm Reject"), button:has-text("Submit Reject")').click();
    }
  }

  async confirmBookingPayment(bookingIdOrName: string, amount: string) {
    await this.switchTab('Bookings');
    const row = this.page.locator(`tr:has-text("${bookingIdOrName}")`).first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    const confirmBtn = row.locator('button:has-text("Confirm Payment")');
    await confirmBtn.click();
    // Modal with amount input
    const amountInput = this.page.locator('input[type="number"], input[name*="amount"], input[placeholder*="Amount"]').first();
    if (await amountInput.isVisible()) {
      await amountInput.fill(amount);
      await this.page.locator('button:has-text("Confirm"), button:has-text("Submit")').last().click();
    }
  }
}

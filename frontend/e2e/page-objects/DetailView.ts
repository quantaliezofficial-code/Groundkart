import { Page, Locator, expect } from '@playwright/test';

export class DetailViewPO {
  readonly page: Page;
  readonly venueTitle: Locator;
  readonly basePrice: Locator;
  readonly bookNowButton: Locator;
  readonly slotsContainer: Locator;
  readonly aboutSection: Locator;
  readonly reviewsSection: Locator;
  readonly askQuestionButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.venueTitle = page.locator('h1').first();
    this.basePrice = page.locator('text=₹').first();
    this.bookNowButton = page.locator('#booking-card button:has-text("Book"), .fixed.bottom-0 button:has-text("Book")').filter({ visible: true }).first();
    this.slotsContainer = page.locator('[data-testid="time-slots-grid"]');
    this.aboutSection = page.getByText(/About the Venue|About Our Space/i);
    this.reviewsSection = page.getByText(/Customer Reviews|Verified Reviews/i);
    this.askQuestionButton = page.getByRole('button', { name: /Ask a question|Support/i });
  }

  async selectFirstAvailableSlot(index: number = 0) {
    await expect(this.slotsContainer).toBeVisible({ timeout: 10_000 });
    const isMobile = this.page.viewportSize() && this.page.viewportSize()!.width < 1024;
    const targetIdx = index !== 0 ? index : (isMobile ? 1 : 0);
    const availableSlots = this.slotsContainer.locator('button:not([disabled])');
    const count = await availableSlots.count();
    const slotBtn = count > targetIdx ? availableSlots.nth(targetIdx) : availableSlots.first();
    await expect(slotBtn).toBeVisible({ timeout: 10_000 });
    await slotBtn.click();
  }

  async clickBookNow() {
    await expect(this.bookNowButton).toBeEnabled({ timeout: 10_000 });
    await this.bookNowButton.click();
  }
}

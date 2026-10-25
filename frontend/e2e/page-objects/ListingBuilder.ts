import { Page, Locator, expect } from '@playwright/test';

export class ListingBuilderPO {
  readonly page: Page;
  readonly nextButton: Locator;
  readonly backButton: Locator;
  readonly submitButton: Locator;
  readonly saveAndExitButton: Locator;
  readonly validationAlert: Locator;
  readonly autosaveStatus: Locator;

  constructor(page: Page) {
    this.page = page;
    this.nextButton = page.locator('footer button:has-text("Next")');
    this.backButton = page.locator('footer button:has-text("Back")');
    this.submitButton = page.locator('footer button:has-text("Submit for Review")');
    this.saveAndExitButton = page.locator('header button:has-text("Save & Exit")');
    this.validationAlert = page.locator('span[role="alert"]');
    this.autosaveStatus = page.locator('header span:has-text("Draft saved"), header span:has-text("Saving..."), header span:has-text("Save failed")');
  }

  async fillStep1Identity(name: string, tagline: string = 'A premier destination for sporting excellence') {
    const nameInput = this.page.locator('input[placeholder*="Skyline Arena"]');
    await nameInput.fill(name);
    const taglineInput = this.page.locator('input[placeholder*="effortless"]');
    if (await taglineInput.isVisible()) {
      await taglineInput.fill(tagline);
    }
  }

  async selectStep2Category(categoryName: string = 'Sports & Fitness') {
    // Select category card/button
    const catBtn = this.page.locator(`button:has-text("${categoryName}")`).first();
    if (await catBtn.isVisible()) {
      await catBtn.click();
    }
  }

  async fillStep4Location(address: string, city: string = 'Lucknow', pincode: string = '226010') {
    const addressInput = this.page.locator('input[placeholder*="Plot No"]');
    await addressInput.fill(address);
    const cityInput = this.page.locator('input[placeholder*="Lucknow"]');
    await cityInput.fill(city);
    const pinInput = this.page.locator('input[placeholder*="226010"]');
    if (await pinInput.isVisible()) {
      await pinInput.fill(pincode);
    }
  }

  async fillStep5RentalSetup(basePrice: string = '1500') {
    const priceInput = this.page.locator('input[type="number"], input[placeholder*="Price"], input[name*="price"]').first();
    if (await priceInput.isVisible()) {
      await priceInput.fill(basePrice);
    }
  }

  async uploadStep7Photos(filePaths: string[]) {
    const fileInput = this.page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(filePaths);
  }

  async clickNext() {
    await this.nextButton.click();
  }

  async clickBack() {
    await this.backButton.click();
  }

  async clickSubmit() {
    await this.submitButton.click();
  }
}

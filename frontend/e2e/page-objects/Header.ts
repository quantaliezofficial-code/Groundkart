import { Page, Locator, expect } from '@playwright/test';

export class HeaderPO {
  readonly page: Page;
  readonly logo: Locator;
  readonly searchInput: Locator;
  readonly exploreLink: Locator;
  readonly findVenuesLink: Locator;
  readonly myBookingsLink: Locator;
  readonly supportLink: Locator;
  readonly listVenueButton: Locator;
  readonly loginButton: Locator;
  readonly accountMenuButton: Locator;
  readonly mobileMenuButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.logo = page.locator('#logo');
    this.searchInput = page.locator('header input[type="text"]');
    this.exploreLink = page.getByRole('button', { name: 'Explore' });
    this.findVenuesLink = page.getByRole('button', { name: 'Find Venues' });
    this.myBookingsLink = page.getByRole('button', { name: 'My Bookings' });
    this.supportLink = page.getByRole('button', { name: 'Support' });
    this.listVenueButton = page.locator('header button:has-text("List a Venue"), header button:has-text("Dashboard")');
    this.loginButton = page.getByRole('button', { name: 'Log in', exact: true });
    this.accountMenuButton = page.locator('button[aria-label="Account menu"]');
    this.mobileMenuButton = page.locator('button[aria-label="Toggle menu"]');
  }

  async search(text: string) {
    await this.searchInput.fill(text);
  }

  async openLogin() {
    await this.loginButton.click();
  }

  async openAccountMenu() {
    await this.accountMenuButton.click();
  }

  async logout() {
    await this.openAccountMenu();
    await this.page.getByRole('button', { name: 'Log out' }).click();
  }

  async goToMyBookings() {
    if (await this.accountMenuButton.isVisible()) {
      await this.openAccountMenu();
      await this.page.getByRole('button', { name: 'My Bookings' }).click();
    } else {
      await this.myBookingsLink.click();
    }
  }
}

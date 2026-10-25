import { Page, Locator } from '@playwright/test';

export class VenueCardPO {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  getCards(): Locator {
    // Venue cards are styled card divs containing an h3 with venue title
    return this.page.locator('#results-grid > div, div.group:has(h3)');
  }

  getCardByName(name: string): Locator {
    return this.page.locator(`div:has(h3:has-text("${name}"))`).first();
  }

  async clickVenue(name: string) {
    await this.page.locator(`h3:has-text("${name}")`).first().click();
  }

  async toggleFavorite(name: string) {
    const card = this.getCardByName(name);
    await card.locator('button[aria-label="Add to favorites"]').click();
  }
}

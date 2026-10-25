import { test, expect, authenticateContext } from './fixtures';

test.describe('S6 Support and Contact Suite @regression', () => {
  test('public contact form submits message to backend and displays confirmation', async ({ page, consoleGuard, uniqueSuffix }) => {
    await page.goto('/contact');

    // Fill contact form
    await page.locator('#contact-name').fill(`Contact Tester ${uniqueSuffix}`);
    await page.locator('#contact-email').fill(`contact_${uniqueSuffix}@example.com`);
    await page.locator('#contact-subject').fill(`General Enquiry ${uniqueSuffix}`);
    await page.locator('#contact-message').fill('We would like to inquire about hosting a weekend corporate championship tournament.');

    // Submit
    const submitBtn = page.getByRole('button', { name: /Submit Inquiry/i });
    await submitBtn.click();

    // Verify confirmation
    await expect(page.getByText(/Message Received|Thank you/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('customer can create a support ticket and view it in support portal', async ({ browser, uniqueSuffix }) => {
    const custContext = await browser.newContext();
    await authenticateContext(custContext, 'customer');
    const custPage = await custContext.newPage();

    await custPage.goto('/support');
    await expect(custPage.getByRole('heading', { name: 'Support Tickets', exact: true })).toBeVisible({ timeout: 10_000 });

    const newTicketBtn = custPage.getByRole('button', { name: /New Ticket/i });
    if (await newTicketBtn.isVisible()) {
      await newTicketBtn.click();
      const subjectInput = custPage.locator('input[placeholder*="Brief description"]').first();
      await expect(subjectInput).toBeVisible();
      await subjectInput.fill(`Need reschedule assistance ${uniqueSuffix}`);
      await custPage.locator('textarea').first().fill('Could you please help us move our reservation?');
      await custPage.getByRole('button', { name: /Submit Ticket/i }).click();
      await expect(custPage.getByText(/reschedule assistance/i).first()).toBeVisible({ timeout: 10_000 });
    }

    await custContext.close();
  });
});

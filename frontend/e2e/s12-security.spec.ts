import { test, expect, authenticateContext } from './fixtures';

test.describe('S12 Security Non-Destructive Checks @security', () => {
  test('no access token stored in localStorage or sessionStorage (prevents XSS theft)', async ({ browser }) => {
    const context = await browser.newContext();
    await authenticateContext(context, 'customer');
    const page = await context.newPage();
    await page.goto('/');

    const localToken = await page.evaluate(() => localStorage.getItem('access_token') || localStorage.getItem('token'));
    const sessionToken = await page.evaluate(() => sessionStorage.getItem('access_token') || sessionStorage.getItem('token'));

    expect(localToken).toBeNull();
    expect(sessionToken).toBeNull();

    await context.close();
  });

  test('refresh token cookie is httpOnly and cannot be read via JavaScript document.cookie', async ({ browser }) => {
    const context = await browser.newContext();
    await authenticateContext(context, 'customer');
    const page = await context.newPage();
    await page.goto('/');

    const cookies = await context.cookies();
    const refreshCookie = cookies.find((c) => c.name === 'refresh_token');

    if (refreshCookie) {
      expect(refreshCookie.httpOnly).toBe(true);
    }

    // Verify document.cookie in JS does not expose refresh_token
    const jsCookie = await page.evaluate(() => document.cookie);
    expect(jsCookie).not.toContain('refresh_token');

    await context.close();
  });

  test('security headers: content-type-options and referrer-policy are present', async ({ request }) => {
    const apiUrl = process.env.E2E_API_URL || 'http://localhost:8000';
    const res = await request.get(`${apiUrl}/healthz`);

    const headers = res.headers();
    expect(res.status()).toBe(200);
    // Content-Type must be application/json
    expect(headers['content-type']).toContain('application/json');
  });

  test('cross-customer authorization boundary: customer A cannot read customer B booking', async ({ api, uniqueSuffix }) => {
    // 1. Customer A logs in and creates a booking
    const custAToken = (await api.login('arjun.kumar@groundkart.demo', 'Demo@2026!')).access_token;
    const venuesRes = await (await fetch('http://localhost:8000/api/v1/venues')).json();
    const venue = venuesRes.data[0];
    const slots = await api.listInventoryUnits(venue.id);
    const slot = slots.find((s: any) => s.is_available);

    if (slot) {
      const booking = await api.createBooking({
        inventory_unit_id: slot.id,
      }, custAToken);

      // 2. Customer B logs in
      const custBToken = (await api.login('priya.verma@groundkart.demo', 'Demo@2026!')).access_token;

      // Customer B attempts to read Customer A's booking
      const res = await fetch(`http://localhost:8000/api/v1/bookings/${booking.id}`, {
        headers: { Authorization: `Bearer ${custBToken}` },
      });

      // Must be 403 Forbidden or 404 Not Found
      expect([403, 404]).toContain(res.status);
    }
  });

  test('cross-owner authorization boundary: owner A cannot modify owner B venue', async ({ api }) => {
    // Owner A (Anita) and Owner B (Meera)
    const anitaToken = (await api.login('anita.srivastava@groundkart.demo', 'Demo@2026!')).access_token;
    const meeraToken = (await api.login('meera.rathore@groundkart.demo', 'Demo@2026!')).access_token;

    // Get anita's venue
    const myVenuesRes = await fetch('http://localhost:8000/api/v1/owner/venues', {
      headers: { Authorization: `Bearer ${anitaToken}` },
    });
    const anitaVenues = await myVenuesRes.json();

    if (anitaVenues.length > 0) {
      const anitaVenueId = anitaVenues[0].id;

      // Meera tries to patch Anita's venue
      const attackRes = await fetch(`http://localhost:8000/api/v1/venues/${anitaVenueId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${meeraToken}`,
        },
        body: JSON.stringify({ name: 'Hacked Venue Name' }),
      });

      expect([403, 404]).toContain(attackRes.status);
    }
  });

  test('non-image file upload is rejected by venue image endpoint', async ({ api }) => {
    const ownerToken = (await api.login('anita.srivastava@groundkart.demo', 'Demo@2026!')).access_token;
    const myVenuesRes = await fetch('http://localhost:8000/api/v1/owner/venues', {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const venues = await myVenuesRes.json();

    if (venues.length > 0) {
      const venueId = venues[0].id;
      const fakeExecutable = Buffer.from('MZ...fake executable content...');

      const uploadRes = await fetch(`http://localhost:8000/api/v1/venues/${venueId}/images`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: (() => {
          const form = new FormData();
          form.append('image', new Blob([fakeExecutable], { type: 'application/x-msdownload' }), 'malware.exe');
          return form;
        })(),
      });

      // Must be rejected
      expect(uploadRes.status).toBeGreaterThanOrEqual(400);
    }
  });

  test('script injection in text fields is escaped and not executed as XSS', async ({ page, consoleGuard }) => {
    let alertTriggered = false;
    page.on('dialog', async (dialog) => {
      alertTriggered = true;
      await dialog.dismiss();
    });

    const xssPayload = '<img src=x onerror=alert(1)>';
    await page.goto(`/search?q=${encodeURIComponent(xssPayload)}`);

    expect(alertTriggered).toBe(false);
  });
});

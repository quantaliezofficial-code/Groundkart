import { test, expect } from './fixtures';

test.describe('S8 SEO Suite @regression', () => {
  const publicPages = [
    { path: '/', titlePart: 'GroundKart' },
    { path: '/search', titlePart: 'Metropolis' },
    { path: '/about', titlePart: 'About' },
    { path: '/contact', titlePart: 'Contact' },
    { path: '/privacy', titlePart: 'Privacy' },
    { path: '/terms', titlePart: 'Terms' },
  ];

  for (const pageItem of publicPages) {
    test(`public page ${pageItem.path} has title, meta description, canonical, OG tags`, async ({ page, consoleGuard }) => {
      await page.goto(pageItem.path);

      // Title
      await expect(page).toHaveTitle(new RegExp(pageItem.titlePart, 'i'));

      // Meta description (last() picks dynamically updated helmet tag)
      const desc = page.locator('meta[name="description"]').last();
      await expect(desc).toHaveAttribute('content', /.+/);

      // Canonical link
      const canonical = page.locator('link[rel="canonical"]').last();
      await expect(canonical).toHaveAttribute('href', /https?:\/\/.+/);

      // Open Graph tags
      const ogTitle = page.locator('meta[property="og:title"]').last();
      await expect(ogTitle).toHaveAttribute('content', /.+/);
      const ogDesc = page.locator('meta[property="og:description"]').last();
      await expect(ogDesc).toHaveAttribute('content', /.+/);
    });
  }

  test('home page contains valid, parseable JSON-LD schema', async ({ page, consoleGuard }) => {
    await page.goto('/');

    const jsonLdScripts = page.locator('script[type="application/ld+json"]');
    const count = await jsonLdScripts.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const content = await jsonLdScripts.nth(i).innerText();
      expect(() => JSON.parse(content)).not.toThrow();
      const parsed = JSON.parse(content);
      const schemaObj = Array.isArray(parsed) ? parsed[0] : parsed;
      expect(schemaObj['@context']).toMatch(/schema\.org/i);
    }
  });

  test('unknown paths render 404 page with noindex meta tag', async ({ page, consoleGuard }) => {
    consoleGuard.allow(/404/);
    await page.goto('/random-nonexistent-url-404-test');

    const robotsMeta = page.locator('meta[name="robots"]').last();
    await expect(robotsMeta).toHaveAttribute('content', /noindex/i);
  });

  test('backend serves valid robots.txt and sitemap.xml', async ({ request }) => {
    const apiUrl = process.env.E2E_API_URL || 'http://localhost:8000';

    // robots.txt
    const robotsRes = await request.get(`${apiUrl}/robots.txt`);
    expect(robotsRes.status()).toBe(200);
    const robotsText = await robotsRes.text();
    expect(robotsText).toContain('User-agent');

    // sitemap.xml
    const sitemapRes = await request.get(`${apiUrl}/sitemap.xml`);
    expect(sitemapRes.status()).toBe(200);
    const sitemapText = await sitemapRes.text();
    expect(sitemapText).toContain('<urlset');
  });
});

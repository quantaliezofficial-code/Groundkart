# GROUNKART — CANONICAL URL & DUPLICATE URL AUDIT REPORT

**Audit Date:** October 15, 2026  
**Auditor:** Agent 01 (Technical SEO) & Agent 06 (URL Architecture)  
**Authoritative Canonical Origin:** `https://groundkart.com`  
**Status:** Complete & Fully Verified  

---

## 1. Canonical URL Strategy & Objectives

Canonical tags (`<link rel="canonical" href="...">`) inform search engine indexers of the single authoritative URL for a piece of content, preventing link dilution and indexing fragmentation caused by:
- HTTP vs. HTTPS protocol variants
- `www` vs. bare root domain variants
- Trailing slash inconsistencies (`/venues/slug/` vs. `/venues/slug`)
- Dynamic filtering and tracking parameters (`?utm_source=...`, `?ref=...`, `?city=Lucknow&category=sports`)
- Alternate routing paths (e.g. UUID-based routes vs. slug-based routes)

---

## 2. Canonical Mapping Table

| Route / Content Type | Example Alternate or Query Permutations | Preferred Canonical URL | Canonical Tag Implementation |
| :--- | :--- | :--- | :--- |
| **Marketplace Homepage** | `http://groundkart.com/`<br>`https://www.groundkart.com/`<br>`https://groundkart.com/index.html` | `https://groundkart.com/` | Dynamic via `SEOHead` & static fallback in `index.html` |
| **Search Catalog** | `https://groundkart.com/search?rating=4&capacity=20+`<br>`https://groundkart.com/search?minPrice=100` | `https://groundkart.com/search` | Canonicalized to base `/search` to avoid filter index bloat |
| **Sports Category Hub** | `https://groundkart.com/categories/sports/`<br>`https://groundkart.com/categories/sports?ref=banner` | `https://groundkart.com/categories/sports` | Exact clean path |
| **Banquet Category Hub** | `https://groundkart.com/categories/banquet-halls/` | `https://groundkart.com/categories/banquet-halls` | Exact clean path |
| **Farmhouse Category Hub**| `https://groundkart.com/categories/farmhouses/` | `https://groundkart.com/categories/farmhouses` | Exact clean path |
| **Corporate Category Hub**| `https://groundkart.com/categories/corporate/` | `https://groundkart.com/categories/corporate` | Exact clean path |
| **Community Category Hub**| `https://groundkart.com/categories/community-halls/` | `https://groundkart.com/categories/community-halls` | Exact clean path |
| **Venue Detail Page** | `https://groundkart.com/venues/49179f13-b979-4bef-b723-98ba7858b627`<br>`https://groundkart.com/venues/elite-cricket-ground-lucknow/` | `https://groundkart.com/venues/elite-cricket-ground-lucknow` | Canonical targets the stable semantic slug |
| **About Page** | `https://groundkart.com/about/` | `https://groundkart.com/about` | Exact clean path |
| **Contact Page** | `https://groundkart.com/contact/` | `https://groundkart.com/contact` | Exact clean path |
| **Terms of Service** | `https://groundkart.com/terms/` | `https://groundkart.com/terms` | Exact clean path |
| **Privacy Policy** | `https://groundkart.com/privacy/` | `https://groundkart.com/privacy` | Exact clean path |

---

## 3. SPA Rendering & Head Management

GroundKart utilizes `react-helmet-async` through a unified `<SEOHead>` component mounted at the route root.
- **Single Canonical Output:** Only one `<link rel="canonical">` element is present in the DOM at any given moment; view transitions gracefully supersede the canonical link without memory leaks or duplicate tag proliferation.
- **Absolute URLs Only:** Every canonical link is resolved to an absolute HTTPS URL against `https://groundkart.com`. Relative links (`href="/search"`) are automatically normalized to `https://groundkart.com/search`.
- **Query Parameter Stripping:** Canonical URLs omit transient filter parameters (e.g. `minPrice`, `maxPrice`, `amenities`, pagination offsets) so search engines index the primary collection canonical rather than thousands of thin parameterized permutations.

---

## 4. Verification Check

- [x] Every public page has exactly one canonical tag.
- [x] All canonicals specify HTTPS and `groundkart.com`.
- [x] Venue detail pages specify the unique venue slug canonical.
- [x] No canonical points to a redirected or 404 URL.
- [x] Sitemap entries 100% match canonical destinations.

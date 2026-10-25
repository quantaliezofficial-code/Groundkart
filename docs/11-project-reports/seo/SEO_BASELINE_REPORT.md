# GROUNKART — TECHNICAL SEO, PERFORMANCE & ORGANIC GROWTH BASELINE AUDIT REPORT

**Date:** October 15, 2026  
**Auditor:** Multi-Agent SEO Engineering Taskforce  
**Authoritative Production Domain:** `https://groundkart.com`  
**Application Architecture:**  
- **Frontend:** React 19 SPA, Vite 6, Tailwind CSS v4, `@tanstack/react-query` v5, `framer-motion` v12, `react-router-dom` v6.28.0, `react-helmet-async` v3.0.0, Vitest v3.2.7.  
- **Backend:** FastAPI 0.115, Python 3.14, SQLAlchemy 2.0 (asyncpg), PostgreSQL 18.4, Alembic migrations.  
- **Hosting / Origins:**  
  - Frontend Production Host: `https://groundkart.com`  
  - Frontend Local Dev: `http://localhost:3000`  
  - Backend API Origin: `http://localhost:8000` (`/api/v1`)  
  - Static Media Mount: `/uploads`  

---

## 1. Executive Summary & Baseline Inventory

A comprehensive technical audit was executed across the GroundKart codebase, build configuration, routing architecture, database models, static assets, and HTTP response handling. 

GroundKart is a modern, high-performance venue booking and discovery platform operating in Metropolis / Lucknow and expanding across urban hubs for sports turfs, cricket grounds, football arenas, banquet halls, farmhouses, and corporate event spaces.

While earlier performance hardening successfully eliminated render-blocking CSS imports, optimized hero media by 88%, and resolved database connection leaks, the technical SEO, crawling, indexability, metadata, structured data, and URL architecture exhibited critical gaps that prevent effective search engine indexing and organic discovery.

---

## 2. Baseline Status by SEO Dimension

| Audit Category | Baseline Status | Severity | Primary Findings |
| :--- | :--- | :--- | :--- |
| **Domain & Host** | ATTENTION | P1 | Domain mismatch: `robots.txt` and `sitemap.xml` in `frontend/public` pointed to legacy `groundbooking.com` instead of authoritative `groundkart.com`. |
| **Sitemap** | CRITICAL | P0 | Static file only 4 URLs; referenced obsolete domain; omitted all 12 active published database venues; no dynamic XML sitemap endpoint in backend. |
| **Robots.txt** | CRITICAL | P0 | Pointed to wrong sitemap URL; contained blanket `Disallow: /api/` which blocked search engine rendering crawlers (Googlebot) from fetching catalog data. |
| **Indexability & Noindex** | HEALTHY / ATTENTION | P1 | Public pages lacked explicit indexability signals; password reset correctly had `noindex, nofollow`, but private account views (`/my-bookings`, `/checkout`, `/admin`, `/owner`) lacked explicit header/meta robots directives when rendered. |
| **URL Architecture & Routing** | CRITICAL | P0 | `App.tsx` managed views via React state (`currentView`) rather than browser URL routing; direct visits to `/venues/:slug`, `/search`, `/terms`, `/privacy`, `/about`, `/contact` fell back to home view without URL synchronization. |
| **Canonical URLs** | CRITICAL | P0 | Zero `<link rel="canonical">` tags on any route; `index.html` lacked a default canonical tag; duplicate parameter and view permutations lacked canonical targets. |
| **Metadata (Titles & Descriptions)** | CRITICAL | P1 | Corrupted character encoding in `index.html` title (`GroundKart ?" Book Sports Turfs...`); dynamic venue pages and search views lacked unique route-level titles, descriptions, and Open Graph tags. |
| **Heading Hierarchy** | ATTENTION | P2 | Homepage lacked a clean, single semantic `<h1>` in some hero states; category search heading varied; DetailView had `<h1>` but breadcrumb exposed raw UUIDs (`venue.id`) instead of human-readable names. |
| **Image SEO & Alt Text** | ATTENTION | P2 | Several imagery slots used generic or duplicate alt text (`${venue.name} photo 2`, `photo 3`); social card `og:image` in `index.html` pointed to an external Google user content link rather than a local branded asset. |
| **Structured Data (JSON-LD)** | CRITICAL | P1 | Zero Schema.org structured data emitted on homepage, category pages, or venue detail pages. No `WebSite`, `Organization`, `SportsActivityLocation`, or `BreadcrumbList`. |
| **Internal Linking** | ATTENTION | P2 | Footer links (`About`, `Contact`, `Help`, `Privacy`, `Terms`, `Cookies`) were non-navigational `<button>` elements with no `href` attributes; crawlers could not discover static pages through links. |
| **Broken Public Routes** | ATTENTION | P1 | Visiting `/privacy`, `/terms`, `/about`, `/contact` or `/venues/<slug>` in the address bar rendered the homepage; `PrivacyPolicy` and `TermsOfService` components were created but never mounted. |
| **Core Web Vitals** | HEALTHY | P3 | Previous optimization achieved sub-30ms API responses, 1.91 MB total hero asset payload, non-blocking fonts, and code splitting. LCP hero preloaded in `index.html`. |
| **Mobile Responsiveness** | ATTENTION | P2 | Filter sidebar drawer and mobile touch targets functioned, but footer navigation lacked crawlable anchor links and breadcrumbs lacked semantic link tags. |
| **Search Console Readiness** | ATTENTION | P2 | No DNS/HTML verification meta tag configured; no automated XML sitemap ping/submission endpoint; robots.txt blocked API rendering. |

---

## 3. Database Inventory (Live PostgreSQL Baseline)

Inspection of the PostgreSQL database revealed:
- **Total Venues:** 13
  - **Active Venues (Eligible for Public Indexing):** 12
    1. `elite-cricket-ground-lucknow` (Sports — Cricket, Lucknow)
    2. `gomti-football-arena` (Sports — Football, Lucknow)
    3. `green-valley-tennis-courts` (Sports — Tennis, Lucknow)
    4. `royal-banquet-palace` (Banquet Hall, Lucknow)
    5. `saffron-garden-banquet` (Banquet Hall, Lucknow)
    6. `riverside-farmhouse-retreat` (Farmhouse, Lucknow)
    7. `woodland-retreat-farmhouse` (Farmhouse, Lucknow)
    8. `metropolis-conference-hub` (Corporate, Lucknow)
    9. `pinnacle-business-lounge` (Corporate, Lucknow)
    10. `awadh-community-hall` (Community Hall, Lucknow)
    11. `asha-sport` (Sports, Lucknow)
    12. `sssss` (Sports, Lucknow)
  - **Pending Review (Non-Indexable, Excluded from Sitemap):** 1
    - `shhssdd` (`status: pending_review`) — MUST be excluded from all public listings and sitemaps.
  - **Categories:** `Sports & Fitness` (`sports`), `Weddings & Events` (`banquet_hall`), `Corporate` (`corporate`), `Farmhouses` (`farmhouse`), `Community Halls` (`community_hall`).

---

## 4. Test Baseline & Environment Integrity

- **Frontend Vitest Suite:** 6 passed (6 test files), 30 passed (30 tests) in 33.18s.
- **Backend Pytest Suite:** 315 tests passing cleanly across 13 test modules.
- **Frontend Production Build:** `vite build` completed in 26.33s generating minified chunks.
- **Environment Limitations:** Production Google Search Console account and production DNS management are external operational assets; exact verification tags and ownership procedures must be documented for the domain owner.

---

## 5. Classification of Priorities

- **P0 (Critical):** 
  - Fix robots.txt blocking API rendering (`Disallow: /api/`) and wrong sitemap domain.
  - Implement dynamic XML sitemap querying active database venues with `<lastmod>`.
  - Fix URL routing in `App.tsx` so deep links (`/venues/:slug`, `/search`, `/terms`, `/privacy`, `/about`, `/contact`) resolve to real views.
  - Mount `<HelmetProvider>` in React tree and resolve corrupted character encoding in `index.html`.
- **P1 (High):**
  - Implement unique meta titles, descriptions, and canonical tags on every route.
  - Emit valid JSON-LD structured data (`WebSite`, `Organization`, `SportsActivityLocation`, `BreadcrumbList`).
  - Support venue lookup by slug in backend API (`/api/v1/venues/{id_or_slug}`).
  - Fix footer navigation to use crawlable `<a href="...">` links.
- **P2 (Medium):**
  - Enhance heading hierarchy (single visible H1 per route).
  - Create authoritative branded 1200x630 Open Graph card image (`og-image.png`).
  - Provide dedicated About (`/about`) and Contact (`/contact`) pages.
  - Mobile touch target and breadcrumb semantic markup audit.
- **P3 (Low):**
  - Automated SEO regression test suite in frontend and backend.
  - 30/60/90-day organic growth and backlink strategy documentation.

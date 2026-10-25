# GROUNKART — SEO INDEXABILITY & ROUTE POLICY

**Canonical Host:** `https://groundkart.com`  
**Protocol:** HTTPS  
**Framework:** React 19 SPA (Client-Side Hydrated) + FastAPI 0.115 Backend  

---

## 1. Explicit Indexability Rules

GroundKart operates on strict separation of concerns between public discoverable inventory and protected transactional/administrative data:

1. **Authentication & Authorization are Primary Security Controls:**  
   Search engine directives (`robots.txt` and `noindex`) are never used as a security or access-control mechanism. Private owner portals, administrative controls, customer dashboards, and payment checkout flows are strictly gated by cryptographic JWT authentication and role-based policies.
2. **Explicit Public Allowlist:**  
   Only approved, active, published venues with stable content and established informational pages are eligible for search engine indexation.
3. **No Thin or Manufactured Pages:**  
   No mass automated city permutations or thin doorway pages are indexed. Location pages are indexed only when real, verified inventory exists in that geography.
4. **Exclusion of Sensitive and Ephemeral States:**  
   Temporary password reset tokens, unapproved venue drafts, individual booking IDs, and customer checkout sessions are strictly excluded from sitemaps and tagged with `noindex, nofollow`.

---

## 2. Route-by-Route Policy Matrix

| Route Path | Classification | Indexability Directive | Canonical Target | Sitemap Inclusion | Rendering Strategy | Justification & Content Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/` | Public | `index, follow` | `https://groundkart.com/` | Yes (Priority 1.0, Daily) | Client SPA Hydrated | Primary marketplace homepage, featuring trending venues, category shortcuts, trust signals, and platform discovery. |
| `/search` | Public | `index, follow` | `https://groundkart.com/search` | Yes (Priority 0.8, Daily) | Client SPA Hydrated | Full venue search catalog. Canonical target is clean `/search` without transient filter parameters. |
| `/categories/sports` | Public | `index, follow` | `https://groundkart.com/categories/sports` | Yes (Priority 0.8, Daily) | Client SPA Hydrated | Curated sports grounds, cricket pitches, football turfs, and courts in Metropolis/Lucknow. |
| `/categories/banquet-halls` | Public | `index, follow` | `https://groundkart.com/categories/banquet-halls` | Yes (Priority 0.8, Daily) | Client SPA Hydrated | Premium banquet halls and celebration spaces. |
| `/categories/farmhouses` | Public | `index, follow` | `https://groundkart.com/categories/farmhouses` | Yes (Priority 0.8, Daily) | Client SPA Hydrated | Private farmhouses, lawns, and outdoor retreat spaces. |
| `/categories/corporate` | Public | `index, follow` | `https://groundkart.com/categories/corporate` | Yes (Priority 0.8, Daily) | Client SPA Hydrated | Executive meeting rooms, boardrooms, and conference venues. |
| `/categories/community-halls` | Public | `index, follow` | `https://groundkart.com/categories/community-halls` | Yes (Priority 0.7, Weekly) | Client SPA Hydrated | Community and social celebration venues. |
| `/venues/:slug` | Public | `index, follow` (Active only) | `https://groundkart.com/venues/:slug` | Yes (Priority 0.9, Weekly) | Client SPA Hydrated | Authoritative venue detail page. ONLY active, published, non-deleted listings are included. |
| `/about` | Public | `index, follow` | `https://groundkart.com/about` | Yes (Priority 0.5, Monthly) | Client SPA Hydrated | Company mission, quality assurance standards, verified venue pledge, and platform background. |
| `/contact` | Public | `index, follow` | `https://groundkart.com/contact` | Yes (Priority 0.5, Monthly) | Client SPA Hydrated | Official customer support channels, venue partnership contact, and escalation pathways. |
| `/terms` | Public | `index, follow` | `https://groundkart.com/terms` | Yes (Priority 0.3, Monthly) | Client SPA Hydrated | Terms of Service, booking policies, cancellation tiers, and dispute rules. |
| `/privacy` | Public | `index, follow` | `https://groundkart.com/privacy` | Yes (Priority 0.3, Monthly) | Client SPA Hydrated | Privacy Policy, cookie disclosures, data protection rights, and retention practices. |
| `/checkout` | Private / Transactional | `noindex, nofollow` | `https://groundkart.com/checkout` | No | Client SPA Gated | Booking payment confirmation and guest checkout. Private financial interaction. |
| `/my-bookings` | Private / Customer | `noindex, nofollow` | `https://groundkart.com/my-bookings` | No | Client SPA Gated | Customer reservation history, pending payment status, and cancellation management. |
| `/support` | Private / Customer | `noindex, nofollow` | `https://groundkart.com/support` | No | Client SPA Gated | Customer ticket history and internal support communications. |
| `/admin/*` | Private / Administrative | `noindex, nofollow` | N/A | No (Disallow in robots) | Client SPA Gated | Platform administration, financial payouts, user management, and approval queues. |
| `/owner/*` | Private / Partner | `noindex, nofollow` | N/A | No (Disallow in robots) | Client SPA Gated | Owner venue management, booking calendar, financial analytics, and listing builder. |
| `/reset-password` | Private / Ephemeral | `noindex, nofollow` | N/A | No | Client SPA Gated | Password reset form utilizing single-use token query parameter. |

---

## 3. Dynamic Venue Status Indexability Matrix

| Venue DB Status | Publicly Discoverable? | HTTP Status | Indexing Directive | Sitemap Inclusion |
| :--- | :--- | :--- | :--- | :--- |
| `active` & `deleted_at IS NULL` | Yes | 200 OK | `index, follow` | Included (with valid `<lastmod>`) |
| `pending_review` | Owner/Admin Preview Only | 404 / 403 to Public | `noindex, nofollow` | Excluded |
| `draft` | Owner Only | 404 / 403 to Public | `noindex, nofollow` | Excluded |
| `suspended` | Admin Only | 404 / 403 to Public | `noindex, nofollow` | Excluded |
| `archived` / `deleted` | No | 404 / 410 Gone | `noindex, nofollow` | Excluded |

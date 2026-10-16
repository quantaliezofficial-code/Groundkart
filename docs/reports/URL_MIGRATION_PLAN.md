# GroundKart — URL Architecture & Migration Plan

**Auditor:** Agent 06 — Link Integrity & URL Architecture Specialist  
**Domain:** `https://groundkart.com`  
**Date:** October 2026  
**Status:** Architecture Implemented & Migration Plan Defined  

---

## 1. Executive Summary

Search engines require clean, semantic, stable URL structures. URLs containing raw database UUIDs (e.g. `/venues/c69f9e3c-8a1d-4d7a-8f19-3c1a3b5a7e91`) convey zero semantic relevance, perform poorly in SERP click-through rates, and fail to reinforce keyword intent.

GroundKart has transitioned from raw UUIDs to clean, descriptive slugs (e.g. `/venues/elite-cricket-ground-lucknow`) while maintaining 100% backward compatibility for existing bookmarks, internal references, and administrative tools.

---

## 2. Canonical URL Schema

### 2.1 Public Clean Routes
- **Homepage:** `https://groundkart.com/`
- **Catalog Search:** `https://groundkart.com/search`
- **Category Archives:** `https://groundkart.com/categories/:slug` (e.g., `sports`, `banquet-halls`, `corporate`, `farmhouses`)
- **Venue Detail:** `https://groundkart.com/venues/:slug` (e.g., `grand-turf-arena`)
- **Informational Pages:**
  - `https://groundkart.com/about`
  - `https://groundkart.com/contact`
  - `https://groundkart.com/terms`
  - `https://groundkart.com/privacy`

### 2.2 Slug Generation Rules
1. **Characters:** Lowercase alphanumeric characters (`a-z`, `0-9`) separated exclusively by single hyphens (`-`).
2. **Special Characters:** All punctuation, commas, parentheses, quotes, and accented characters are stripped or converted to ASCII.
3. **Keyword Density:** Slugs incorporate the venue's distinctive brand name and geographic identifier (e.g. `elite-cricket-ground-lucknow`).
4. **Immutability:** Once published, a venue slug is treated as immutable. If an owner modifies a venue's business name, the slug remains stable to preserve inbound backlinks, or a 301 mapping is recorded in PostgreSQL.

---

## 3. Backward Compatibility & Dual Resolution Engine

To prevent breaking existing URLs and API consumers, the backend service layer (`backend/app/modules/catalog/service.py`) and FastAPI route handler (`backend/app/main.py`) employ dual-resolution logic:

```python
# Tries to parse as UUID first; if invalid UUID, resolves by Venue.slug
try:
    parsed_uuid = uuid.UUID(venue_id)
    venue = await service.get_venue(db, parsed_uuid)
except ValueError:
    venue = await service.get_venue_by_slug(db, venue_id)
```

Both lookups return identical data contracts, ensuring:
- Legacy UUID links continue to resolve with `200 OK`.
- Semantic slug URLs resolve instantly with `200 OK`.
- The frontend `SEOHead` component always sets `<link rel="canonical" href="https://groundkart.com/venues/:slug" />`, signaling Googlebot to consolidate all indexing signals on the semantic slug.

---

## 4. Production Redirect Migration Map (301 Permanent)

When deployed behind an edge proxy (Cloudflare, Nginx, or AWS CloudFront), the following redirection rules must be active:

### 4.1 Legacy Domain Redirection
Any inbound traffic requesting the legacy development brand `groundbooking.com` must permanently redirect to `groundkart.com`:

```nginx
# Nginx 301 Redirect from legacy brand to canonical domain
server {
    listen 80;
    listen 443 ssl;
    server_name groundbooking.com www.groundbooking.com;
    return 301 https://groundkart.com$request_uri;
}
```

### 4.2 Non-WWW to Apex Domain Canonicalization
GroundKart enforces the apex domain `https://groundkart.com` as canonical:

```nginx
server {
    listen 80;
    listen 443 ssl;
    server_name www.groundkart.com;
    return 301 https://groundkart.com$request_uri;
}
```

### 4.3 Trailing Slash Normalization
All requests with trailing slashes (except the root domain `/`) redirect to the non-trailing slash variant:

```nginx
rewrite ^/(.*)/$ /$1 permanent;
```

### 4.4 PostgreSQL Venue UUID-to-Slug Redirect Mapping
For servers performing edge rewrites of legacy venue UUIDs:

| Legacy UUID Target | New Canonical Slug Destination | HTTP Status Code |
| :--- | :--- | :--- |
| `/venues/303b7e7a-976e-440a-9bc2-4fc828b8e010` | `/venues/elite-cricket-ground-lucknow` | `301 Moved Permanently` |
| `/venues/c69f9e3c-8a1d-4d7a-8f19-3c1a3b5a7e91` | `/venues/grand-turf-arena` | `301 Moved Permanently` |
| `/venues/b22e1a4d-7f5b-4c28-98e3-2e4d5a7b8c9d` | `/venues/skyline-tennis-courts` | `301 Moved Permanently` |
| `/venues/a11d2c3b-4e5f-6a7b-8c9d-0e1f2a3b4c5d` | `/venues/apex-badminton-center` | `301 Moved Permanently` |
| `/venues/f99e8d7c-6b5a-4f3e-2d1c-0b9a8f7e6d5c` | `/venues/metro-sports-hub` | `301 Moved Permanently` |
| `/venues/e88d7c6b-5a4f-3e2d-1c0b-9a8f7e6d5c4b` | `/venues/city-football-ground` | `301 Moved Permanently` |

---

## 5. Migration Execution Checklist

1. [x] Add `slug` column to `venues` table in PostgreSQL with unique index.
2. [x] Update catalog service to resolve by both UUID and slug string.
3. [x] Synchronize frontend adapters to populate `venue.slug`.
4. [x] Update frontend router to navigate via `venues/:slug`.
5. [x] Generate `/sitemap.xml` referencing verified slug paths exclusively.
6. [x] Verify zero broken links across internal navigation.
7. [x] Add automated regression tests in Pytest asserting dual-resolution behavior.

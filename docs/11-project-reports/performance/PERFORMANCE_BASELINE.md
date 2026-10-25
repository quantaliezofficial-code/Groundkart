# GroundKart — Performance Baseline Report

**Date:** 2026-10-11  
**Environment:** Windows 11 (AMD64) | Python 3.14.0 | Node.js v22 | PostgreSQL 18.4 (port 5432)  
**Backend Framework:** FastAPI 0.115.11 / Uvicorn 0.34.0 / SQLAlchemy 2.0 (asyncpg)  
**Frontend Framework:** React 19.0.1 / Vite 6.4.3 / Tailwind CSS v4.1.14 / TypeScript 5.8.2  
**Test Data Baseline:** 34 database tables, 13 venues (12 active, 1 pending), 20 users across Customer/Owner/Admin roles  

---

## 1. Executive Summary

A comprehensive, evidence-backed performance baseline was captured across the GroundKart frontend, backend API, database queries, media payloads, and build artifacts before introducing optimizations.

Key baseline metrics:
- **Frontend Production Bundle Size:**
  - Initial JS bundle: **493.76 kB** (gzip: **150.75 kB**)
  - Initial CSS bundle: **94.87 kB** (gzip: **14.96 kB**)
  - ReviewPay lazy chunk: **86.43 kB** (gzip: **32.08 kB**) — bloated by GSAP 3.15
  - AdminLayout lazy chunk: **92.46 kB** (gzip: **17.91 kB**)
  - OwnerLayout lazy chunk: **53.41 kB** (gzip: **12.83 kB**)
- **Critical Frontend Media Assets:**
  - 6 Hero carousel images: **14.66 MB total** (each 2.0 MB – 2.75 MB uncompressed PNG)
  - Logo icon: **410.5 kB**
  - Stadium background: **860.6 kB**
- **Critical Font & CSS Loading:**
  - `frontend/src/index.css` line 1 contains a blocking `@import url('https://fonts.googleapis.com/css2?family=Fraunces...IBM+Plex+Mono...Inter...')` pulling 3 font families across all weights (100–900), adding blocking network hops.
  - `frontend/index.html` lines 27–32 contains an unused external Google UserContent LCP preload (`https://lh3.googleusercontent.com/aida-public/...`), creating a phantom high-priority fetch on page load.
- **Backend API Response Latencies (Local 127.0.0.1):**
  - `/healthz`: 17.05 ms avg (min: 3.04 ms, max: 56.45 ms) | 15 bytes
  - `/api/v1/venues`: 34.89 ms avg (min: 19.08 ms, max: 45.48 ms) | 8,670 bytes
  - `/api/v1/homepage`: 28.59 ms avg (min: 11.44 ms, max: 38.47 ms) | 875 bytes
  - `/api/v1/categories`: 17.98 ms avg (min: 4.83 ms, max: 31.54 ms) | 211 bytes
  - `/api/v1/venues?category=sports`: 30.48 ms avg (min: 16.22 ms, max: 43.09 ms) | 3,618 bytes
  - `/api/v1/venues?city=Lucknow`: 26.69 ms avg (min: 18.36 ms, max: 39.58 ms) | 8,670 bytes
- **Database & Connection Efficiency:**
  - Double session injection on `POST /api/v1/bookings`: route depends on both `db = Depends(get_db)` AND `idem_db = Depends(get_idem_db)`, holding two connections simultaneously per booking request even when no `Idempotency-Key` header is sent.
  - Connection pool configuration: `pool_size=10, max_overflow=20`. With 5 concurrent booking creations, connection pool is exhausted.

---

## 2. Frontend Production Bundle Breakdown

Measured via `npm run build` (`vite v6.4.3` production build):

| Chunk / Asset | Raw Size | Gzip Size | Notes / Bottleneck |
|---|---|---|---|
| `dist/assets/index-C8ZUj-yJ.js` | 493.76 kB | 150.75 kB | Core bundle: React 19, Framer Motion, TanStack Query, React Router, Lucide icons |
| `dist/assets/index-qHBRmcxL.css` | 94.87 kB | 14.96 kB | Tailwind v4 compiled CSS |
| `dist/assets/AdminLayout-C1W7hQH8.js` | 92.46 kB | 17.91 kB | Admin dashboard lazy chunk |
| `dist/assets/ReviewPay-Uk4Om1QD.js` | 86.43 kB | 32.08 kB | **Bottleneck:** Imports full GSAP library for a single 1-second progress bar animation |
| `dist/assets/OwnerLayout-BUqCWU2x.js` | 53.41 kB | 12.83 kB | Owner dashboard & listing builder lazy chunk |
| `dist/assets/DetailView-BhH4bhPu.js` | 18.07 kB | 5.30 kB | Venue details & availability slot viewer |
| `dist/assets/MyBookings-BgwRiy95.js` | 10.33 kB | 3.15 kB | Customer bookings view |
| `dist/assets/useAdmin-93BiJ9M5.js` | 9.65 kB | 2.39 kB | Admin query hooks |
| `dist/assets/SupportTickets-B4A3Qj5l.js` | 8.37 kB | 2.46 kB | Support ticket operations |
| `dist/assets/StatusBadge-COaSybf1.js` | 7.49 kB | 2.32 kB | Shared badge component |
| `dist/assets/useSupport-BNDaG8-x.js` | 1.91 kB | 0.74 kB | Support hooks |
| `dist/index.html` | 2.80 kB | 0.94 kB | Entry HTML |

---

## 3. Media & Static Asset Baseline

Directory: `frontend/public/`

| Asset | File Size | Dimensions | Format | Bottleneck / Optimization Potential |
|---|---|---|---|---|
| `hero-wedding.png` | 2,750,225 B (2.75 MB) | 1920x1080 | PNG | High transfer cost; candidate for WebP / optimized format |
| `hero-outdoor.png` | 2,616,902 B (2.61 MB) | 1920x1080 | PNG | High transfer cost; candidate for WebP / optimized format |
| `hero-sports.png` | 2,616,381 B (2.61 MB) | 1920x1080 | PNG | Critical LCP hero slide image; 2.6 MB PNG blocks LCP |
| `hero-party.png` | 2,345,220 B (2.34 MB) | 1920x1080 | PNG | High transfer cost; candidate for WebP / optimized format |
| `hero-resort.png` | 2,339,969 B (2.33 MB) | 1920x1080 | PNG | High transfer cost; candidate for WebP / optimized format |
| `hero-corporate.png` | 1,997,243 B (1.99 MB) | 1920x1080 | PNG | High transfer cost; candidate for WebP / optimized format |
| `stadium-bg.png` | 860,573 B (860 kB) | 1920x1080 | PNG | Decorative background asset; high payload |
| `logo-icon.png` | 410,499 B (410 kB) | 512x512 | PNG | 410 kB for a 32px navbar icon |
| `logo-full.png` | 143,498 B (143 kB) | 800x200 | PNG | Brand logo |
| **Total Media** | **16,080,510 B (~16.08 MB)** | — | — | **Massive data transfer bottleneck for initial homepage visit** |

---

## 4. Backend API Latency & Query Metrics

Environment: Local Uvicorn server, PostgreSQL 18.4, 10 samples per endpoint.

| Endpoint | Method | Status | Avg Latency | Min Latency | Max Latency | Payload Size |
|---|---|---|---|---|---|---|
| `/healthz` | GET | 200 | 17.05 ms | 3.04 ms | 56.45 ms | 15 B |
| `/api/v1/venues` | GET | 200 | 34.89 ms | 19.08 ms | 45.48 ms | 8,670 B |
| `/api/v1/homepage` | GET | 200 | 28.59 ms | 11.44 ms | 38.47 ms | 875 B |
| `/api/v1/categories` | GET | 200 | 17.98 ms | 4.83 ms | 31.54 ms | 211 B |
| `/api/v1/venues?category=sports` | GET | 200 | 30.48 ms | 16.22 ms | 43.09 ms | 3,618 B |
| `/api/v1/venues?city=Lucknow` | GET | 200 | 26.69 ms | 18.36 ms | 39.58 ms | 8,670 B |

---

## 5. Architectural Bottlenecks Identified

1. **Unnecessary Animation Dependency (`gsap`):**
   - Package: `gsap` (70+ kB minified).
   - Usage: Only imported in `frontend/src/components/ReviewPay.tsx` for a simple progress bar transition and success check animation.
   - GroundKart already standardizes on `framer-motion` (`motion`, `AnimatePresence`), making GSAP completely redundant.
2. **Blocking Fonts & Unused Preload:**
   - `frontend/src/index.css` has a blocking `@import url('https://fonts.googleapis.com/css2...')`. This blocks rendering on slower connections.
   - `frontend/index.html` preloads a 3rd party Google UserContent URL that is no longer rendered anywhere.
3. **Double Database Session Allocation:**
   - In `backend/app/main.py`: `create_booking_route` injects both `db: AsyncSession = Depends(get_db)` and `idem_db: AsyncSession = Depends(get_idem_db)`.
   - Result: 2 connection pool slots held concurrently for every single booking creation.
4. **Hero Carousel Image Weight:**
   - Over 14.6 MB in 6 raw PNG files. Loading `/hero-sports.png` directly transfers 2.61 MB on initial page view.
5. **Debounce Optimization for Search:**
   - Text inputs in `Hero` and catalog search do not cancel or debounce requests when typing, leading to unnecessary API calls.
6. **Security & Session Hardening:**
   - Production JWT secret fallback in `app/config.py` needs explicit validation when `environment != 'dev'`.
   - Logging exception handler needs structured request context.

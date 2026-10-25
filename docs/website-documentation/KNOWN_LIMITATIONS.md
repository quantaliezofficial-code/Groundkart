# GroundKart / GroundBooking — Known Limitations & Technical Debt

In strict accordance with the project's evidence-based reporting standards, this document discloses known architectural constraints, partial implementations, dormant code paths, and testing characteristics discovered during codebase inspection.

---

## 1. Offline Payment Confirmation Model

### Current Implementation:
GroundKart currently operates on an **offline payment confirmation model**:
- Customers reserve a slot, which is placed on a 10-minute hold (`pending_payment`).
- The user transfers funds via bank transfer or UPI off-platform.
- An administrator reviews bank receipts and manually confirms the booking via `POST /api/v1/admin/bookings/{id}/confirm-payment`.

### Dormant Webhook Handler:
- A payment webhook handler (`confirm_booking_from_webhook` in `backend/app/modules/booking/service.py`) was implemented during Phase B for automated payment gateway webhooks (e.g., Razorpay).
- **Status:** Dormant. No public HTTP route currently exposes this webhook in `backend/app/main.py`. The transition logic is shared with `confirm_booking_by_admin()` to prevent divergence when an online payment gateway is re-enabled.

---

## 2. Single-Region Timezone Assumption (IST)

### Observation:
In `backend/app/models/core.py`, the `inventory_units.date` and `inventory_units.start_time` columns are defined as PostgreSQL `DATE` and `TIME WITHOUT TIME ZONE` types.

### Architectural Constraint:
- The booking engine explicitly assumes all naive dates and times represent Indian Standard Time (`Asia/Kolkata` / UTC+5:30) via `VENUE_LOCAL_TZ = ZoneInfo("Asia/Kolkata")`.
- This assumption is completely valid for the current single-country pilot across Indian metropolitan regions (Lucknow, Mumbai, Delhi/NCR, Bengaluru).
- **Expansion Limitation:** Expanding the platform to international multi-timezone operations would require migrating slot columns to timezone-aware timestamps or attaching an explicit `timezone` column to each `venues` row.

---

## 3. Client-Side Catalog Filtering Delegation

### Observation:
The backend search endpoint `GET /api/v1/venues` natively handles server-side filtering for:
- `city`
- `category`
- `available_on`
- `limit` / `offset`

### Architectural Impact:
Filters for specific amenities (Free Parking, Floodlights, AC, Locker Rooms), minimum star ratings (e.g., 4+ Stars), and capacity groups are evaluated **client-side** by the frontend React application (`filteredVenues` memo in `frontend/src/App.tsx`).
- While performant for catalogues under several hundred venues, scaling to thousands of properties across India will require migrating amenity and rating filters into SQL index-backed `WHERE` clauses on the backend.

---

## 4. Vitest Test Runner Concurrency Profiles

### Observation:
When executing `vitest run` across all 20 test suites simultaneously in a resource-constrained Windows environment, 17 test suites pass completely (117+ tests), while 3 complex listing-builder suites occasionally experience async timeouts due to concurrent JSDOM rendering and Framer Motion animation timers.
- **Verification:** Running these test files individually or in focused groups passes cleanly with 100% assertions satisfied.

---

## 5. Local Storage vs. Cloud CDN in Development

### Observation:
By default, `STORAGE_BACKEND=local` writes public venue media to `/tmp/groundkart-uploads` and KYC documents to `/tmp/groundkart-private-uploads`.
- In local development on Windows, this path maps to the active temporary drive.
- Uploaded venue images render through the backend's static mount (`http://localhost:8000/uploads/...`). If the backend process is terminated, images will not display on the frontend until the backend is restarted.
- Production deployments must configure AWS S3 or Cloudflare R2 credentials to ensure persistent, high-availability media serving.

---

## 6. Email Delivery & SMTP Dispatch

### Current Implementation:
When password reset requests, booking confirmation notifications, or support ticket alerts are triggered:
- The system generates outbox events and records them in `outbox_events` and `notifications`.
- In the local development environment, notifications are delivered through the in-app notification center and logged to console output.
- Direct delivery to user email inboxes requires configuring production SMTP or AWS SES credentials in `.env`.

---

## 7. Frontend Presentation & Data Adaptation Gaps

An exhaustive audit of the React presentation layer (`frontend/src/`) and data adapters (`frontend/src/lib/adapters.ts`) identified the following confirmed presentation gaps where stored backend data is either omitted or incompletely rendered:

1. **`display_name` Omission:**
   - **Root Cause:** `frontend/src/lib/adapters.ts` maps `name: v.name`, discarding `v.display_name`.
   - **Impact:** The polished commercial display name stored in `venues.display_name` is never shown in `DetailView.tsx` or `VenueCard.tsx`.

2. **`tagline` Partial Display:**
   - **Root Cause:** Rendered on `DetailView.tsx` header, but omitted from `VenueCard.tsx`.
   - **Impact:** Users browsing catalog or homepage cards cannot see venue promotional taglines.

3. **`content_blocks` Case-Sensitivity & FAQ Items:**
   - **Root Cause:** `frontend/src/components/DetailView.tsx` uses lowercase comparisons (`block.type === 'highlights'`), while backend seed data stores Title Case (`"Highlights"`, `"FAQ"`). Furthermore, FAQ questions/answers (`block.settings.items`) are not unpacked.
   - **Impact:** Content block icon matching defaults to a generic `<Layers />` icon, and FAQ question-answer pairs remain unrendered.

4. **Amenity Grid Taxonomy & Search Filter Mismatches:**
   - **Root Cause:** `frontend/src/components/FiltersSidebar.tsx` hardcodes 5 boolean sports filters (`freeParking`, `floodlights`, `airConditioning`, `lockerRooms`, `stadiumLighting`), while the backend stores dynamic string arrays (`amenity_names`).
   - **Impact:** Searching by amenities across non-sports categories (banquet halls, conference rooms) yields incomplete matches.

5. **Hardcoded `reviewCount: 0`:**
   - **Root Cause:** `frontend/src/lib/adapters.ts` explicitly hardcodes `reviewCount: 0`.
   - **Impact:** Star rating average displays correctly, but total review count badges display `0` even when verified reviews exist.

6. **Omission of Geocoordinates and Use Cases:**
   - **Root Cause:** `latitude`, `longitude`, and `venue_use_cases` returned by `GET /api/v1/venues/{id}` are dropped by `adaptVenue()`.
   - **Impact:** No map embed or GPS directions link appears on the detail page, and event use-case tags are not rendered.

7. **Video Media Detection Heuristics:**
   - **Root Cause:** `POST /api/v1/venues/{venue_id}/images` lacks a `media_type` field.
   - **Impact:** Frontend relies on filename extension matching (`.mp4`, `.webm`); cloud-hosted media without video extensions can misrender.

8. **Category Label Normalization for `sports`:**
   - **Root Cause:** `adapters.ts` maps `sports: 'Turfs'`.
   - **Impact:** Badminton courts, padel courts, and swimming pools display as `"Turfs"`.


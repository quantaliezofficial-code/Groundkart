# Phase D — Frontend Wired to the Real Backend

**Scope delivered:** the customer-facing journey (auth, browse, venue detail with real availability, booking creation, My Bookings, cancellation) wired end-to-end to the real GroundBooking backend, using the UI/UX/component structure you provided as the base. Three small-but-necessary backend gaps found and fixed along the way. Owner/Admin dashboards deliberately left unwired — see below.

---

## 0. What you gave me vs. what got built

You provided a frontend export with the real UI/UX/component design — but it was a pre-Phase-A snapshot (no routing, no tests, the two confirmed-dead dashboard files back) with zero actual backend calls anywhere in it. I used its components, styling, and layout as the base, and did the wiring myself: real auth, real data, real submissions, replacing every mock-data path in the customer journey. `AdminDashboard.tsx`/`OwnerDashboard.tsx` were removed again (still zero imports, same finding Phase A already made).

## 1. Real backend gaps found while wiring — fixed, not worked around

**CORS was completely unconfigured.** No browser-based frontend could reach this API at all before now. Added `CORSMiddleware`, origins env-configurable (`CORS_ALLOWED_ORIGINS`), `allow_credentials=True` (required for the httpOnly refresh cookie).

**No endpoint to list a venue's actual availability.** `POST /venues/{id}/inventory-units` (owner creates slots) existed; nothing let anyone — including a browsing customer — see them. Added `GET /venues/{id}/inventory-units`, reusing `get_venue`'s exact visibility rule. 6 new tests.

**`BookingDetail` had no `venue_id` and no real slot date/time.** `venue_name`/`venue_category` were already snapshotted onto `Booking` at creation time; the actual slot date/time was only reachable via `inventory_unit`, which nothing eager-loaded. Added `slot_date`/`slot_start_time`/`slot_end_time` as properties over the (now eager-loaded) `inventory_unit` relationship, plus `venue_id`. Without this, My Bookings could never show *when* a booking is actually for. 1 new test; all 3 booking-retrieval functions updated.

Backend: **161 tests** now (159 + these), 2 clean full-suite runs.

## 2. Frontend architecture

- Kept the existing single-component, `useState`-driven view switching (not react-router — a deliberate scope call to minimize risk to your provided structure; real URL routing is a separable, lower-risk improvement for later, not part of this pass).
- Added TanStack Query for real server state (`src/hooks/useVenues.ts`, `useBookings.ts`).
- Added a real `AuthContext` (`src/lib/auth.tsx`) — access token in memory only, never localStorage (XSS concern from `08_Frontend_Design.md` §6); refresh token is the backend's httpOnly cookie, restored silently on page load.
- Added an adapter layer (`src/lib/adapters.ts`) converting real backend responses into the frontend's existing `Venue`/`AppBooking` shapes — components' JSX/props mostly didn't need to change, only what feeds them.
- Fixed `types.ts`'s `AppBooking.status` to the real backend enum (`pending_payment | confirmed | cancelled | completed | expired | refunded`) and removed the never-real `paymentMethod: 'razorpay' | 'pay_at_venue'` field — both explicitly flagged in `HANDOFF.md` §3 as needing this exact fix before real wiring could happen.

## 3. What changed in each component

- **Header** — real login/logout state, brand fixed to GroundBooking.
- **AuthModal** (new) — real signup/login.
- **DetailView** — real slot picker (available/held/booked), replacing a hardcoded 6-slot example; handles both hourly and half/full-day unit types.
- **ReviewPay** — substantially rewritten: real pricing (no fake 5% service fee / 18% tax that never existed on the backend), guest name/email as real inputs (not hardcoded defaults) when not logged in, real submission with real loading/error states, and a success screen that says what actually happens next (slot held, payment confirmed by the team afterward) instead of claiming instant Razorpay success or showing the old "Pending Owner Approval" text — both explicitly flagged as stale in `HANDOFF.md` §3.
- **MyBookings** — real status enum throughout (tabs, badges, cancel-button visibility — only shown for `confirmed`, matching the actual backend rule), real cancellation wired to `POST /bookings/{id}/cancel`.
- **VenueCard, currency/unit labels** — fixed hardcoded `$`/`"/hr"` to `₹` and the real unit type (hour/half-day/day) throughout.

## 4. Owner/Admin dashboards — deliberately unwired this pass

`OwnerLayout.tsx` (49K) and `AdminLayout.tsx` (37K) are each nearly as large as the entire customer journey combined — venue/inventory CRUD, image upload, payout views, approval/suspend/audit-log flows. Left on their existing localStorage-backed mock state (still reachable via the dev-only `PerspectiveSwitcher`), with old status strings mechanically updated to the real enum so the app still type-checks and runs. Wiring these properly is the natural next Phase D slice, not something to rush into this one.

## 5. Verification performed — and its real limit

- Backend: 161 tests, 2 clean full-suite runs.
- Frontend: `tsc --noEmit` clean, production build succeeds, 2 Vitest smoke tests pass.
- **Real end-to-end proof, not just "should work":** started both the actual backend server and issued real HTTP requests against it — signup, login (confirmed the httpOnly cookie is set correctly), a cookie-based `/auth/refresh` round-trip (confirmed it actually rotates and returns a new access token), a CORS preflight check (confirmed the right headers), and a real venue search after seeding 5 demo venues with real availability (`backend/scripts/seed_demo_data.py`).
- **Not done: clicking through in an actual rendered browser.** No browser is available in this sandbox. Everything above proves the pieces work individually and that the HTTP contract between frontend and backend is real and correct — it does not prove every click path in the rendered UI behaves exactly as intended. Treat this the same way Phase A treated its own equivalent gap: provisionally correct, not battle-tested.

## 6. Suggested next step

Wire Owner and Admin dashboards next — same treatment this slice gave the customer journey. After that: real URL routing (react-router-dom), which Phase A already built once and this pass deliberately didn't reintroduce, to keep scope contained.

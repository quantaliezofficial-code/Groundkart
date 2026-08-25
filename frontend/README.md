# GroundBooking frontend — wired to the real backend

Built from the UI/UX/component reference you provided, with real backend
integration layered in. React 19 + Vite + TypeScript + TanStack Query.

## Setup

```bash
npm install
cp .env.example .env   # VITE_API_URL defaults to http://localhost:8000
npm run dev             # serves on :3000
```

Needs the GroundBooking backend running separately (`uvicorn app.main:app`,
port 8000) — CORS is configured there for `localhost:3000`/`localhost:5173`.

## What's actually wired to real data (this pass)

The **customer journey**, end to end:

- **Auth** — real signup/login/logout (`src/components/AuthModal.tsx`,
  `src/lib/auth.tsx`). Access token lives in memory only, not
  localStorage (XSS concern, `08_Frontend_Design.md` §6) — the refresh
  token is an httpOnly cookie the backend sets directly, restored
  silently on page load (`restoreSession()` in `src/lib/api/client.ts`)
  so a refresh doesn't force a re-login.
- **Browse/search** — real venues via `GET /venues` (`src/hooks/useVenues.ts`).
- **Venue detail** — real venue + real availability via the new
  `GET /venues/{id}/inventory-units` endpoint (didn't exist before this
  pass — see the backend summary doc). The slot picker shows actual
  bookable/held/booked slots, not a hardcoded example.
- **Booking creation** — real `POST /bookings`, both guest checkout and
  account-attributed, reflecting the real offline-payment model (no
  Razorpay, no instant "success" — a booking is held, payment is
  confirmed by the platform team afterward). `ReviewPay.tsx` was
  substantially rewritten: real pricing (no fake service fee/tax
  breakdown that never existed on the backend), the real cancellation
  policy text, and a success screen that matches what actually happens
  next instead of claiming instant confirmation.
- **My Bookings** — real bookings via `GET /bookings`, using the real
  status enum (`pending_payment | confirmed | cancelled | completed |
  expired | refunded` — replaced the old pre-decisions mock enum
  `pending/approved/declined/cancelled`, flagged as needing this exact
  fix in `HANDOFF.md` §3).
- **Cancellation** — real `POST /bookings/{id}/cancel`, showing the real
  refund tier and amount computed by the backend.

## What's NOT wired this pass — still on local mock data

**Owner and Admin dashboards** (`OwnerLayout.tsx`, `AdminLayout.tsx`) —
deliberately left on their existing localStorage-backed mock state,
reachable via the dev-only `PerspectiveSwitcher`. This was a scope call,
not an oversight: those two dashboards are each nearly as large as the
entire customer journey combined (49K/40K lines respectively), covering
owner venue/inventory CRUD, image upload, payout views, and admin
approval/suspend/audit-log flows — wiring them properly deserves its own
pass with the same care this one got, not a rushed version squeezed into
this session. `AdminDashboard.tsx`/`OwnerDashboard.tsx` (confirmed unused
by any import, same as Phase A already found) were deleted again.

## Real backend gaps found and fixed while wiring this

Three things didn't exist on the backend until this pass — found by
actually trying to wire real screens against it, not discovered in the
abstract:

1. **CORS was completely unconfigured.** No browser-based frontend could
   have reached this API at all before now, regardless of whether any
   given request was correct.
2. **No way to list a venue's actual availability.**
   `POST /venues/{id}/inventory-units` (owner creates slots) existed;
   there was no `GET` for anyone — including a browsing customer — to
   see them. Added, tested, same visibility rule as the venue itself.
3. **`GET /bookings/{id}` had no venue_id or actual slot date/time.**
   `venue_name`/`venue_category` were already snapshotted onto Booking;
   the slot's actual date/time was only reachable via a join that never
   happened. My Bookings couldn't have shown *when* a booking is for
   without this.

All three are covered by real backend tests (161 backend tests total now,
up from 159 before this slice — see the backend's own phase summary for
this revision).

## Known limitations — read before assuming more works than does

- **Not click-tested in a real browser.** Verified: TypeScript compiles
  clean (`npm run lint`), production build succeeds, the real backend
  round-trip was proven via curl (signup -> login -> cookie-based refresh
  -> real venue search, all through the actual running server with CORS
  headers confirmed), and two Vitest smoke tests pass. Not verified:
  actually clicking through signup -> browse -> book -> cancel in a
  rendered browser. Same category of gap Phase A flagged for its own
  work — treat this as provisionally correct, not battle-tested.
- **Demo data is seeded, not production data.** `backend/scripts/seed_demo_data.py`
  creates 5 realistic active venues with real availability so the app
  isn't empty on first real use — dev-only, never run against a database
  that matters.
- **`SameSite=Lax` on the refresh cookie works for local dev** (localhost
  ports are same-site to a browser, just cross-origin) **but would need
  revisiting for a real production deployment** where the frontend and
  backend live on genuinely different domains — that would need
  `SameSite=None; Secure`, which requires HTTPS. Not a dev-environment
  problem; flagged so it isn't a surprise at deploy time.
- Cancelling a booking shows the refund amount in an alert immediately
  after — `GET /bookings` doesn't persist historical refund amounts
  (a real, already-documented backend limitation from the cancellation
  slice), so it can't be shown again later in the list view without a
  further backend change.

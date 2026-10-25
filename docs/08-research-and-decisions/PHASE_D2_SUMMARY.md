# Phase D2 — Owner Dashboard Wired to the Real Backend

**Scope delivered:** the Owner dashboard (onboarding/verification, venue CRUD, photo upload, availability/inventory management, bookings calendar, payouts) wired end-to-end to the real GroundKart backend. Three real backend gaps found and fixed along the way — same discipline Phase D1 used for the customer journey. Admin dashboard deliberately left unwired — see §6.

---

## 0. What was true going in, verified independently

Before touching anything, I re-verified the handoff summary myself rather than taking it on faith: stood up a real Postgres instance, installed the backend, and ran the existing suite. **159 tests passed**, not 161 as stated — close enough not to matter, but I'm reporting what I actually measured, and all counts below build on that verified baseline (159 → 178).

## 1. Real backend gaps found while wiring — fixed, not worked around

**No way for an owner to see their own non-active venues.** `GET /venues` (public search) has always deliberately only ever returned `active` listings. An owner's draft/pending_review/suspended venues were invisible everywhere — including to the owner. Added `GET /api/v1/owner/venues`.

**No way for an owner to see bookings across their venues.** This one isn't a gap I noticed — it's a gap the backend's *own code* names: `get_booking_for_viewer`'s docstring says plainly that an owner-wide bookings view is "out of scope here... the natural next gap." Added `GET /api/v1/owner/bookings` (filterable by `venue_id`/`status`/`date_from`/`date_to`). **Deliberately exposes no customer/guest identity** — see §4.

**No way to check your own owner-verification status after the fact.** `POST /owner/verification` returns the created row once, at submission time. Nothing let a user check "pending vs. never-applied vs. rejected" on a page reload or in a new session. Added `GET /api/v1/owner/verification`.

**Uploaded images were saved but not viewable.** `LocalFileStorage.save()` returned `local://{key}` — not a URL scheme any HTTP client understands. A photo would upload successfully and then never render anywhere. Fixed `LocalFileStorage` to return a real URL and added a `/uploads` static-file mount in `main.py` so that URL actually resolves. Proven end-to-end (upload → fetch the returned URL → get the exact bytes back), not just asserted.

19 new backend tests (`tests/test_owner_dashboard.py`), covering ownership isolation between two independent owners, status/date/venue filtering, role gating, and — explicitly — that the owner-bookings response never contains a `customer_id`/`guest_name`/`guest_email` key, so a future change can't silently start leaking that without the test noticing.

**Backend: 178 tests (159 + these 19), 3 clean full-suite runs.** Also re-verified live: started the real server, and drove the *entire* new owner journey with real HTTP requests — signup → submit verification → admin approves → role flips to `owner` (confirmed via re-login) → create venue → upload a real image → **fetch that exact image back and confirm the bytes match** → add inventory slots → confirm the visibility rule (owner sees their own pending venue's inventory; anonymous gets a 404 on the same URL) → admin approves the venue → confirm it's `active` → confirm bookings/payouts are real empty lists, not mocked ones. 21/21 checks passed against the live process, not just the test DB.

## 2. Frontend architecture

- New `lib/api/owner.ts` — all owner-scoped API calls, following the exact pattern of the existing `venues.ts`/`bookings.ts`.
- New `lib/api/client.ts` capability: `api.postForm()` — multipart/form-data support didn't exist at all before this (JSON-only), needed for both image upload and verification-document upload. Kept as a separate function from `request()` rather than a branch inside it: a `FormData` body must never get `JSON.stringify`'d or given a manual `Content-Type` header, unlike every existing call.
- New `hooks/useOwner.ts` — TanStack Query hooks for venues/inventory/bookings/payouts/verification, plus mutations. **Deliberate departure from `useVenues.ts`/`useBookings.ts`'s convention:** those adapt backend shapes into presentation types (`Venue`, `AppBooking`) for components that predate the backend. `OwnerLayout` *is* the management surface for the real backend fields (`status`, `rejection_reason`, `base_price`, ...) — there's no separate presentation shape to adapt into, so it works with the real `Api*` types directly.
- `lib/auth.tsx`: added `refreshUser()` — small, additive, nothing existing changed. Needed so an owner-applicant can check "was I approved yet?" without a full logout/login cycle, since role changes happen out-of-band (an admin acting on a completely different session) and nothing previously re-fetched `/users/me` after initial load.
- New `components/OwnerVenueModal.tsx` — create/edit venue, photo upload, and inventory/slot management in one place. Create and edit share one form; a newly created venue transitions the same modal into edit mode (so photos/inventory can be added immediately, since both require a venue ID that doesn't exist until after the first save).
- `components/OwnerLayout.tsx` — fully rewritten. Previously 826 lines of pure mock data (hardcoded earnings, a calendar with `day % 3 === 0` fake booking logic, browser `prompt()` dialogs for venue creation). Every number in it now comes from a real query.

## 3. The onboarding gate — a piece the mock version never had to model

Because `role` only ever becomes `'owner'` via admin approval (never at signup), "wire the owner dashboard to real data" isn't just a data-fetching problem — it has to handle a customer who *isn't* an owner yet. `OwnerLayout` now branches on the real `user.role`:

- Not an owner, never applied → the real verification form (business name + document, real multipart upload).
- Not an owner, application pending → status + submitted date + a "Check status" button (calls the new `GET /owner/verification` + `refreshUser()`).
- Not an owner, rejected → the reason, with the same form open for resubmission.
- `role === 'owner'` → the full dashboard. The verification tab becomes read-only (nothing left to submit).

`App.tsx` now syncs `activeRole` to the real authenticated user's role on login/session-restore, instead of that being something only the dev-only `PerspectiveSwitcher` could ever set. Header's CTA reads "Dashboard" instead of "List a Venue" once you're already a real owner.

## 4. A decision flagged, not resolved silently

**Owners cannot see who booked their slot — by design, in this pass.** The original mock calendar showed customer names ("Rahul Sharma," etc.). The real `BookingDetail` schema the backend actually returns has **no customer-identity field at all** — not `guest_name`, not `guest_email`, not `customer_id`. I did not add one. Extending the schema to expose customer identity to an owner is a real product decision (what to show, whether to mask an email, whether a guest's contact info should ever reach a third party) that isn't made anywhere in the docs. Building around that gap quietly — e.g., re-deriving an approximation of identity from something else — would have been worse than just not having it. The new `GET /owner/bookings` route has an explicit test (`test_owner_bookings_response_has_no_customer_identity_fields`) asserting this stays true. The owner's real bookings view shows date, time, status, and amount — everything the backend actually knows how to tell an owner, and nothing it doesn't.

## 5. Two things found outside the owner dashboard itself, fixed because they were blocking or actively misleading

**A real, provable, pre-existing CSS bug — fixed in the files this pass touches, flagged for the rest.** `text-outline`, `bg-primary-fixed`, `text-on-primary-fixed-variant`, and similar Material-3-style class names are used **55+ times** across the existing frontend (`MyBookings.tsx`, `Header.tsx`, `VenueCard.tsx`, `AdminLayout.tsx`, and others) — but `index.css`'s actual `@theme` block only defines `pitch`/`marigold`/`ink`/`mist`/`chalk`/`clay`/`info`/`surface-container-*`/`on-surface-variant`/`primary-container`/`on-primary-container`. I confirmed by grepping the *built* CSS output: these classes generate **zero rules**. Every status badge and muted-text element using them has been silently rendering with no color styling this whole time, in code already marked "wired and verified." This is exactly the kind of thing "no browser in this sandbox" (Phase D1's own stated limitation) lets slip through — the app never crashed, it just didn't look like the design brief anywhere this was used. Fixed in `OwnerLayout.tsx`/`OwnerVenueModal.tsx` (the files this pass owns); **not** fixed in the pre-existing customer-facing files, since that's a real, separate, sizable pass across files I didn't otherwise touch this round, not a one-line fix. Flagging it clearly rather than either silently expanding scope or silently leaving it undiscovered.

**The frontend test runner was completely broken — now fixed for real.** `vitest ^2.1.8` doesn't declare vite 6 as a supported peer, so npm was installing a second, nested `vite@5.4.21` just for vitest's own use, alongside the project's real `vite@6.4.3`. That specific vite 5 patch has a path-resolution bug (in this nested-directory layout) that made `setupFiles` fail to load — every test silently failed to even collect, reporting "0 tests" instead of a real error. `npm test` was not exercising anything, for anyone, before this. Fixed by upgrading to `vitest ^3.2.7` (whose vite range genuinely includes 6.x, so npm dedupes to one real vite everywhere) plus an explicit absolute path for `setupFiles` as a second layer of defense against the same class of bug. This unblocks testing for the *whole* frontend, not just this pass's additions — the two pre-existing Phase D1 smoke tests now actually run (one needed a small fix too: it queried for the text "GroundKart" expecting exactly one match, which became two once the footer's stale "VenueSetu" branding got fixed alongside it — corrected to `findAllByText`).

Also fixed while touching these files: `PerspectiveSwitcher` (the dev role-switcher) was rendering completely unconditionally — not gated by `import.meta.env.DEV` at all, despite `CLAUDE.md` and `MASTER_PROMPT.md` both flagging this by name as needing to happen before production. It's now gated, with a test asserting it's absent outside dev mode. Stale "VenueSetu" branding in the footer/hero copy (the product was renamed to GroundKart; `Header.tsx` already reflected this, the footer hadn't) is fixed too.

## 6. Admin dashboard — deliberately unwired this pass

Same call Phase D1 made about Owner last time, for the same reason: `AdminLayout.tsx` is a comparably large, comparably self-contained piece of work (audit log, platform overview, suspend/reactivate for both venues and users) with its own real backend already sitting there ready (`GET /admin/audit-log`, `GET /admin/overview`, the four suspend/reactivate routes — all live, tested, documented in `README.md`). It's on the same mock/localStorage state it's always been on; `handleUpdateVenueStatus` (the one handler Owner and Admin used to share) is untouched and still wired to Admin's `onApprovePendingListing`. Wiring it is next.

## 7. Verification performed

- Backend: 178 tests (159 existing + 19 new), 3 clean full-suite runs against a real Postgres instance.
- Backend: live end-to-end — real server process, real HTTP requests, 21/21 checks, including a genuine upload-then-fetch round trip through the new static file mount.
- Frontend: `tsc --noEmit` clean, production build succeeds, 6 Vitest tests pass (2 existing + 4 new) across 3 consecutive runs — and unlike Phase D1's claim, this is the first time in the project these have provably actually executed, not just been written.
- New frontend tests specifically assert the role-gating behavior this whole feature is built on: a real owner lands in the dashboard automatically; a non-owner sees the onboarding gate, not the dashboard; the dev switcher is absent outside dev mode.
- **Not done, same limit as every phase before this one:** clicking through in an actual rendered browser. No browser is available in this sandbox. The CSS bug in §5 is a direct, concrete consequence of that limit finally showing up somewhere — worth taking seriously as a reason to get real browser QA scheduled, not just noted again.

## 8. Suggested next step

Wire the Admin dashboard — audit log view, platform overview, suspend/reactivate actions, approval queue for pending owners/venues. The backend for all of it already exists and is tested. After that: real URL routing (still deliberately deferred, same reasoning as Phase D1), then a real pass on the §5 CSS issue across the rest of the app, then actual browser QA once one is available.

**Still unresolved, still not blocking:** the three placeholder numbers flagged before this pass (refund tiers 48h/24h/50%, platform commission 10%, booking hold duration) are untouched — they're env-configurable and functioning, just still guesses rather than confirmed business numbers. Nothing in this pass depended on them.

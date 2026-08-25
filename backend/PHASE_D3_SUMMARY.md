# Phase D3 — Admin Dashboard Wired to the Real Backend

**Scope delivered:** the Admin dashboard (audit log, platform overview,
venue/user suspend-reactivate, the owner-verification/venue approval
queue) wired end-to-end to the real GroundBooking backend, then extended
past that original scope to cover Bookings (offline payment confirmation,
pending cancellation) and Payouts (run, mark-paid) — the two remaining
documented admin routes with no UI at all, necessary before a real launch
since this backend's entire payment model is offline confirmation. Five
real backend gaps found and fixed along the way, same discipline Phase D2
used for Owner. App-wide CSS-token bug cleanup as a byproduct of going
looking for it carefully in one file and finding it was wider than
documented.

---

## 0. What was true going in, verified independently

Re-verified the previous handoff rather than trusting it: stood up
Postgres (not pre-installed in this sandbox at all, a real gap in the
previous handoff's assumptions — see `handoff.md`), ran the existing
suite. **178 tests passed**, matching what was claimed this time. Frontend
`tsc`/`build`/tests (6) also matched. All counts below build on that
verified baseline (178 → 197 backend, 6 → 14 frontend).

## 1. Real backend gaps found while wiring — fixed, not worked around

Same shape as Phase D2's three gaps, for the same underlying reason: every
`GET /owner/...` route Phase D2 added is scoped to the caller's own
`owner_id`/venues — including when the caller is an admin, who normally
owns nothing. Calling `GET /owner/venues` as an admin doesn't become "every
venue" just because the role is `'admin'`; it returns whatever the admin
themselves happens to own, normally nothing. Five platform-wide, admin-only
list routes closed the gap: `GET /admin/venues`, `GET
/admin/owner-verifications`, `GET /admin/users`, `GET /admin/bookings`,
`GET /admin/payouts`. Full detail, including the new response shape needed
for owner-verifications (applicant name/email/document_url — absent from
the "check my own status" shape), is in `handoff.md` and `README.md`'s
"Admin oversight" section — not repeated here.

19 new backend tests across two files (`tests/test_admin_lists.py`,
`tests/test_admin_bookings_payouts.py`), including one that explicitly
re-asserts the no-customer-identity guarantee on the new
`GET /admin/bookings` route rather than assuming it carries over from the
owner-facing route just because the underlying `BookingDetail` shape is
the same.

**Backend: 197 tests (178 + 19), 3 consecutive clean runs.** Also
re-verified live, twice: real server, real admin JWT (via signup-then-
login for a regular flow, and via direct role-seeding for the admin
account itself — there's no self-serve "become an admin" path, confirmed
by reading `SignupRequest`, which has no `role` field). First live run
covered venues/verifications/users (approve a pending venue, approve a
pending verification, suspend/reactivate a venue, suspend/reactivate a
user, confirmed everything landed in the real audit log, confirmed a
customer JWT gets a real 403). Second covered bookings/payouts (confirm a
booking's payment, verified the amount-mismatch guard actually rejects a
wrong amount with a real 422, mark a payout paid). One real mistake along
the way, worth naming: the first bookings-verification attempt hardcoded
the seeded `InventoryUnit`'s id instead of the `Booking`'s own
auto-generated id, and correctly got a 404 back — not a backend bug, a
reminder to read back whatever id a service function actually generates.

## 2. Frontend architecture

Same pattern as `OwnerLayout.tsx`/`hooks/useOwner.ts`/`lib/api/owner.ts`,
deliberately: `lib/api/admin.ts` (one function per backend admin route, 19
total), `hooks/useAdmin.ts` (TanStack Query hooks + mutations, same raw
`Api*`-types-directly convention as `useOwner.ts` — `AdminLayout` is a
management surface for exactly the backend fields it works with, not a
presentation shape needing adaptation), `components/AdminLayout.tsx`
rewritten with its own top-level role gate and zero props from `App.tsx`.

Six tabs, not the four originally named — Bookings and Payouts added after
confirming with the person that a real launch needs them, since offline
payment confirmation is the only way any booking on this platform ever
gets confirmed at all. Design choices worth naming:

- **Overview**'s mock had "Total Users"/"Dispute Rate" cards and a
  decorative chart with no real field or endpoint behind either — dropped,
  not faked.
- **Approval Queue** combines pending venues and pending verifications into
  one screen (matching both the mock's own structure and how this
  session's Goal phrased it), but each item hits its own distinct real
  endpoint — the mock had no working reject at all, only a fake alert.
- **Venues**: "Featured" toggle dropped (no `is_featured` field exists
  anywhere), "Delete" dropped (no DELETE route exists — suspend is the
  real, reversible equivalent). Both confirmed with the person before
  changing, not guessed.
- **Users** is entirely new UI — the mock had none, despite the original
  Goal naming "venue/user suspend-reactivate" explicitly.
- **Bookings**/**Payouts** are entirely new UI, added past the original
  four named areas. Bookings defaults to the `pending_payment` filter (the
  queue that actually needs attention). Confirming a payment uses a small
  inline form (amount/method required, reference/notes optional) rather
  than this dashboard's usual `window.prompt` pattern — a 4-field form
  doesn't fit a sequence of prompts well; everything single-reason
  (suspend, reject, cancel-pending) still uses `window.prompt`, consistent
  with the rest of the dashboard.

`App.tsx` cleanup: removed all 7 dead mock handlers that fed the old
`AdminLayout` props (confirmed each was genuinely dead by grepping every
usage across the whole `src/` tree, not just within `App.tsx`, before
deleting any of them), the `mockOwnerVenues`/`mockOwnerBookings` state and
its two `localStorage` effects, the 47-line `INITIAL_BOOKINGS` array, and
the type imports that became unused once all of that was gone.

`src/AdminLayout.test.tsx` — 8 tests: role-gating (mirrors
`OwnerLayout.test.tsx`'s), real-data rendering (explicitly checks the
fake mock cards are gone, not just hidden), and mutation flows exercised
end-to-end through the rendered UI — approve a venue, suspend a user,
confirm a booking payment through the inline form, mark a payout paid.

## 3. CSS-token bug — wider than documented

`AdminLayout.tsx`'s occurrence count had drifted from the 25 the previous
handoff claimed to 30, using its own exact grep command — re-run, not
trusted. More significantly, that grep pattern only ever anchored on
`text-outline`, missing the same broken color name (`outline`,
`outline-variant`, `primary-fixed`, `surface-variant` — none defined in
`src/index.css`'s `@theme` block) used with other color-consuming utility
prefixes: `decoration-outline` (`FiltersSidebar.tsx`) and `border-outline`
(`ReviewPay.tsx` — the checkout flow, a production screen). A search
across every color-consuming prefix against all four broken tokens found
38 occurrences total across 8 files. All fixed with the same substitutions
established previously, re-verified against real Tailwind core
`outline-none`/`outline-2` utilities (a genuine, unrelated CSS property,
not this bug) to avoid touching those by mistake. Separately,
`OwnerLayout.tsx` had three uses of an undefined `skeleton` class (almost
certainly meant to be `shimmer`, which is defined) — same failure mode,
different missing class, fixed alongside since it was noticed while
building the equivalent loading states for the new `AdminLayout.tsx` code.

## 4. What's still open

Unchanged from Phase D2's handoff: the three placeholder business numbers
(refund tiers, commission, hold duration), the S3/R2 storage swap (blocked
by this sandbox's network, not a decision against it), and whether
owner/admin dashboards should ever surface customer identity on
bookings — still nobody's call to make but the product owner's, re-flagged
rather than silently resolved, same discipline as Phase D2 applied to the
same question.

Everything in the backend README's "What's deliberately not here yet"
list (notifications, reviews/ratings, real file storage, the hold-expiry
sweep job, the full launch-readiness bundle, load testing) is unrelated
backend-design scope, untouched by this phase.

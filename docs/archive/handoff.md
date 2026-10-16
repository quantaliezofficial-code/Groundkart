# Handoff — Admin dashboard wiring, complete

This supersedes the previous `handoff.md` (which described `AdminLayout.tsx`
as 100% mock, untouched). That work is now done — this file is the current,
authoritative state. If a `docs/` folder with `CLAUDE.md`, numbered PRD/
design docs, or `PHASE_*_SUMMARY.md` files exists alongside this, those are
still useful secondary background for the earlier phases; nothing here
changes what they say about the customer-journey/Owner-dashboard work.
`PHASE_C7_SUMMARY.md` through `PHASE_D2_SUMMARY.md` plus this file and its
predecessor now form the full history.

## Where things actually are (read this first if anything below is stale)

Two separate zips/repos, no shared root — this file is duplicated at both
repo roots, same as before.

**Frontend has a nested-directory trap, still true:** the outer `frontend/`
is a raw, untouched original export with its own `package.json`, its own
826-line mock-only `OwnerLayout.tsx`, and no `hooks/`/`lib/` directories.
The real, current codebase is nested inside `frontend/frontend_deliver/`.
Always work inside `frontend_deliver/`. Confirm this yourself rather than
trusting this paragraph — `ls frontend/frontend_deliver/handoff.md` should
show a file identical to whichever copy of this file you're reading now.

**Git now exists in both repos.** Neither repo had a `.git` when this
session started (confirmed, not assumed, same as the previous session
found). Both were initialized partway through this session, so the first
commit in each necessarily bundles "the pre-existing state" together with
whatever had already changed by the time `git init` ran — noted honestly in
each repo's first commit message rather than presented as a clean baseline.
Everything after that first commit is a real, honest slice-by-slice history.

**Postgres was not pre-installed in this sandbox.** The previous handoff's
"always run `service postgresql start`" assumption didn't hold — the
service didn't exist at all. Had to `apt-get install postgresql
postgresql-contrib`, then create the `groundkart` role/password and both
`groundkart`/`groundkart_test` databases, then run `alembic upgrade
head` against both, before anything else would work. If your sandbox
already has Postgres, skip this; if not, this is the exact sequence that
worked. Don't assume the next environment has it installed either — check.

## What changed this session

**Backend: 178 → 197 tests, all TDD'd (red confirmed before green each
time), 3 consecutive clean runs at every checkpoint.**

Five new admin-only, platform-wide GET routes — all a straightforward gap,
not a product decision: every existing `GET /owner/...` route (added by the
previous session for the Owner dashboard) is scoped to *the caller's own*
`owner_id`/venues, including when the caller is an admin, who normally owns
nothing. There was no way for a real admin, using only the HTTP API, to
discover which venue/verification/user/booking/payout IDs exist to act on
via the suspend/approve/reject/confirm-payment/mark-paid routes that
already existed and were already tested by ID.

```
GET /api/v1/admin/venues                — every venue regardless of status/owner; ?status= filter
GET /api/v1/admin/owner-verifications    — every verification; ?status= filter; new AdminOwnerVerificationView
                                            response shape (id/user_id/applicant_name/applicant_email/document_url/
                                            business_name/status/rejection_reason/created_at/reviewed_at) —
                                            deliberately NOT the same shape as GET /owner/verification, which has
                                            none of the applicant-identity fields. See that schema's own docstring
                                            for why exposing identity here is fine (identity verification IS the
                                            point of the flow) unlike customer-identity-on-bookings below.
GET /api/v1/admin/users                  — every user; ?role=/?suspended= filters; reuses the existing
                                            AdminUserView shape
GET /api/v1/admin/bookings               — every booking regardless of venue owner; ?status=/?venue_id=/
                                            ?date_from=/?date_to= filters; same no-customer-identity guarantee
                                            as GET /owner/bookings (re-verified by a dedicated test, see below)
GET /api/v1/admin/payouts                — every payout regardless of owner; ?status= filter
```

Full README.md updates alongside — "Admin oversight" section now documents
all five, with the same route-table + rationale style as the rest of that
doc. Service functions: `list_venues_for_admin` (catalog/service.py),
`list_verifications_for_admin` (owner_onboarding/service.py, eager-loads
`.user` for the identity fields), `list_users_for_admin`
(admin/service.py), `list_bookings_for_admin` (booking/service.py),
`list_payouts_for_admin` (payout/service.py). Two test files:
`tests/test_admin_lists.py` (12 tests — venues/verifications/users) and
`tests/test_admin_bookings_payouts.py` (7 tests — bookings/payouts,
including one that explicitly re-asserts the no-customer-identity guarantee
on the new route, not just trusts it holds because the owner-facing route
already proved it once).

**Frontend: AdminLayout.tsx fully wired, 0 props, 6 tabs, real data
throughout. 12 → 14 frontend tests.**

Same pattern as `OwnerLayout.tsx`/`hooks/useOwner.ts`/`lib/api/owner.ts`:
`src/lib/api/admin.ts` (one function per backend admin route, 19 total —
every documented route, not just the ones with UI built on top),
`src/hooks/useAdmin.ts` (TanStack Query hooks + mutations, one per
query/action), `src/components/AdminLayout.tsx` rewritten with its own
top-level role gate (`user.role !== 'admin'`) and zero props from
`App.tsx`. `src/AdminLayout.test.tsx` — 8 tests: role-gating (mirrors
`OwnerLayout.test.tsx`'s 3), real-data rendering (explicitly asserts the
mock's fake "Total Users"/"Dispute Rate" cards are actually gone, not
just hidden), and 4 mutation flows exercised end-to-end through the
rendered UI (approve a venue from the approval queue, suspend a user with
a reason, confirm a booking payment through the inline form, mark a
payout paid).

Six tabs:
1. **Overview** — real GMV/commission/bookings-by-status/pending-approval
   counts (`GET /admin/overview`) + real audit log (`GET /admin/audit-log`).
   The mock's fake "Total Users"/"Dispute Rate" cards and decorative
   booking-volume chart are gone — no real field/endpoint backs either, so
   they were dropped rather than faked. Every card left maps to a real
   `PlatformOverview` field.
2. **Approval Queue** — combines pending venues (status=pending_review) and
   pending owner-verifications (status=pending) into one queue, matching
   how the mock UI and this session's Goal both described it ("the owner-
   verification/venue approval queue"), but each item approves/rejects
   against its own real, distinct backend entity — the mock had no working
   reject at all, only a fake "Request Changes" alert.
3. **Venues** — every status visible (not just active, unlike the mock,
   which only ever showed what was in local prop state), suspend/
   reactivate wired to the real routes, price editing kept (reuses
   `ownerApi.updateVenue` — same `PATCH /venues/{id}` endpoint, role-gated
   owner OR admin either way). "Featured" toggle dropped (no `is_featured`
   field anywhere in the schema/model — confirmed, not assumed). "Delete"
   dropped (no DELETE route for a venue exists at all — only suspend,
   which is the real, reversible equivalent for a venue that may have real
   booking history).
4. **Users** — entirely new; the mock had no user-management UI at all
   despite this session's Goal explicitly naming "venue/user
   suspend-reactivate" as one of the four original target areas. Can't
   suspend your own account (backend also rejects this with 422; the UI
   disables the button too, with a tooltip explaining why).
5. **Bookings** — new, added completing this session (not one of the
   original four named areas, but necessary before launch: this backend's
   entire payment model is offline confirmation, no gateway webhook, so
   this screen is how an admin actually operates the marketplace day to
   day). Defaults to the `pending_payment` filter. Confirming payment uses
   a small inline form (amount/method required, reference/notes optional)
   rather than the `window.prompt` pattern used elsewhere in this
   dashboard — a 4-field form doesn't fit a sequence of prompts well.
   Cancel-pending still uses `window.prompt` for its single reason field,
   consistent with suspend/reject elsewhere.
6. **Payouts** — new, same rationale as Bookings. Run-a-payout is a small
   inline form (owner ID + period start/end); mark-paid is a single button
   per pending payout.

`App.tsx` cleanup: removed all 7 dead mock handlers
(`handleUpdateVenueStatus`, `handleToggleFeatureVenue`,
`handleToggleSuspendVenue`, `handleUpdateVenuePrice`, `handleDeleteVenue`,
`handleForceBookingStatus`, `handleResetDatabase` — confirmed each was
genuinely dead by grepping for every usage across the whole `src/` tree
before deleting, not just within `App.tsx`), the `mockOwnerVenues`/
`mockOwnerBookings` state + their two `localStorage` persistence effects,
the 47-line `INITIAL_BOOKINGS` mock array, and the now-unused `Venue`/
`AppBooking` type imports that deleting all of the above left behind.
`mockVenues` import (different from the removed `mockOwnerVenues` state)
is still legitimately used elsewhere as a fallback and was correctly left
alone — checked before assuming it was part of the same cleanup.

**CSS-token bug: fixed everywhere found, not just `AdminLayout.tsx`.**

The original bug (four Tailwind classes — `text-outline`, `bg-primary-fixed`
paired with `text-on-primary-fixed-variant`, `outline-variant`,
`bg-surface-variant` — none of which exist in `src/index.css`'s `@theme`
block, so they silently generate zero CSS) turned out to be broader than
the previous handoff's own grep pattern caught, in two ways:

1. The exact grep command it specified now returns **30** occurrences in
   `AdminLayout.tsx`, not the 25 it claimed — genuine drift, re-confirmed
   by running that exact command, not trusted from the doc.
2. The grep pattern only anchored on `text-outline`, missing the same
   broken color name used with other color-consuming utility prefixes:
   `decoration-outline` (`FiltersSidebar.tsx`) and `border-outline`
   (`ReviewPay.tsx` — the checkout flow). A broader search across every
   color-consuming prefix (`bg`/`text`/`border`/`decoration`/`ring`/
   `divide`/`from`/`via`/`to`/`fill`/`stroke`/`caret`/`accent`) against
   all four broken tokens found 38 total occurrences across
   `AdminLayout.tsx`, `Header.tsx`, `VenueCard.tsx`, `DetailView.tsx`,
   `FiltersSidebar.tsx`, `MyBookings.tsx`, `PerspectiveSwitcher.tsx`,
   `ReviewPay.tsx`, and `App.tsx`. All fixed, using the same substitutions
   as before (`text-outline` → `text-on-surface-variant`;
   `text-outline-variant` → `text-ink/40`; `bg-primary-fixed
   text-on-primary-fixed-variant` → `bg-primary-container
   text-on-primary-container`; `bg-surface-variant`/`bg-outline-variant` →
   `bg-surface-container-high`; any other prefix on `outline` → the same
   base substitution as `text-outline`'s, i.e. `on-surface-variant`).
   Legitimate Tailwind core `outline-none`/`outline-2` utilities (the real
   CSS `outline` property, unrelated to this bug — a genuine collision risk
   if searched carelessly) were checked and left untouched.

A **separate but related** bug found in `OwnerLayout.tsx`: three loading
placeholders used a `skeleton` class that's never defined anywhere in this
codebase (zero styling, same failure mode as the token bug, just a
different missing class) — almost certainly meant to be `shimmer`, which
*is* defined in `index.css` and is what the new `AdminLayout.tsx` code
uses. Fixed, all three occurrences, re-verified with the full test suite
since it touches a production screen.

## Dead ends — do not retry (carried over + one new)

The five from the previous handoff still apply (skip-auth pattern for
authenticated views, the CSS-token bug's real tokens, the vitest
`setupFiles` absolute-path fix, single-tool-call server lifecycle, signup
returning no token). One new one:

6. **Postgres isn't guaranteed to be installed.** See "Where things
   actually are" above. Don't assume `service postgresql start` alone is
   enough to bootstrap a fresh sandbox — check `which psql` first, install
   if missing, *then* create the role/databases/run migrations before
   trusting any `service postgresql start` step.

## Key decisions made this session (flagged before acting, not guessed)

- **"Featured" venue toggle: dropped.** No `is_featured` field anywhere in
  the backend. Confirmed with the person before removing it from the real
  UI rather than silently reinterpreting or inventing new backend schema.
- **"Delete venue": dropped, mapped conceptually to Suspend.** No DELETE
  route exists for a venue. Same as above — confirmed before proceeding
  rather than guessing that suspend was an acceptable substitute.
- **Fake "Total Users"/"Dispute Rate" overview cards and the decorative
  chart: dropped, not flagged as a decision** — this one didn't need
  sign-off, it's the direct, obvious consequence of "replace 100%
  mock/localStorage data with real API calls": there's no real field or
  endpoint behind either, so keeping them would mean inventing fake data,
  which the mission explicitly ruled out.
- **Approval queue combines venue + verification review into one screen.**
  Matches both the mock UI's own structure and this session's Goal
  phrasing ("the owner-verification/venue approval queue"). Each item
  still hits its own distinct real backend entity/endpoint — this is a UI
  grouping decision, not a backend modeling one.
- **No customer/guest identity exposed on bookings anywhere admin-facing,
  including the new `GET /admin/bookings` — still locked in, re-verified
  with its own dedicated test rather than assumed to carry over from the
  owner-facing route.** This remains a real, standing product question if
  anyone ever wants "who booked this" visible on any dashboard — nobody
  has signed off on that, same as before.

## Environment notes (updated)

Same as before (Python 3.12/FastAPI/SQLAlchemy 2.0 async/PostgreSQL 16
only, no SQLite no Redis; Vite 6/React 18/TanStack Query/Tailwind v4
CSS-first config in `src/index.css`; no browser anywhere in this sandbox,
all frontend verification is `tsc` + `build` + `vitest` + reading JSX
carefully, never actual visual/click verification — still the direct cause
behind how the CSS-token bug and its extended scope went unnoticed for as
long as it did; sandbox network allowlisted to package registries + GitHub
only), plus:

- Postgres needed manual install this session — see above.
- Git now exists in both repos — see above.
- Live end-to-end HTTP verification was done twice this session (once
  after the venues/verifications/users slice, once after the bookings/
  payouts slice), both times as real HTTP against a real running server
  with a real admin JWT obtained via signup-then-login (Dead End #5) or
  direct role-seeding (there's no self-serve "become an admin" path — a
  real deployment provisions the first admin out-of-band, e.g. a bootstrap
  script; `SignupRequest` has no `role` field, confirmed by reading it, not
  assumed), both within single self-contained tool calls (Dead End #4).
  One real mistake caught in that process, worth naming so it's not
  repeated: the first bookings verification attempt hardcoded the wrong
  UUID (the seeded `InventoryUnit`'s id instead of the `Booking`'s own
  auto-generated id) and got a legitimate 404 back — not a backend bug,
  just a reminder to read back whatever ID a service function actually
  generates rather than assuming you know it in advance.

## What's still open (unchanged from before, not resolved this session)

- Real values for the three placeholder business numbers (refund tiers
  48h/24h/50%, platform commission 10%, booking hold duration 24h) — still
  just placeholders, not blocking, nobody's confirmed them as real.
- S3/R2 storage swap — blocked by this sandbox's network allowlist, not a
  decision against it.
- Whether owner/admin dashboards should ever surface customer identity on
  bookings — see "Key decisions" above, still nobody's call but the
  product owner's.
- Everything in the backend README's "What's deliberately not here yet"
  section (reviews/ratings, real file storage, hold-expiry sweep job, the
  full launch-readiness bundle, load testing) — all backend-design scope,
  unrelated to and untouched by this session's frontend-wiring work.
  **Notifications specifically: partially addressed by Addendum 2 above**
  — in-app notifications exist and are wired into every admin action that
  affects an owner/user. What's still genuinely open is real email/SMS
  delivery (so a suspended user finds out even though they can't log in to
  see an in-app notification) — that needs a provider decision (SendGrid/
  SES/etc.), templates, and deliverability work, none of which this
  sandbox can reach anyway (no external network route). **Note on the
  hold-expiry sweep job specifically, since Addendum 1 above might read
  otherwise**: `hold_expires_at` is now *visible* to an admin (so a stale
  hold can be found and manually cleared via cancel-pending), but nothing
  automatically clears one — the sweep job itself still doesn't exist.
  Visibility isn't automation; don't conflate the two if picking this up
  next.

## Verification status as of the end of this session

- Backend: **197/197 passing**, 3 consecutive clean runs.
- Frontend: `tsc --noEmit` clean, `npm run build` clean, **14/14 tests
  passing**.
- Live end-to-end HTTP verification: done twice (see above), all 19 admin
  routes exercised with a real admin JWT against a real running server,
  non-admin correctly gets 403, every mutating action correctly appears in
  the real audit log afterward.

## Addendum — a follow-up round after the person asked "what's left to make this easy for us to handle as admin"

Two more real things fixed, past the original four-area scope, in response
to that question rather than guessed at proactively:

**`BookingDetail.hold_expires_at`** — new field, backed by a new property
on the `Booking` model (`app/models/core.py`, mirrors `slot_date`'s
existing pattern exactly: proxies `self.inventory_unit.hold_expires_at`,
requires the same eager-load every route using `BookingDetail` already
does). Lets the Admin Bookings screen flag which `pending_payment`
bookings are already past their hold window and sort them to the top —
there's still no automatic sweep job that clears stale holds (see "What's
still open" below), so this is the only visibility an admin has until one
exists.

**Adding that field surfaced a real, previously-invisible bug**:
`_apply_payment_confirmation` (shared by `confirm_booking_by_admin` — the
actual production confirm-payment path — and the dormant webhook path)
was the *one* booking-state transition in `booking/service.py` that never
cleared `inventory_unit.hold_expires_at` on success. Every other terminal
transition (`cancel_pending_booking`, `flag_booking`,
`cancel_booking_as_customer`) already does. Harmless for as long as
nothing ever read the field — now that it's externally visible, a
confirmed booking would otherwise misleadingly still show a hold-expiry
timestamp. Fixed to match its three sibling call sites, with a regression
test, then re-verified live (confirmed on a fresh booking after the fix:
`hold_expires_at` correctly flips to `null` on confirm — the previous live
check accidentally re-used a booking confirmed by an *earlier* run,
before the fix existed, and that stale row understandably still showed a
timestamp; don't mistake old data for a failed fix, always confirm against
something created after the change).

**Owner identity on Venues and Payouts** — new `AdminVenueView`/
`AdminPayoutView` schemas (`app/schemas/admin.py`), each the same shape as
`VenueResponse`/`PayoutDetail` plus `owner_name`/`owner_email`.
Deliberately kept separate from the base schemas rather than adding those
fields there directly: `VenueResponse` is also the public `GET /venues`
shape, and there's no reason a public listing should ever expose an
owner's contact details. `list_venues_for_admin`/`list_payouts_for_admin`
now eager-load the `owner` relationship. Frontend: Venues/Payouts lists
and the approval queue's venue detail all show a real name instead of an
`owner_id.slice(0,8)` fragment; the "run a payout" form is now a dropdown
of real owners (`useAdminUsers({role:'owner'})`) instead of a blind
owner-ID text field.

Backend: 197 → 200 tests, 3 new (3 new: hold-expiry regression test,
owner-identity-on-venues, owner-identity-on-payouts), stable across
multiple runs. Frontend: 14 tests updated/passing, `tsc`/`build` clean.
Both re-verified live over real HTTP with a real admin JWT (see above).

## Addendum 2 — in-app notifications

The other item from the "what's left" list actually built: an owner/user
now finds out when an admin acts on their venue, verification, account, or
payout — no more finding out by asking support or noticing it themselves.

New `Notification` model + migration (`da614e8551b0`),
`app/modules/notifications/service.py` (a `notify(...)` factory —
deliberately NOT a self-committing function; every call site adds the
`Notification` row in the *same* `session.begin()` block as its existing
`AuditLog` entry, so the action and the notification about it are atomic).
Four routes: `GET /api/v1/notifications` (paginated, `?unread_only=`),
`GET /api/v1/notifications/unread-count`, `POST /api/v1/notifications/
{id}/read`, `POST /api/v1/notifications/read-all`.

Wired into: venue approve/reject/suspend/reactivate, verification
approve/reject, user suspend/reactivate, payout mark-paid. **Deliberately
NOT wired into** booking confirm-payment/cancel-pending or payout run —
see `tests/test_notifications.py`'s module docstring for the reasoning
(guest bookings often have no account to notify at all; "run" isn't the
moment money moved, "mark-paid" is). In-app only, not email/SMS — no route
to any external delivery service exists in this sandbox; a real pipeline
(provider, templates, deliverability) is a separate, bigger decision.

Frontend: `Header.tsx`'s notification bell used to be a fully mock
decorative dot (`showNotificationBadge`, hardcoded `true`, permanently
dismissed on first click, never showed anything) — replaced with a real
dropdown backed by `hooks/useNotifications.ts` (unread count polled every
30s — there's no websocket/SSE channel anywhere in this codebase). Only
renders when logged in. Hit a real vitest hoisting gotcha while testing
this — worth flagging since it'll bite again: `Header.tsx` (and therefore
`useNotifications.ts`) is NOT lazy-loaded the way `AdminLayout.tsx` is, so
its import chain resolves *synchronously* during `import App from
'./App'`, before a same-file `const notificationsApiMock = {...}` has
executed — a real `ReferenceError`, not a flake. Fixed with `vi.hoisted()`.
Any future test mocking a module that a non-lazy component imports needs
the same treatment; `adminApiMock`'s plain-`const` pattern only works
because `AdminLayout` is lazy-loaded and its mock factory doesn't get
invoked until well after the test file's own top-level code has run.

Backend: 200 → 210 tests (`tests/test_notifications.py`, 10 new — the
endpoints themselves plus one per admin action that should/shouldn't
notify). Frontend: 14 → 15 tests. Both re-verified live over real HTTP:
suspended a venue as admin, confirmed the owner's unread count went from 0
to 1, confirmed the message content, marked it read, confirmed the count
dropped back to 0, confirmed an unrelated user sees an empty list.

## Addendum 3 — the three items explicitly requested next: sweep automation, pagination, jump-to-booking

**Hold-expiry sweep automation.** Addendum 1 gave an admin *visibility*
into stale holds; this is the missing *automation* piece
`cancel_pending_booking`'s own docstring had flagged as still missing.
`booking/service.py::sweep_expired_holds()` reuses
`cancel_pending_booking`'s exact transition (status → cancelled, unit
freed, hold cleared, audit log) with `actor_id=None` (system-triggered;
`AuditLog.actor_id` is nullable specifically for this). Two ways to
trigger it: a real background loop (`app/main.py`'s new `lifespan`,
`asyncio.create_task`, runs every `hold_sweep_interval_minutes` — new
setting, default 5) and a manual `POST /api/v1/admin/bookings/
sweep-expired-holds` (also wired to a "Sweep expired holds now" button on
the Bookings tab). Two real bugs caught building this, both fixed: (1) the
sweep's initial SELECT auto-begins a transaction that collided with
`cancel_pending_booking`'s own `session.begin()` — a genuine
`InvalidRequestError`; (2) the sweep's `logger.info()` calls went nowhere
because nothing had attached a handler to that logger — both confirmed via
live verification with a real running server and a short interval
override, not just unit tests. 6 new backend tests
(`tests/test_hold_sweep.py`).

**Pagination on all 5 admin list endpoints** (venues, users,
verifications, bookings, payouts) — same keyword-only `limit`/`offset`
convention as `get_audit_log`'s existing pagination (default 50, bounded
1–200, flat list response, no total-count envelope). Every one of these
was returning everything unpaginated before. Frontend: `useInfiniteQuery`-
based "Load more" pagination for Venues/Users/Bookings/Payouts (4 new
paginated hooks in `hooks/useAdmin.ts`, added alongside the existing
single-fetch hooks rather than replacing them). Verifications
deliberately did NOT get "Load more" UI — the Approval Queue still uses a
single bounded fetch (`limit=200`) for both pending venues and pending
verifications, since a queue meant to be cleared out doesn't need page
controls the way a full browsing list does. Found and fixed a related
real gap while doing this: `AdminDashboard` was fetching ALL venues/
verifications unfiltered (implicit default `limit=50`) and filtering
client-side for the approval queue — pending items could have already
been silently missing once there were enough active/suspended/draft
venues sitting alongside them. Now fetches `status=pending_review`/
`pending` directly, server-side. 6 new backend tests
(`tests/test_admin_pagination.py`), 1 new frontend test.

**"Jump to booking by ID."** Needed no new backend endpoint at all — it
reuses `GET /api/v1/bookings/{id}` directly, which turned out to already
grant an admin access to *any* booking, guest ones included. That wasn't
obvious going in: this route's own docstring claimed a guest booking is
"never reachable through this route at all, for anyone," which turned out
to be stale (the code's `is_admin` check grants access unconditionally,
no guest-exclusion clause) and, worse, untested either way. Added a real
test confirming the code's actual behavior before building anything on
top of it, then fixed the docstring. Frontend: a small `BookingLookup`
component + `BookingRow` extracted as its own self-contained component (own
hooks, own local confirm-form state) so the exact same card renders
identically whether a booking was found by browsing or by pasting its ID
— no duplicated markup between the two paths. 1 new backend test
(`test_admin_can_view_a_guest_booking_via_this_route`), 2 new frontend
tests.

One test-infrastructure gotcha worth knowing about if extending any of
this further: `mockResolvedValue` (not `mockResolvedValueOnce`) persists
across tests in this file since `afterEach` only calls `.mockClear()`
(resets call history, not the implementation) — a later test reusing the
same fixture name/venue as an earlier one can produce a genuine "multiple
elements found" error that looks like a bug in the feature but is really
just leftover mock data. Hit this twice building the tests above; fixed
by using distinct fixture names and `getAllBy`-style assertions where two
renders of similar data are expected to coexist.

Backend: 210 → 223 tests across this addendum (6 sweep + 6 pagination + 1
docstring-accuracy), stable across 2+ runs each. Frontend: 15 → 18 tests,
tsc/build clean throughout.
  
SUPPORT TICKETS -- COMPLETED  
exact test results: 27/27 backend support tests passed, 179 total backend tests passed 

# GroundBooking backend (Phase C, continued)

FastAPI + SQLAlchemy 2.0 (async) + Alembic + Postgres 16 — **Postgres only,
no other moving parts** (Redis was removed from this project entirely as
of `PHASE_C8_SUMMARY.md`). Booking engine, auth/RBAC, owner onboarding,
venue catalog, offline payment confirmation, customer-initiated
cancellation, the owner payout ledger, and admin oversight are all real
and tested against a live Postgres instance. See `HANDOFF.md` (one level
up) for the full history and current priority list, or
`PHASE_C9_SUMMARY.md` for what this specific revision added.

Renamed from VenueSetu to GroundBooking as of `PHASE_C8_SUMMARY.md`, per
explicit client direction — database names, connection strings, and this
README were all updated then and remain so; the nine original planning
docs (`01_PRD.md` etc.), `CLAUDE.md`, and `MASTER_PROMPT.md` are untouched
(historical reference documents from before that session, not live
artifacts this backend reads). The frontend zip (`venuesetu-phase-a.zip`)
is also still untouched — out of scope for backend-only slices; its
folder/package name would need the same rename whenever frontend work
next picks up.

## Setup

```bash
pip install -r requirements.txt
cp .env.example .env   # then edit DATABASE_URL/JWT_SECRET_KEY for your machine

# Postgres: create the role/db/extensions once
psql -c "CREATE USER groundbooking WITH PASSWORD 'devpassword' CREATEDB;"
psql -c "CREATE DATABASE groundbooking OWNER groundbooking;"
psql -d groundbooking -c "CREATE EXTENSION IF NOT EXISTS citext; CREATE EXTENSION IF NOT EXISTS pgcrypto;"
psql -c "CREATE DATABASE groundbooking_test OWNER groundbooking;"
psql -d groundbooking_test -c "CREATE EXTENSION IF NOT EXISTS citext; CREATE EXTENSION IF NOT EXISTS pgcrypto;"

# Apply migrations
alembic upgrade head

# Run the app
uvicorn app.main:app --reload
```

No Redis, no other service to install — Postgres is the only piece of
real infrastructure this backend needs.

## Running the tests (this is the part that matters most right now)

```bash
# tests/conftest.py points itself at groundbooking_test automatically —
# never run tests against the dev database.
# Note: You must run migrations on the test database before running tests:
# Windows (PowerShell):
# $env:DATABASE_URL="postgresql+asyncpg://groundbooking:devpassword@localhost:5432/groundbooking_test"; alembic upgrade head
# Linux/macOS:
# DATABASE_URL="postgresql+asyncpg://groundbooking:devpassword@localhost:5432/groundbooking_test" alembic upgrade head

pytest tests/ -v
```

Read in this order:
1. `tests/test_concurrency.py` — the double-booking-prevention test,
   described as "the single most important test in this entire project" in
   `MASTER_PROMPT.md`. 25 genuinely concurrent requests at the same slot,
   exactly one succeeds; a separate test proves the database-level partial
   unique index is a real backstop independent of the application's locking
   code.
2. `tests/test_auth_flow.py` — signup/login/refresh/logout, and specifically
   the refresh-token reuse-detection path (TRD §4): replaying an
   already-rotated token doesn't just fail that one request, it revokes
   every active session for that user. Login rate limiting here is
   Postgres-backed (see "Redis removed" below) — same threshold and
   observable behavior as before, different mechanism underneath.
3. `tests/test_rbac.py` — the owner-flag route, exercised through real
   JWTs: the right owner succeeds, a different owner gets 403, a customer
   role gets 403 before the booking is even looked up, an expired grace
   window gets 410. Also covers `flag_booking` now recording
   `refund_amount` (Decision Point C-9).
4. `tests/test_owner_onboarding.py` — submit verification doc -> admin
   approves -> role actually flips to `owner` and an audit_logs row exists
   (not just "the request returned 200"); a parallel test proves rejection
   leaves the role alone and a resubmission is allowed afterward.
5. `tests/test_catalog.py` — venue create/search/visibility/edit, plus
   three specific traps: a non-active listing is invisible to the public
   but previewable by its owner/an admin; a no-op PATCH does NOT bounce an
   active listing back to pending_review (only a genuine content change
   does); switching the cover image is atomic (never two `is_cover=true`
   rows, which `uq_one_cover_image_per_venue` would reject if it weren't).
6. `tests/test_booking_retrieval.py` — `POST /bookings` now attributes a
   booking to a real customer_id when a valid token is present; a
   different customer gets 404 (not 403) viewing someone else's booking —
   checked specifically against the shape of the original codebase's
   booking-PII leak (Implementation Plan Phase 0 item #3), not just "wrong
   user can't see it."
7. `tests/test_offline_payment_confirmation.py` — payment is confirmed
   offline by an admin, not by a Razorpay webhook (explicitly deferred —
   see Decision Point C-5/C-6 below). A double-click on "confirm" gets
   409, not a second Payment row; a wrong amount gets 422; a pending
   request can be released immediately instead of waiting out the
   (now long, deal-dependent) hold.
8. `tests/test_grace_period.py` — the grace-period cap-binding math
   (Decision Point B-1), as a deterministic unit test with no wall-clock
   hazards.
9. `tests/test_refund_tiers.py` — the distance-from-event refund-tier math
   (Decision Point C-7), deterministic and wall-clock-independent, same
   style as #8. Includes a case constructed so an IST-vs-UTC-naive bug
   would land in a *different* tier, not just a slightly wrong number.
10. `tests/test_booking_cancellation.py` — the customer-initiated
    cancellation routes (account holder and guest), proving the HTTP
    wiring reaches the right tier end to end, the 404-not-403 PII-leak
    check applies here too, and a booking already terminal via
    `flag_booking` can't be re-processed through this second door.
11. `tests/test_payout_split.py` — the commission/net math (Decision Point
    C-10), deterministic, including the property that actually matters for
    a financial ledger: commission + net always reconstitutes gross
    exactly, no rounding-mismatch penny gap.
12. `tests/test_payout_ledger.py` — the owner payout ledger routes
    end to end: gross computed from *retained* amount (not pre-refund
    price, Decision Point C-11), a payment already swept into one payout
    can't be swept into another, a period extending into the future is
    rejected outright.
13. `tests/test_admin_oversight.py` — audit_logs' first real read path
    (filterable by actor/entity/date); GMV computed from the *pre-refund*
    booking amount, deliberately a different sense of "gross" than the
    payout ledger's (Decision Point C-13); suspending a venue reuses the
    'suspended' status value that's been in the enum, unused, since the
    first migration; suspending a user blocks login and revokes their
    refresh tokens without needing a per-request DB check on every
    protected route.

## Auth endpoints

```
POST /api/v1/auth/signup    — {name, email, password} -> 201
POST /api/v1/auth/login     — {email, password} -> access_token + httpOnly refresh cookie
POST /api/v1/auth/refresh   — reads the refresh cookie, rotates it, returns a new access_token
POST /api/v1/auth/logout    — revokes just that one session
GET  /api/v1/users/me       — current profile + role + verification status
```

`signup` always creates a `customer` — becoming an `owner` requires the
verification flow below, not a role field at signup (Decision Point, see
`PHASE_C3_SUMMARY.md` §1).

Login is rate-limited (10 attempts / 60s per email) — Postgres-backed, see
"Redis removed" below. A suspended account (Decision Point C-14 below)
gets the same generic 401 as a wrong password, not a distinct message —
same enumeration reasoning already applied to a soft-deleted account.

## Owner onboarding endpoints

```
POST /api/v1/owner/verification                              — any logged-in user, multipart (document + optional business_name)
GET  /api/v1/owner/verification                                — any logged-in user; latest submission's status, or null if none yet
POST /api/v1/admin/owner-verifications/{id}/approve            — admin only; flips role -> 'owner', is_verified -> true
POST /api/v1/admin/owner-verifications/{id}/reject              — admin only; {reason}, role unchanged, resubmission allowed
```

File storage is `LocalFileStorage` (writes to `/tmp/groundbooking-uploads`,
served back out at `/uploads/...` via the `StaticFiles` mount in
`app/main.py`) — **dev/test only**, not what TRD §2 asks for (S3/R2). This
sandbox has no network access to either provider; see
`app/modules/storage/base.py`'s `FileStorage` protocol for the swap point
— implement one S3/R2 class against that interface and nothing else in
this module changes. (Found and fixed while wiring the owner dashboard:
this used to return `local://{key}`, a scheme no HTTP client can fetch —
an uploaded photo saved correctly but could never actually be displayed
anywhere. It now returns a real URL through the mount above.)

## Catalog endpoints

```
POST  /api/v1/venues                          — owner/admin only; always lands 'pending_review'
GET   /api/v1/venues                            — public search (city, category, available_on, price_max)
GET   /api/v1/owner/venues                        — owner/admin only; every status of the caller's own venues (list_venues above never returns non-active ones — this is the gap found wiring the owner dashboard's Listings tab)
GET   /api/v1/venues/{id}                         — the endpoint TRD §3 calls out as missing from the original backend; public if active, owner/admin preview otherwise
PATCH /api/v1/venues/{id}                          — owner/admin; a genuine content change re-enters pending_review, a no-op doesn't
POST  /api/v1/venues/{id}/images                    — multipart upload; is_cover handling is atomic (see test_catalog.py)
POST  /api/v1/venues/{id}/inventory-units             — batch create; enforces unit_type/start_time-end_time consistency (B-1's assumption)
GET   /api/v1/venues/{id}/inventory-units             — every unit regardless of status; same visibility rule as GET /venues/{id} (Phase D)
POST  /api/v1/admin/venues/{id}/approve                 — admin only
POST  /api/v1/admin/venues/{id}/reject                   — admin only; venue -> 'draft' (not a new status), reason recorded
```

## Booking endpoints

```
POST /api/v1/bookings                     — account booking if a valid token is present, guest checkout otherwise
GET  /api/v1/bookings                       — "My Bookings" (account holders only)
GET  /api/v1/bookings/{id}                    — single booking; owner or admin only, 404 (not 403) otherwise
GET  /api/v1/bookings/manage/{token}            — guest's view, the manage_token IS the auth, no login
GET  /api/v1/owner/bookings                       — owner/admin only; every booking across the caller's own venues, filterable by venue_id/status/date_from/date_to. The gap get_booking_for_viewer's own docstring named as "the natural next gap" — needed to wire the owner dashboard's Calendars tab to real data. Deliberately exposes no customer_id/guest_name/guest_email anywhere (see list_bookings_for_owner's docstring): BookingDetail has no customer-identity field at all, so an owner can see a slot is booked, for how much, in what state — never who booked it. Whether/how to surface that is a real, separate product decision, flagged here rather than resolved silently.
POST /api/v1/bookings/{id}/flag                  — owner/admin only (Phase C2)
POST /api/v1/bookings/{id}/cancel                   — account holder only; cancels a *confirmed* booking, refund per Decision Point C-7's tiers
POST /api/v1/bookings/manage/{token}/cancel            — guest equivalent of the above, token is the auth
```

## Payment confirmation model — offline, not Razorpay (Decision Point C-5/C-6)

**Payment is confirmed offline by an admin, not by a payment gateway.**
This is a deliberate, explicit client decision, not an unfinished feature —
real Razorpay integration is skipped entirely for now, by direction.

```
POST /api/v1/admin/bookings/{id}/confirm-payment   — admin only; records a real Payment row (gateway='offline') + audit log, then confirms the booking
POST /api/v1/admin/bookings/{id}/cancel-pending      — admin only; releases a pending_payment slot immediately, without waiting out the hold
```

`confirm_booking_from_webhook()` (Phase B) still exists in
`app/modules/booking/service.py` but is **dormant** — no route calls it.
Kept, not deleted, in case gateway integration is revisited later; both it
and `confirm_booking_by_admin()` share one internal transition helper
(`_apply_payment_confirmation`) so the confirmed_at/grace_period_ends_at/
unit-status logic can't drift between the two paths if the dormant one is
ever reactivated.

**`booking_hold_duration_minutes` (env var, default 1440 = 24h) is a
placeholder, not a confirmed number.** The original spec assumed a
10-minute hold sized for gateway checkout; with payment confirmed offline
instead, the real gap between requesting a slot and payment being
confirmed depends on a human deal, not a checkout timer. Change it via
`.env`, not code.

## Customer-initiated cancellation — Decision Points C-7, C-8, C-9

`flag_booking` (owner, always 100%) and `cancel-pending` (admin, unpaid
requests only) both existed; a customer cancelling a *confirmed* booking
they already paid for, with the standard distance-from-event refund
tiers, did not, until this was resolved (see `PHASE_C7_SUMMARY.md`).

**Decision Point C-7 — the refund tiers themselves (flag for real
sign-off).** No doc anywhere states the actual tier count, cutoffs, or
percentages — every doc references "the standard distance-from-event
refund tiers" as though defined elsewhere. The only concrete anchor in
any of the nine planning docs is one hedged example in
`03_Implementation_Plan.md`: *"e.g., free cancellation > 48h before,
partial refund inside that window."* Current placeholder
(env-configurable, same treatment as C-5):

| Time before the slot's start (IST) | Refund |
|---|---|
| ≥ 48h | 100% |
| 24h – 48h | 50% |
| < 24h | 0% |

For a half_day/full_day unit (no `start_time`), "the slot's start" is
local midnight IST at the start of `date` — same reasoning as B-1's
no-start_time handling, applied to a different problem. A past event
clamps to the 0% tier rather than erroring.

**Decision Point C-8 — atomic refund, not a second admin-confirmed step
(flag for awareness, not sign-off).** Went atomic — tier computed, booking
cancelled, payment marked refunded, all in one transaction — to match
`flag_booking`'s existing, tested precedent, rather than introduce a
second, different refund-execution shape for the same concept. Contrast
with the payout ledger below, which *does* get the two-step
admin-confirms treatment, on its own merits (see C-10/C-11's section).

**Decision Point C-9 — `payments.refund_amount` (mechanical, no sign-off
needed).** New nullable `Numeric(10,2)` column, populated by both the
cancellation path and `flag_booking`, so a `'refunded'` payment row means
the same thing regardless of which path produced it. This is also what
makes the payout ledger's gross-amount calculation possible (see C-11).

One small, reasoned deviation from the docs, not a decision point:
`07_design.md` §3.3 specifies the account-holder route as
`DELETE /api/v1/bookings/{id}`; implemented as `POST .../cancel` instead,
matching every other state-changing booking route already in this
codebase.

## Owner payout ledger — Decision Points C-10, C-11, C-12

`06_Backend_Schema.md` §4 lists `payouts` as a one-line summary
(`owner_id`, `period_start/end`, `gross_amount`, `commission_amount`,
`net_amount`, `status`) with an ERD edge from users only — no full DDL, no
status enum, no commission rate, and no relationship at all back to
bookings/payments despite `07_design.md` §4 describing it as "one row per
owner per settlement period" (necessarily an aggregate of many).

```
POST /api/v1/admin/payouts/run                — admin only; {owner_id, period_start, period_end} -> aggregates eligible bookings into a new 'pending' payout
POST /api/v1/admin/payouts/{id}/mark-paid       — admin only; 'pending' -> 'paid', records paid_at
GET  /api/v1/owner/payouts                        — owner only; their own payout history, most recent period first
```

**Decision Point C-10 — the commission rate (flag for real sign-off).** No
doc anywhere gives a percentage — `01_PRD.md`/`03_Implementation_Plan.md`
both name "gross, commission, net" as the shape without ever giving the
rate. 10% (`PLATFORM_COMMISSION_PERCENT`, env-configurable) is a
defensible marketplace-commission placeholder, not a confirmed number.

**Decision Point C-11 — what "gross" means, what anchors a period, and
why eligibility requires the slot date to be in the past (the most
foundational decision in that slice).** Three interacting design calls the
docs never make:
- "Gross" is the amount the platform actually *retained* per payment
  (`amount - COALESCE(refund_amount, 0)`), not the pre-refund booking
  price — one formula covers never-refunded, partially-refunded, and
  fully-refunded bookings alike, falling straight out of Decision Point
  C-9's `refund_amount` column.
- Period membership is keyed on the inventory unit's *slot date*, not the
  payment's confirmation date.
- A payout's `period_end` must be strictly in the past (422 otherwise).
  This isn't just caution: `compute_refund_fraction` (C-7) already clamps
  to the 0%-refund tier once an event's start has passed, so once a
  slot's date is behind us, its payment's retained amount can never
  change again. This is what lets Phase 1 skip building a clawback
  mechanism entirely.

**Decision Point C-12 — `payments.payout_id` as a structural backstop
against double-counting.** Set once a payment is swept into a payout,
never cleared, checked via `payout_id IS NULL` — independent of whether
an admin's chosen period dates happen to overlap a previous run.
`SELECT ... FOR UPDATE` on the matched payments means two concurrent runs
for the same owner can't both claim the same payment (same
read-committed-plus-row-lock pattern `test_concurrency.py` already proves
for bookings) — though unlike that guarantee, this one has **not** been
proven under an explicit N-way concurrent load test, and there is
currently no database-level constraint (no equivalent of
`uq_active_booking_per_unit`) that would catch a double-payout if some
future code path touched `payments.payout_id` outside `run_payout()`'s
locked pattern. Worth a trigger-based safeguard if more code ever touches
this column directly; not built now — would be over-engineering for a
"Phase 1, manual payout run" feature with exactly one writer today.

Payouts get a two-step admin-confirmed treatment (`run` then
`mark-paid`) rather than the atomic pattern Decision Point C-8 chose for
refunds — a deliberate difference, not an inconsistency: C-8 went atomic
specifically to match `flag_booking`'s existing precedent; there's no
equivalent atomic precedent for payouts, so on its own merits this is
exactly the "a human is about to move real money" case
`confirm_booking_by_admin`'s split already exists for.

## Redis removed — Postgres-only, per explicit client direction

This backend previously used Redis for one thing: login rate limiting
(`check_login_rate_limit`, Phase C2). Redis has been removed from the
project entirely — not deferred, not made optional. What changed:

- **`login_rate_limits`** (new table, `app/models/core.py`) replaces the
  Redis `INCR`+`EXPIRE` fixed-window counter. `check_login_rate_limit()`
  (`app/modules/auth/service.py`) now does one atomic Postgres UPSERT —
  increment within the current window, or reset to a fresh window once
  the old one has expired — as a single round-trip, same fixed-window
  semantics (10 attempts / 60s) as before, same observable behavior
  (`test_login_rate_limited_after_too_many_attempts` is unchanged).
- `app/redis_client.py` deleted. `redis` removed from `requirements.txt`.
  `REDIS_URL`/`redis_url` removed from `.env.example`/`app/config.py`.
  Every test file's `client` fixture no longer takes a `test_redis`
  parameter or overrides a `get_redis` dependency — there's nothing left
  to override.
- The Redis hold-expiry sweep job that was on the "not built yet" list
  since `PHASE_C_SUMMARY.md` is **no longer applicable as originally
  framed** — it was always going to be Redis-backed (TRD §5's original
  design). If an automated hold-expiry sweep is still wanted, it now needs
  a Postgres-native mechanism (e.g. a periodic query against
  `hold_expires_at`, run by an external scheduler) rather than a Redis TTL
  callback. Re-added to the outstanding list below with this note attached
  so it isn't picked up later against a stale assumption.
- `RefreshToken`'s model docstring, comparing its design to "Redis as the
  UX layer," is left as-is — it's explaining a Phase C2 design choice that
  remains accurate (why sessions live in Postgres, not a cache), not
  claiming Redis is used anywhere now.

No functional code anywhere in `app/` references Redis any longer
(verified by grep, not just by removing the obvious spots); the full test
suite was run and passed with the Redis package uninstalled and the
daemon stopped, not just unused while still running in the background.

## Admin oversight — Decision Points C-13, C-14, C-15

`01_PRD.md` §5's admin stories: "View platform-wide bookings and GMV,"
"Suspend a listing or user," "View audit log of sensitive actions."
`audit_logs` has been write-only since `PHASE_C3_SUMMARY.md` built it (its
own docstring: "no update path anywhere in this codebase — a row, once
written, is never changed, only ever read") — this is its first real read
path.

```
GET  /api/v1/admin/audit-log                    — admin only; filterable by actor_id/entity_type/entity_id/date_from/date_to, paginated
GET  /api/v1/admin/overview                       — admin only; GMV, bookings-by-status, commission collected, pending-approval counts
POST /api/v1/admin/venues/{id}/suspend              — admin only; {reason}; only a currently-active venue
POST /api/v1/admin/venues/{id}/reactivate             — admin only; suspended -> active
POST /api/v1/admin/users/{id}/suspend                   — admin only; {reason}; blocks login, revokes refresh tokens; can't suspend yourself
POST /api/v1/admin/users/{id}/reactivate                  — admin only
```

**Admin-facing list endpoints (added completing the AdminLayout.tsx
frontend wiring, not part of the original C-13/C-14/C-15 slice).** Every
`GET /owner/...` route added for the Owner dashboard is scoped to the
caller's own `owner_id`/venues — including when the caller is an admin,
who normally owns nothing. There was no route anywhere that let an admin
discover which venue/verification/user/booking/payout IDs exist to act on
via the suspend/approve/reject/confirm-payment/mark-paid routes that
already existed (some from this section, some from Catalog/Owner
onboarding/Payment confirmation/Owner payout ledger below). Five
platform-wide, admin-only list routes were added to close that gap, each
alongside the action routes it's the discovery mechanism for:

```
GET /api/v1/admin/venues                — every venue regardless of status/owner; ?status= filter
GET /api/v1/admin/owner-verifications    — every verification regardless of applicant; ?status= filter; response shape includes
                                            applicant name/email/document_url (deliberately NOT the same shape as GET /owner/verification —
                                            see AdminOwnerVerificationView's docstring for why exposing identity here is fine)
GET /api/v1/admin/users                  — every user; ?role= and/or ?suspended= filters
GET /api/v1/admin/bookings               — every booking regardless of venue owner; ?status=/?venue_id=/?date_from=/?date_to= filters;
                                            same no-customer-identity guarantee as GET /owner/bookings
GET /api/v1/admin/payouts                — every payout regardless of owner; ?status= filter
```

**Decision Point C-13 — "GMV" and the payout ledger's "gross_amount" are
deliberately different senses of "gross" (flag for awareness).** GMV here
is `SUM(booking.amount)` — the original, pre-refund booking value — for
any booking that was genuinely paid for at some point, including ones
later refunded. The payout ledger's `gross_amount`
(`PHASE_C8_SUMMARY.md`'s Decision Point C-11) nets out refunds to
represent what the platform actually retained. Both are individually
standard uses of "gross" in their own context (GMV as top-line
marketplace activity; a payout's gross as the pre-commission base) — using
the same English word for two different figures in the same codebase is
worth a named callout, not an assumption that they match.

**Decision Point C-14 — user suspension is a new field, blocks login +
revokes refresh tokens, and stops there (flag for awareness).** Not a
reuse of `deleted_at` — that's documented (`06_Backend_Schema.md` §1) as
being about preserving referential integrity on permanent-ish removal, a
different concern from a temporary, admin-reversible dispute action.
`suspended_at`/`suspension_reason` block future logins (merged into the
same generic 401 as wrong-password/deleted, deliberately not a distinct
"account suspended" message — a distinct message would let an attacker
probe which emails belong to suspended accounts, the same enumeration
risk the existing `deleted_at` check already avoids) and revoke every
active refresh token. **What this does not do:** invalidate an
already-issued access token still inside its 15-minute TTL — the same
bounded trade-off this codebase already accepts for `logout()`. Adding a
per-request suspension check to `get_current_user` would close that
window but add a DB round-trip to what's currently a stateless JWT decode
on every single protected request in the app — a much bigger change than
this slice, not undertaken here.

**Decision Point C-15 — venue suspension reuses the existing `'suspended'`
enum value (mechanical, no sign-off needed).** `venue_status` has had
`'suspended'` since the very first migration, unreachable by any code path
until now. A new `suspension_reason` column, kept separate from
`rejection_reason` — different flows with different lifecycles (rejection
clears on resubmission via a content edit; suspension clears on an
explicit reactivate, no content review involved).

## What's deliberately not here yet

Admin oversight is done now (see above) — no longer on this list. Still
outstanding, re-sequenced per `HANDOFF.md` §7:

1. **Notifications.** Zero email/SMS integration.
2. **Reviews/ratings.** `venues.avg_rating` exists as a column; nothing
   computes or writes to it.
3. **Real file storage.** Blocked by this sandbox's network allowlist
   specifically, not by missing design.
4. **Hold-expiry sweep job.** No longer Redis-backed even in concept (see
   "Redis removed" above) — needs a Postgres-native design if still
   wanted; `cancel-pending` covers the practical case manually today.
5. **Launch-readiness bundle.** Dockerfile fix, CI pipeline, dev/staging/
   prod separation, GST invoicing, search-result caching.
6. **Load test (Locust).** Last gate, depends on everything above.

Also still true, not this slice's to fix: neither the guest cancel route
nor `GET /bookings/manage/{token}` implements the per-token rate limiting
`07_design.md` §6 calls for. The payout double-counting protection
(Decision Point C-12, `PHASE_C8_SUMMARY.md`) has one layer (row locking)
where the booking concurrency guarantee has two.

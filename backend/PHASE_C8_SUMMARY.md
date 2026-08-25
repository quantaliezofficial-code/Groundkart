# Phase C, continued again — Owner Payout Ledger, and Two Structural Changes

**Scope delivered:** the owner payout ledger (`HANDOFF.md` §7's next item after `PHASE_C7_SUMMARY.md` resolved customer-initiated cancellation), plus two changes made mid-slice by explicit client direction, unrelated to the payout feature itself but touching much of the same codebase: **Redis removed from the project entirely** (Postgres-only from here on), and **the project renamed from VenueSetu to GroundBooking**. All three are covered below, kept clearly separate since they're different kinds of change.

Same infrastructure caveat as every prior summary: Postgres is this sandbox session's, reinstalled from scratch, restarted several more times while building this slice. One thing *is* different this time, on purpose: Redis is no longer part of this project's infrastructure at all, so it's no longer installed, started, or checked — see §2.

---

## 0. Worth saying plainly before anything else

Two changes in this revision are not features — they're structural, and everything else in this doc sits on top of them:

1. **Redis is gone.** It was used for exactly one thing (login rate limiting). That's now Postgres-backed. No other part of this backend ever depended on Redis.
2. **The project is now GroundBooking, not VenueSetu.** Databases, connection strings, the FastAPI app title, and this backend's own README are all updated. The nine original planning docs, `CLAUDE.md`, `MASTER_PROMPT.md`, and `PHASE_A_SUMMARY.md` through `PHASE_C7_SUMMARY.md` are **not** rewritten — they're historical records of what was true when each was written, the same treatment already given to the original docs throughout this project. `PHASE_C7_SUMMARY.md` still says "VenueSetu" in one place; that's correct, not a leftover.

Noting both once, clearly, rather than letting either pass as an invisible substitution — the same standard `PHASE_C6_SUMMARY.md` §0 set for the payment-model change.

---

## 1. The payout ledger — Decision Points C-10, C-11, C-12

`06_Backend_Schema.md` §4 lists `payouts` as a one-line summary (`owner_id`, `period_start/end`, `gross_amount`, `commission_amount`, `net_amount`, `status`) with an ERD edge from `users` only (§2) — no full DDL, no status enum, no commission rate, and no relationship at all back to bookings/payments, despite `07_design.md` §4 describing it as "one row per owner per settlement period" (necessarily an aggregate of many). Same shape of gap `owner_verifications`/`audit_logs` each were before `PHASE_C3_SUMMARY.md` built them out.

### C-10 — the commission rate (flag for real sign-off)

`01_PRD.md`/`03_Implementation_Plan.md` both name "gross, commission, net" as the shape of the ledger without ever giving the rate itself — confirmed by grepping every planning doc for "commission," which returns exactly those two mentions and nothing numeric. **Implemented:** `PLATFORM_COMMISSION_PERCENT=10` (env-configurable, same treatment as C-5/C-7), a defensible marketplace-commission placeholder, not a confirmed business number.

### C-11 — what "gross" means, what anchors a period, and why eligibility requires the slot date to be in the past (the most foundational decision in this slice)

Three interacting design calls the docs never make, all needed to give "one row per owner per settlement period" an actual, correct implementation:

- **Gross is the amount actually *retained*, not the pre-refund price.** `gross_amount = SUM(payment.amount - COALESCE(payment.refund_amount, 0))` over eligible payments. One formula covers a never-refunded booking (retained == amount), a partially-refunded one (retained == the kept fraction), and a fully-refunded one (retained == 0) — no special-case branching, and it only works because Decision Point C-9 (`PHASE_C7_SUMMARY.md`) already tracks `refund_amount` per payment. This is the clearest connection between the last two slices: last slice's schema decision is what makes this slice's aggregation correct.
- **Period membership is keyed on the inventory unit's slot date, not the payment's confirmation date.** An owner thinks of "July's payout" as bookings for July dates, not as whichever day customers happened to pay.
- **`period_end` must be strictly before today, or the run is rejected (422).** Not just caution: `compute_refund_fraction` (Decision Point C-7) already clamps to the 0%-refund tier once an event's start has passed — so once a slot's date is behind us, its payment's retained amount can never change again. A cancellation attempt after the fact computes a 0% refund and leaves `retained` untouched. Restricting payouts to already-past slot dates is what makes that guarantee hold, and is what lets this stay a simple, one-shot aggregation instead of needing a clawback mechanism.

A run with nothing eligible found is rejected (422) rather than recorded as a ₹0 payout — more likely a mistake in `owner_id`/dates than a genuine empty period.

### C-12 — `payments.payout_id` as a structural backstop, with an honest limit

New nullable FK, set once a payment is swept into a payout, never cleared, checked via `payout_id IS NULL` — independent of whether an admin's period dates happen to overlap a previous run. `SELECT ... FOR UPDATE` on the matched payments inside `run_payout()`'s transaction means two concurrent runs for the same owner can't both claim the same payment: the second blocks, then re-evaluates against the first's committed result — the same read-committed-plus-row-lock mechanism `test_concurrency.py` already proves for bookings.

**Where this is honestly weaker than that guarantee, stated plainly rather than glossed over:** the booking concurrency guarantee has *two* independent layers — the row lock, and a database-level partial unique index (`uq_active_booking_per_unit`) proven as "a real backstop independent of application code" by a test that bypasses the service layer entirely. This slice's protection has only the first layer. There is no database-level constraint that would catch a double-payout if some future code path touched `payments.payout_id` directly, outside `run_payout()`'s locked pattern — and unlike the booking guarantee, this one was **not** proven under an explicit N-way concurrent load test (the sequential "already swept, second run finds nothing" test proves correctness, not concurrency safety specifically). A trigger-based safeguard (`payout_id` write-once) would close this gap; not built now — over-engineering for a "Phase 1, manual payout run" feature with exactly one writer today, per `01_PRD.md` §5's own framing.

### Payouts get the two-step admin-confirmed treatment; refunds (last slice) didn't — deliberately, not inconsistently

`run_payout()` creates a `'pending'` record; a separate `mark_payout_paid()` call is what actually closes it out. This is the *opposite* choice from Decision Point C-8 (customer refunds: atomic, no second step) — and both are correct on their own terms. C-8 went atomic specifically to match `flag_booking`'s existing, tested precedent, avoiding a second refund-execution shape for the same concept. Payouts have no equivalent atomic precedent to stay consistent with; on its own merits, "a human is about to move real money out of the platform's account" is exactly the case `confirm_booking_by_admin`'s two-step split already exists for. Same underlying principle (match precedent where one exists; reason from scratch where one doesn't), different — correct — outcomes.

---

## 2. Redis removed entirely — Postgres-only from here on

Redis had exactly one job in this backend: `check_login_rate_limit()`, a fixed-window counter (10 attempts / 60s) using `INCR`+`EXPIRE`. Per explicit client direction, Redis is removed from the project — not deferred, not made optional.

**Replacement:** a new `login_rate_limits` table (`key` primary key, `window_start`, `attempt_count`) and one atomic Postgres UPSERT:

```sql
INSERT INTO login_rate_limits (key, window_start, attempt_count)
VALUES (:key, now(), 1)
ON CONFLICT (key) DO UPDATE SET
    attempt_count = CASE WHEN <window expired> THEN 1 ELSE attempt_count + 1 END,
    window_start  = CASE WHEN <window expired> THEN now() ELSE window_start END
RETURNING attempt_count
```

Same fixed-window semantics as the Redis version, same threshold, same observable behavior — `test_login_rate_limited_after_too_many_attempts` needed zero assertion changes, only fixture cleanup (see below). One round trip, no separate lock needed: the `CASE` expressions resolve against whatever row version Postgres hands this statement, atomically.

**What else changed:**
- `app/redis_client.py` deleted. `redis` removed from `requirements.txt`, `REDIS_URL`/`redis_url` removed from `.env.example`/`app/config.py`.
- Every test file that had a `client` fixture taking a `test_redis` parameter and overriding `get_redis` — 8 files (`test_offline_payment_confirmation.py`, `test_owner_onboarding.py`, `test_auth_flow.py`, `test_rbac.py`, `test_booking_retrieval.py`, `test_catalog.py`, plus my own `test_booking_cancellation.py`/`test_payout_ledger.py` from the last two slices) — had that parameter and override line removed. `conftest.py`'s `test_redis` fixture and `REDIS_URL` setup deleted outright.
- **Verified, not just asserted:** ran the full suite with the `redis` Python package uninstalled from the environment *and* the Redis daemon stopped (not just unused while still running in the background) — 126/126 still green. A grep across `app/` for "redis" (case-insensitive) turns up only explanatory prose in two docstrings, no functional reference.

**A real, pre-existing bug caught while touching `conftest.py` for this, unrelated to Redis:** the `clean_tables` fixture's `TRUNCATE` list was missing `payouts` — added in the previous tool-call batch of this same session but never added to the truncate list. It hadn't surfaced as a test failure because every payout test creates its own fresh, randomly-generated `owner_id`, so leftover rows from earlier tests never collided with a later test's assertions — but rows were silently accumulating across the session's test runs, a real test-isolation gap. Fixed alongside adding `login_rate_limits` to the same list, while already editing that fixture for a different reason.

**One thing this removal changes for the outstanding-work list:** the Redis hold-expiry sweep job, on the "not built yet" list since `PHASE_C_SUMMARY.md`, was always specified as Redis-backed (TRD §5). That framing no longer applies — if an automated sweep is still wanted, it now needs a Postgres-native design (e.g. a periodic query against `hold_expires_at`), not a TTL callback. Re-added to this doc's §7 with that note attached, so it isn't picked up later against a stale assumption.

---

## 3. Renamed: VenueSetu → GroundBooking

Scoped to what's actually live and reads as "the current state of the project," not a wholesale rewrite of history:

**Changed:** both Postgres databases (`groundbooking`/`groundbooking_test`, role renamed to match), `app/config.py`'s default `DATABASE_URL`, `.env`/`.env.example`, `tests/conftest.py`'s hardcoded test database URL, the FastAPI app title (`"GroundBooking API"`, visible in the OpenAPI docs), the default local-storage upload path (`/tmp/groundbooking-uploads`), and this backend's own `README.md` throughout.

**Deliberately not changed:** the nine original planning docs (`01_PRD.md` through `09_UI_Design.md`), `CLAUDE.md`, `MASTER_PROMPT.md` — historical reference documents from before this session, not live artifacts this backend reads at runtime, the same boundary this whole project has already drawn around them. `PHASE_A_SUMMARY.md` through `PHASE_C7_SUMMARY.md` — already-delivered records of what was true at each point in time; rewriting them would misrepresent history, not correct it. The frontend (`venuesetu-phase-a.zip`) — untouched, out of scope for a backend-only slice; its own folder/package naming would need the identical rename whenever frontend work next resumes, flagged here so that's not a surprise then.

---

## 4. Test coverage added

20 new tests (19 payout ledger + rate-limit fixture cleanup across 8 existing files, no new rate-limit test logic needed since the observable behavior is unchanged), full suite now **126 tests**, 3 clean runs at ~50s each, plus the Redis-uninstalled verification run described in §2:

| File | Count | Proves |
|---|---|---|
| `tests/test_payout_split.py` | 5 | Decision Point C-10's math: default 10%, a rounding edge case, zero gross, the rate is read from settings live — and the property that actually matters for a financial ledger: commission + net always reconstitutes gross exactly, no independent-rounding penny gap |
| `tests/test_payout_ledger.py` | 15 | Decision Point C-11 end to end: gross uses *retained* amount for a partial refund (not the pre-refund price); a fully-refunded booking contributes ₹0 but still gets swept (`payout_id` set) so it doesn't show up as eligible forever; a period extending into the future, or with `period_start` after `period_end`, is rejected; a payment already swept into one payout can't be swept into another; RBAC on all three routes (admin-only for run/mark-paid, owner-only-and-scoped-to-themselves for the list); double-mark-paid gets 409 |

---

## 5. What's in the zip (additions/changes since `PHASE_C7_SUMMARY.md`)

```
backend/
  app/
    config.py                             — REDIS_URL removed; + platform_commission_percent (C-10); database default renamed
    models/core.py                          — + Payout, + Payment.payout_id/payout relationship, + User.payouts, + LoginRateLimit; PayoutStatus enum in models/base.py
    modules/auth/service.py                   — check_login_rate_limit now Postgres-backed (session, not redis_client)
    modules/payout/service.py (new)             — compute_payout_split, run_payout, mark_payout_paid, list_payouts_for_owner
    modules/storage/base.py                       — default upload path renamed
    schemas/payout.py (new)                          — PayoutRunRequest, PayoutDetail
    main.py                                            — + 3 payout routes; login route no longer takes redis_client; app title renamed
    redis_client.py                                      — deleted
  alembic/versions/
    ..._add_payments_refund_amount_column.py               — (previous slice, unchanged)
    ..._add_payouts_table_and_payment_payout_id.py            — new
    ..._add_login_rate_limits_table.py                          — new
  tests/
    test_payout_split.py, test_payout_ledger.py (new)
    conftest.py                                                    — database renamed; test_redis fixture removed; clean_tables TRUNCATE list fixed (+payouts, +login_rate_limits)
    test_offline_payment_confirmation.py, test_owner_onboarding.py, — test_redis parameter / get_redis override
    test_auth_flow.py, test_rbac.py, test_booking_retrieval.py,      — removed from each; no assertion changes
    test_catalog.py, test_booking_cancellation.py
  requirements.txt                                                    — redis removed
  .env.example, README.md                                                — thoroughly updated: rename, Redis removal, payout endpoints, Decision Points C-10/11/12
```

---

## 6. What's still not done

Per `HANDOFF.md` §7, re-sequenced now that the payout ledger is resolved:

1. **Admin oversight routes.** `audit_logs` rows are written correctly (including both new payout actions, `payout.run` and `payout.marked_paid`); nothing reads them back yet. No GMV/bookings overview, no suspend-listing/suspend-user action.
2. **Notifications.** Zero email/SMS integration.
3. **Reviews/ratings.** `venues.avg_rating` exists as a column; nothing computes or writes to it.
4. **Real file storage.** Blocked by this sandbox's network allowlist specifically, not by missing design.
5. **Hold-expiry sweep job.** No longer Redis-backed even in concept (§2 above) — needs a Postgres-native design if still wanted; `cancel-pending` covers the practical case manually today.
6. **Launch-readiness bundle.** Dockerfile fix, CI pipeline, dev/staging/prod separation, GST invoicing, search-result caching (Postgres-backed now).
7. **Load test (Locust).** Last gate, depends on everything above.

Also still true, not this slice's to fix: neither the guest cancel route nor `GET /bookings/manage/{token}` implements the per-token rate limiting `07_design.md` §6 calls for (flagged in `PHASE_C7_SUMMARY.md`, unchanged here).

**One new, honestly-flagged limitation from this slice** (Decision Point C-12): the payout double-counting protection has one layer (row locking) where the booking concurrency guarantee has two (row locking *and* an independent database constraint). Worth a trigger-based safeguard if more code ever writes to `payments.payout_id`; not built now.

---

## 7. Full backend status check — updated

**Solid and tested today:** the full data model (14 tables now, +2 this slice: `payouts`, `login_rate_limits`), the double-booking concurrency guarantee, auth with refresh rotation (rate-limited login, now Postgres-backed), RBAC, owner onboarding, venue catalog, booking creation/attribution/retrieval, offline payment confirmation, customer-initiated cancellation with the refund-tier engine, and now — the actual point of this slice — the owner payout ledger, end to end, on Postgres alone with no other infrastructure dependency. 126 tests, all currently green, 3 clean runs.

**Remaining backend slices:** 7, unchanged in count from `PHASE_C7_SUMMARY.md` — the payout ledger was the next scheduled item and is now resolved; everything left is its own follow-on system (admin oversight, notifications, reviews), operational hardening (storage, sweep job, launch bundle), or the final gate (load test).

## 8. Suggested next step

Admin oversight routes are the natural next slice per `HANDOFF.md` §7: `audit_logs` now has real, meaningful rows from *five* distinct action types (owner verification approve/reject, venue approve/reject, offline payment confirm, and now payout run/mark-paid) with no way to read any of them back, and no GMV overview exists despite the payout ledger now producing exactly the aggregate figures such an overview would want to surface.

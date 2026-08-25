# Phase C, continued again — Customer-Initiated Cancellation + the Refund-Tier Engine

**Scope delivered:** the gap named explicitly at the front of this session's `HANDOFF.md` §7 and in every status check since `PHASE_C5_SUMMARY.md`: a customer (or guest) cancelling a *confirmed* booking they already paid for, with a refund computed by distance-from-event tiers. `flag_booking` (owner, always 100%) and `cancel-pending` (admin, unpaid requests only) already existed; this was the one remaining hole in the booking lifecycle itself.

Same infrastructure caveat as every prior summary, for the same reason it keeps needing repeating: Postgres/Redis are this sandbox session's, reinstalled from scratch this session, restarted three more times while building this slice (the shell environment reset between tool calls, same as documented in every `PHASE_C*_SUMMARY.md` so far). Data survived each restart; the daemons just needed restarting.

---

## 0. Confirmed before any code was touched, per this session's instructions

**Payment model actually implemented:** offline admin-confirm (`POST /api/v1/admin/bookings/{id}/confirm-payment`), not Razorpay — `confirm_booking_from_webhook()` remains dormant. Not "fixed" toward the original docs.

**Next backend slice per `HANDOFF.md` §7:** #1, this one.

---

## 1. Decision Points C-7, C-8, C-9

### C-7 — the refund tiers themselves (flag for real sign-off)

Every doc references "the standard distance-from-event refund tiers" as though defined elsewhere. None of them — `01_PRD.md`, `02_TRD.md`, `05_App_Flow.md`, `06_Backend_Schema.md`, `07_design.md` — actually specify the tier count, cutoffs, or percentages. The only concrete anchor across all nine planning docs is one hedged example in `03_Implementation_Plan.md`: *"e.g., free cancellation > 48h before, partial refund inside that window."* `05_App_Flow.md`'s state diagram implies a third, no-refund tier (its decision node has three branches: full refund / partial refund / window passed) without naming where it starts, and no doc says whether this should vary by `unit_type` despite hourly turfs and weeks-out banquet halls having very different natural lead times.

**Implemented** (env-configurable, same treatment as Decision Point C-5's hold duration):

| Time before the slot's start (IST) | Refund |
|---|---|
| ≥ 48h | 100% |
| 24h – 48h | 50% |
| < 24h | 0% |

For a half_day/full_day unit (no `start_time`), "the slot's start" is local midnight IST at the start of `date` — the same no-natural-intraday-moment reasoning Decision Point B-1 already established, applied to a different problem. A past event clamps to the 0% tier rather than erroring or extrapolating a negative percentage. All three numbers live in `app/config.py` / `.env`, read live (not cached into a module constant) specifically so a test can monkeypatch them and see immediate effect — a small, deliberate refinement over `HOLD_DURATION`'s module-constant pattern, not a criticism of it (that pattern exists because `HOLD_DURATION` gets used inline in a hot path; this doesn't need to).

### C-8 — atomic refund, not a second admin-confirmed step (flag for awareness, not sign-off)

Since Phase C6 removed Razorpay entirely, there's no more of a real gateway behind a *refund* than there is behind a payment *collection* — the same reasoning that made payment confirmation require a human (`confirm_booking_by_admin`) could apply symmetrically here: request cancellation, compute the tier, then require an admin to confirm the money actually left the account before the booking reaches `refunded`.

Went the other way: `cancel_booking_as_customer`/`cancel_booking_by_manage_token` are atomic — tier computed, booking cancelled, payment marked refunded, all in one transaction, no second step. Reasoning: `flag_booking` (Phase B, predates the Phase C6 payment-model change) already has exactly this atomic property for the owner-flagged 100% case, complete with a docstring reference to "the actual gateway refund call happens in the Payments module" that was never true even before C6 (`modules/payments/__init__.py` is, and was, empty). Rather than introduce a *second*, different refund-execution shape for the same underlying concept in the same codebase — one atomic, one admin-gated — this matches the existing, tested precedent. If the client's real offline process needs a "confirm the money actually left the account" step, `refund_amount` is already tracked per-payment (C-9 below), so that's a small, well-isolated follow-up — and it would naturally pair with the still-unbuilt owner payout ledger, which needs real money-movement tracking anyway.

### C-9 — `payments.refund_amount` (mechanical, no sign-off needed)

No column anywhere records a partial refund: `payment_status` is binary (`success`/`refunded`) and `amount` is fixed at collection time. Added a nullable `Numeric(10,2)` `refund_amount` column, populated by the new cancellation path *and* by `flag_booking` (a one-line addition to a loop that function was already running) — without touching `flag_booking` too, a `'refunded'` payment row would mean "some unknown amount" from one path and "exactly this much" from the other, which is worse than the one-line addition. Migration generated via `alembic revision --autogenerate`, hand-reviewed (clean — a single `ADD COLUMN`, nothing to fix), applied to both databases, and round-tripped (`downgrade -1` → `upgrade head`) rather than just written and assumed.

### A small, reasoned deviation from the docs — not a decision point

`07_design.md` §3.3 specifies the account-holder route as `DELETE /api/v1/bookings/{id}`. Implemented as `POST /api/v1/bookings/{id}/cancel` instead, matching every other state-changing booking route already in this codebase (`flag`, `confirm-payment`, `cancel-pending` are all POST, never DELETE) — including the doc's *own* guest-side equivalent for this exact operation, which `07_design.md` itself specifies as `POST .../cancel`, not DELETE. Checked the actual frontend (`venuesetu-phase-a.zip`) before deciding this was safe to deviate on: `MyBookings.tsx`'s cancel action is still local-state-only (`onCancelBooking` callback, no real HTTP call at all — Phase D hasn't started), so nothing on either side is depending on the literal verb yet.

---

## 2. What actually got built

- `compute_refund_fraction()` — the pure tier calculation (Decision Point C-7), deterministic given `(now, unit)`.
- `cancel_booking_as_customer()` / `cancel_booking_by_manage_token()` — row-locked, status-guarded (`confirmed` only — matches `cancel_pending_booking`'s own stated boundary that a pending, unpaid request is a different operation), sharing one `_apply_customer_cancellation()` transition helper so the account and guest paths can't drift, the same shape `_apply_payment_confirmation` already uses for the two payment-confirmation entry points.
- `POST /api/v1/bookings/{id}/cancel` — `require_role("customer")`. A different customer's token passes the role gate and then gets 404 from the service layer's ownership check (matches `get_booking_for_viewer`'s PII-leak-avoidance precedent, Implementation Plan Phase 0 item #3). An owner/admin token gets a flat 403 from the role gate itself — a deliberate difference from the 404 pattern, reasoned through below.
- `POST /api/v1/bookings/manage/{token}/cancel` — no auth dependency at all, same as the existing `GET` equivalent; the token is the entire authentication.
- `flag_booking()` touched minimally: now also sets `payment.refund_amount = payment.amount` (Decision Point C-9).
- `payments.refund_amount` column + migration.

**Why an admin gets 403, not 404, on the account-holder route** (worth stating plainly, since it's a real fork and I went a different way than `get_booking_for_viewer`'s read-side pattern): `get_booking_for_viewer`'s 404-not-403 is specifically about hiding a booking's *existence* from a stranger with no legitimate way to know about it — a real enumeration concern. An admin isn't that stranger: they already have read access to any booking via `GET /bookings/{id}`'s admin-inclusive branch, so a 404 here wouldn't actually hide anything an admin couldn't already confirm by looking. Role-gating this route with `require_role("customer")` (403 for admin/owner) instead matches the *dominant* pattern for state-changing booking actions already in this file — `flag`, `confirm-payment`, and `cancel-pending` are all `require_role`-gated the same way. Tested explicitly (`test_admin_token_gets_403_not_this_customer_route`), not left as an assumption.

---

## 3. Three things that went wrong, all in my own test-writing, not in application code

Worth being as plain about this as prior phases were about real application bugs — this time the bugs were mine, in the tests, not in the code being tested:

1. **Wrong `InventoryUnit` fields.** Constructed test fixtures with `unit_type=` and `status=` kwargs, copying what felt natural from the `Venue`/booking-creation shape. `unit_type` actually lives on `Venue`, not `InventoryUnit` — confirmed by checking `test_grace_period.py`'s existing bare-object construction pattern, which uses neither field. `TypeError: 'unit_type' is an invalid keyword argument` on the very first test run — caught immediately, before it could hide behind a false pass.
2. **Backwards assertion in my own settings-override test.** First draft raised `cancellation_full_refund_hours` from 48 to 72 and asserted a 47h59m-out booking would flip to `full_refund`. Backwards: *raising* the full-refund cutoff can only *narrow* who qualifies for it, not widen it. The test failed against its own wrong expectation, exactly the "a test I wrote was wrong, and it caught itself" shape `PHASE_C6_SUMMARY.md` §4 described. Fixed by lowering the cutoff instead, which is the direction that actually flips a partial case to full.
3. **Missing `Payment` row in test setup.** `confirm_booking_from_webhook()` — the existing fast-path shortcut `test_rbac.py` already uses to get a booking to `confirmed` without caring how — takes no payment details and, by design, creates no `Payment` row. My cancellation logic correctly refunds based on *actual payment rows*, so a booking confirmed only through that shortcut correctly refunded ₹0 regardless of tier — not a bug in the refund logic, a gap in my test fixture. Fixed by seeding a real `Payment(status="success")` row alongside the shortcut in a new `_seed_successful_payment()` helper.

No real bugs found in the pre-existing application code this slice — the closest candidate (`flag_booking`'s vestigial "the actual gateway refund call happens in the Payments module" docstring, referring to a module that's empty and was never built) predates this slice, isn't wrong so much as aspirational-and-stale, and is called out in Decision Point C-8 above rather than "fixed," since changing what it *does* wasn't asked for.

---

## 4. Test coverage added

27 new tests, full suite now **106 tests**, 3 clean runs at ~40s each (plus a 4th earlier run at each intermediate stage — infrastructure restarts included, same resilience already demonstrated in every prior phase):

| File | Count | Proves |
|---|---|---|
| `tests/test_refund_tiers.py` | 12 | Decision Point C-7's math directly: both boundaries (48h, 24h) exactly and just-under; a past event clamps instead of erroring; the half/full-day midnight-IST reference point across all three tiers; a case constructed so an IST-vs-UTC-naive bug would land in a *different* tier, not just a slightly wrong number; both settings are read live, not hardcoded |
| `tests/test_booking_cancellation.py` | 14 | The HTTP wiring end to end for both entry points: full/partial/no-refund tiers reaching the right amount through real HTTP; a different customer gets 404 (not 403); an admin gets 403 (not 404) — the opposite call from the read path, reasoned through in §2; a `pending_payment` booking can't be cancelled through this route; double-cancel gets 409; a booking already terminal via `flag_booking` can't be re-processed through this second door; both anonymous-access properties (401 with no token on the account route, 200 with no `Authorization` header at all on the guest route); reason is optional on both paths |
| `tests/test_rbac.py` (+1) | 1 | `flag_booking` now also populates `refund_amount` (Decision Point C-9) |

Deliberately **not** added: a dedicated concurrency test for double-cancellation. Both new functions reuse the exact `SELECT ... FOR UPDATE` row-locking mechanism `test_concurrency.py` already proves safe under 25-way concurrent load for booking creation — a second concurrent-cancel test would be re-proving the same Postgres/SQLAlchemy locking primitive, not new logic specific to this slice.

---

## 5. What's in the zip (additions/changes since `PHASE_C6_SUMMARY.md`)

```
backend/
  app/
    config.py                          — + cancellation_full_refund_hours, cancellation_partial_refund_hours, cancellation_partial_refund_percent (Decision Point C-7)
    models/core.py                       — + Payment.refund_amount (Decision Point C-9)
    modules/booking/service.py             — + compute_refund_fraction, _event_start_ist, _apply_customer_cancellation, cancel_booking_as_customer, cancel_booking_by_manage_token; flag_booking touched to populate refund_amount
    schemas/booking.py                       — GuestBookingCancelRequest -> BookingCancelRequest (+ optional reason field it was built to accommodate), + BookingCancelResponse
    main.py                                    — + POST /bookings/{id}/cancel, + POST /bookings/manage/{token}/cancel
  alembic/versions/..._add_payments_refund_amount_column.py
  tests/test_refund_tiers.py, tests/test_booking_cancellation.py, tests/test_rbac.py (+1 test)
  .env.example, README.md                          — updated: new settings documented, new routes listed, Decision Points C-7/8/9 given their own section, a pre-existing stale line about owner onboarding (accurate as of Phase C2, contradicted by Phase C3 onward, never corrected) fixed while already in the file
```

---

## 6. What's still not done

Also surfaced while building this slice, out of its scope, flagged rather than fixed or silently ignored: neither the new guest cancel route nor the pre-existing `GET /bookings/manage/{token}` implements the per-token rate limiting `07_design.md` §6 calls for. Real, pre-existing gap — not introduced by this slice, and not fixed by it either, since fixing it only for the new route while leaving its sibling GET route unprotected would be an odd half-measure, and broader rate-limiting wasn't what was asked for here.

Not extended this slice, on purpose: `GET /bookings/{id}` still doesn't expose historical refund amounts — the cancellation response itself shows the customer what they're getting back at the moment of cancelling, which is the actual need; showing it again later on the detail view would need eager-loading `payments` in three more places (`get_booking_for_viewer`, `list_bookings_for_customer`, `get_booking_by_manage_token`) for a nice-to-have, not a gap in this slice's actual scope.

---

## 7. Full backend status check — updated

**Solid and tested today:** the full data model (still 12 tables, +1 column), the double-booking concurrency guarantee, auth with refresh rotation, RBAC, owner onboarding, venue catalog, booking creation/attribution/retrieval, offline payment confirmation, and now — the actual point of this slice — customer-initiated cancellation with a distance-from-event refund-tier engine, end to end, on both the account-holder and guest paths. 106 tests, all currently green, 3 clean runs.

**Remaining backend slices, re-sequenced now that cancellation is resolved** (per `HANDOFF.md` §7):

1. **Owner payout ledger.** Needs its own schema decision first — no `payouts` table exists yet, same shape of gap `refresh_tokens`/`owner_verifications`/`audit_logs` each were before being resolved. Decision Point C-8 above is directly relevant once this gets built.
2. **Admin oversight routes.** `audit_logs` rows are written correctly; nothing reads them back yet. No GMV/bookings overview, no suspend-listing/suspend-user action.
3. **Notifications.** Zero email/SMS integration. "Booking confirmed" and now "booking cancelled" are both real, reachable events to trigger off.
4. **Reviews/ratings.** `venues.avg_rating` exists as a column; nothing computes or writes to it.
5. **Real file storage.** Blocked by this sandbox's network allowlist specifically, not by missing design — the `FileStorage` interface is ready.
6. **Redis hold-expiry sweep job.** `cancel-pending` covers the practical case manually; the automated backstop still doesn't exist, and matters more, not less, now that holds can legitimately last 24h+.
7. **Launch-readiness bundle.** Dockerfile fix, CI pipeline, dev/staging/prod separation, GST invoicing, search-result Redis caching, and — surfaced this slice — the manage-token rate limiting gap in §6 above.
8. **Load test (Locust).** Last gate, depends on everything above.

**So: roughly 7 remaining backend slices**, unchanged in count from `PHASE_C6_SUMMARY.md` — cancellation was the one genuinely unbuilt piece of core booking-lifecycle functionality; everything left is now either its own follow-on system (payouts, notifications, reviews), operational hardening (storage, sweep job, launch bundle), or the final gate (load test).

## 8. Suggested next step

Owner payout ledger is the natural next slice: it's the next item on `HANDOFF.md` §7's list, and Decision Point C-8 above (atomic refund, no admin-confirms-money-sent step) means every refund this slice processes is currently tracked only as a `payments.refund_amount` figure with no ledger entry anywhere — which is fine for now, but is exactly the kind of gap a payout ledger's schema decision should account for from the start rather than retrofit later.

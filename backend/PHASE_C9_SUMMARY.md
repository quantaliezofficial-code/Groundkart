# Phase C, continued again — Admin Oversight

**Scope delivered:** the admin oversight routes `HANDOFF.md` §7 named as the next item after `PHASE_C8_SUMMARY.md` resolved the owner payout ledger — `01_PRD.md` §5's three admin stories: "View platform-wide bookings and GMV," "Suspend a listing or user," "View audit log of sensitive actions." `audit_logs` has been write-only since `PHASE_C3_SUMMARY.md` built it — this is its first real read path.

Same infrastructure caveat as every summary since Postgres-only became the norm: this sandbox's Postgres, reinstalled from scratch, restarted several more times this slice.

---

## 1. Decision Points C-13, C-14, C-15

### C-13 — "GMV" and the payout ledger's "gross_amount" are deliberately different senses of "gross" (flag for awareness, not sign-off)

Both `01_PRD.md` and `03_Implementation_Plan.md` name "GMV" without defining it, and neither doc anticipated that a *different* feature in this same codebase (the payout ledger, `PHASE_C8_SUMMARY.md`) would already be using the word "gross" for something related but distinct. Worth disambiguating explicitly rather than letting a reader assume they match:

- **GMV** (`get_platform_overview()`) = `SUM(booking.amount)` — the original, pre-refund booking value — for any booking that reached a state where money genuinely changed hands (`confirmed`, `refunded`, `completed`), *including* ones later refunded. This is the conventional marketplace sense: top-line transaction volume, unreduced by what happened afterward.
- **`payouts.gross_amount`** (Decision Point C-11, previous slice) = the amount the platform actually *retained* after any refund — the base commission gets computed against.

Both are individually correct, standard uses of "gross" in their respective contexts. Implemented, tested, and now documented as two deliberately different figures, not reconciled into one — because they measure different things and reconciling them would make one of the two wrong.

### C-14 — user suspension: a new field, blocks login + revokes refresh tokens, and stops there (flag for awareness)

`users.suspended_at`/`suspension_reason` are new — **not** a reuse of the existing `deleted_at` column, which `06_Backend_Schema.md` §1 documents as being specifically about preserving referential integrity on permanent-ish removal ("a venue with booking history should never be hard-deleted"), a different concern from a temporary, admin-reversible dispute action.

`login()` treats a suspended account exactly like a deleted or wrong-password one: merged into the same generic 401, not a distinct "account suspended" message. This wasn't the first instinct while designing this (a distinct message initially seemed more helpful to a legitimate suspended user) — but the existing `deleted_at` check's own comment already states why that's wrong: a distinct message lets an attacker enumerate which emails belong to suspended (or deleted) accounts, information a generic failure doesn't leak. Reversed that initial instinct before writing any code, in favor of consistency with the precedent already sitting in this exact function.

Suspending a user also revokes every one of their currently-active refresh tokens (reusing the *existing* `revoked_at` mechanism the reuse-detection logic already relies on — no new revocation concept invented). **What this deliberately does not do:** invalidate an access token already issued and still inside its 15-minute TTL. Adding that would mean a DB round-trip on `get_current_user` for literally every protected request in the entire application — a much bigger architectural change than "add a suspend action," and the same bounded trade-off this codebase already accepts for `logout()` (which also only revokes the refresh token, not outstanding access tokens). Flagged plainly rather than silently accepted: a suspended user's session doesn't die instantly, it dies within 15 minutes.

One small guard added without explicit doc support, because leaving it out would be an obviously bad gap: an admin cannot suspend their own account (422).

### C-15 — venue suspension reuses the existing `'suspended'` enum value (mechanical, no sign-off needed)

`venue_status` has included `'suspended'` since the very first migration (`06_Backend_Schema.md`'s original DDL) — completely unreachable by any code path until this slice. New `suspension_reason` column, kept deliberately separate from the existing `rejection_reason` (Decision Point C-3, `PHASE_C4_SUMMARY.md`): rejection is a content-review outcome that clears automatically on a genuine resubmission edit; suspension is an independent dispute-driven action with its own lifecycle (suspend/reactivate, no content review involved). Conflating the two would make either action's history ambiguous about which flow actually produced a given reason string.

---

## 2. What actually got built

```
GET  /api/v1/admin/audit-log       — filterable by actor_id/entity_type/entity_id/date_from/date_to, paginated, most-recent-first
GET  /api/v1/admin/overview          — GMV, bookings-by-status breakdown, commission collected, pending-approval counts
POST /api/v1/admin/venues/{id}/suspend    — {reason}; only a currently-active venue; hides it from public search immediately (reuses the existing visibility rule — no change needed there)
POST /api/v1/admin/venues/{id}/reactivate   — suspended -> active, restores search visibility
POST /api/v1/admin/users/{id}/suspend         — {reason}; blocks login, revokes refresh tokens, can't target yourself
POST /api/v1/admin/users/{id}/reactivate        — clears suspension; user just logs in again normally
```

No new tables — `07_design.md` §4 describes Admin as cutting "across Catalog and Auth rather than owning its own tables," which held up exactly as written: every new capability here is a new operation against `Venue`, `User`, or `AuditLog`, not a new schema concept.

---

## 3. Test coverage added

26 new tests, full suite now **152 tests**, 3 clean runs at ~75s each:

| Area | Count | Proves |
|---|---|---|
| Audit log | 7 | Admin-only; filters by entity_type/entity_id/actor_id individually (not just "some filter works"); most-recent-first ordering; `limit` respected; entries come from a *real* action (venue suspend), not a synthetic insert |
| Overview | 5 | Admin-only; GMV correctly excludes a `pending_payment` booking that never actually paid anything, while including a confirmed one at its full pre-refund amount (Decision Point C-13); bookings-by-status breakdown; pending-approval and active-venue counts |
| Venue suspend/reactivate | 6 | Only an active venue can be suspended (409 otherwise); suspending immediately removes public visibility via the *existing* visibility check (no new logic needed to prove this — same rule pending/rejected venues already use); reactivating restores it; role-gated |
| User suspend/reactivate | 8 | Suspension blocks a subsequent login attempt; existing refresh tokens are actually revoked in the database, not just conceptually; can't suspend yourself; double-suspend gets 409; reactivating allows login again; role-gated; the audit log entry carries the real reason string |

---

## 4. A schema gap noticed and fixed while building this, one hop away from the actual ask

`VenueResponse` already exposed `rejection_reason` but had no field for the new `suspension_reason` — meaning an admin or owner querying a suspended venue's detail would see `status: "suspended"` with no visible explanation, even though the column now holds one. Added `suspension_reason` to `VenueResponse`/`from_venue()` for parity with the existing field, the same way `rejection_reason` is already surfaced. Not a bug in prior work — the field didn't exist until this slice — but worth fixing immediately rather than shipping a response shape that's already one field behind the schema it's supposed to represent.

---

## 5. What's in the zip (additions/changes since `PHASE_C8_SUMMARY.md`)

```
backend/
  app/
    models/core.py                      — + User.suspended_at/suspension_reason, + Venue.suspension_reason
    modules/admin/service.py (new)         — get_audit_log, get_platform_overview, suspend_venue, reactivate_venue, suspend_user, reactivate_user
    modules/auth/service.py                  — login() now also checks suspended_at (same generic 401)
    schemas/admin.py (new)                     — SuspendRequest, AuditLogEntry, PlatformOverview, AdminUserView
    schemas/catalog.py                           — VenueResponse + suspension_reason (parity with rejection_reason)
    main.py                                        — + 6 admin routes
  alembic/versions/
    ..._add_login_rate_limits_table.py               — (previous slice, unchanged)
    ..._add_user_and_venue_suspension_fields.py         — new
  tests/test_admin_oversight.py (new)
  README.md                                              — admin oversight section, Decision Points C-13/14/15, updated outstanding-work list, phase-reference numbers bumped
```

---

## 6. What's still not done

Per `HANDOFF.md` §7, re-sequenced now that admin oversight is resolved:

1. **Notifications.** Zero email/SMS integration.
2. **Reviews/ratings.** `venues.avg_rating` exists as a column; nothing computes or writes to it.
3. **Real file storage.** Blocked by this sandbox's network allowlist specifically, not by missing design.
4. **Hold-expiry sweep job.** No longer Redis-backed even in concept; needs a Postgres-native design if still wanted.
5. **Launch-readiness bundle.** Dockerfile fix, CI pipeline, dev/staging/prod separation, GST invoicing, search-result caching.
6. **Load test (Locust).** Last gate, depends on everything above.

Both honestly-flagged limitations from the last two slices are unchanged and still true: the payout double-counting protection (Decision Point C-12) has one layer where the booking guarantee has two; neither cancellation route implements the per-token rate limiting `07_design.md` §6 calls for.

**One new limitation from this slice, flagged the same way:** suspending a user doesn't invalidate an already-issued access token for up to 15 minutes (Decision Point C-14). A real, bounded window, not a silent gap — but worth remembering if a genuinely instant lockout is ever required (e.g. for a severe abuse case), since that would need the larger architectural change described above, not a small addition.

---

## 7. Full backend status check — updated

**Solid and tested today:** the full data model (14 tables, +2 columns on `users`/`venues` this slice, no new tables), the double-booking concurrency guarantee, auth with refresh rotation and Postgres-backed rate limiting, RBAC, owner onboarding, venue catalog, booking creation/attribution/retrieval, offline payment confirmation, customer-initiated cancellation, the owner payout ledger, and now admin oversight — audit log, platform overview, and suspend/reactivate for both venues and users. 152 tests, all currently green, 3 clean runs.

**Remaining backend slices:** 6, down from 7 — admin oversight was the next scheduled item and is now resolved. Everything left is its own follow-on system (notifications, reviews), operational hardening (storage, sweep job, launch bundle), or the final gate (load test) — none of it blocks on a schema or product decision the way every slice through this one has.

## 8. Suggested next step

Of the six remaining items, none has the same "this genuinely can't be built without a design decision first" shape the last several slices did (payments, cancellation, payouts, and now oversight each turned on a real Decision Point). Reviews/ratings is the smallest, most self-contained remaining feature slice — `venues.avg_rating` already exists, waiting for exactly this — and would be a natural next pick if continuing the feature-by-feature path; notifications is the one every other completed feature (confirmation, cancellation, payout) has been quietly assuming would eventually exist as a trigger point. Either is a reasonable next step; worth your call on which matters more before the launch-readiness bundle becomes the real remaining work.

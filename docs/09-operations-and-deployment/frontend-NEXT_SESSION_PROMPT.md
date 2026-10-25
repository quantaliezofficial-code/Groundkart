# Start Prompt — Admin Dashboard

**How to use this:** paste everything below the line into a fresh Claude Code session opened in this repo (backend or frontend — `handoff.md` is duplicated at the root of both). Don't paste this alongside a summary of any prior conversation; this prompt and `handoff.md` are the only context you need.

---

Before writing a single line, read `handoff.md` in this repo's root, in full. It is the current, authoritative state of this project — written specifically for a session with no other context. Do not proceed on assumptions it contradicts.

If a `docs/` folder is present alongside this repo (`CLAUDE.md`, `01_PRD.md` through `09_UI_Design.md`, `06_Backend_Schema.md`, `07_design.md`, `08_Frontend_Design.md`) and/or `PHASE_C7_SUMMARY.md` / `PHASE_C8_SUMMARY.md` / `PHASE_C9_SUMMARY.md` / `PHASE_D1_SUMMARY.md` / `PHASE_D2_SUMMARY.md` exist in the backend repo, they're useful secondary background — pull the relevant one only when you need it, don't read all of them cover-to-cover up front. If they aren't present, `handoff.md` alone is sufficient to proceed; say so and continue, don't stall waiting for them.

## Your mission

Wire `src/components/AdminLayout.tsx` (frontend) to the real GroundBooking backend, exactly the way `OwnerLayout.tsx` was wired in the previous session — replace 100% of its mock/localStorage data with real API calls. Every backend route this needs already exists and is tested; `handoff.md`'s **Current State** section lists them all with exact paths. This is frontend-and-verification work, not backend design work, unless you discover a genuine gap the same way the previous session found three (see `handoff.md` if you want that precedent).

## Before you start

- Read `handoff.md`'s **Dead Ends** section before attempting anything it covers. Five specific things already failed once, with root causes — don't re-discover them at the cost of real time. In particular: don't reuse `venuesApi.listInventoryUnits`-style skip-auth patterns for authenticated management views; don't trust Tailwind classes just because they're already used elsewhere in this codebase (verify against `src/index.css`'s actual `@theme` block, or check the built CSS output directly); if you touch `vite.config.ts`'s test block, keep the absolute `setupFiles` path; any live-server verification must start, use, and kill the server within one single tool call, not across several.
- Read `handoff.md`'s **Key Decisions & Assumptions** section. In particular: no customer/guest identity is exposed on bookings anywhere in this backend, by design — don't add it while wiring Admin without flagging that as a new decision first, the same way the previous session flagged it instead of quietly resolving it.
- Confirm the current state yourself before trusting any of the above as still accurate — run the backend test suite and confirm frontend `tsc`/`build` are clean, the same way you'd verify any handoff. Don't assume nothing has drifted.

## Operating rules

- Follow the same pattern as `OwnerLayout.tsx`/`hooks/useOwner.ts`/`lib/api/owner.ts` — read those three files as your template before writing the Admin equivalents. Match their conventions (self-contained component calling its own hooks, not prop-drilled from `App.tsx`; one API module per domain; mutations invalidate their own query keys).
- Write a failing test before any code that touches booking or role state specifically — `confirm-payment`, `cancel-pending`, suspend/reactivate, and the approval routes all mutate real state and deserve the same rigor the booking-concurrency work got originally.
- Fix the CSS-token bug in `AdminLayout.tsx` (25 occurrences, exact grep command in `handoff.md`) as part of this same pass — don't defer it, it's the same file you're already rewriting.
- One commit per meaningful slice (e.g., audit log wired → overview wired → suspend/reactivate wired → approval queue wired), not one giant commit at the end. If this environment has no git, treat each slice as a natural checkpoint to verify and report back on anyway.
- Stop and flag any product decision you weren't handed an answer for — guessing and moving on is exactly what caused the "customer identity" question to need flagging last time instead of silently resolving it.
- Before merging/finishing anything touching a screen already in production (the customer journey, Owner dashboard), re-verify it still works. Don't assume your Admin changes are isolated — check.

## Start here

1. Read `handoff.md` in full.
2. Read `app/schemas/admin.py` and `app/modules/admin/service.py` (backend) for the exact request/response shapes of every admin route.
3. Read `src/components/OwnerLayout.tsx`, `src/hooks/useOwner.ts`, and `src/lib/api/owner.ts` (frontend) as your template.
4. Confirm the baseline: run the backend test suite (expect 178 passing) and `tsc --noEmit` + `npm run build` on the frontend (expect clean).
5. Create `src/lib/api/admin.ts`.

Report back after step 5 — not after the whole dashboard is wired.

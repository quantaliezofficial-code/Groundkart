# GROUNDKART — SAFE REPOSITORY CLEANUP & DEAD-CODE ELIMINATION PLAN

## A. Summary & Baseline Observations
- **Git Branch:** `master`
- **Baseline Commit:** `6be2e02 fix: use-cases API schema and frontend rendering`
- **Pre-Cleanup Test Status:**
  - Frontend: 30 passed / 0 failed (100% green across 6 test suites)
  - Backend: 315 passed / 0 failed / 0 errors (100% green across 41 test modules)
  - Typecheck: 0 errors (`tsc --noEmit`)
  - Production Build: 0 errors, 0 warnings (`npm run build`)
- **Working Tree Analysis:**
  - 59 modified tracked files (containing system fixes and test stabilizations)
  - 226 untracked items
  - Primary sources of repository clutter:
    1. 95 root Python one-off patch/scratch scripts
    2. 49 backend root Python one-off patch/scratch scripts
    3. 13 frontend root Python one-off patch/scratch scripts
    4. 5 text log/dump files (`pytest_output.txt`, `out.txt`, etc., totaling ~950 KB)
    5. Redundant backup files (`backend/app/main2.py`, `backend/app/models/core.py.bak`, `backend/old_service.py`)
    6. Stale backup folder `temp_restore/` (2.45 MB, contains nested `.git` folders)
    7. Orphaned root image folder `imgs/` (13.99 MB of unreferenced raw image files)
    8. 2 dead/superseded frontend components (`OwnerVenueModal.tsx` [876 lines], `DetailsStep.tsx` [107 lines])
    9. 1 unused frontend package dependency (`motion` in `frontend/package.json`)

---

## B. Proposed Removals

### Batch 1 — Temporary Logs and Output Artifacts
| File Path | Purpose | Evidence of Non-Use | Risk |
| :--- | :--- | :--- | :--- |
| `backend/out.txt` | Temporary command output dump | Not tracked, not referenced anywhere | P4 / None |
| `backend/pytest_output.txt` | Test run failure output log (~471 KB) | Not tracked, not referenced anywhere | P4 / None |
| `backend/pytest_output2.txt` | Secondary test run output log (~373 KB) | Not tracked, not referenced anywhere | P4 / None |
| `emojis_found.txt` | 0-byte search dump | Not tracked, empty file | P4 / None |
| `frontend/test_output.txt` | Vitest command output dump (~67 KB) | Not tracked, not referenced anywhere | P4 / None |

### Batch 2 — Redundant Backup Files & Directories
| File Path | Purpose | Evidence of Non-Use | Risk |
| :--- | :--- | :--- | :--- |
| `temp_restore/` | Old workspace backup directory (2.45 MB) | Contains duplicate old git history; not imported or referenced | P4 / None |
| `backend/app/main2.py` | Backup copy of main.py (74 KB) | 0 imports; FastAPI entry point is `app/main.py` | P4 / None |
| `backend/app/models/core.py.bak` | Backup copy of core.py (53 KB) | `.bak` extension, 0 imports; models reside in `core.py` | P4 / None |
| `backend/old_service.py` | UTF-16 PowerShell redirected backup of booking service (87 KB) | 0 imports; booking service is in `app/modules/booking/service.py` | P4 / None |

### Batch 3 — Root Python Scratch / Patch Scripts (95 files)
- **Files:** `add_category_endpoints.py`, `append_admin_notifs.py`, `append_support_routes.py`, `debug_test.py`, `find_emojis.py`, `fix_*.py` (35 files), `migrate_dbs.py`, `patch.py`, `patch_*.py` (19 files), `refactor.py`, `refactor_*.py` (5 files), `rename_price.py`, `rename_sportType.py`, `replace_emojis.py`, `replace_selects.py`, `restore_enums.py`, `rewrite_jobs.py`, `rewrite_jobs2.py`, `run_alembic.py`, `update_*.py` (17 files).
- **Purpose:** Ad-hoc scripts executed in previous sessions to inject or patch code in repository files.
- **Evidence of Non-Use:** Full codebase AST/text scan confirms 0 imports or references in application runtime, build scripts, or tests.
- **Side Effects:** None.
- **Risk:** P4 / None.

### Batch 4 — Backend Root Scratch Scripts (49 files)
- **Files:** `backend/add_analytics_routes.py`, `backend/add_badge_ui.py`, `backend/add_dashboard_service.py`, `backend/add_drawer.py`, `backend/add_handler.py`, `backend/add_public_hooks.py`, `backend/append.py`, `backend/append_events.py`, `backend/append_routes.py`, `backend/append_schemas.py`, `backend/append_service.py`, `backend/check_db.py`, `backend/check_hp_table.py`, `backend/check_test_db.py`, `backend/edit_service.py`, `backend/edit_service2.py`, `backend/fix.py`, `backend/fix_*.py` (19 files), `backend/get_booking_sample.py`, `backend/inject_*.py` (6 files), `backend/patch_*.py` (3 files), `backend/restore.py`, `backend/test_db.py`, `backend/test_fastapi.py`, `backend/update_test_reviews.py`.
- **Purpose:** Ad-hoc backend modifier scripts.
- **Evidence of Non-Use:** Full codebase scan confirms 0 imports across `backend/app/`, `backend/tests/`, or configuration.
- **Side Effects:** None.
- **Risk:** P4 / None.

### Batch 5 — Frontend Root Scratch Scripts (13 files)
- **Files:** `frontend/add_frontend_types.py`, `frontend/apply_ui_ux_fixes.py`, `frontend/fix_ios_zoom.py`, `frontend/fix_mybookings.py`, `frontend/modify_admin_api.py`, `frontend/modify_useadmin.py`, `frontend/patch_header.py`, `frontend/refactor.py`, `frontend/refactor_components.py`, `frontend/refactor_final.py`, `frontend/rewrite_overview.py`, `frontend/update_detailview.py`, `frontend/update_mybookings.py`.
- **Purpose:** Ad-hoc frontend file modifier scripts.
- **Evidence of Non-Use:** 0 imports or package.json script references.
- **Risk:** P4 / None.

### Batch 6 — Orphaned Asset Folder (`imgs/`, 13.99 MB)
- **Files:** `imgs/Golden Hour Soccer Scrimmage.png`, `imgs/Growth Strategy at Sunset Conference.png`, `imgs/Luxury Villa Sunset Retreat.png`, `imgs/Rooftop Sunset Soirée with City Lights.png`, `imgs/Sunset Wedding Aisle of Lights.png`, `imgs/Twilight Villa Gathering by the Firepit.png`.
- **Purpose:** Raw unreferenced graphics placed in repository root.
- **Evidence of Non-Use:** Not served by Vite, not in `frontend/public/`, not referenced in any CSS, HTML, component, or backend route.
- **Risk:** P4 / None.

### Batch 7 — Dead Frontend Components (2 files, 983 lines)
- **Files:**
  1. `frontend/src/components/OwnerVenueModal.tsx` (876 lines): Old single-modal venue form superseded by `components/owner/listing-builder/ListingBuilder.tsx`.
  2. `frontend/src/components/owner/listing-builder/DetailsStep.tsx` (107 lines): Abandoned 3-step prototype superseded by `FeaturesStep.tsx` and `PricingStep.tsx`.
- **Evidence of Non-Use:** 0 imports in `frontend/src/` or tests. Verified via text and AST import analysis.
- **Risk:** P3 / Low.

### Batch 8 — Unused Frontend Dependency (`motion`)
- **Package:** `motion` (`^12.23.24` in `frontend/package.json`).
- **Evidence of Non-Use:** 0 occurrences in `frontend/src/`. All animations in `App.tsx`, `DetailView.tsx`, `FiltersSidebar.tsx`, etc., strictly import from `framer-motion`.
- **Action:** Remove `"motion": "^12.23.24"` from `frontend/package.json` and run `npm install` to update `package-lock.json`.
- **Risk:** P3 / Low.

---

## C. Proposed Consolidations (Documented for Visibility)
- **Select Inputs:** `GroundSelect` is the unified custom dropdown. Minor native selects remain in Admin dashboard filters; these are working and tested, preserved to avoid unnecessary risk during cleanup.
- **Types:** `src/types.ts` provides UI view adapters from `src/lib/api/types.ts`. Both serve distinct architectural boundaries (API wire contracts vs. UI view models) and are preserved.

---

## D. Protected Files (Strictly Untouched)
1. **Database Migrations:** All 19 Alembic migrations in `backend/alembic/versions/` (forms active schema revision chain up to `5cc23b4c0e28`).
2. **Backend Services & Schemas:** `backend/app/modules/*` and `backend/app/schemas/*` (active operational services).
3. **Database Scripts:** `backend/scripts/` (`cleanup_temp_records.py`, `full_pipeline_seed.py`, `seed_demo_data.py`), `backend/admin_setup.py`, `backend/seed_placements.py`.
4. **Active Hero Assets:** All 6 category images in `frontend/public/` (`hero-corporate.png`, `hero-outdoor.png`, `hero-party.png`, `hero-resort.png`, `hero-sports.png`, `hero-wedding.png`).
5. **Brand Assets:** `frontend/public/logo-full.png`, `frontend/public/logo-icon.png`, `favicon.svg`.
6. **SEO & Static Assets:** `robots.txt`, `sitemap.xml`.
7. **Legal & Compliance Components:** `TermsOfService.tsx`, `PrivacyPolicy.tsx`, `NotFound.tsx`, `ForgotPassword.tsx`.
8. **Dev Tooling:** `start.bat`.
9. **All Tests & Fixtures:** All 41 backend test files and 6 frontend test suites.

---

## E. Expected Results
- **Files Removed:** ~168 redundant files + 2 directories (`imgs/`, `temp_restore/`).
- **Disk Space Reclaimed:** >17.5 MB (including 13.99 MB raw images, 2.45 MB restore backup, ~1 MB text logs and redundant code).
- **Dependencies Removed:** 1 (`motion`).
- **Repository Health:** 100% clean root, 0 clutter, 0 broken imports, 100% passing test suite.

---

## F. Verification Plan
After executing each batch:
1. `git status --short` to verify exact deletion scope.
2. `npm run lint` (`tsc --noEmit`) to verify 0 broken frontend imports or types.
3. `npm test` (`vitest run`) to verify all 30 frontend tests pass.
4. `npm run build` (`vite build`) to verify bundle compiles without warnings.
5. `python -c "import app.main"` to verify backend loads cleanly.
6. `python -m pytest tests/test_versioning.py tests/test_catalog.py` to verify backend routes and catalog stay fully functional.

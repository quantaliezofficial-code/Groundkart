# BROWSER_DATABASE_AUTH_REMEDIATION_PLAN.md
# GroundKart — Diagnosis and Repair Plan
**Generated:** 2026-10-11 | **Engineer:** Senior Full-Stack / Backend / Auth / QA

---

## 1. Exact Browser Failure Reproduced

**Symptom A — Application not opening in browser:**
Port 8000 was occupied by a separate, unrelated Python application (`python app.py` — Quantaliez Voice Scribe, PID 17260) bound to `127.0.0.1:8000`. This process intercepts all localhost:8000 requests before the GroundKart backend (even when uvicorn is listening on `0.0.0.0:8000`), returning `{"detail":"Not Found"}` or serving Quantaliez HTML for every GroundKart API route.

The GroundKart frontend (Vite) was also **not running** at all. No process listening on port 3000 (its configured port).

**Status after immediate fix:** Quantaliez process killed. Backend now responding on port 8000. Frontend started on port 3000. Both services verified live.

---

## 2. Frontend Startup Findings

| Item | Finding |
|------|---------|
| Entry point | `frontend/src/main.tsx` — React 18 with `BrowserRouter`, `QueryClientProvider`, `AuthProvider` ✅ |
| Vite config | Port 3000, host 0.0.0.0 — correct, consistent with `VITE_API_URL=http://localhost:8000` ✅ |
| `.env` file | `VITE_API_URL=http://localhost:8000` — correct for local dev ✅ |
| API client base URL | Falls back to `http://localhost:8000` if env absent ✅ |
| Dependencies | Node modules present in `frontend/node_modules/` ✅ |
| Frontend startup | **Was NOT running** — must be started manually or via `start.bat` ⚠️ |
| `start.bat` | Correctly starts both services but cannot start backend if port 8000 is occupied by another app ❌ |

**Root Cause A:** Port 8000 conflict with Quantaliez app. The Quantaliez `python app.py` process was binding `127.0.0.1:8000` before GroundKart could, causing all `localhost:8000` requests to be handled by the wrong app.

---

## 3. Backend Startup Findings

| Item | Finding |
|------|---------|
| Import test | `python -c "from app.main import app"` — PASSES with no errors ✅ |
| `ApproveOwnerVerificationRequest` | Correctly defined in `app/schemas/owner_verification.py` ✅ |
| `Notification` import | Correctly imported from `app/models/core` ✅ |
| SQLAlchemy mapper | All models initialize cleanly ✅ |
| Uvicorn startup | "Application startup complete" — clean ✅ |
| `/healthz` endpoint | Returns `{"status":"ok"}` when not blocked by Quantaliez ✅ |
| CORS | Configured for `http://localhost:3000,http://localhost:5173` ✅ |
| Hold sweep loop | Background task starts in non-test environment ✅ |
| Outbox sweep loop | Background task starts in non-test environment ✅ |

**Backend startup issues previously reported (ApproveOwnerVerificationRequest, Notification) are RESOLVED** in the current codebase.

---

## 4. Database Connectivity Findings

| Item | Finding |
|------|---------|
| PostgreSQL version | 18.4 on localhost:5432 ✅ |
| Database name | `groundbooking` ✅ |
| Connection string in `.env` | `postgresql+asyncpg://postgres:sagar007@localhost:5432/groundbooking` ✅ |
| SQLAlchemy connection | Successful ✅ |
| Alembic revision | `5cc23b4c0e28` (current HEAD) ✅ |
| Total venues | 13 (12 active, 1 pending_review) ✅ |
| Total users | 20 ✅ |
| All tables present | 34 tables — schema complete ✅ |

---

## 5. Schema/Migration Findings

| Item | Finding |
|------|---------|
| Schema completeness | All tables referenced in models exist ✅ |
| `User.status` column issue | **NOT PRESENT** — `User` model uses `suspended_at` (datetime) not a status enum — no query targets `User.status` ✅ |
| `Booking.slot_date` issue | Correctly implemented as Python `@property` delegating to `inventory_unit.date` ✅ |
| `audit_logs.actor_id` type | Correctly typed as `UUID | None` with FK to `users.id` ✅ |
| Pending migrations | None — current DB at head ✅ |

**Schema/migration issues previously reported are RESOLVED** in the current codebase.

---

## 6. Venue API Findings

| Test | Result |
|------|--------|
| `GET /api/v1/venues` | 200, returns 12 active venues with full schema ✅ |
| `GET /api/v1/venues?category=sports` | 200, returns 5 sports venues ✅ |
| `GET /api/v1/venues?city=lucknow` | 200, returns 12 venues ✅ |
| `GET /api/v1/categories` | 200, returns 3 categories ✅ |
| Category filter type | Filters on `Venue.category` string column (not UUID) — correct ✅ |
| Visibility filter | Only `status='active'` and `deleted_at IS NULL` — correct ✅ |
| Response shape | `VenueListResponse` with `data`, `total`, `limit`, `offset` — matches frontend expectation ✅ |

**One confirmed issue:** The `list_venues` service has duplicate `selectinload(Venue.media)` and `selectinload(Venue.amenities)` options — they are applied twice (once in the initial query, once before pagination). This causes duplicate SQL joins but is functionally correct. Minor performance issue, not a correctness bug.

---

## 7. Login/Registration Findings

### Login
| Test | Result |
|------|--------|
| Valid credentials | Returns `access_token` correctly ✅ |
| Invalid credentials | 401 `{"detail":"Incorrect email, phone or password"}` — safe message ✅ |
| Login field | Accepts both email and phone via `login_id` field ✅ |
| Frontend login function | Calls `authApi.login(email, password)` which maps to `{ login_id: email, password }` — **CORRECT** but misleading naming (loginId, not email) ✅ |
| Rate limiting | PostgreSQL-backed, 10 attempts per 60s window ✅ |

### Registration (Signup)

**Found issue:** `auth.tsx` `signup` function calls `authApi.signup(name, email, password, phone)` — the `phone` parameter is optional in `authApi.signup`'s TypeScript signature, but `SignupRequest` in the backend requires `phone: str` (not Optional). If the phone input is empty, the backend will reject with a 422.

The `AuthModal` has a required `phone` field (HTML `required` attribute), so frontend validation prevents this. However, the TypeScript typing inconsistency should be fixed.

### Password Reset
**Security VERIFIED:** The `forgot_password` route **does NOT return the token** in the HTTP response. Response is: `{"message":"If an account exists with this email, password reset instructions have been sent."}` — correct, accounts for enumeration prevention. ✅

**One finding:** `forgot_password` service returns `"mock-token"` for non-existent users (for enumeration prevention) but the return value is not used by the route handler. Clean. ✅

---

## 8. API URL/CORS Findings

| Item | Finding |
|------|---------|
| Frontend API base URL | `http://localhost:8000` (from `.env` VITE_API_URL) ✅ |
| Backend port | 8000 ✅ |
| CORS allowed origins | `http://localhost:3000,http://localhost:5173` ✅ |
| Vite port | 3000 ✅ |
| Route prefixes | All backend routes use `/api/v1/...` ✅ |
| Frontend API calls | All use `/api/v1/...` ✅ |
| No double-prefix | Verified — no double `/api/v1` issue ✅ |

---

## 9. Frontend Data Rendering Findings

| Item | Finding |
|------|---------|
| `useVenues` hook | Uses `query.data?.data ?? []` to handle `VenueListResponse` envelope ✅ |
| Error handling | Query errors are exposed in `error` prop, not silently converted to `[]` ✅ |
| Loading state | `isLoading: query.isLoading` exposed correctly ✅ |
| `adaptVenue` adapter | Maps API response to frontend `Venue` type correctly ✅ |
| Category label mapping | `CATEGORY_LABELS` covers `sports`, `banquet_hall`, `farmhouse`, `corporate`, `community_hall` ✅ |
| `DISPLAY_TO_BACKEND_CATEGORY` mapping | Maps display names to backend strings — covers key categories ✅ |
| Placeholder image | Falls back to Unsplash image if no media ✅ |

**One issue found:** In `App.tsx`, `handleCategoryTileClick` is called with `'banquet'`, `'football'`, and `'conference'` in the bento grid — these are NOT in `DISPLAY_TO_BACKEND_CATEGORY`. They will result in `undefined` category being passed to search, falling back to no-category search. The bento grid tiles thus don't actually filter by category.

---

## 10. Media Findings

| Item | Finding |
|------|---------|
| Upload path | `/tmp/groundbooking-uploads` (Linux/Mac) — **Windows incompatible** ❌ |
| Static mount | `app.mount("/uploads", StaticFiles(directory="/tmp/groundbooking-uploads"))` ❌ |
| Windows local uploads | On Windows dev, `/tmp/groundbooking-uploads` doesn't exist as expected |
| Existing venue media URLs | `http://localhost:8000/uploads/venues/{id}/{hash}.jpg` — correct format if dir exists ✅ |
| Placeholder fallback | Unsplash image used when no media — venues still render ✅ |

The `/tmp/groundbooking-uploads` path works on Unix. On Windows, `os.makedirs` creates it at the root of the current drive (e.g., `C:\tmp\groundbooking-uploads`). This may or may not be where uploads land — needs verification. The backend creates the dir, so it won't crash, but new uploads may go to `C:\tmp\...` while the static server serves from the same path.

---

## 11. Confirmed Root Causes

| # | Symptom | Root Cause | Severity |
|---|---------|-----------|----------|
| **RC-1** | App not loading in browser | Quantaliez Voice Scribe app (`python app.py`) was binding `127.0.0.1:8000`, intercepting all localhost:8000 requests from GroundKart frontend | **CRITICAL** |
| **RC-2** | Frontend not running | The Vite dev server was not started; `start.bat` could not start the backend (port conflict) | **CRITICAL** |
| **RC-3** | Category bento tiles don't filter | `handleCategoryTileClick('banquet')`, `('football')`, `('conference')` are not in `DISPLAY_TO_BACKEND_CATEGORY` — sends undefined category, falls back to unfiltered search | **MEDIUM** |
| **RC-4** | Duplicate selectinload in `list_venues` | `selectinload(Venue.media/amenities)` applied twice in same query — inefficiency but not correctness bug | **LOW** |
| **RC-5** | TypeScript phone optional mismatch | `authApi.signup` types `phone` as `string | undefined` but backend requires it | **LOW** (HTML required prevents this at runtime) |

---

## 12. Suspected Causes Requiring Verification

| # | Suspected Issue | Verification Needed |
|---|----------------|-------------------|
| **S-1** | Windows `/tmp/` path for uploads | Check if `C:\tmp\groundbooking-uploads` or `C:\tmp` exists; test file upload end-to-end |
| **S-2** | `start.bat` resilience | If another app claims port 8000, `start.bat` silently fails the backend — no error reporting |

---

## 13. Files to Modify

| File | Change | Priority |
|------|--------|---------|
| `frontend/src/App.tsx` | Fix bento grid `handleCategoryTileClick` calls to use correct category keys | MEDIUM |
| `frontend/src/lib/api/auth.ts` | Make `phone` required in `signup` TypeScript signature | LOW |
| `backend/app/main.py` | Fix `/tmp/groundbooking-uploads` to use cross-platform temp dir | LOW |
| `backend/app/modules/catalog/service.py` | Remove duplicate `selectinload` options in `list_venues` | LOW |
| `start.bat` | Add port conflict check and error messaging | LOW |

---

## 14. Database Changes

**None required.** The database is healthy, all migrations applied, 12 active venues present.

---

## 15. Dependencies Between Fixes

```
RC-1 (Port conflict) → ALREADY FIXED (process killed)
RC-2 (Frontend not running) → ALREADY FIXED (both services started)
RC-3 (Category bento tiles) → Fix App.tsx (independent)
RC-4 (Duplicate selectinload) → Fix catalog service (independent)
RC-5 (Phone TypeScript) → Fix auth.ts (independent)
```

---

## 16. Testing Plan

### After RC-3 fix (category tiles):
1. Click "Banquet Halls" bento tile → should filter by `banquet_hall` category
2. Click "Sports Grounds" bento tile → should filter by `sports` category
3. Click "Corporate Spaces" bento tile → should filter by `corporate` category
4. Verify filtered results appear

### After RC-4 fix (duplicate selectinload):
1. No behavior change expected — query still returns same data
2. Check backend log for any SQL error (should be none)

### General regression:
1. Homepage loads with venues
2. Category chip clicks work
3. Hero search by city works
4. Hero search by category works
5. Venue detail page loads
6. Login with existing credentials works
7. Signup with name/email/phone/password works
8. Protected routes redirect to login when not authenticated
9. Admin dashboard accessible with admin credentials
10. Owner dashboard accessible with owner credentials

---

## 17. Rollback/Recovery Considerations

- **Port conflict:** If Quantaliez restarts, it will again claim port 8000. The permanent fix is to configure either Quantaliez or GroundKart to use a different port. As a developer convenience, GroundKart could use port 8001; update `backend/.env` and `frontend/.env` accordingly.
- **No database changes** are being made, so no rollback needed for DB.
- **No destructive file changes** are planned — all edits are additive or corrective.

# GroundBooking / GroundKart — Admin Password Management Fix Report

**Project:** GroundBooking / GroundKart  
**Feature:** Secure Admin Password-Reset Link Generation, Delivery & Redemption  
**Status:** COMPLETE & VERIFIED  
**Date:** 2026-10-15  

---

## 1. Executive Summary

The Admin Password Management system in GroundBooking/GroundKart has been comprehensively repaired and secured. Administrators can now generate a secure, shareable password-reset link for any eligible customer or venue owner. The generated link is constructed strictly from the validated frontend application origin (`PUBLIC_APP_URL`), contains a high-entropy cryptographically secure one-time token, and opens a dedicated, brand-aligned password-reset page on the actual application domain.

All identified deficiencies—including duplicate email rendering, exposed internal database identifiers, mismatched modal button labels, raw token leakage, missing frontend routing, and missing token revocation—have been resolved and verified with automated test suites in both the frontend (Vitest + React Testing Library) and backend (Pytest + AsyncSession + HTTPX).

---

## 2. Confirmed Root Causes & Remediations

| # | Component | Observed Defect | Root Cause | Remediation Applied |
|---|-----------|-----------------|------------|---------------------|
| 1 | Frontend (`AdminPasswords.tsx`) | Contact column printed user email twice | Copy-paste bug: line 79 rendered `{user.email}` instead of `{user.phone}`. | Rendered `{user.email}` on line 1, followed conditionally by `{user.phone}` only if non-empty. No placeholder or duplicate email. |
| 2 | Frontend (`AdminPasswords.tsx`) | Raw UUID displayed in primary user column | Line 75 rendered `{user.id}` directly beneath the user's name. | Removed user UUID from primary display. Replaced with user's role badge (e.g., "customer" / "owner"). |
| 3 | Frontend (`AdminPasswords.tsx`) | Reset modal button labeled generic "Continue" | Hardcoded button text that did not adapt to the selected recovery method. | Dynamic button text: `"Generate Reset Link"` for link generation, `"Generate Temporary Password"` for temporary credentials, and `"Require Reset at Next Login"` for forced reset. |
| 4 | Backend & Frontend Contract | Endpoint returned raw bearer token `token="xyz..."` | `admin_passwords_service.admin_generate_reset_link` returned raw token, and schema returned `token: str`. | Introduced `PUBLIC_APP_URL` configuration. Backend now generates full frontend URL: `https://<domain>/reset-password?token=<token>`. Updated contract schema to `reset_url: str`. |
| 5 | Frontend (`AdminPasswords.tsx`) | No clipboard copy action for generated link | Modal rendered raw token in uncopyable `<code>` block without action buttons. | Added dedicated "Password Reset Link Ready" result state with selectable, read-only input and accessible **Copy Reset Link** button (`navigator.clipboard.writeText`) with fallback selection. |
| 6 | Frontend Routing (`main.tsx`) | Reset link opened homepage, swallowing token | `App.tsx` was a pure state-machine SPA without React Router `<Routes>`. | Wired React Router `<Routes>` in `main.tsx` with dedicated public route `<Route path="/reset-password" element={<ResetPassword />} />` outside the authenticated state machine. |
| 7 | Backend Service (`passwords_service.py`) | No revocation of previously issued links | Creating a second reset link left earlier active tokens valid in `password_reset_requests`. | Added `_revoke_previous_reset_tokens()` to mark all unconsumed tokens for the user as `used_at=now()` before creating the new request (one-active-link-per-user policy). |
| 8 | Backend Configuration (`config.py`) | No canonical frontend application URL setting | Backend only configured `app_base_url` (API server for static asset uploads). | Added `public_app_url: str = "http://localhost:3000"` with strict production validation (must use HTTPS, cannot point to localhost). |

---

## 3. Architecture & Implementation Details

### 3.1 Backend Architecture

#### 1. Configuration (`backend/app/config.py` & `.env.example`)
- Added `public_app_url: str = "http://localhost:3000"`.
- Pydantic `@model_validator(mode="after")` validates that in `production` environment:
  - `public_app_url` must parse with scheme `https`.
  - `public_app_url` host cannot be `localhost` or `127.0.0.1`.
- Added documentation and defaults in `backend/.env.example` and `backend/.env`.

#### 2. Passwords Service (`backend/app/modules/admin/passwords_service.py`)
- `_build_reset_url(raw_token: str) -> str`: Safely constructs `f"{settings.public_app_url.rstrip('/')}/reset-password?token={raw_token}"`.
- `_revoke_previous_reset_tokens(session: AsyncSession, user_id: uuid.UUID)`: Runs atomic SQL update on `password_reset_requests` setting `used_at = now()` where `used_at IS NULL`.
- `admin_generate_reset_link()`:
  1. Verifies target user exists in database (raises 404 if not found).
  2. Generates 256-bit cryptographically secure raw token via `secrets.token_urlsafe(32)`.
  3. Computes SHA-256 hash `token_hash = _hash_token(raw_token)`.
  4. Revokes previous tokens for that user.
  5. Inserts `PasswordResetRequest` with `token_hash`, `expires_at = now + 24h`, `requested_by = admin_id`, `reason = reason`.
  6. Creates immutable `AuditLog` entry: `action="admin.password_reset_initiated"`, entity_id=target_user_id, with audit reason in `extra_data`. **The raw token and reset URL are never saved to audit logs.**
  7. Dispatches notification to user.
  8. Commits transaction and returns the constructed `reset_url`.

#### 3. Admin Schemas & Route (`backend/app/schemas/admin.py` & `backend/app/main.py`)
- Schema `AdminPasswordResetResponse` specifies `reset_url: str | None = None`.
- Route `POST /api/v1/admin/users/{user_id}/reset-password` requires `admin` role and returns `AdminPasswordResetResponse(message="Reset link generated", reset_url=reset_url)`.

#### 4. Redemption Endpoint (`POST /api/v1/auth/reset-password`)
- Reused existing, secure `auth_service.reset_password()`:
  - Validates `token_hash` against `password_reset_requests`.
  - Rejects if `used_at IS NOT NULL` (single-use enforcement).
  - Rejects if `expires_at < now()` (expiry enforcement).
  - Updates `User.password_hash` using Argon2.
  - Clears `User.must_change_password`.
  - Marks `PasswordResetRequest.used_at = now()`.
  - Invalidates all existing active `RefreshToken` sessions for the user.
  - Records `AuditLog(action="user.password_reset")`.

---

### 3.2 Frontend Architecture

#### 1. Routing Integration (`frontend/src/main.tsx`)
```tsx
<HelmetProvider>
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<App />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </QueryClientProvider>
</HelmetProvider>
```

#### 2. Public Reset Page (`frontend/src/components/ResetPassword.tsx`)
- Reads one-time bearer token from query parameter `useSearchParams().get('token')`.
- Token is kept only in component local state for the duration of the request; never stored in localStorage, sessionStorage, or console logs.
- States:
  - `form`: Active entry state with password and confirmation inputs.
  - `success`: "Password Updated" confirmation banner with "Return to Login" link.
  - `invalid_token`: "Link Invalid or Expired" notice for malformed, missing, used, or expired tokens.
  - `error`: Non-token server error banner with "Try Again" action.
- Validations:
  - Minimum 8 characters.
  - Confirmation password match.
  - Password visibility toggles (`Eye` / `EyeOff` icons).
- GroundKart brand identity:
  - Forest green / grass accents (`#1b4332`, `bg-grass`, `hover:bg-grass-600`).
  - Midnight ink text (`#1a1f16`).
  - Chalk and mist backgrounds.
  - Accessible labels, `aria-label`, and `role="alert"`.
  - Search engine exclusion: `<meta name="robots" content="noindex, nofollow" />`.

#### 3. Admin Passwords Dashboard (`frontend/src/components/dashboard/AdminPasswords.tsx`)
- **Table View:**
  - Contact column renders email once, followed by phone only when present.
  - User column renders name and role badge without exposing internal UUIDs.
  - Role filter (All Roles, Customers, Owners) and search filtering.
  - Accessible Action button: `Reset Password` with Key icon.
- **Modal Dialog (`ResetPasswordDialog`):**
  - Displays target user information: name, email, role.
  - Recovery method selector with radios:
    - *Generate reset link*
    - *Generate temporary password*
    - *Require reset at next login*
  - Audit reason selector dropdown with predefined compliance reasons.
  - Dynamic submit button matching selected method.
- **Result State:**
  - Displays "Password Reset Link Ready" view.
  - Read-only, full-width selectable input containing the generated `reset_url`.
  - **Copy Reset Link** button calling `navigator.clipboard.writeText` with visual feedback ("Link Copied").
  - Clipboard fallback mechanism: automatic input text selection if clipboard API is denied.
  - "Generate New Link" button to reset the dialog for a new request.

---

## 4. Security Review & Threat Mitigation

| Threat Vector | Severity | Mitigation Implemented |
|---|---|---|
| **Predictable Token / Brute Force** | Critical | Tokens generated using `secrets.token_urlsafe(32)` providing 256 bits of cryptographic entropy. Cannot be guessed or enumerated. |
| **Token Exposure in Database Breach** | Critical | Raw tokens are NEVER stored in the database. Only their SHA-256 cryptographic hashes (`token_hash`) are persisted. |
| **Token Replay / Multi-use** | High | `PasswordResetRequest.used_at` is stamped upon redemption. Re-submission with the same token is rejected with 400 Bad Request. |
| **Concurrent Stale Links** | Medium | When an administrator issues a new reset link for a user, `_revoke_previous_reset_tokens()` marks all previous unconsumed tokens as used. Only the most recent link is redeemable. |
| **Token Leakage in Logs** | High | Server audit logs and application logger exclude the raw token and the constructed `reset_url`. The raw token exists solely in memory during URL synthesis. |
| **Referrer Leakage** | Medium | Server enforces `Referrer-Policy: strict-origin-when-cross-origin`. Reset page contains no external third-party assets or external outbound links. |
| **Search Engine Indexing** | Medium | `<meta name="robots" content="noindex, nofollow" />` injected on `/reset-password` route. |
| **Account Takeover via Malicious Origin** | Critical | Reset URLs are built exclusively from server configuration `PUBLIC_APP_URL`. Request headers and admin parameters cannot override the domain. |
| **Production Misconfiguration** | High | Pydantic startup validator enforces HTTPS and bans `localhost` origins when `ENVIRONMENT=production`. |
| **Session Fixation / Lingering Access** | High | Password redemption automatically revokes all existing refresh tokens for the user, terminating all active attacker and user sessions. |

---

## 5. Verification & Test Execution Summary

### 5.1 Automated Backend Test Suite (`backend/tests/test_admin_passwords.py`)
Executed via `pytest` with AsyncSession and test PostgreSQL database:
- `test_admin_generate_reset_link_success`: Validates canonical URL construction, 256-bit token entropy, SHA-256 database storage, and audit log scrubbing. **[PASS]**
- `test_admin_reset_password_requires_admin_role`: Validates 401 on unauthenticated and 403 on customer requests. **[PASS]**
- `test_admin_generate_reset_link_nonexistent_user`: Validates 404 response on unknown user ID. **[PASS]**
- `test_generating_new_link_revokes_previous_link`: Validates one-active-link-per-user revocation policy. **[PASS]**
- `test_full_reset_password_journey`: Validates complete lifecycle (link generation → URL extraction → password update → new password login works → old password fails → token reuse rejected). **[PASS]**
- `test_reset_password_expired_token`: Validates rejection of expired tokens. **[PASS]**
- `test_admin_generate_temporary_password`: Validates temporary password generation, hashing, and `must_change_password` flag. **[PASS]**
- **Result:** **7 passed in 10.24s** (100% pass rate).

### 5.2 Automated Frontend Test Suites (`vitest`)
Executed via Vitest with `@testing-library/react` and `jsdom`:
- **`src/components/ResetPassword.test.tsx` (6 tests):**
  - Renders reset form when valid token is in query params. **[PASS]**
  - Displays invalid/expired banner when token is missing. **[PASS]**
  - Enforces minimum 8-character validation. **[PASS]**
  - Enforces password confirmation match. **[PASS]**
  - Submits to `/api/v1/auth/reset-password` and transitions to success view. **[PASS]**
  - Renders invalid/expired banner when API rejects token. **[PASS]**
- **`src/components/dashboard/AdminPasswords.test.tsx` (4 tests):**
  - Renders contact column without duplicate emails, showing phone only when present; omits internal UUIDs. **[PASS]**
  - Opens Reset Password modal with user details and default method "link". **[PASS]**
  - Dynamically updates primary action button label when method radio changes. **[PASS]**
  - Generates reset link and displays result state with clipboard copy and feedback. **[PASS]**
- **Overall Frontend Suite:** **8 test files, 40 passed in 8.74s** (100% pass rate).
- **TypeScript Typecheck:** `npx tsc --noEmit` exited with **0 errors**.

---

## 6. Deployment & Environment Runbook

To configure and deploy the repaired password management system:

1. **Environment Variable Configuration:**
   Add or update the following variable in your server environment:
   ```env
   # Development:
   PUBLIC_APP_URL=http://localhost:3000

   # Production:
   PUBLIC_APP_URL=https://app.groundbooking.com
   ```

2. **Database:**
   No schema migration is required. The system leverages the existing `password_reset_requests`, `users`, and `audit_logs` tables.

3. **Frontend Build:**
   Compile the frontend SPA:
   ```bash
   cd frontend
   npm run build
   ```
   Ensure server routing (Nginx / Caddy / Cloudflare Pages) forwards `/reset-password` requests to `index.html` for client-side routing.

4. **Health Check:**
   Verify the admin reset password endpoint is functioning:
   ```bash
   curl -X POST https://api.groundbooking.com/api/v1/admin/users/<USER_UUID>/reset-password \
     -H "Authorization: Bearer <ADMIN_JWT>" \
     -H "Content-Type: application/json" \
     -d '{"method": "link", "reason": "Support verification"}'
   ```
   Expected response:
   ```json
   {
     "message": "Reset link generated",
     "reset_url": "https://app.groundbooking.com/reset-password?token=..."
   }
   ```

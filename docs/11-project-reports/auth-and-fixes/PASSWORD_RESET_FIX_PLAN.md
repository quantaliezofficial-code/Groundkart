# Password Reset Fix Plan

## Research Summary — Confirmed Issues

### Frontend Issues

#### 1. Duplicate Email in Contact Column (`AdminPasswords.tsx` L78–79)
```tsx
// CURRENT — both lines render {user.email}
<div className="text-sm text-midnight">{user.email}</div>
<div className="text-sm text-chalk-600">{user.email}</div>
```
The second line was meant to render phone but copies the email field. `ApiAdminUserView` in `types.ts` already has `phone?: string` but it is never rendered.

#### 2. User UUID Exposed in Primary Cell (`AdminPasswords.tsx` L75)
```tsx
<div className="text-sm text-chalk-600 font-mono text-xs">{user.id}</div>
```
The raw UUID is the second line under the user's name in the "User" column. Should be removed or demoted to a secondary metadata field.

#### 3. Primary Action Button Labelled "Continue" (`AdminPasswords.tsx` L219)
When `method === 'link'` the button says "Continue". Requirement: button text must match the selected method. For the link method it must read **Generate Reset Link**.

#### 4. Reset Link Returns Raw Token, Not a Full URL
`admin_reset_password_route` in `main.py` L1706:
```python
return AdminPasswordResetResponse(message="Reset link generated", token=token)
```
`token` is the raw bearer token (e.g. `xJ3mK…`), not a URL. The frontend renders it inside a `<code>` element labelled "Secure Link Token:" — the admin cannot copy a usable link.

#### 5. No Copy-to-Clipboard Functionality
The result state in `ResetPasswordDialog` shows the token in a `<code>` element with `select-all` but has no Copy button.

#### 6. No `/reset-password` Route Registered in the App
`ForgotPassword.tsx` exists and accepts a `token` query parameter via its internal state (step → 'reset'), but:
- It is never imported into `App.tsx`
- There is no `<Route path="/reset-password">` anywhere
- A user opening `http://localhost:3000/reset-password?token=…` would land on the homepage, not the reset form
- The app uses React Router `BrowserRouter` wrapping a single `<App>` component that renders views via `currentView` state, not URL routes

#### 7. `ApiAdminUserView` Backend Missing `phone`
`backend/app/schemas/admin.py` `AdminUserView` has `phone: str | None = None`. The frontend `ApiAdminUserView` in `types.ts` already has `phone?: string`. However the backend `list_users` service must confirm it includes `phone` in the response.

### Backend Issues

#### 8. `admin_generate_reset_link` Revokes No Previous Tokens
When a second reset link is generated for the same user, the old (still-valid) link remains active. The function adds a new `PasswordResetRequest` row without invalidating earlier ones.

#### 9. No `PUBLIC_APP_URL` Configuration
`backend/app/config.py` has `app_base_url` = `http://localhost:8000` (the API server URL used for uploaded file serving). There is no separate `public_app_url` / frontend domain setting. The reset URL must be built from the **frontend** origin (`http://localhost:3000` in dev), not the API server.

#### 10. `forgot_password` Returns `"mock-token"` on Non-Existent User
`auth/service.py` L123: `return "mock-token"` — the function returns early but returns a literal string "mock-token" which reset_password explicitly rejects (L144–145). This is harmless at the HTTP level (the route wrapper never exposes the token) but wastes a DB write and is misleading.

#### 11. `ForgotPassword.tsx` References `react-router-dom` `<Link>` — Needs Route
`ForgotPassword.tsx` uses `Link to="/"` and `Link to="/"` from react-router-dom, which works, but the component must be mounted at a real URL path for the reset link to work.

### Database / Schema

- `PasswordResetRequest` model: adequate. Has `user_id`, `token_hash`, `expires_at`, `used_at`, `requested_by`, `reason`, `source_type`, `source_id`, `created_at`.
- Missing: `revoked_at` column. Previous tokens are never invalidated. This must be addressed either by adding a column or by querying for and marking old tokens used when a new one is created.

### Configuration

- Backend `app_base_url = "http://localhost:8000"` — API server, not frontend
- No `PUBLIC_APP_URL` or equivalent for the frontend origin
- Frontend `VITE_API_URL = http://localhost:8000`
- Frontend port: 3000 (vite.config.ts)

---

## Fix Plan

### A. Backend — Add `public_app_url` Setting

Add to `config.py`:
```python
public_app_url: str = "http://localhost:3000"
```
Validate in production: must be HTTPS, must not be the API URL, must not be localhost.

Add to `backend/.env`:
```
PUBLIC_APP_URL=http://localhost:3000
```

### B. Backend — Build Reset URL in `admin_generate_reset_link`

Return a full URL instead of a raw token:
```python
from app.config import settings
reset_url = f"{settings.public_app_url}/reset-password?token={raw_token}"
return reset_url
```

Validate `public_app_url` is set and safe before building the URL.

### C. Backend — Revoke Previous Active Tokens

Before creating a new `PasswordResetRequest`, mark all existing unused, non-expired tokens for the user as used (revoked):
```python
await session.execute(
    sa_update(PasswordResetRequest)
    .where(
        PasswordResetRequest.user_id == user.id,
        PasswordResetRequest.used_at.is_(None),
    )
    .values(used_at=datetime.now(timezone.utc))
)
```

### D. Backend — Update `AdminPasswordResetResponse`

Change `token: str | None` to `reset_url: str | None` to be explicit that this is the full URL, never a raw token.

### E. Frontend — Add `/reset-password` Route

The app uses a `BrowserRouter` but `App.tsx` is a pure state machine. We need to:
1. Create a dedicated `ResetPassword.tsx` page component
2. Add a `<Routes><Route path="/reset-password" element={<ResetPassword />} /></Routes>` wrapper around the state-based app in `main.tsx` or `App.tsx`

The cleanest approach: wrap the existing app state machine with a `<Routes>` at the top level so `/reset-password?token=…` is handled before the rest of the app renders.

### F. Frontend — New `ResetPassword.tsx` Page

- Reads `token` from `useSearchParams()`
- Submits to `POST /api/v1/auth/reset-password`
- Handles: loading, success, error (invalid/expired token), password mismatch
- Uses GroundKart brand colors
- No auth required
- Does NOT store or log the token

### G. Frontend — Fix `AdminPasswords.tsx` Contact Column

```tsx
// Contact column
<td className="px-6 py-4">
  <div className="text-sm text-midnight">{user.email}</div>
  {user.phone && (
    <div className="text-sm text-chalk-600">{user.phone}</div>
  )}
</td>
```

Remove UUID from the User column. If needed for internal reference, add a tooltip or collapsed detail.

### H. Frontend — Fix Modal Button Label

Change the primary action button to reflect the selected method:
```tsx
const actionLabel = method === 'link'
  ? 'Generate Reset Link'
  : method === 'temporary'
  ? 'Generate Temporary Password'
  : 'Require Reset at Next Login';
```

### I. Frontend — Fix Result State: Show Full URL + Copy Button

When `result.reset_url` (renamed from `token`) is returned:
- Show the full URL in a selectable `<code>` block
- Add a "Copy Reset Link" button using `navigator.clipboard.writeText`
- Show a confirmation ("Copied!") on success
- Fallback: display a selectable text input if clipboard API unavailable

### J. Frontend — Update API Types

`AdminPasswordResetResponse` type:
```ts
interface AdminPasswordResetResponse {
  message: string;
  reset_url?: string;   // was token — now a full URL
  temp_password?: string;
}
```

---

## Security Risks

| Risk | Mitigation |
|---|---|
| Raw token returned in API response | Return full URL; backend never logs it; frontend treats it as a one-time secret |
| Token reuse | Revoke all previous tokens when generating a new one |
| Localhost URL in production | Validate `PUBLIC_APP_URL` in production — must be HTTPS, not localhost |
| Admin-supplied redirect URL | URL always constructed from trusted server config, never from request body |
| Token in browser console/logs | Frontend never console.logs the token or URL |
| Open redirect via `token` param | Backend constructs URL; no user-supplied path component |

---

## Tests Required

### Backend
- `admin_generate_reset_link` returns full URL using `public_app_url`
- Previous tokens are revoked when a new one is generated
- `reset_password` works with token extracted from generated URL
- Expired token rejected
- Used token rejected (one-time use)
- Admin auth required for reset link generation

### Frontend
- Contact column shows email + phone (not email twice)
- No UUID in primary user cell
- Button label matches selected method
- Copy button copies full URL
- `/reset-password?token=…` renders the reset form
- Success and error states render correctly

---

## Implementation Order

1. `config.py` — add `public_app_url`
2. `backend/.env` — add `PUBLIC_APP_URL`
3. `passwords_service.py` — revoke old tokens + return full URL
4. `main.py` / `schemas/admin.py` — rename `token` → `reset_url`
5. `AdminPasswords.tsx` — fix contact column, fix button label, fix result state
6. `ResetPassword.tsx` — new public page component
7. `App.tsx` / `main.tsx` — register `/reset-password` route
8. `lib/api/types.ts` — update response type

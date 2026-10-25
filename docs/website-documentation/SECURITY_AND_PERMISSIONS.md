# GroundKart / GroundBooking — Security & Permissions Architecture

This document details the security posture, authentication architecture, authorization controls, rate limiting, and data protection mechanisms implemented in GroundKart.

---

## 1. Authentication Architecture

GroundKart implements modern, stateless token authentication backed by cryptographically secure storage and token rotation.

```mermaid
flowchart TD
    subgraph Client ["Client Browser"]
        LoginForm["Login Form (Email/Phone + Password)"]
        TokenStore["Local Storage / Memory (access_token, refresh_token)"]
    end

    subgraph BackendAuth ["Backend Auth Service (FastAPI)"]
        Argon2Verify["Argon2id Password Verification"]
        JWTIssuer["PyJWT Token Generator"]
        TokenDB[("PostgreSQL refresh_tokens")]
    end

    LoginForm -->|POST /api/v1/auth/login| Argon2Verify
    Argon2Verify -->|Success| JWTIssuer
    JWTIssuer -->|Issues Access Token (15m)| TokenStore
    JWTIssuer -->|Issues Refresh Token (30d)| TokenStore
    JWTIssuer -->|Persists Token Hash| TokenDB
```

### 1.1 Password Hashing (Argon2id)
- Passwords are never stored in plaintext.
- Passwords are hashed using the **Argon2id** algorithm via `argon2-cffi` (`PasswordHasher`), the winner of the Password Hashing Competition. Argon2id provides state-of-the-art resistance to both GPU-accelerated brute-force attacks and side-channel timing attacks.

### 1.2 JWT Access & Refresh Tokens
- **Access Tokens:** Signed using HMAC-SHA256 (`HS256`) with `jwt_secret_key`. Carries standard claims:
  - `sub`: User UUID
  - `role`: Role string (`customer`, `owner`, `admin`)
  - `exp`: Short-lived expiration (15 minutes)
- **Refresh Tokens:** Issued during login and stored in the database (`refresh_tokens` table) with expiration (30 days). Used to silently issue new access tokens via `POST /api/v1/auth/refresh` without requiring credentials re-entry.
- **Revocation:** Logging out (`POST /api/v1/auth/logout`) explicitly revokes the refresh token in the database, preventing replay attacks.

### 1.3 Secure One-Way Token Hashing (Guest Manage Tokens & Password Resets)
To protect guest reservations and password recovery links from database leaks:
- The platform generates high-entropy cryptographic raw tokens using `secrets.token_urlsafe(32)`.
- The raw token is **never** stored in the database and **never** printed in application logs.
- The raw token is hashed using `SHA-256` (`hash_manage_token()`).
- Only the 64-character hexadecimal digest (`manage_token_hash`) is stored in the database.
- Even with full read access to the database, an attacker cannot forge or reconstruct valid management or password reset URLs.

---

## 2. Role-Based Access Control (RBAC) Matrix

Permissions are enforced at the API route level using FastAPI's dependency injection (`require_role()` in `app/modules/auth/dependencies.py`):

| Resource / Capability | Public Visitor | Customer | Venue Owner | Administrator | Enforcement Mechanism |
|---|:---:|:---:|:---:|:---:|---|
| **Browse Venues & Slots** | Allowed | Allowed | Allowed | Allowed | Public Route |
| **Book Slot (As Guest)** | Allowed | Allowed | Allowed | Allowed | Public Route with Captcha / Rate Limit |
| **Book Slot (Logged In)** | Denied | Allowed | Allowed | Allowed | `get_current_user` |
| **Manage Own Bookings** | Via Token | Allowed | Allowed | Allowed | User ID check or SHA-256 Token |
| **Submit Venue Review** | Denied | Allowed | Allowed | Allowed | Completed Booking Verified |
| **Create Support Ticket** | Denied | Allowed | Allowed | Allowed | `get_current_user` |
| **Submit Owner KYC** | Denied | Allowed | Allowed | Allowed | `get_current_user` |
| **Create / Edit Venues** | Denied | Denied | Allowed (Own) | Allowed | `require_role("owner")` + Owner ID Check |
| **Access Owner Calendar** | Denied | Denied | Allowed (Own) | Allowed | `require_role("owner")` + Owner ID Check |
| **View Revenue & Payouts** | Denied | Denied | Allowed (Own) | Allowed | `require_role("owner")` + Owner ID Check |
| **Approve / Reject Venues** | Denied | Denied | Denied | Allowed | `require_role("admin")` |
| **Confirm Offline Payments** | Denied | Denied | Denied | Allowed | `require_role("admin")` |
| **Disburse Payout Batches** | Denied | Denied | Denied | Allowed | `require_role("admin")` |
| **Suspend / Reactivate Users**| Denied | Denied | Denied | Allowed | `require_role("admin")` |
| **Reconcile Financial Ledger**| Denied | Denied | Denied | Allowed | `require_role("admin")` |
| **Moderate Reviews** | Denied | Denied | Denied | Allowed | `require_role("admin")` |

---

## 3. Resource Ownership Verification

In addition to coarse role checks, the service layer strictly enforces row-level ownership:
1. **Venue Updates:** `PATCH /api/v1/venues/{id}` verifies that `venue.owner_id == current_user.id`. If a user attempts to edit a venue owned by another person, the system responds with `HTTP 403 Forbidden`.
2. **Bank Accounts:** Owners can only create, view, or modify bank accounts linked directly to their user ID (`app/modules/payout/service.py`).
3. **Support Tickets:** Customers can only retrieve tickets they created. Owners can view tickets tied to their venues. Administrators have global queue visibility.

---

## 4. Rate Limiting & Abuse Prevention

The platform protects sensitive endpoints against automated brute-force attacks via the `RateLimiter` middleware and database-backed `login_rate_limits`:
- **Login Rate Limiter:** Tracks failed authentication attempts by client IP address and target account identifier (`email_or_phone`).
- **Progressive Delay & Lockout:** Repeated failed attempts trigger exponential cooldowns and temporary lockouts (`HTTP 429 Too Many Requests`).
- **Hold Spam Protection:** Initiating holds is rate-limited per IP and user session to prevent malicious actors from locking up inventory units.

---

## 5. File Upload Protection & Data Isolation

GroundKart accepts image and video uploads for venue listings and PDF/image uploads for owner KYC identity verification:
1. **MIME-Type Sniffing & Whitelisting:** Uploads are validated against permitted formats (`image/jpeg`, `image/png`, `image/webp`, `video/mp4`, `application/pdf`). Unsupported extensions or disguised executables are rejected with `HTTP 415 Unsupported Media Type`.
2. **Video Duration Verification:** Videos must be at least 10 seconds in length to qualify as legitimate walkthroughs.
3. **Private KYC Storage:** Identity documents are saved in a private storage bucket (`private_uploads_dir` or `private_s3_bucket_name`) and are **never** accessible through public static mounts. Access requires administrative authentication via `GET /api/v1/admin/owner-verifications/{id}/document`.

---

## 6. Immutable Audit Trails (`AuditLog`)

All governance-critical and monetary operations write immutable audit records to the `audit_logs` table:
- **Captured Attributes:** `actor_id`, `action`, `target_type`, `target_id`, `details` (JSONB snapshot), `ip_address`, and `created_at`.
- **Audited Events Include:**
  - Venue status transitions (approval, rejection, suspension, reactivation)
  - Owner KYC verification decisions
  - Offline payment confirmations
  - Payout batch creation and disbursement marks
  - Administrative password reset token generations
  - User suspension and unsuspension actions

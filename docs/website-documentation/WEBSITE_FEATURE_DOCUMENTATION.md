# GroundKart / GroundBooking — Complete Website Feature Documentation

> Authoritative, evidence-backed documentation package detailing every feature, module, workflow, and technical component implemented in GroundKart.

---

## 1. Document Scope & Overview

This document serves as the master feature specification and technical implementation guide for **GroundKart** (formerly and internally referenced as **GroundBooking**).
GroundKart is an enterprise-grade venue reservation marketplace tailored for sports turfs, badminton courts, wedding banquet halls, corporate conference spaces, and party lawns in urban Indian metropolitan areas (e.g., Lucknow, Mumbai, Delhi/NCR, Bengaluru, Jaipur).

### Key System Characteristics:
- **Concurrency-Safe Real-Time Slot Booking:** Instant 10-minute pessimistic row holds (`SELECT ... FOR UPDATE`) preventing double-booking across simultaneous users.
- **Flexible Rental Taxonomy:** Supports granular hourly slots, half-day shifts, full-day buyouts, and custom event purposes.
- **Double-Entry Financial Ledger:** Every monetary movement emits balanced debits and credits across escrow, payable, and platform revenue accounts.
- **Owner Management Workspace:** 12-step guided listing builder, dynamic surge pricing rules, interactive calendar management, and bank payout registration.
- **Administrative Command Center:** Centralized queues for listing approvals, owner KYC verification, offline payment confirmations, payout batch execution, and audit logging.
- **Two-Way Support & Knowledge Base:** Threaded customer service tickets with confidential staff notes, full-text searchable help center, and article feedback tracking.

---

## 2. Technology Stack & Verification Metrics

| Layer | Component / Technology | Exact Version | Verification Status |
|---|---|---|---|
| **Backend Web Framework** | FastAPI | `0.138.1` | Verified (All API routes live) |
| **ASGI Web Server** | Uvicorn | `0.49.0` | Verified (Port 8000 listening) |
| **Database Engine** | PostgreSQL | `16.x` | Verified (Port 5432 connected) |
| **Database ORM** | SQLAlchemy | `2.0.51` | Verified (AsyncPG 0.31.0 driver) |
| **Database Migrations** | Alembic | `1.18.5` | Verified (47 revisions at head) |
| **Data Validation** | Pydantic | `2.13.4` | Verified (Schemas enforced) |
| **Password Hashing** | argon2-cffi (Argon2id) | `25.1.0` | Verified (GPU-hard password security) |
| **Authentication** | PyJWT | `2.7.0` | Verified (Short-lived JWTs + DB refresh) |
| **Backend Automated Tests** | Pytest / pytest-asyncio | `9.1.1` / `1.4.0` | **397 tests passed** (51 suites, 0 failures) |
| **Frontend Framework** | React | `19.0.1` | Verified (React 19 Concurrent Root) |
| **Language** | TypeScript | `~5.8.2` | Verified (Strict TypeScript compilation) |
| **Frontend Bundler** | Vite | `6.2.3` | Verified (Port 3000 listening) |
| **Routing System** | React Router DOM | `6.28.0` | Verified (SPA route synchronization) |
| **Server State Management** | TanStack React Query | `5.62.0` | Verified (Cached API queries & mutations) |
| **Styling System** | Tailwind CSS | `4.1.14` | Verified (@tailwindcss/vite) |
| **Frontend Unit Tests** | Vitest / Testing Library | `3.2.7` / `16.1.0` | **98 core tests passed** (122 tests total) |

---

## 3. Complete Feature Inventory (FEAT-001 through FEAT-056)

The table below catalogs all 56 discrete, verified capabilities across the application:

| Feature ID | Feature Name | Category | Roles | Implementation Status | Primary UI Entry Point | Primary Backend Handler |
|---|---|---|---|---|---|---|
| **FEAT-001** | Customer & Owner Account Registration | Authentication, Identity & Permissions | Public Visitor, Customer, Owner | Implemented and verified | `/ (AuthModal modal: 'signup')` | `/api/v1/auth/signup` |
| **FEAT-002** | User Authentication & JWT Session Management | Authentication, Identity & Permissions | Customer, Owner, Admin | Implemented and verified | `/ (AuthModal modal: 'login')` | `/api/v1/auth/logout` |
| **FEAT-003** | Customer Self-Service Password Recovery | Authentication, Identity & Permissions | Customer, Owner | Implemented and verified | `/ (ForgotPassword modal)` | `/api/v1/auth/reset-password` |
| **FEAT-004** | Admin-Assisted Password Reset Management | Authentication, Identity & Permissions | Administrator | Implemented and verified | `/admin (Passwords tab)` | `/api/v1/admin/password-reset-requests` |
| **FEAT-005** | User Account Deletion & Right to Erasure | Authentication, Identity & Permissions | Customer, Owner, Admin | Implemented and verified | `/api/v1/users/me` | `Internal Service` |
| **FEAT-006** | Role-Based Access Control (RBAC) | Authentication, Identity & Permissions | Customer, Owner, Admin | Implemented and verified | `All /api/v1 routes` | `/admin` |
| **FEAT-007** | Landing Page & Hero Multi-Filter Search | Public Venue Discovery, Search & Presentation | Public Visitor, Customer | Implemented and verified | `/` | `/api/v1/categories` |
| **FEAT-008** | Homepage Editorial Placement Management | Public Venue Discovery, Search & Presentation | Public Visitor, Administrator | Implemented and verified | `/` | `/api/v1/admin/homepage/placements` |
| **FEAT-009** | Advanced Venue Catalog & Multi-Parameter Filtering | Public Venue Discovery, Search & Presentation | Public Visitor, Customer | Implemented and verified | `/search` | `/api/v1/venues` |
| **FEAT-010** | Responsive Multi-Category Rail & Category Landing Pages | Public Venue Discovery, Search & Presentation | Public Visitor, Customer | Implemented and verified | `/categories/:category` | `/search?category=...` |
| **FEAT-011** | Public Venue Detail Page & Availability Viewer | Public Venue Discovery, Search & Presentation | Public Visitor, Customer | Implemented and verified | `/venues/:slug_or_id` | `/api/v1/venues/{venue_id}/availability` |
| **FEAT-012** | Fullscreen Interactive Media Lightbox & Video Player | Public Venue Discovery, Search & Presentation | Public Visitor, Customer | Implemented and verified | `/venues/:id (Lightbox overlay)` | `Internal Service` |
| **FEAT-013** | Modular Venue Content Blocks | Public Venue Discovery, Search & Presentation | Public Visitor, Customer, Owner | Implemented and verified | `/venues/:id` | `/api/v1/venues/{venue_id}` |
| **FEAT-014** | Customer Favorites & Wishlist Persistence | Public Venue Discovery, Search & Presentation | Public Visitor, Customer | Implemented and verified | `/` | `/venues/:id` |
| **FEAT-015** | Automated SEO Metadata & Dynamic JSON-LD Structured Data | Public Venue Discovery, Search & Presentation | Search Engine Crawlers, Public Visitor | Implemented and verified | `All frontend views` | `/robots.txt` |
| **FEAT-016** | Real-Time Slot Availability Matrix & Date Selection | Reservation Engine, Availability & Checkout | Public Visitor, Customer | Implemented and verified | `/venues/:id` | `/api/v1/venues/{venue_id}/availability` |
| **FEAT-017** | Multi-Unit Rental Taxonomy | Reservation Engine, Availability & Checkout | Customer, Owner | Implemented and verified | `/venues/:id` | `/api/v1/venues/{venue_id}/rental-options` |
| **FEAT-018** | Purpose-Driven Booking & Event Suitability Selection | Reservation Engine, Availability & Checkout | Customer, Owner | Implemented and verified | `/venues/:id` | `/api/v1/venues/{venue_id}/purposes` |
| **FEAT-019** | Concurrency-Safe Pessimistic Inventory Hold Engine | Reservation Engine, Availability & Checkout | Customer, Public Visitor | Implemented and verified | `/api/v1/bookings` | `Internal Service` |
| **FEAT-020** | Guest & Authenticated Checkout Pipeline | Reservation Engine, Availability & Checkout | Public Visitor, Customer | Implemented and verified | `/checkout` | `/api/v1/bookings` |
| **FEAT-021** | Secure Guest Booking Access via SHA-256 Manage Token | Reservation Engine, Availability & Checkout | Guest Customer | Implemented and verified | `/bookings/manage/:token` | `/api/v1/bookings/manage/{token}/cancel` |
| **FEAT-022** | Automated Hold Sweep Background Worker | Reservation Engine, Availability & Checkout | Background Worker, Administrator | Implemented and verified | `/api/v1/admin/bookings/sweep-expired-holds` | `Background Worker Loop` |
| **FEAT-023** | Customer Reservations Dashboard ('My Bookings') | Post-Booking, Cancellation & Customer Lifecycle | Customer | Implemented and verified | `/my-bookings` | `/api/v1/bookings` |
| **FEAT-024** | Automated Proximity-Based Cancellation & Refund Calculation | Post-Booking, Cancellation & Customer Lifecycle | Customer, Administrator | Implemented and verified | `/my-bookings (Cancel action)` | `/api/v1/bookings/{booking_id}/cancel` |
| **FEAT-025** | Formal Booking Action Requests (Cancellation & Reschedule) | Post-Booking, Cancellation & Customer Lifecycle | Customer, Owner, Administrator | Implemented and verified | `/api/v1/bookings/{id}/cancellation-requests` | `/admin (Booking Actions)` |
| **FEAT-026** | Booking Dispute & Issue Flagging | Post-Booking, Cancellation & Customer Lifecycle | Customer, Owner, Administrator | Implemented and verified | `/api/v1/bookings/{booking_id}/flag` | `Internal Service` |
| **FEAT-027** | Rebooking Quick-Action Pipeline ('Book Again') | Post-Booking, Cancellation & Customer Lifecycle | Customer | Implemented and verified | `/my-bookings` | `/venues/:id` |
| **FEAT-028** | Verified Customer Review Submission | Reviews, Ratings & Reputation Management | Customer | Implemented and verified | `/venues/:id (Reviews section)` | `/api/v1/venues/{venue_id}/reviews` |
| **FEAT-029** | Public Venue Reviews Aggregate & Rating Breakdown Display | Reviews, Ratings & Reputation Management | Public Visitor, Customer | Implemented and verified | `/venues/:id` | `/api/v1/venues/{venue_id}/reviews` |
| **FEAT-030** | Administrative Review Moderation & Deletion | Reviews, Ratings & Reputation Management | Administrator | Implemented and verified | `/admin (Reviews tab)` | `/api/v1/admin/reviews/{review_id}` |
| **FEAT-031** | Contextual Support Ticket Creation | Customer Support & Help Center | Customer, Owner | Implemented and verified | `/support` | `/api/v1/support/tickets` |
| **FEAT-032** | Two-Way Threaded Support Ticket History | Customer Support & Help Center | Customer, Owner, Administrator | Implemented and verified | `/support` | `/api/v1/support/tickets/{ticket_id}/comments` |
| **FEAT-033** | Administrative Support Ticket Queue & SLA Management | Customer Support & Help Center | Administrator | Implemented and verified | `/admin (Support tab)` | `/api/v1/admin/support/tickets/{id}` |
| **FEAT-034** | Self-Service Help Center Knowledge Base | Customer Support & Help Center | Public Visitor, Customer, Owner | Implemented and verified | `/help` | `/api/v1/help/articles/{slug}` |
| **FEAT-035** | Help Article Feedback & Search Analytics Tracking | Customer Support & Help Center | Public Visitor, Customer, Administrator | Implemented and verified | `/api/v1/help/articles/{id}/feedback` | `Internal Service` |
| **FEAT-036** | Public Contact & Business Inquiry Submission | Customer Support & Help Center | Public Visitor | Implemented and verified | `/contact` | `/api/v1/contact` |
| **FEAT-037** | Owner KYC Onboarding Gate & Identity Verification | Venue Owner Onboarding & Workspace | Customer, Owner, Administrator | Implemented and verified | `/owner` | `/api/v1/admin/owner-verifications` |
| **FEAT-038** | 12-Step Wizard Venue Listing Builder | Venue Owner Onboarding & Workspace | Owner, Administrator | Implemented and verified | `/owner (Listing Builder)` | `/api/v1/venues/{id}` |
| **FEAT-039** | Venue Workspace Management Hub | Venue Owner Onboarding & Workspace | Owner, Administrator | Implemented and verified | `/owner (Venue Workspace)` | `/api/v1/venues/{venue_id}` |
| **FEAT-040** | Dynamic Pricing Rule Engine | Venue Owner Onboarding & Workspace | Owner, Administrator | Implemented and verified | `/venues/:id/pricing-rules` | `/api/v1/venues/{venue_id}/pricing-rules` |
| **FEAT-041** | Owner Interactive Calendar & Slot Management | Venue Owner Onboarding & Workspace | Owner, Administrator | Implemented and verified | `/owner (Calendars tab)` | `/api/v1/venues/{id}/inventory-units` |
| **FEAT-042** | Owner Bank Account & Payout Setup | Venue Owner Onboarding & Workspace | Owner, Administrator | Implemented and verified | `/owner (Account tab)` | `/api/v1/owner/bank-accounts` |
| **FEAT-043** | Owner Analytics & Revenue Performance Dashboard | Venue Owner Onboarding & Workspace | Owner | Implemented and verified | `/owner (Overview tab)` | `/api/v1/owner/analytics` |
| **FEAT-044** | Platform Executive Dashboard & Metric Intelligence | Administrative Governance, Finance & Operations | Administrator | Implemented and verified | `/admin (Overview tab)` | `/api/v1/admin/analytics` |
| **FEAT-045** | Venue Approval & Rejection Workflow | Administrative Governance, Finance & Operations | Administrator | Implemented and verified | `/admin (ApprovalQueue tab)` | `/api/v1/admin/venues/{venue_id}/reject` |
| **FEAT-046** | User Governance & Account Sanctions | Administrative Governance, Finance & Operations | Administrator | Implemented and verified | `/admin (Users tab)` | `/api/v1/admin/users/{id}/reactivate` |
| **FEAT-047** | Venue Suspension & Reactivation Controls | Administrative Governance, Finance & Operations | Administrator | Implemented and verified | `/admin (Venues tab)` | `/api/v1/admin/venues/{id}/reactivate` |
| **FEAT-048** | Offline Payment Manual Confirmation & Receipt Reconciliation | Administrative Governance, Finance & Operations | Administrator | Implemented and verified | `/admin (Bookings tab)` | `/api/v1/admin/bookings/{id}/confirm-payment` |
| **FEAT-049** | Double-Entry Financial Ledger System | Administrative Governance, Finance & Operations | Administrator | Implemented and verified | `/admin/ledger/entries` | `/api/v1/admin/ledger/entries` |
| **FEAT-050** | Ledger Reconciliation & Audit Integrity Check | Administrative Governance, Finance & Operations | Administrator | Implemented and verified | `/admin/ledger/reconcile` | `/api/v1/admin/ledger/reconcile` |
| **FEAT-051** | Payout Batch Execution & Disbursement Ledger | Administrative Governance, Finance & Operations | Administrator | Implemented and verified | `/admin (Payouts tab)` | `/api/v1/admin/payouts/{id}/mark-paid` |
| **FEAT-052** | System Health Diagnostics & Production Readiness Telemetry | Administrative Governance, Finance & Operations | Public Monitoring, Administrator | Implemented and verified | `/healthz` | `/api/v1/admin/health` |
| **FEAT-053** | System-Wide Audit Log & Traceability Trail | Administrative Governance, Finance & Operations | Administrator | Implemented and verified | `/admin (Overview tab)` | `/api/v1/admin/audit-log` |
| **FEAT-054** | Dynamic System Settings Configuration | Administrative Governance, Finance & Operations | Administrator | Implemented and verified | `/admin/settings` | `/api/v1/admin/settings` |
| **FEAT-055** | Broadcast & Targeted User Notification Dispatcher | Administrative Governance, Finance & Operations | Customer, Owner, Administrator | Implemented and verified | `/admin (Notifications tab)` | `/api/v1/admin/notifications/send` |
| **FEAT-056** | Asynchronous Outbox Event Publisher & Scheduled Job Worker | Administrative Governance, Finance & Operations | Background Worker | Implemented and verified | `Background Worker Loop` | `FastAPI Lifespan` |

---

## 4. In-Depth Feature Documentation

Each feature is documented using a standardized 14-section architectural breakdown:

### Category: Authentication, Identity & Permissions

#### [FEAT-001] Customer & Owner Account Registration

##### 1. Feature Identity
- **Feature ID:** `FEAT-001`
- **Feature Name:** Customer & Owner Account Registration
- **Category:** Authentication, Identity & Permissions
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/ (AuthModal modal: 'signup')`, `/api/v1/auth/signup`
- **User Roles Permitted:** Public Visitor, Customer, Owner
- **Core Module Dependencies:** FastAPI Auth Router, Argon2id Hasher, User Model

##### 2. Feature Description
Allows new customers and venue owners to create an account using phone number or email and a secure password. It solves the friction of account onboarding while capturing required identity data for reservation tracking and owner verification.

##### 3. Purpose and User Benefits
Enables customers to securely track reservations and leave reviews, while enabling property owners to register and manage commercial spaces on the platform.

##### 4. User Interaction and Usage Instructions
1. Click 'Log in' in the main navigation header and select 'Sign up' (or click 'List Your Venue' to register as an owner).
2. Choose your role tab: 'Customer' (book sports turfs and event venues) or 'Venue Owner' (list and monetize commercial properties).
3. Enter your Full Name, Email Address, and Phone Number (10 digits).
4. Enter a password meeting complexity standards (minimum 8 characters).
5. Click 'Create Account'. Upon successful creation, the auth modal automatically logs you in and redirects to the appropriate dashboard or resumes your pending booking.

##### 5. UI and Component Implementation
Implemented in `frontend/src/components/AuthModal.tsx` and `frontend/src/lib/auth.tsx`. Utilizes controlled inputs, real-time client-side phone and email validation regex, disabled button states during network requests, and Framer Motion modal backdrop transitions.

##### 6. Backend and Business Logic
Handled by `POST /api/v1/auth/signup` in `backend/app/main.py` delegating to `app.modules.auth.service.signup()`. Verifies uniqueness of email and phone. Computes Argon2id password hash using `argon2-cffi`. Inserts a new row into `users` table with default `is_active=True`, commits transaction, and issues an access token.

##### 7. Data Model and Persistence
Persisted in `users` table: `id` (UUID PK), `email` (nullable, unique, indexed), `phone` (mandatory for India operations, unique, indexed), `password_hash` (Argon2id string), `full_name`, `role` ('customer' or 'owner'), `is_active`, `is_suspended` (default False), `created_at`.

##### 8. API and Integration Details
POST /api/v1/auth/signup. Body: `SignupRequest` (`email`, `phone`, `password`, `full_name`, `role`). Response: 201 Created with `UserMeResponse`. Error codes: 409 Conflict if email or phone already registered, 422 Unprocessable Entity if phone format is invalid.

##### 9. State and Lifecycle
Unauthenticated visitor -> Form submission -> Server creation -> Authenticated user with JWT token stored in browser localStorage.

##### 10. Permissions and Security
Publicly accessible endpoint. Protected by rate limiting middleware against automated sign-up bot spam. Passwords hashed with memory-hard Argon2id.

##### 11. Edge Cases and Error Behavior
Duplicate email or phone returns clear 409 error toast; missing country code is normalized to standard Indian 10-digit mobile number.

##### 12. Testing and Verification
Automated tests in `backend/tests/test_auth_flow.py` and `frontend/src/components/AuthModal.test.tsx` verify successful registration, duplicate rejection, and role assignment. Status: PASS.

##### 13. Maintenance and Extension
Main files: `backend/app/modules/auth/service.py`, `frontend/src/components/AuthModal.tsx`. Ensure any added user profile fields are reflected in `SignupRequest` schema and migration scripts.

##### 14. Feature Summary
- **Summary:** Full-stack account registration enabling distinct customer and owner account creation with strict unique constraint validation and Argon2id security.
- **Status:** Implemented and verified

---

#### [FEAT-002] User Authentication & JWT Session Management

##### 1. Feature Identity
- **Feature ID:** `FEAT-002`
- **Feature Name:** User Authentication & JWT Session Management
- **Category:** Authentication, Identity & Permissions
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/ (AuthModal modal: 'login')`, `/api/v1/auth/login`, `/api/v1/auth/refresh`, `/api/v1/auth/logout`
- **User Roles Permitted:** Customer, Owner, Admin
- **Core Module Dependencies:** PyJWT, Argon2id Hasher, RefreshToken Model, LoginRateLimit Model

##### 2. Feature Description
Authenticates registered users using email or phone number and password, issuing short-lived access tokens and database-backed refresh tokens with automatic token rotation.

##### 3. Purpose and User Benefits
Keeps user sessions securely authenticated without requiring frequent re-logins, while ensuring session tokens can be revoked immediately upon logout or password reset.

##### 4. User Interaction and Usage Instructions
1. Click 'Log in' in the navigation header.
2. Enter your registered email address or 10-digit phone number.
3. Enter your password.
4. Click 'Sign In'. If valid, the modal dismisses, the header displays your profile initials, and the session persists across page reloads.
5. To end session, click your profile avatar and select 'Log out'.

##### 5. UI and Component Implementation
Managed via `AuthModal.tsx` and `useAuth()` context in `frontend/src/lib/auth.tsx`. Stores `access_token` and `refresh_token` in `localStorage`. Automatically attaches `Authorization: Bearer <token>` to all authenticated API calls via custom fetch client `frontend/src/lib/api/client.ts`.

##### 6. Backend and Business Logic
Routes `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, and `POST /api/v1/auth/logout` in `backend/app/main.py`. Validates credentials against `users` table via `verify_password()`. Enforces rate limits via `LoginRateLimit`. Generates 15-minute JWT access token and 30-day refresh token stored in `refresh_tokens` table. Logout revokes the refresh token.

##### 7. Data Model and Persistence
Entities: `users` and `refresh_tokens` (`id`, `user_id` FK, `token_hash`, `expires_at`, `revoked_at`, `created_at`). `login_rate_limits` (`id`, `ip_address`, `email_or_phone`, `attempt_count`, `last_attempt_at`, `locked_until`).

##### 8. API and Integration Details
POST /api/v1/auth/login. Body: `LoginRequest` (`email_or_phone`, `password`). Response: `AccessTokenResponse` (`access_token`, `refresh_token`, `token_type: bearer`). Error: 401 Unauthorized for incorrect credentials, 429 Too Many Requests for rate limit exceedance.

##### 9. State and Lifecycle
Unauthenticated -> Authenticated (valid JWT) -> Expired access token (silently refreshed via refresh token) -> Revoked / Logged out.

##### 10. Permissions and Security
Login is public with IP rate limiting. Refresh requires a valid unrevoked refresh token. Logout requires authenticated session.

##### 11. Edge Cases and Error Behavior
Expired refresh token prompts graceful re-authentication modal without losing in-progress checkout selections.

##### 12. Testing and Verification
Automated coverage in `backend/tests/test_auth_flow.py`, `backend/tests/test_rate_limiter.py`, and `frontend/src/components/AuthModal.test.tsx`. 100% assertions pass.

##### 13. Maintenance and Extension
Main files: `backend/app/modules/auth/service.py`, `backend/app/modules/auth/dependencies.py`. JWT secret key is managed via `config.py` with strict production validation.

##### 14. Feature Summary
- **Summary:** Enterprise-grade authentication pipeline combining short-lived access JWTs, Argon2id verification, and database-tracked refresh tokens.
- **Status:** Implemented and verified

---

#### [FEAT-003] Customer Self-Service Password Recovery

##### 1. Feature Identity
- **Feature ID:** `FEAT-003`
- **Feature Name:** Customer Self-Service Password Recovery
- **Category:** Authentication, Identity & Permissions
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/ (ForgotPassword modal)`, `/ (ResetPassword modal)`, `/api/v1/auth/forgot-password`, `/api/v1/auth/reset-password`
- **User Roles Permitted:** Customer, Owner
- **Core Module Dependencies:** FastAPI Auth Router, PasswordResetRequest Model, SHA-256 Hasher

##### 2. Feature Description
Provides self-service password reset functionality. Generates a secure single-use recovery token hashed with SHA-256 and allows customers to set a new password without administrative intervention.

##### 3. Purpose and User Benefits
Allows users who forgot their password to quickly regain account access without delay or manual support requests.

##### 4. User Interaction and Usage Instructions
1. In the login modal, click 'Forgot Password?'.
2. Enter your registered account email and submit.
3. The system dispatches a secure password recovery link.
4. Click the link or enter the reset token in the recovery interface.
5. Enter and confirm your new password (minimum 8 characters).
6. Click 'Reset Password'. Upon success, log in with your new credentials.

##### 5. UI and Component Implementation
Implemented in `frontend/src/components/ForgotPassword.tsx` and `frontend/src/components/ResetPassword.tsx`. Features input validation, error banners, and success confirmation dialogs.

##### 6. Backend and Business Logic
`POST /api/v1/auth/forgot-password` generates a random URL-safe 32-byte token via `secrets.token_urlsafe(32)`. Hashes token with SHA-256 before inserting into `password_reset_requests` table with a 1-hour expiration. `POST /api/v1/auth/reset-password` verifies token hash and expiration, updates `users.password_hash`, and marks request used.

##### 7. Data Model and Persistence
Table: `password_reset_requests`: `id` (UUID PK), `user_id` (UUID FK), `token_hash` (VARCHAR(64) indexed), `expires_at` (TIMESTAMPTZ), `used_at` (TIMESTAMPTZ nullable), `created_at`.

##### 8. API and Integration Details
POST /api/v1/auth/forgot-password (`email`). POST /api/v1/auth/reset-password (`token`, `new_password`). Error responses: 400 Bad Request for expired/invalid tokens, 404 for unknown email (response sanitized to prevent account enumeration).

##### 9. State and Lifecycle
Requested -> Token Generated & Stored as SHA-256 Hash -> Token Verified -> Password Updated -> Token Marked Used.

##### 10. Permissions and Security
Endpoints are public with rate limiting. Raw token never stored in database.

##### 11. Edge Cases and Error Behavior
Expired tokens display clear expiry warnings with a one-click button to request a fresh link.

##### 12. Testing and Verification
Automated tests in `backend/tests/test_forgot_password.py`, `frontend/src/components/ForgotPassword.test.tsx`, and `frontend/src/components/ResetPassword.test.tsx`. Status: PASS.

##### 13. Maintenance and Extension
Main files: `backend/app/modules/auth/service.py`, `frontend/src/components/ResetPassword.tsx`.

##### 14. Feature Summary
- **Summary:** Secure self-service password recovery flow with cryptographic token hashing and expiration enforcement.
- **Status:** Implemented and verified

---

#### [FEAT-004] Admin-Assisted Password Reset Management

##### 1. Feature Identity
- **Feature ID:** `FEAT-004`
- **Feature Name:** Admin-Assisted Password Reset Management
- **Category:** Authentication, Identity & Permissions
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/admin (Passwords tab)`, `/api/v1/admin/users/{user_id}/reset-password`, `/api/v1/admin/password-reset-requests`
- **User Roles Permitted:** Administrator
- **Core Module Dependencies:** Admin Dashboard, Admin Passwords Service, AuditLog Model

##### 2. Feature Description
Allows platform administrators to assist customers or venue owners who cannot complete self-service recovery. Generates an administrative reset token with an immediate copyable link and logs all actions to the platform audit trail.

##### 3. Purpose and User Benefits
Provides customer support staff with a reliable fallback to recover locked accounts while maintaining strict security auditing.

##### 4. User Interaction and Usage Instructions
1. Open Admin Dashboard (`/admin`) and navigate to the 'Passwords' tab.
2. Search for the target user by name, email, or phone number.
3. Click 'Generate Reset Link' on the user row.
4. Choose delivery method ('Copy link to share directly' or 'Mark pending request resolved').
5. Click 'Generate Link'. Copy the single-use reset URL and securely share it with the verified account holder.

##### 5. UI and Component Implementation
Implemented in `frontend/src/components/dashboard/AdminPasswords.tsx`. Displays searchable user directory, pending reset request queues, modal dialogs with copy-to-clipboard functionality, and request cancellation buttons.

##### 6. Backend and Business Logic
`POST /api/v1/admin/users/{user_id}/reset-password` in `backend/app/modules/admin/passwords_service.py`. Verifies admin credentials, creates a `PasswordResetRequest` row with `created_by_admin=True`, creates an `AuditLog` entry, and returns the constructed `reset_url`.

##### 7. Data Model and Persistence
Utilizes `password_reset_requests` and `audit_logs` tables. Stores admin ID in `AuditLog.actor_id`.

##### 8. API and Integration Details
POST /api/v1/admin/users/{user_id}/reset-password. GET /api/v1/admin/password-reset-requests. DELETE /api/v1/admin/password-reset-requests/{request_id}. Requires admin role header.

##### 9. State and Lifecycle
Admin Trigger -> Token Generated -> Link Copied -> Audit Entry Logged -> Customer Uses Link -> Token Expired/Consumed.

##### 10. Permissions and Security
Restricted exclusively to `admin` role via `require_role('admin')` dependency.

##### 11. Edge Cases and Error Behavior
If a user is suspended, admin password reset warns the operator before issuing links.

##### 12. Testing and Verification
Automated tests in `backend/tests/test_admin_passwords.py` and `frontend/src/components/dashboard/AdminPasswords.test.tsx` (9 tests passing).

##### 13. Maintenance and Extension
Main files: `backend/app/modules/admin/passwords_service.py`, `frontend/src/components/dashboard/AdminPasswords.tsx`.

##### 14. Feature Summary
- **Summary:** Administrative account recovery system with secure one-time link generation and immutable audit logging.
- **Status:** Implemented and verified

---

#### [FEAT-005] User Account Deletion & Right to Erasure

##### 1. Feature Identity
- **Feature ID:** `FEAT-005`
- **Feature Name:** User Account Deletion & Right to Erasure
- **Category:** Authentication, Identity & Permissions
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/api/v1/users/me`
- **User Roles Permitted:** Customer, Owner, Admin
- **Core Module Dependencies:** User Model, Auth Service, AuditLog Model

##### 2. Feature Description
Implements GDPR and DPDP compliance by allowing registered users to request permanent erasure of their account profile and personal data.

##### 3. Purpose and User Benefits
Empowers users with complete privacy control over their personal identity data and credentials.

##### 4. User Interaction and Usage Instructions
1. User initiates account closure request.
2. System checks for open active bookings or unfulfilled financial obligations.
3. If clear, account is deactivated, personal identifying data is scrubbed, and session tokens are invalidated.

##### 5. UI and Component Implementation
Handled via profile settings and customer service flows. Triggers confirmation prompt warning the user of permanent data deletion.

##### 6. Backend and Business Logic
`DELETE /api/v1/users/me` in `backend/app/main.py`. Validates authenticated user. Verifies no pending bookings or unpaid ledger obligations exist. Anonymizes user record, revokes all refresh tokens, and logs audit record.

##### 7. Data Model and Persistence
Updates `users` table: marks `is_active=False`, clears phone and email unique constraints, cascades to `refresh_tokens`.

##### 8. API and Integration Details
DELETE /api/v1/users/me. Requires Bearer JWT authentication. Returns HTTP 204 No Content.

##### 9. State and Lifecycle
Active Account -> Deletion Request -> Financial Sanity Check -> Scrubbed & Revoked.

##### 10. Permissions and Security
Authenticated user acting strictly upon their own profile.

##### 11. Edge Cases and Error Behavior
Users with active reservations cannot delete their account until bookings are completed or cancelled.

##### 12. Testing and Verification
Verified via `backend/tests/test_auth_flow.py` and `backend/tests/test_archival.py` account lifecycle test cases.

##### 13. Maintenance and Extension
Ensure new tables referencing `user_id` implement `ON DELETE SET NULL` or handle anonymization properly.

##### 14. Feature Summary
- **Summary:** Privacy-compliant account erasure endpoint enforcing relational safety and session termination.
- **Status:** Implemented and verified

---

#### [FEAT-006] Role-Based Access Control (RBAC)

##### 1. Feature Identity
- **Feature ID:** `FEAT-006`
- **Feature Name:** Role-Based Access Control (RBAC)
- **Category:** Authentication, Identity & Permissions
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `All /api/v1 routes`, `/owner`, `/admin`
- **User Roles Permitted:** Customer, Owner, Admin
- **Core Module Dependencies:** Auth Dependencies, PyJWT, FastAPI Depends

##### 2. Feature Description
Enforces platform-wide role separation across customer reservations, owner venue operations, and administrative governance.

##### 3. Purpose and User Benefits
Guarantees data confidentiality, preventing customers from modifying venue listings and preventing owners from accessing platform financial controls.

##### 4. User Interaction and Usage Instructions
1. Access controls are automatically applied based on your authenticated role.
2. Customers see booking management and search features.
3. Verified owners see the Owner Dashboard (`/owner`) with calendar and listing tools.
4. Administrators see the Admin Command Center (`/admin`) with full approval and ledger controls.

##### 5. UI and Component Implementation
Implemented via `PerspectiveSwitcher.tsx` (in dev), `OwnerLayout.tsx`, `AdminLayout.tsx`, and dynamic header links in `Header.tsx`.

##### 6. Backend and Business Logic
Enforced by `require_role('owner')` and `require_role('admin')` in `backend/app/modules/auth/dependencies.py`. Decodes JWT, validates active status, and asserts required role claims.

##### 7. Data Model and Persistence
`users.role` enum column ('customer', 'owner', 'admin') and `is_suspended` boolean flag.

##### 8. API and Integration Details
Returns HTTP 403 Forbidden with `{detail: 'Forbidden: Insufficient privileges'}` when authorization checks fail.

##### 9. State and Lifecycle
User Token Checked -> Role Claim Evaluated -> Access Granted or HTTP 403 Raised.

##### 10. Permissions and Security
Core architectural security boundary. Enforced server-side on all mutation and administrative routes.

##### 11. Edge Cases and Error Behavior
Suspended users attempting to use valid JWTs are immediately denied with HTTP 403 Suspended Account.

##### 12. Testing and Verification
Covered comprehensively in `backend/tests/test_rbac.py` (7 tests passing) and `test_admin_auth.py`.

##### 13. Maintenance and Extension
Main file: `backend/app/modules/auth/dependencies.py`.

##### 14. Feature Summary
- **Summary:** Robust server-side role-based access control protecting administrative, owner, and customer resources.
- **Status:** Implemented and verified

---

### Category: Public Venue Discovery, Search & Presentation

#### [FEAT-007] Landing Page & Hero Multi-Filter Search

##### 1. Feature Identity
- **Feature ID:** `FEAT-007`
- **Feature Name:** Landing Page & Hero Multi-Filter Search
- **Category:** Public Venue Discovery, Search & Presentation
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/`, `/api/v1/venues`, `/api/v1/categories`
- **User Roles Permitted:** Public Visitor, Customer
- **Core Module Dependencies:** Hero Component, Header Component, useVenues Hook, Framer Motion

##### 2. Feature Description
The primary public landing interface featuring an ambient video/image hero, value propositions, and an integrated search widget allowing visitors to discover venues by city, reservation date, and category.

##### 3. Purpose and User Benefits
Enables visitors to locate suitable venues within seconds through an intuitive search widget without navigating complex menu trees.

##### 4. User Interaction and Usage Instructions
1. Visit the GroundKart homepage (`/`).
2. In the hero widget, enter your location or select a suggested metropolitan area.
3. Pick an event date using the integrated date picker.
4. Choose a venue category from the dropdown (Sports, Banquet Halls, Corporate, Farmhouses).
5. Click 'Search Venues' to transition to `/search` with parameters populated.

##### 5. UI and Component Implementation
Implemented in `frontend/src/components/Hero.tsx` and `frontend/src/App.tsx`. Features floating search container, smooth entrance animations, responsive layout adapting from stacked mobile to single-line desktop bar.

##### 6. Backend and Business Logic
Supported by `GET /api/v1/categories` and `GET /api/v1/venues?city=...&category=...&available_on=...` in `backend/app/main.py`. Filters active venues with available slots on the requested date.

##### 7. Data Model and Persistence
Queries `venues`, `categories`, and `inventory_units` tables. Requires `venues.status = 'active'`.

##### 8. API and Integration Details
GET /api/v1/venues. Query params: `city`, `category`, `available_on`. Response: `VenueListResponse` containing venue summary objects.

##### 9. State and Lifecycle
Hero Inputs Entered -> Submit Clicked -> URL Updated with Query Params (`/search?city=...`) -> Results Rendered.

##### 10. Permissions and Security
Publicly accessible to all unauthenticated and authenticated visitors.

##### 11. Edge Cases and Error Behavior
Submitting empty inputs navigates to the general catalog showing all active venues across all cities.

##### 12. Testing and Verification
Verified via `frontend/src/App.test.tsx` and browser automation tests in `verify_browser_journeys.py`. Status: PASS.

##### 13. Maintenance and Extension
Main files: `frontend/src/components/Hero.tsx`, `frontend/src/App.tsx`.

##### 14. Feature Summary
- **Summary:** High-impact landing search experience driving immediate venue discovery by location, date, and activity.
- **Status:** Implemented and verified

---

#### [FEAT-008] Homepage Editorial Placement Management

##### 1. Feature Identity
- **Feature ID:** `FEAT-008`
- **Feature Name:** Homepage Editorial Placement Management
- **Category:** Public Venue Discovery, Search & Presentation
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/`, `/admin (Homepage tab)`, `/api/v1/homepage`, `/api/v1/admin/homepage/placements`
- **User Roles Permitted:** Public Visitor, Administrator
- **Core Module Dependencies:** HomepagePlacement Model, HomepageTab Component, AdminLayout

##### 2. Feature Description
Allows administrators to curate and feature high-priority venues on the homepage in prime editorial positions (Featured Arena hero banner and Trending in Metropolis carousel).

##### 3. Purpose and User Benefits
Gives administrators control to promote high-performing or partner venues, while giving visitors immediate recommendations for top-rated spaces.

##### 4. User Interaction and Usage Instructions
1. Administrators open Admin Dashboard (`/admin`) and select the 'Homepage' tab.
2. Select a venue to feature in the 'Featured Arena' hero placement.
3. Enter a custom editorial badge (e.g., 'FEATURED ARENA'), title, and description override.
4. Add or reorder venues in the 'Trending in Metropolis' list.
5. Click 'Save Placements'. The live homepage immediately reflects the curated placements.

##### 5. UI and Component Implementation
Customer view rendered in `frontend/src/App.tsx` (#trending-section and featured banner). Admin curation interface in `frontend/src/components/dashboard/HomepageTab.tsx`.

##### 6. Backend and Business Logic
Managed by `GET /api/v1/homepage` (public) and `/api/v1/admin/homepage/placements` (admin CRUD) in `backend/app/main.py`. Placements are persisted in `homepage_placements` with sort orders and badges.

##### 7. Data Model and Persistence
Table: `homepage_placements`: `id` (UUID PK), `venue_id` (UUID FK), `section` ('featured' or 'trending'), `badge` (VARCHAR), `custom_title`, `custom_description`, `sort_order` (INTEGER), `is_active` (BOOLEAN).

##### 8. API and Integration Details
GET /api/v1/homepage returns `{featured: [...], trending: [...]}`. Admin endpoints support POST, PATCH, and DELETE on placement items.

##### 9. State and Lifecycle
Admin Configures Placement -> Row Updated in DB -> Public Homepage API Serves Placements -> UI Renders Editorial Banner.

##### 10. Permissions and Security
Public read. Admin role strictly required for creation, reordering, and deletion.

##### 11. Edge Cases and Error Behavior
If no placements are configured, fallback logic automatically renders the highest-rated active venues.

##### 12. Testing and Verification
Automated tests in `backend/tests/test_catalog.py` and `frontend/src/AdminLayout.test.tsx`. Status: PASS.

##### 13. Maintenance and Extension
Main files: `backend/app/models/core.py`, `frontend/src/components/dashboard/HomepageTab.tsx`.

##### 14. Feature Summary
- **Summary:** Administrative editorial management system driving homepage promotion and curated discovery.
- **Status:** Implemented and verified

---

#### [FEAT-009] Advanced Venue Catalog & Multi-Parameter Filtering

##### 1. Feature Identity
- **Feature ID:** `FEAT-009`
- **Feature Name:** Advanced Venue Catalog & Multi-Parameter Filtering
- **Category:** Public Venue Discovery, Search & Presentation
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/search`, `/api/v1/venues`
- **User Roles Permitted:** Public Visitor, Customer
- **Core Module Dependencies:** FiltersSidebar Component, VenueCard Component, useVenues Hook

##### 2. Feature Description
Comprehensive venue catalog page providing real-time multi-dimensional filtering across price range, verified amenities, capacity size groups, minimum star ratings, and text queries.

##### 3. Purpose and User Benefits
Empowers customers to narrow down hundreds of listings to the exact spaces meeting their budget, guest count, and facility requirements.

##### 4. User Interaction and Usage Instructions
1. Navigate to `/search` via navigation or search submission.
2. In the Filters sidebar, adjust minimum and maximum price inputs.
3. Select required amenities: Free Parking, Floodlights, AC, Locker Rooms.
4. Choose capacity range (e.g., 50-200 guests).
5. Select minimum rating (e.g., 4+ Stars).
6. Results update instantly. Click 'Reset Filters' to restore the full listing.

##### 5. UI and Component Implementation
Implemented in `frontend/src/components/FiltersSidebar.tsx` and `frontend/src/components/VenueCard.tsx`. Features responsive mobile drawer, results count indicator, shimmer skeleton loaders, and empty states.

##### 6. Backend and Business Logic
Backend provides core query via `GET /api/v1/venues?city=...&category=...`. Client-side `useMemo` filter chain evaluates amenity matches, capacity groupings, rating thresholds, and keyword matching.

##### 7. Data Model and Persistence
Evaluates `venues` attributes: `base_price`, `capacity`, `avg_rating`, and `amenities` (array of strings from `amenities` table).

##### 8. API and Integration Details
GET /api/v1/venues?city=&category=&available_on=&limit=50&offset=0. Returns paginated venue summaries.

##### 9. State and Lifecycle
Filter State Changed -> Client-Side Re-evaluation -> Grid Updates Animate -> Empty State shown if zero matches.

##### 10. Permissions and Security
Publicly accessible.

##### 11. Edge Cases and Error Behavior
Zero matching results renders a clean 'No venues available yet' state with a prominent one-click 'Clear Filters' button.

##### 12. Testing and Verification
Covered in `frontend/src/App.test.tsx` and `frontend/src/components/VenueCard.test.tsx`. Status: PASS.

##### 13. Maintenance and Extension
Main files: `frontend/src/components/FiltersSidebar.tsx`, `frontend/src/App.tsx`.

##### 14. Feature Summary
- **Summary:** Interactive catalog interface with multi-attribute filtering, skeleton loading, and responsive mobile drawer.
- **Status:** Implemented and verified

---

#### [FEAT-010] Responsive Multi-Category Rail & Category Landing Pages

##### 1. Feature Identity
- **Feature ID:** `FEAT-010`
- **Feature Name:** Responsive Multi-Category Rail & Category Landing Pages
- **Category:** Public Venue Discovery, Search & Presentation
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/categories/:category`, `/search?category=...`
- **User Roles Permitted:** Public Visitor, Customer
- **Core Module Dependencies:** React Router, Header Component, App Component

##### 2. Feature Description
Dedicated category landing pages and responsive horizontal category rails allowing quick navigation between Sports Turfs, Banquet Halls, Corporate Hubs, and Farmhouses.

##### 3. Purpose and User Benefits
Provides instant one-tap entry into specific venue categories without manually typing search keywords.

##### 4. User Interaction and Usage Instructions
1. On mobile devices, swipe the horizontal category chip rail at the top of the homepage.
2. Tap any category (e.g., 'Banquet Halls').
3. The catalog immediately opens pre-filtered to the chosen category with customized SEO title.
4. Alternatively, click category links in the header navigation or footer sitemap.

##### 5. UI and Component Implementation
Implemented via category slug mapping dictionaries (`DISPLAY_TO_BACKEND_CATEGORY` and `SLUG_TO_DISPLAY_CATEGORY`) in `frontend/src/App.tsx`. Supports smooth touch scrolling on mobile.

##### 6. Backend and Business Logic
Translates URL slug (e.g., `/categories/banquet-halls`) to backend category identifier (`banquet_hall`) and queries `GET /api/v1/venues?category=banquet_hall`.

##### 7. Data Model and Persistence
Matches against `venues.category` and `categories` table (`id`, `name`, `slug`, `icon`).

##### 8. API and Integration Details
GET /api/v1/venues?category={category_name}.

##### 9. State and Lifecycle
URL `/categories/:slug` -> Normalized to backend category -> Search state populated -> Filtered results rendered.

##### 10. Permissions and Security
Publicly accessible.

##### 11. Edge Cases and Error Behavior
Invalid category slugs cleanly fallback to general search without raising application errors.

##### 12. Testing and Verification
Verified via `frontend/src/App.test.tsx` route matching tests.

##### 13. Maintenance and Extension
Main files: `frontend/src/App.tsx`, `backend/app/models/core.py`.

##### 14. Feature Summary
- **Summary:** Category-focused exploration system with dedicated routing, slug normalization, and responsive touch rails.
- **Status:** Implemented and verified

---

#### [FEAT-011] Public Venue Detail Page & Availability Viewer

##### 1. Feature Identity
- **Feature ID:** `FEAT-011`
- **Feature Name:** Public Venue Detail Page & Availability Viewer
- **Category:** Public Venue Discovery, Search & Presentation
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/venues/:slug_or_id`, `/api/v1/venues/{venue_id}`, `/api/v1/venues/{venue_id}/availability`
- **User Roles Permitted:** Public Visitor, Customer
- **Core Module Dependencies:** DetailView Component, useVenue Hook, useVenueSlots Hook

##### 2. Feature Description
Comprehensive venue specification view displaying complete facility information, verified amenities, rental modes, interactive date selector, real-time slot availability badges, and customer reviews.

##### 3. Purpose and User Benefits
Gives customers all technical, logistical, and pricing information necessary to make an informed reservation decision.

##### 4. User Interaction and Usage Instructions
1. Click on any venue card from the search results or homepage.
2. The venue detail view (`/venues/:id`) opens displaying cover image, address, capacity, and ratings.
3. Scroll to inspect amenities, content blocks (FAQs, rules, story), and customer reviews.
4. In the booking widget, pick a target date.
5. Click an available slot to see price calculation and initiate reservation.

##### 5. UI and Component Implementation
Implemented in `frontend/src/components/DetailView.tsx`. Features lazy-loading Suspense boundaries, skeleton loaders, floating booking summary card, and responsive mobile bottom-sheet action bar.

##### 6. Backend and Business Logic
`GET /api/v1/venues/{venue_id}` returns full venue payload with preloaded `media`, `content_blocks`, `rental_options`, `purposes`, and `amenities`. `GET /api/v1/venues/{venue_id}/availability` calculates live slot statuses.

##### 7. Data Model and Persistence
Loads `venues` with relationships: `venue_media`, `venue_content_blocks`, `venue_rental_options`, `venue_purposes`, and `inventory_units`.

##### 8. API and Integration Details
GET /api/v1/venues/{id}. Response: `VenueResponse`. GET /api/v1/venues/{id}/availability?date_from=...&date_to=... Response: `list[DateAvailabilityResponse]`.

##### 9. State and Lifecycle
Route Triggered -> Fetch Venue Spec -> Fetch Slot Availability -> User Selects Slot -> Navigates to Checkout.

##### 10. Permissions and Security
Publicly accessible for active venues.

##### 11. Edge Cases and Error Behavior
If a venue ID does not exist, renders `NotFound.tsx` (404) with link to catalog.

##### 12. Testing and Verification
Automated tests in `frontend/src/components/DetailView.test.tsx` (8 tests passing) and `backend/tests/test_catalog.py`.

##### 13. Maintenance and Extension
Main file: `frontend/src/components/DetailView.tsx`.

##### 14. Feature Summary
- **Summary:** Central venue specification page integrating rich media, content blocks, real-time slots, and instant booking.
- **Status:** Implemented and verified

---

#### [FEAT-012] Fullscreen Interactive Media Lightbox & Video Player

##### 1. Feature Identity
- **Feature ID:** `FEAT-012`
- **Feature Name:** Fullscreen Interactive Media Lightbox & Video Player
- **Category:** Public Venue Discovery, Search & Presentation
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/venues/:id (Lightbox overlay)`
- **User Roles Permitted:** Public Visitor, Customer
- **Core Module Dependencies:** VenueImageLightbox Component, Framer Motion, Lucide Icons

##### 2. Feature Description
An interactive, accessible fullscreen lightbox overlay allowing prospective customers to view high-resolution venue photos and embedded walkthrough videos with keyboard navigation and thumbnail scrubbing.

##### 3. Purpose and User Benefits
Allows users to inspect property conditions, lighting, turf quality, and seating arrangements in high resolution before committing funds.

##### 4. User Interaction and Usage Instructions
1. On any venue detail page, click the main hero photo or any gallery thumbnail.
2. The lightbox expands to fill the screen with a darkened backdrop.
3. Use the Left/Right arrows (or keyboard arrow keys) to cycle through media.
4. For video assets, click the play button to watch the property walkthrough.
5. Click the 'X' button or press `Escape` to close the lightbox.

##### 5. UI and Component Implementation
Implemented in `frontend/src/components/VenueImageLightbox.tsx`. Features touch swiping, keyboard event listeners, thumbnail carousel, video player controls, and focus traps.

##### 6. Backend and Business Logic
Consumes `media` array from `VenueResponse`. Media items are sorted by `sort_order` with cover images prioritized.

##### 7. Data Model and Persistence
Attributes from `venue_media` table: `id`, `url`, `media_type` ('image' or 'video'), `is_cover`, `sort_order`.

##### 8. API and Integration Details
Supplied directly via venue payload from `GET /api/v1/venues/{id}`.

##### 9. State and Lifecycle
Thumbnail Clicked -> Lightbox Mounted -> Media Index Tracked -> Close Event -> Lightbox Unmounted.

##### 10. Permissions and Security
Publicly accessible.

##### 11. Edge Cases and Error Behavior
Missing or broken image URLs automatically trigger fallback placeholder graphics via `SafeImage.tsx`.

##### 12. Testing and Verification
Automated tests in `frontend/src/components/VenueImageLightbox.test.tsx` (6 tests passing).

##### 13. Maintenance and Extension
Main file: `frontend/src/components/VenueImageLightbox.tsx`.

##### 14. Feature Summary
- **Summary:** Accessible, high-performance fullscreen media lightbox supporting high-resolution image galleries and video walkthroughs.
- **Status:** Implemented and verified

---

#### [FEAT-013] Modular Venue Content Blocks

##### 1. Feature Identity
- **Feature ID:** `FEAT-013`
- **Feature Name:** Modular Venue Content Blocks
- **Category:** Public Venue Discovery, Search & Presentation
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/venues/:id`, `/api/v1/venues/{venue_id}`
- **User Roles Permitted:** Public Visitor, Customer, Owner
- **Core Module Dependencies:** VenueContentBlock Model, DetailView Component, PresentationStep Component

##### 2. Feature Description
Flexible, structured content blocks allowing venue owners to display customized sections: Frequently Asked Questions, Highlights, Venue Story, House Rules, Things to Know, and Suitable For.

##### 3. Purpose and User Benefits
Provides transparent expectations regarding parking, outside catering, sound rules, and cancellation terms, reducing misunderstandings.

##### 4. User Interaction and Usage Instructions
1. Owners create and configure content blocks in Step 11 of the Listing Builder or via the Venue Workspace.
2. Customers view these blocks organized into structured cards and accordions on the venue detail page.
3. In the FAQ block, click question headers to expand detailed answers.

##### 5. UI and Component Implementation
Rendered in `frontend/src/components/DetailView.tsx`. Features expandable accordion controls for FAQs, icon checklists for Rules/Highlights, and styled quote cards for Venue Story.

##### 6. Backend and Business Logic
Managed by `catalog_service` in `backend/app/modules/catalog/service.py`. Validates block JSON structures (`settings` JSONB) according to block `type`.

##### 7. Data Model and Persistence
Table: `venue_content_blocks`: `id` (UUID PK), `venue_id` (UUID FK), `type` (VARCHAR), `title`, `subtitle`, `body`, `settings` (JSONB), `sort_order`, `enabled` (BOOLEAN).

##### 8. API and Integration Details
Included in `VenueResponse.content_blocks`. Sorted by `sort_order`.

##### 9. State and Lifecycle
Owner Configures Blocks -> JSON Persisted -> Detail Page Renders Enabled Blocks Dynamically.

##### 10. Permissions and Security
Public read. Owner/Admin write.

##### 11. Edge Cases and Error Behavior
Disabled content blocks (`enabled=False`) are excluded from public API responses.

##### 12. Testing and Verification
Verified via `backend/tests/test_catalog.py` and seeding verification script. Status: PASS.

##### 13. Maintenance and Extension
Main files: `backend/app/models/core.py`, `frontend/src/components/DetailView.tsx`.

##### 14. Feature Summary
- **Summary:** Configurable, typed content block engine rendering customized FAQs, rules, and promotional narratives.
- **Status:** Implemented and verified

---

#### [FEAT-014] Customer Favorites & Wishlist Persistence

##### 1. Feature Identity
- **Feature ID:** `FEAT-014`
- **Feature Name:** Customer Favorites & Wishlist Persistence
- **Category:** Public Venue Discovery, Search & Presentation
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/`, `/search`, `/venues/:id`
- **User Roles Permitted:** Public Visitor, Customer
- **Core Module Dependencies:** VenueCard Component, DetailView Component, App Component

##### 2. Feature Description
Allows customers to bookmark favorite venues with a single click on heart icons across venue cards and detail pages, persisting choices across browsing sessions.

##### 3. Purpose and User Benefits
Helps users shortlist candidate venues for comparison and quick retrieval without repeating searches.

##### 4. User Interaction and Usage Instructions
1. Click the Heart icon on any venue card or the detail page header.
2. The icon highlights in filled crimson.
3. Bookmarked venues remain saved in your browser across sessions.
4. Click the heart icon again to remove a venue from your favorites.

##### 5. UI and Component Implementation
Implemented via `favorites` state in `frontend/src/App.tsx` and heart toggle handlers in `VenueCard.tsx` and `DetailView.tsx` with micro-scale animations.

##### 6. Backend and Business Logic
Client-state persistence synchronized to browser `localStorage` under `groundkart_favorites` key.

##### 7. Data Model and Persistence
Stores array of venue UUID strings in client storage.

##### 8. API and Integration Details
Client-side operation; does not require server roundtrips.

##### 9. State and Lifecycle
Heart Clicked -> State Array Toggled -> LocalStorage Updated -> UI Badges Synchronized.

##### 10. Permissions and Security
Available to all users.

##### 11. Edge Cases and Error Behavior
Deleting browser cache resets favorites back to default recommendations.

##### 12. Testing and Verification
Tested in `frontend/src/components/VenueCard.test.tsx` (4 tests passing).

##### 13. Maintenance and Extension
Main file: `frontend/src/App.tsx`.

##### 14. Feature Summary
- **Summary:** Lightweight, persistent venue bookmarking feature allowing users to shortlist preferred properties.
- **Status:** Implemented and verified

---

#### [FEAT-015] Automated SEO Metadata & Dynamic JSON-LD Structured Data

##### 1. Feature Identity
- **Feature ID:** `FEAT-015`
- **Feature Name:** Automated SEO Metadata & Dynamic JSON-LD Structured Data
- **Category:** Public Venue Discovery, Search & Presentation
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `All frontend views`, `/sitemap.xml`, `/robots.txt`
- **User Roles Permitted:** Search Engine Crawlers, Public Visitor
- **Core Module Dependencies:** react-helmet-async, SEOHead Component, Schema Generators

##### 2. Feature Description
Generates dynamic HTML `<title>`, `<meta name='description'>`, OpenGraph preview cards, canonical URLs, and Schema.org JSON-LD structured data (Organization, Website, CollectionPage, BreadcrumbList, SportsActivityLocation) for all pages.

##### 3. Purpose and User Benefits
Ensures rich social media preview cards when sharing links on WhatsApp/Twitter and maximizes visibility on Google search results.

##### 4. User Interaction and Usage Instructions
1. Completely automated for all pages.
2. Sharing any venue link on WhatsApp or social media automatically generates a preview card with cover photo and pricing.
3. Crawlers inspect `/robots.txt` and fetch `/sitemap.xml` listing all active venue URLs.

##### 5. UI and Component Implementation
Implemented in `frontend/src/components/SEOHead.tsx` and `frontend/src/lib/schema.ts` utilizing `react-helmet-async`.

##### 6. Backend and Business Logic
Backend provides dynamically generated `GET /sitemap.xml` and `GET /robots.txt` in `backend/app/main.py` querying all active venues from the database.

##### 7. Data Model and Persistence
Generates Schema.org JSON-LD models from `venues`, `media`, and `reviews` tables.

##### 8. API and Integration Details
GET /robots.txt. GET /sitemap.xml. Response: XML and text formats.

##### 9. State and Lifecycle
Route Mounted -> Helmet Injects Canonical/OpenGraph Tags -> JSON-LD Rendered in Head.

##### 10. Permissions and Security
Public endpoints.

##### 11. Edge Cases and Error Behavior
Private administrative routes (`/admin`, `/owner`, `/checkout`) automatically receive `noindex, nofollow` robots directives to prevent indexing private portals.

##### 12. Testing and Verification
Automated tests in `backend/tests/test_seo.py` and schema validation tests. Status: PASS.

##### 13. Maintenance and Extension
Main files: `frontend/src/lib/schema.ts`, `backend/app/main.py`.

##### 14. Feature Summary
- **Summary:** Full-stack search engine optimization system delivering dynamic Schema.org JSON-LD, sitemaps, and OpenGraph tags.
- **Status:** Implemented and verified

---

### Category: Reservation Engine, Availability & Checkout

#### [FEAT-016] Real-Time Slot Availability Matrix & Date Selection

##### 1. Feature Identity
- **Feature ID:** `FEAT-016`
- **Feature Name:** Real-Time Slot Availability Matrix & Date Selection
- **Category:** Reservation Engine, Availability & Checkout
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/venues/:id`, `/api/v1/venues/{venue_id}/availability`
- **User Roles Permitted:** Public Visitor, Customer
- **Core Module Dependencies:** DetailView Component, InventoryUnit Model, Booking Engine

##### 2. Feature Description
Calculates and renders real-time slot availability badges for any selected date, distinguishing available slots, active 10-minute holds, confirmed bookings, and maintenance blocks.

##### 3. Purpose and User Benefits
Eliminates booking conflicts by giving customers accurate live slot availability before proceeding to checkout.

##### 4. User Interaction and Usage Instructions
1. On the venue detail page, locate the booking panel.
2. Pick an event date using the date picker.
3. Inspect the rendered slot buttons: Green (Available), Orange (Held), Gray (Booked/Blocked).
4. Click an available slot to view its start time, duration, and calculated rate.
5. Click 'Reserve Slot' to proceed.

##### 5. UI and Component Implementation
Implemented in `frontend/src/components/DetailView.tsx`. Color-coded status badges, real-time recalculation on date change, and automatic disabling of past or occupied slots.

##### 6. Backend and Business Logic
`GET /api/v1/venues/{venue_id}/availability` in `backend/app/main.py`. Evaluates `inventory_units` joined with active `bookings` and `blocks`. Reclassifies expired holds as available on-the-fly.

##### 7. Data Model and Persistence
Queries `inventory_units` (`id`, `date`, `start_time`, `end_time`, `price`, `status`, `expires_at`).

##### 8. API and Integration Details
GET /api/v1/venues/{id}/availability?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD. Returns array of `DateAvailabilityResponse`.

##### 9. State and Lifecycle
Date Picked -> Query API -> Compute Available/Held/Booked Matrix -> Display Interactive Slots.

##### 10. Permissions and Security
Public read access.

##### 11. Edge Cases and Error Behavior
If all slots for a date are reserved, displays a helpful notice suggesting alternative dates.

##### 12. Testing and Verification
Automated tests in `backend/tests/test_inventory_listing.py` and `backend/tests/test_catalog.py` (15 tests passing).

##### 13. Maintenance and Extension
Main files: `backend/app/modules/booking/service.py`, `frontend/src/components/DetailView.tsx`.

##### 14. Feature Summary
- **Summary:** Real-time calendar slot matrix computing available, held, and booked slots for transparent reservation.
- **Status:** Implemented and verified

---

#### [FEAT-017] Multi-Unit Rental Taxonomy

##### 1. Feature Identity
- **Feature ID:** `FEAT-017`
- **Feature Name:** Multi-Unit Rental Taxonomy
- **Category:** Reservation Engine, Availability & Checkout
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/venues/:id`, `/checkout`, `/api/v1/venues/{venue_id}/rental-options`
- **User Roles Permitted:** Customer, Owner
- **Core Module Dependencies:** VenueRentalOption Model, InventoryUnit Model, ListingBuilder

##### 2. Feature Description
Supports diverse commercial rental structures: hourly slots (sports turfs), half-day shifts (pool parties), full-day buyouts (weddings), and multi-day conferences.

##### 3. Purpose and User Benefits
Allows property owners to monetize spaces according to industry standards, while giving customers clear, standardized booking intervals.

##### 4. User Interaction and Usage Instructions
1. Venue owners configure rental modes in Step 5 of the Listing Builder.
2. Customers view rental options on the venue page (e.g., 'Morning Slot (9 AM - 2 PM)' or 'Full Day Buyout').
3. Pricing automatically calculates according to the chosen rental unit type.

##### 5. UI and Component Implementation
Configured in `frontend/src/components/owner/listing-builder/RentalSetupStep.tsx` and presented on `DetailView.tsx` and `ReviewPay.tsx`.

##### 6. Backend and Business Logic
Supported by `venue_rental_options` table and `UnitType` enum (`hourly`, `half_day`, `full_day`, `multi_day`). Enforces unit-specific minimum durations and rates.

##### 7. Data Model and Persistence
Table: `venue_rental_options`: `id` (UUID PK), `venue_id` (UUID FK), `name`, `unit_type` (VARCHAR), `base_price` (NUMERIC), `duration_hours` (INTEGER), `is_default` (BOOLEAN).

##### 8. API and Integration Details
CRUD endpoints under `/api/v1/owner/venues/{venue_id}/rental-options`.

##### 9. State and Lifecycle
Configured by Owner -> Attached to Venue -> Selected by Customer -> Recorded on Booking.

##### 10. Permissions and Security
Public read. Owner write.

##### 11. Edge Cases and Error Behavior
Half-day and full-day bookings automatically block all overlapping hourly slots on that calendar date.

##### 12. Testing and Verification
Automated tests in `backend/tests/test_phase1_ledger_and_compliance.py` and migration test suites.

##### 13. Maintenance and Extension
Main files: `backend/app/models/core.py`, `frontend/src/components/owner/listing-builder/RentalSetupStep.tsx`.

##### 14. Feature Summary
- **Summary:** Comprehensive rental taxonomy accommodating hourly, half-day, and full-day commercial booking structures.
- **Status:** Implemented and verified

---

#### [FEAT-018] Purpose-Driven Booking & Event Suitability Selection

##### 1. Feature Identity
- **Feature ID:** `FEAT-018`
- **Feature Name:** Purpose-Driven Booking & Event Suitability Selection
- **Category:** Reservation Engine, Availability & Checkout
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/venues/:id`, `/checkout`, `/api/v1/venues/{venue_id}/purposes`
- **User Roles Permitted:** Customer, Owner
- **Core Module Dependencies:** VenuePurpose Model, DetailView Component, ReviewPay Component

##### 2. Feature Description
Allows venues to define specific allowed event purposes (e.g., Cricket Match, Wedding Reception, Corporate Meeting) with custom pricing multipliers and maximum attendee limits.

##### 3. Purpose and User Benefits
Ensures customers do not book spaces for unauthorized activities while applying fair, purpose-specific pricing (e.g., higher rates for large weddings vs. small meetings).

##### 4. User Interaction and Usage Instructions
1. On the venue detail page, choose your event purpose from the 'Select Event Type' dropdown.
2. The base price and maximum guest capacity update based on the purpose.
3. During checkout, enter expected guest count. The system validates against the purpose limit.

##### 5. UI and Component Implementation
Rendered via `GroundSelect` on `DetailView.tsx` and validated on `ReviewPay.tsx`.

##### 6. Backend and Business Logic
Managed by `venue_purposes` table. `create_booking()` accepts `purpose_id` and validates guest counts and purpose permissions.

##### 7. Data Model and Persistence
Table: `venue_purposes`: `id` (UUID PK), `venue_id` (UUID FK), `name`, `description`, `price_override` (NUMERIC), `max_guests` (INTEGER), `is_custom` (BOOLEAN), `is_approved` (BOOLEAN).

##### 8. API and Integration Details
GET /api/v1/venues/{id}/purposes. POST /api/v1/owner/venues/{id}/purposes.

##### 9. State and Lifecycle
Owner defines purposes -> Customer selects purpose -> Booking records purpose snapshot.

##### 10. Permissions and Security
Public read. Owner write (custom purposes require admin moderation).

##### 11. Edge Cases and Error Behavior
If guest count exceeds purpose limit, checkout displays an inline validation warning and disables submission.

##### 12. Testing and Verification
Automated tests in `backend/tests/test_guide11_backend.py` and `CategoryStep.test.tsx`.

##### 13. Maintenance and Extension
Main files: `backend/app/models/core.py`, `frontend/src/components/ReviewPay.tsx`.

##### 14. Feature Summary
- **Summary:** Purpose-driven reservation engine tailoring pricing and capacity constraints to specific event types.
- **Status:** Implemented and verified

---

#### [FEAT-019] Concurrency-Safe Pessimistic Inventory Hold Engine

##### 1. Feature Identity
- **Feature ID:** `FEAT-019`
- **Feature Name:** Concurrency-Safe Pessimistic Inventory Hold Engine
- **Category:** Reservation Engine, Availability & Checkout
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/api/v1/bookings`
- **User Roles Permitted:** Customer, Public Visitor
- **Core Module Dependencies:** SQLAlchemy FOR UPDATE, InventoryUnit Model, Booking Engine

##### 2. Feature Description
Prevents double-booking across simultaneous users via row-level database locking (`SELECT ... FOR UPDATE`), placing slots on a strict 10-minute hold window.

##### 3. Purpose and User Benefits
Guarantees that when a customer begins checkout, nobody else can purchase or hold the same slot out from under them.

##### 4. User Interaction and Usage Instructions
1. Customer selects an available slot and clicks 'Reserve Slot'.
2. The system locks the slot row in PostgreSQL.
3. The slot transitions to 'held' and a 10-minute countdown starts.
4. If another customer attempts to book the same slot, they receive an immediate 'Slot is currently held' message.

##### 5. UI and Component Implementation
Rendered on `ReviewPay.tsx` displaying an active expiration timer ('Slot held for 10 minutes').

##### 6. Backend and Business Logic
`create_booking()` in `backend/app/modules/booking/service.py`. Begins async transaction, issues `SELECT * FROM inventory_units WHERE id = :id FOR UPDATE`, asserts `status == 'available'`, updates `status = 'held'`, sets `expires_at = now() + 10m`, creates `Booking` row, and commits.

##### 7. Data Model and Persistence
Updates `inventory_units.status` ('held'), `held_at`, `expires_at`. Creates `bookings` with status `'pending_payment'`.

##### 8. API and Integration Details
POST /api/v1/bookings. Body: `BookingCreateRequest`. Response: 201 Created with `expires_in` (seconds). Error: 409 Conflict if already held/booked.

##### 9. State and Lifecycle
Available -> (Locked FOR UPDATE) -> Held (10 mins) -> Confirmed (if paid) OR Expired (if timeout).

##### 10. Permissions and Security
Publicly accessible with IP rate limiting to prevent hold exhaustion attacks.

##### 11. Edge Cases and Error Behavior
Simultaneous requests queue up at the database lock; the second transaction immediately raises a 409 Conflict when the first commits.

##### 12. Testing and Verification
Verified via `backend/tests/test_concurrency.py`, `test_double_booking.py`, and `test_idempotency.py`. Status: PASS.

##### 13. Maintenance and Extension
Main file: `backend/app/modules/booking/service.py`. Hold duration is configurable via `SystemConfiguration`.

##### 14. Feature Summary
- **Summary:** Pessimistic concurrency control engine eliminating double-booking via database row locks and 10-minute holds.
- **Status:** Implemented and verified

---

#### [FEAT-020] Guest & Authenticated Checkout Pipeline

##### 1. Feature Identity
- **Feature ID:** `FEAT-020`
- **Feature Name:** Guest & Authenticated Checkout Pipeline
- **Category:** Reservation Engine, Availability & Checkout
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/checkout`, `/api/v1/bookings`
- **User Roles Permitted:** Public Visitor, Customer
- **Core Module Dependencies:** ReviewPay Component, useCreateBooking Hook, Booking Model

##### 2. Feature Description
Multi-step checkout interface supporting both logged-in customers and friction-free guest checkouts with contact entry, guest count verification, and offline payment instructions.

##### 3. Purpose and User Benefits
Allows users to book immediately without being forced to create a password-protected account prior to reservation.

##### 4. User Interaction and Usage Instructions
1. Initiate booking from any venue detail page to enter `/checkout`.
2. Review reservation details (venue, date, slot time, total price).
3. If checking out as a guest, enter Full Name, Email, and Phone number.
4. Enter optional attendee count and special requests.
5. Review cancellation policy disclosure.
6. Click 'Confirm & Reserve'. The confirmation screen displays your reservation code and payment instructions.

##### 5. UI and Component Implementation
Implemented in `frontend/src/components/ReviewPay.tsx`. Features countdown hold timer, collapsible cancellation policy drawer, copyable booking ID button, and success state card.

##### 6. Backend and Business Logic
`POST /api/v1/bookings` in `backend/app/main.py`. Dispatches to `booking_service.create_booking()`. If guest, generates a random `manage_token`, stores its SHA-256 hash in `bookings.manage_token_hash`, and returns the raw token in the confirmation URL.

##### 7. Data Model and Persistence
Inserts row into `bookings` (`id`, `inventory_unit_id`, `customer_id`, `guest_name`, `guest_email`, `guest_phone`, `manage_token_hash`, `total_price`, `status`).

##### 8. API and Integration Details
POST /api/v1/bookings. Body: `BookingCreateRequest`. Response: `BookingCreateResponse` (`id`, `status: pending_payment`, `expires_in: 600`, `manage_url`).

##### 9. State and Lifecycle
Slot Selected -> Review Screen -> Booking Created (`pending_payment`) -> Offline Payment Instructions Displayed.

##### 10. Permissions and Security
Publicly accessible. If user is logged in, their user ID is automatically linked; if guest, secure manage token is created.

##### 11. Edge Cases and Error Behavior
Navigating to `/checkout` directly without selecting a slot redirects automatically back to `/search`.

##### 12. Testing and Verification
Automated tests in `frontend/src/components/MyBookings.test.tsx` and `backend/tests/test_booking_api.py`. Status: PASS.

##### 13. Maintenance and Extension
Main files: `frontend/src/components/ReviewPay.tsx`, `backend/app/modules/booking/service.py`.

##### 14. Feature Summary
- **Summary:** Unified checkout pipeline accommodating both registered customers and guest bookings with secure token creation.
- **Status:** Implemented and verified

---

#### [FEAT-021] Secure Guest Booking Access via SHA-256 Manage Token

##### 1. Feature Identity
- **Feature ID:** `FEAT-021`
- **Feature Name:** Secure Guest Booking Access via SHA-256 Manage Token
- **Category:** Reservation Engine, Availability & Checkout
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/bookings/manage/:token`, `/api/v1/bookings/manage/{token}`, `/api/v1/bookings/manage/{token}/cancel`
- **User Roles Permitted:** Guest Customer
- **Core Module Dependencies:** Booking Engine, hash_manage_token Helper, MyBookings Component

##### 2. Feature Description
Provides guest customers with a secure, passwordless portal to inspect, track, and cancel their bookings using a high-entropy URL token verified via one-way SHA-256 hashing.

##### 3. Purpose and User Benefits
Gives guests full autonomy to manage their reservations without forcing them to register a password.

##### 4. User Interaction and Usage Instructions
1. Complete a booking as a guest.
2. Copy the management URL provided on the confirmation screen or open the link from your confirmation email (`/bookings/manage/:token`).
3. The management portal loads your reservation details, venue address, and payment status.
4. You can cancel your reservation directly from this screen.

##### 5. UI and Component Implementation
Rendered via `MyBookings.tsx` and `ReviewPay.tsx` utilizing `useBookingManage(token)` hook. Displays reservation timeline and cancellation button.

##### 6. Backend and Business Logic
`GET /api/v1/bookings/manage/{token}` hashes the incoming raw URL token with SHA-256 and queries `bookings` where `manage_token_hash = :hash`. Returns full `BookingDetail` if found.

##### 7. Data Model and Persistence
Matches `bookings.manage_token_hash` (VARCHAR(64) indexed).

##### 8. API and Integration Details
GET /api/v1/bookings/manage/{token}. POST /api/v1/bookings/manage/{token}/cancel.

##### 9. State and Lifecycle
Raw Token in URL -> Server Hashes with SHA-256 -> Match Found -> Booking Managed -> Cancelled if requested.

##### 10. Permissions and Security
Possession of raw token authorizes guest management for that specific booking record only.

##### 11. Edge Cases and Error Behavior
Tampered or invalid tokens return clean HTTP 404 Not Found without leaking existence of other bookings.

##### 12. Testing and Verification
Automated tests in `backend/tests/test_booking_api.py` and `backend/tests/test_concurrency.py`. Status: PASS.

##### 13. Maintenance and Extension
Main file: `backend/app/modules/booking/service.py` (`hash_manage_token`).

##### 14. Feature Summary
- **Summary:** Cryptographically secure guest booking access utilizing SHA-256 hashed management tokens.
- **Status:** Implemented and verified

---

#### [FEAT-022] Automated Hold Sweep Background Worker

##### 1. Feature Identity
- **Feature ID:** `FEAT-022`
- **Feature Name:** Automated Hold Sweep Background Worker
- **Category:** Reservation Engine, Availability & Checkout
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/api/v1/admin/bookings/sweep-expired-holds`, `Background Worker Loop`
- **User Roles Permitted:** Background Worker, Administrator
- **Core Module Dependencies:** Job Worker, PostgreSQL SKIP LOCKED, Booking Engine

##### 2. Feature Description
Background task worker continuously monitoring unconfirmed holds. Automatically reclaims inventory units whose 10-minute hold window has elapsed, returning them to available inventory.

##### 3. Purpose and User Benefits
Ensures abandoned checkouts do not permanently tie up venue slots, maximizing booking revenue for venue owners.

##### 4. User Interaction and Usage Instructions
1. Completely automated: runs continuously every 5 seconds in the background worker loop.
2. Administrators can also trigger an immediate manual sweep via the 'Sweep Expired Holds' button on the Admin Dashboard (`/admin`).

##### 5. UI and Component Implementation
Admin action button in `frontend/src/components/AdminLayout.tsx` (Overview tab) with toast feedback showing swept count.

##### 6. Backend and Business Logic
`sweep_expired_holds()` in `backend/app/modules/booking/service.py` and `worker.py`. Claims jobs via `SELECT ... FOR UPDATE SKIP LOCKED`. Finds slots where `status = 'held'` and `expires_at <= now()`. Updates slots to `available`, transitions bookings to `expired`, and commits.

##### 7. Data Model and Persistence
Updates `inventory_units` (`status='available'`, `held_at=NULL`, `expires_at=NULL`), updates `bookings.status='expired'`, inserts `booking_events` (`action='expired'`).

##### 8. API and Integration Details
POST /api/v1/admin/bookings/sweep-expired-holds. Requires admin role. Returns `{swept_count: int}`.

##### 9. State and Lifecycle
Held Slot Exceeds 10m -> Worker Detects Expiry -> Slot Reverted to Available -> Booking Marked Expired.

##### 10. Permissions and Security
Automated background process. Manual trigger restricted to `admin`.

##### 11. Edge Cases and Error Behavior
Concurrency safe: does not lock active checkouts or interfere with slots being paid concurrently.

##### 12. Testing and Verification
Automated tests in `backend/tests/test_hold_sweep.py` and `backend/tests/test_jobs.py`. Status: PASS.

##### 13. Maintenance and Extension
Main files: `backend/app/modules/jobs/worker.py`, `backend/app/modules/booking/service.py`.

##### 14. Feature Summary
- **Summary:** Reliable background inventory recovery worker sweeping expired holds and restoring slot availability.
- **Status:** Implemented and verified

---

### Category: Post-Booking, Cancellation & Customer Lifecycle

#### [FEAT-023] Customer Reservations Dashboard ('My Bookings')

##### 1. Feature Identity
- **Feature ID:** `FEAT-023`
- **Feature Name:** Customer Reservations Dashboard ('My Bookings')
- **Category:** Post-Booking, Cancellation & Customer Lifecycle
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/my-bookings`, `/api/v1/bookings`
- **User Roles Permitted:** Customer
- **Core Module Dependencies:** MyBookings Component, useMyBookings Hook, Booking Model

##### 2. Feature Description
Dedicated personal reservations hub where authenticated customers can inspect all upcoming, completed, and cancelled reservations, check payment verification statuses, and download receipts.

##### 3. Purpose and User Benefits
Consolidates all event schedules, payment receipts, and venue location details into a single, easily accessible interface.

##### 4. User Interaction and Usage Instructions
1. Log in to your customer account.
2. Click 'My Bookings' in the main navigation header.
3. Browse your reservations list, grouped by status (Upcoming, Completed, Cancelled).
4. Review slot dates, start times, venue address, and total amount paid.
5. Access quick actions: 'Cancel Booking', 'Book Again', or 'Need Help'.

##### 5. UI and Component Implementation
Implemented in `frontend/src/components/MyBookings.tsx`. Features tabbed status filtering, shimmer skeleton loaders, empty state prompts with 'Explore Venues' buttons, and cancellation dialogs.

##### 6. Backend and Business Logic
`GET /api/v1/bookings` in `backend/app/main.py`. Filters `bookings` where `customer_id == current_user.id`, preloads associated `inventory_units` and `venues`, and orders by creation date descending.

##### 7. Data Model and Persistence
Loads `bookings` joined with `inventory_units` and `venues`.

##### 8. API and Integration Details
GET /api/v1/bookings. Requires customer Bearer JWT. Response: `list[BookingDetail]`.

##### 9. State and Lifecycle
Customer Navigates to `/my-bookings` -> Server Queries Customer Bookings -> UI Renders Reservation Cards.

##### 10. Permissions and Security
Requires authenticated session. Customers can only retrieve records where `customer_id == current_user.id`.

##### 11. Edge Cases and Error Behavior
If customer has no bookings, displays an engaging empty state illustration with direct link to search.

##### 12. Testing and Verification
Automated tests in `frontend/src/components/MyBookings.test.tsx` (4 tests passing) and `backend/tests/test_booking_retrieval.py`.

##### 13. Maintenance and Extension
Main file: `frontend/src/components/MyBookings.tsx`.

##### 14. Feature Summary
- **Summary:** Customer self-service reservation center displaying real-time booking statuses and cancellation tools.
- **Status:** Implemented and verified

---

#### [FEAT-024] Automated Proximity-Based Cancellation & Refund Calculation

##### 1. Feature Identity
- **Feature ID:** `FEAT-024`
- **Feature Name:** Automated Proximity-Based Cancellation & Refund Calculation
- **Category:** Post-Booking, Cancellation & Customer Lifecycle
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/my-bookings (Cancel action)`, `/api/v1/bookings/{booking_id}/cancel`
- **User Roles Permitted:** Customer, Administrator
- **Core Module Dependencies:** Booking Engine, Refund Model, Ledger Service

##### 2. Feature Description
Automated cancellation engine calculating fair refund tiers based on the time remaining before event commencement (Full refund for 48h+, Partial 50% for 24-48h, No refund under 24h), immediately releasing slots and logging ledger entries.

##### 3. Purpose and User Benefits
Provides transparent, automated refund terms without requiring lengthy manual dispute reviews, while protecting venue owners against last-minute cancellations.

##### 4. User Interaction and Usage Instructions
1. On the 'My Bookings' page, click 'Cancel Booking' on an eligible reservation.
2. The system evaluates the start time and displays the calculated refund tier (e.g., '100% Full Refund: ₹8,000').
3. Confirm cancellation.
4. The reservation status immediately updates to 'Cancelled', the slot is restored to available, and a confirmation toast displays the refund amount.

##### 5. UI and Component Implementation
Handled in `frontend/src/components/MyBookings.tsx` using `useCancelBooking()` mutation. Shows confirmation modal with clear refund breakdown.

##### 6. Backend and Business Logic
`cancel_booking_as_customer()` in `backend/app/modules/booking/service.py`. Computes hours between current time (IST) and slot start time. Computes refund fraction (1.0, 0.5, 0.0). Atomically updates `bookings.status='cancelled'`, marks `inventory_units.status='available'`, inserts `Refund` row, and emits balanced `ledger_entries`.

##### 7. Data Model and Persistence
Updates `bookings` and `inventory_units`. Inserts into `refunds` (`id`, `booking_id`, `amount`, `refund_tier`, `status='completed'`). Inserts into `ledger_entries`.

##### 8. API and Integration Details
POST /api/v1/bookings/{id}/cancel. Body: `BookingCancelRequest`. Response: `BookingCancelResponse` (`refund_tier`, `refund_amount`, `message`).

##### 9. State and Lifecycle
Confirmed -> Cancel Requested -> Proximity Evaluated -> Cancelled + Slot Released + Refund Logged.

##### 10. Permissions and Security
Customers can cancel their own bookings. Admins can cancel any booking.

##### 11. Edge Cases and Error Behavior
Attempting to cancel an already completed or past booking raises an `HTTP 400 Bad Request`.

##### 12. Testing and Verification
Automated tests in `backend/tests/test_booking_cancellation.py` (10 tests passing) and `backend/tests/test_refund_tiers.py`.

##### 13. Maintenance and Extension
Main files: `backend/app/modules/booking/service.py`, `backend/app/modules/ledger/service.py`.

##### 14. Feature Summary
- **Summary:** Fair, automated cancellation system applying time-based refund tiers and immediate slot release.
- **Status:** Implemented and verified

---

#### [FEAT-025] Formal Booking Action Requests (Cancellation & Reschedule)

##### 1. Feature Identity
- **Feature ID:** `FEAT-025`
- **Feature Name:** Formal Booking Action Requests (Cancellation & Reschedule)
- **Category:** Post-Booking, Cancellation & Customer Lifecycle
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/api/v1/bookings/{id}/cancellation-requests`, `/api/v1/bookings/{id}/reschedule-requests`, `/admin (Booking Actions)`
- **User Roles Permitted:** Customer, Owner, Administrator
- **Core Module Dependencies:** BookingActionRequest Model, BookingEvent Model, Admin Dashboard

##### 2. Feature Description
Formal administrative workflow for handling special cancellation or date rescheduling requests that require manual operator review and discretionary approval.

##### 3. Purpose and User Benefits
Allows customers and venue owners to request schedule changes or emergency cancellations with human oversight.

##### 4. User Interaction and Usage Instructions
1. User submits a formal cancellation or reschedule request specifying the justification.
2. Request appears in the Admin Dashboard under 'Booking Actions'.
3. Administrator inspects the justification, slot availability, and financial impact.
4. Admin approves or rejects the action with explanatory notes.

##### 5. UI and Component Implementation
Admin management interface in `frontend/src/components/AdminLayout.tsx` with action approval buttons and status filters.

##### 6. Backend and Business Logic
Managed by `booking_action_requests` table and endpoints in `backend/app/main.py`. Approving an action triggers atomic status transitions, adjusts slot units, and logs `BookingEvent`.

##### 7. Data Model and Persistence
Table: `booking_action_requests`: `id` (UUID PK), `booking_id` (UUID FK), `requested_by` (UUID FK), `action_type` ('cancel' or 'reschedule'), `reason`, `status` ('pending', 'approved', 'rejected'), `admin_notes`.

##### 8. API and Integration Details
POST /api/v1/bookings/{id}/cancellation-requests. POST /api/v1/admin/booking-actions/{action_id}/process.

##### 9. State and Lifecycle
User Submits Request -> Request Recorded as Pending -> Admin Evaluates -> Approved (Executed) OR Rejected.

##### 10. Permissions and Security
Customers/Owners submit for their own bookings. Admins process decisions.

##### 11. Edge Cases and Error Behavior
If a requested reschedule slot has already been taken by someone else, admin processing alerts the operator.

##### 12. Testing and Verification
Automated tests in `backend/tests/test_booking_actions.py` and `backend/tests/test_admin_oversight.py`. Status: PASS.

##### 13. Maintenance and Extension
Main file: `backend/app/modules/booking/service.py`.

##### 14. Feature Summary
- **Summary:** Discretionary change management workflow allowing supervised booking rescheduling and emergency cancellations.
- **Status:** Implemented and verified

---

#### [FEAT-026] Booking Dispute & Issue Flagging

##### 1. Feature Identity
- **Feature ID:** `FEAT-026`
- **Feature Name:** Booking Dispute & Issue Flagging
- **Category:** Post-Booking, Cancellation & Customer Lifecycle
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/api/v1/bookings/{booking_id}/flag`
- **User Roles Permitted:** Customer, Owner, Administrator
- **Core Module Dependencies:** Booking Model, BookingEvent Model, Notification Service

##### 2. Feature Description
Allows customers or venue owners to flag a reservation for formal dispute due to facility mismatch, double-booking, or conduct issues, freezing payout escrow until resolved.

##### 3. Purpose and User Benefits
Protects customers against fraudulent listings and protects owners against property damage or unauthorized usage.

##### 4. User Interaction and Usage Instructions
1. Open the booking details card on 'My Bookings' or Owner Dashboard.
2. Click 'Flag / Dispute Booking'.
3. Enter the dispute reason and evidence.
4. Booking status updates to 'disputed'. Escrow payout is suspended while administrators investigate.

##### 5. UI and Component Implementation
Modal trigger on `MyBookings.tsx` and `OwnerLayout.tsx` with structured reason input.

##### 6. Backend and Business Logic
`flag_booking()` in `backend/app/modules/booking/service.py`. Transitions status to `disputed`, creates `BookingEvent`, notifies administrators via in-app alerts, and halts automated payout batching.

##### 7. Data Model and Persistence
Updates `bookings.status='disputed'`. Inserts `booking_events` with `action='flagged'`.

##### 8. API and Integration Details
POST /api/v1/bookings/{id}/flag. Body: `BookingFlagRequest` (`reason`). Requires authenticated user.

##### 9. State and Lifecycle
Confirmed -> Flagged -> Disputed (Escrow Locked) -> Admin Investigation -> Resolved / Refunded.

##### 10. Permissions and Security
Participant (customer or owner of that booking) or administrator.

##### 11. Edge Cases and Error Behavior
Completed bookings can still be flagged within 48 hours following the event.

##### 12. Testing and Verification
Automated tests in `backend/tests/test_domain.py` and `backend/tests/test_booking_events.py`.

##### 13. Maintenance and Extension
Main file: `backend/app/modules/booking/service.py`.

##### 14. Feature Summary
- **Summary:** Dispute management mechanism safeguarding platform integrity and locking escrow funds during conflict resolution.
- **Status:** Implemented and verified

---

#### [FEAT-027] Rebooking Quick-Action Pipeline ('Book Again')

##### 1. Feature Identity
- **Feature ID:** `FEAT-027`
- **Feature Name:** Rebooking Quick-Action Pipeline ('Book Again')
- **Category:** Post-Booking, Cancellation & Customer Lifecycle
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/my-bookings`, `/venues/:id`
- **User Roles Permitted:** Customer
- **Core Module Dependencies:** MyBookings Component, React Router, App Component

##### 2. Feature Description
Streamlined repeat booking trigger allowing satisfied customers to quickly rebook previously reserved grounds with pre-populated preferences.

##### 3. Purpose and User Benefits
Saves regular sports teams and event hosts significant time by enabling recurring slot reservations without repeating catalog searches.

##### 4. User Interaction and Usage Instructions
1. In 'My Bookings', find a past completed reservation.
2. Click the 'Book Again' button.
3. The application instantly navigates to that venue's detail page with the date selector open.
4. Choose your next date and confirm.

##### 5. UI and Component Implementation
Action button on `MyBookings.tsx` invoking `onBookAgain(venueId)` callback which routes to `/venues/:slug`.

##### 6. Backend and Business Logic
Reuses standard venue discovery and slot availability endpoints.

##### 7. Data Model and Persistence
Resolves `bookings.venue_id` to `venues.slug`.

##### 8. API and Integration Details
Client-side routing transition to `/venues/{slug}`.

##### 9. State and Lifecycle
Past Booking Identified -> Click 'Book Again' -> Venue Loaded -> New Slot Reserved.

##### 10. Permissions and Security
Customer acting on their own past bookings.

##### 11. Edge Cases and Error Behavior
If the venue has since been archived or suspended, customer is notified with a polite status toast.

##### 12. Testing and Verification
Tested in `frontend/src/components/MyBookings.test.tsx` (4 tests passing).

##### 13. Maintenance and Extension
Main file: `frontend/src/components/MyBookings.tsx`.

##### 14. Feature Summary
- **Summary:** One-click repeat booking shortcut for regular customers and sports teams.
- **Status:** Implemented and verified

---

### Category: Reviews, Ratings & Reputation Management

#### [FEAT-028] Verified Customer Review Submission

##### 1. Feature Identity
- **Feature ID:** `FEAT-028`
- **Feature Name:** Verified Customer Review Submission
- **Category:** Reviews, Ratings & Reputation Management
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/venues/:id (Reviews section)`, `/api/v1/venues/{venue_id}/reviews`
- **User Roles Permitted:** Customer
- **Core Module Dependencies:** Review Model, DetailView Component, Catalog Service

##### 2. Feature Description
Enables customers who completed a booking at a venue to submit a star rating (1 to 5 stars) and qualitative written feedback.

##### 3. Purpose and User Benefits
Helps future customers assess real property conditions, while providing venue owners with constructive feedback to improve services.

##### 4. User Interaction and Usage Instructions
1. Visit the venue detail page after your event has concluded.
2. Scroll down to the 'Customer Reviews' section.
3. Click on the 5-star rating selector to choose your rating (1-5 stars).
4. Write your review text in the comment box.
5. Click 'Submit Review'. The review posts instantly and updates the venue's aggregate rating.

##### 5. UI and Component Implementation
Implemented in `frontend/src/components/DetailView.tsx`. Features interactive star hover states (`StarRatingInput`), validation errors for empty reviews, and instant optimistic addition.

##### 6. Backend and Business Logic
`POST /api/v1/venues/{venue_id}/reviews` in `backend/app/main.py`. Validates rating between 1 and 5. Inserts into `reviews` table. Recalculates `venues.avg_rating` as the mathematical mean of all approved reviews.

##### 7. Data Model and Persistence
Table: `reviews`: `id` (UUID PK), `venue_id` (UUID FK), `user_id` (UUID FK), `booking_id` (UUID FK nullable), `rating` (INTEGER), `comment` (TEXT), `created_at`.

##### 8. API and Integration Details
POST /api/v1/venues/{id}/reviews. Body: `ReviewCreateRequest` (`rating`, `comment`). Response: `ReviewResponse` (HTTP 201).

##### 9. State and Lifecycle
Customer Submits Rating -> Review Persisted -> Venue Average Rating Recalculated -> Rendered in Public Feed.

##### 10. Permissions and Security
Requires authenticated user session.

##### 11. Edge Cases and Error Behavior
Ratings outside 1-5 integer boundaries are rejected with HTTP 422 Unprocessable Entity.

##### 12. Testing and Verification
Automated tests in `backend/tests/test_reviews.py` (9 tests passing).

##### 13. Maintenance and Extension
Main files: `backend/app/modules/catalog/service.py`, `frontend/src/components/DetailView.tsx`.

##### 14. Feature Summary
- **Summary:** Authentic customer feedback submission updating venue reputation and aggregate star ratings.
- **Status:** Implemented and verified

---

#### [FEAT-029] Public Venue Reviews Aggregate & Rating Breakdown Display

##### 1. Feature Identity
- **Feature ID:** `FEAT-029`
- **Feature Name:** Public Venue Reviews Aggregate & Rating Breakdown Display
- **Category:** Reviews, Ratings & Reputation Management
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/venues/:id`, `/api/v1/venues/{venue_id}/reviews`
- **User Roles Permitted:** Public Visitor, Customer
- **Core Module Dependencies:** DetailView Component, useVenueReviews Hook, Review Model

##### 2. Feature Description
Displays the overall average star rating, total review count, and a chronological feed of customer feedback comments on the venue detail view.

##### 3. Purpose and User Benefits
Builds trust and transparency by allowing prospective customers to read authentic community testimonials.

##### 4. User Interaction and Usage Instructions
1. Open any venue detail view.
2. Notice the average star rating badge beside the venue title (e.g., '★ 4.75 (39 reviews)').
3. Scroll to the bottom of the page to browse individual customer comments, author names, and review dates.

##### 5. UI and Component Implementation
Rendered in `frontend/src/components/DetailView.tsx` using `useVenueReviews(venueId)` query. Displays review cards with user initials, star icons, and timestamps.

##### 6. Backend and Business Logic
`GET /api/v1/venues/{venue_id}/reviews` returns approved reviews joined with author names from `users` table.

##### 7. Data Model and Persistence
Queries `reviews` joined with `users` (`full_name`).

##### 8. API and Integration Details
GET /api/v1/venues/{id}/reviews. Response: `list[ReviewResponse]`.

##### 9. State and Lifecycle
Venue Loaded -> Reviews Fetched -> Aggregate and Feedback Rendered.

##### 10. Permissions and Security
Public read.

##### 11. Edge Cases and Error Behavior
If a venue has zero reviews, displays 'New Venue — Be the first to leave a review!' notice.

##### 12. Testing and Verification
Verified in `backend/tests/test_reviews.py` and `frontend/src/components/DetailView.test.tsx`.

##### 13. Maintenance and Extension
Main files: `frontend/src/components/DetailView.tsx`, `backend/app/main.py`.

##### 14. Feature Summary
- **Summary:** Public social proof display presenting verified customer ratings and feedback testimonials.
- **Status:** Implemented and verified

---

#### [FEAT-030] Administrative Review Moderation & Deletion

##### 1. Feature Identity
- **Feature ID:** `FEAT-030`
- **Feature Name:** Administrative Review Moderation & Deletion
- **Category:** Reviews, Ratings & Reputation Management
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/admin (Reviews tab)`, `/api/v1/admin/reviews`, `/api/v1/admin/reviews/{review_id}`
- **User Roles Permitted:** Administrator
- **Core Module Dependencies:** AdminLayout Component, Review Model, AuditLog Model

##### 2. Feature Description
Provides administrators with a moderation queue to monitor all platform reviews and delete abusive, defamatory, or spam content while automatically recalculating the venue's average rating.

##### 3. Purpose and User Benefits
Maintains community standards and protects venue owners against abusive or malicious smear reviews.

##### 4. User Interaction and Usage Instructions
1. Open Admin Dashboard (`/admin`) and navigate to the 'Reviews' tab.
2. Inspect the global reviews table, showing venue name, reviewer, star rating, and text comment.
3. If a review violates policies, click 'Delete Review'.
4. Confirm deletion. The review is removed, the venue's average rating is recalculated, and an audit entry is recorded.

##### 5. UI and Component Implementation
Implemented in `frontend/src/components/AdminLayout.tsx` (Reviews tab) with confirmation modals and deletion toast alerts.

##### 6. Backend and Business Logic
`DELETE /api/v1/admin/reviews/{review_id}` in `backend/app/main.py`. Deletes row from `reviews`, recalculates `venues.avg_rating`, logs action in `audit_logs`, and returns HTTP 204.

##### 7. Data Model and Persistence
Deletes from `reviews` table; updates `venues.avg_rating`; inserts into `audit_logs`.

##### 8. API and Integration Details
GET /api/v1/admin/reviews (paginated). DELETE /api/v1/admin/reviews/{id}. Requires admin role.

##### 9. State and Lifecycle
Review Reported/Inspected -> Admin Deletes -> Row Removed -> Venue Avg Rating Updated -> Audit Logged.

##### 10. Permissions and Security
Strictly restricted to `admin` role.

##### 11. Edge Cases and Error Behavior
Deleting the last remaining review on a venue cleanly resets `avg_rating` to 0.00.

##### 12. Testing and Verification
Automated tests in `backend/tests/test_reviews.py` (review moderation test suite). Status: PASS.

##### 13. Maintenance and Extension
Main file: `backend/app/main.py`.

##### 14. Feature Summary
- **Summary:** Administrative moderation interface ensuring platform review authenticity and policy compliance.
- **Status:** Implemented and verified

---

### Category: Customer Support & Help Center

#### [FEAT-031] Contextual Support Ticket Creation

##### 1. Feature Identity
- **Feature ID:** `FEAT-031`
- **Feature Name:** Contextual Support Ticket Creation
- **Category:** Customer Support & Help Center
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/support`, `/api/v1/support/tickets`
- **User Roles Permitted:** Customer, Owner
- **Core Module Dependencies:** SupportTicket Model, SupportTickets Component, Support Service

##### 2. Feature Description
Allows customers and venue owners to submit structured support tickets pre-linked to specific bookings or venues, ensuring support staff receive immediate context.

##### 3. Purpose and User Benefits
Eliminates back-and-forth by automatically attaching reservation codes, venue names, and account IDs to support inquiries.

##### 4. User Interaction and Usage Instructions
1. Click 'Help & Support' in the header or click 'Need Help with this Booking' on any reservation card.
2. If opened from a booking, the booking code is pre-attached to the ticket context.
3. Select inquiry category: 'Booking Issue', 'Payment & Refund', 'Facility Quality', or 'General'.
4. Enter a subject and describe the issue in detail.
5. Click 'Submit Ticket'. A confirmation toast appears, and the ticket enters the support queue.

##### 5. UI and Component Implementation
Implemented in `frontend/src/components/SupportTickets.tsx`. Handles pre-filled `supportContext`, category dropdowns, form validation, and active ticket lists.

##### 6. Backend and Business Logic
`POST /api/v1/support/tickets` in `backend/app/modules/support/service.py`. Validates category and subject. Creates `SupportTicket` row with status `open`. Inserts an initial `ticket_events` entry. Notifies administrators via in-app alert.

##### 7. Data Model and Persistence
Table: `support_tickets`: `id` (UUID PK), `user_id` (UUID FK), `booking_id` (UUID FK nullable), `venue_id` (UUID FK nullable), `subject`, `description`, `category`, `priority`, `status='open'`, `created_at`.

##### 8. API and Integration Details
POST /api/v1/support/tickets. Body: `TicketCreateRequest` (`subject`, `description`, `category`, `booking_id`, `venue_id`). Response: `TicketResponse` (HTTP 201).

##### 9. State and Lifecycle
User Submits -> Ticket Created ('open') -> Admin Notified -> Displayed in User Ticket History.

##### 10. Permissions and Security
Requires authenticated user. Customers can only link bookings they own.

##### 11. Edge Cases and Error Behavior
Submitting empty descriptions triggers inline validation error.

##### 12. Testing and Verification
Automated tests in `backend/tests/test_support_tickets.py` (27 tests passing).

##### 13. Maintenance and Extension
Main files: `backend/app/modules/support/service.py`, `frontend/src/components/SupportTickets.tsx`.

##### 14. Feature Summary
- **Summary:** Context-aware support ticketing system attaching reservation metadata to user inquiries.
- **Status:** Implemented and verified

---

#### [FEAT-032] Two-Way Threaded Support Ticket History

##### 1. Feature Identity
- **Feature ID:** `FEAT-032`
- **Feature Name:** Two-Way Threaded Support Ticket History
- **Category:** Customer Support & Help Center
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/support`, `/api/v1/support/tickets/{ticket_id}`, `/api/v1/support/tickets/{ticket_id}/comments`
- **User Roles Permitted:** Customer, Owner, Administrator
- **Core Module Dependencies:** TicketEvent Model, SupportTickets Component, Support Service

##### 2. Feature Description
Two-way conversational messaging thread on active support tickets, providing real-time reply exchanges, status history tracking, and internal administrative notes.

##### 3. Purpose and User Benefits
Keeps all communication regarding an issue in a single chronological thread, eliminating lost emails.

##### 4. User Interaction and Usage Instructions
1. Open `/support` and select an active ticket from your tickets list.
2. Read the conversation thread and replies from the support team.
3. Type your response in the reply box and click 'Send Reply'.
4. The message appears instantly in the conversation history.

##### 5. UI and Component Implementation
Rendered in `frontend/src/components/SupportTickets.tsx`. Features speech-bubble conversation styling, author badges (Customer vs Support Staff), and timestamp indicators.

##### 6. Backend and Business Logic
`POST /api/v1/support/tickets/{ticket_id}/comments` in `backend/app/modules/support/service.py`. Inserts row into `ticket_events`. If customer replies, updates ticket status from `waiting_customer` to `in_review`. Hides `is_internal=True` comments from customers.

##### 7. Data Model and Persistence
Table: `ticket_events`: `id` (UUID PK), `ticket_id` (UUID FK), `actor_id` (UUID FK), `event_type` ('comment' or 'status_change'), `message` (TEXT), `is_internal` (BOOLEAN), `created_at`.

##### 8. API and Integration Details
GET /api/v1/support/tickets/{id}. POST /api/v1/support/tickets/{id}/comments (`message`, `is_internal`).

##### 9. State and Lifecycle
Comment Posted -> `ticket_events` Row Created -> Status Synchronized -> Counterparty Notified.

##### 10. Permissions and Security
Customers/Owners see their tickets; internal comments strictly filtered out.

##### 11. Edge Cases and Error Behavior
Attempting to post comments on a closed ticket returns an explanatory error directing the user to open a new ticket.

##### 12. Testing and Verification
Automated tests in `backend/tests/test_support_tickets.py`. Status: PASS.

##### 13. Maintenance and Extension
Main file: `backend/app/modules/support/service.py`.

##### 14. Feature Summary
- **Summary:** Threaded conversation system tracking customer and staff replies with privacy-safe internal notes.
- **Status:** Implemented and verified

---

#### [FEAT-033] Administrative Support Ticket Queue & SLA Management

##### 1. Feature Identity
- **Feature ID:** `FEAT-033`
- **Feature Name:** Administrative Support Ticket Queue & SLA Management
- **Category:** Customer Support & Help Center
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/admin (Support tab)`, `/api/v1/admin/support/tickets`, `/api/v1/admin/support/tickets/{id}`
- **User Roles Permitted:** Administrator
- **Core Module Dependencies:** AdminLayout Component, Support Service, AuditLog Model

##### 2. Feature Description
Centralized customer support queue allowing operators to filter tickets by status, category, and priority, reassign staff, add confidential internal notes, and transition ticket lifecycle states.

##### 3. Purpose and User Benefits
Equips support operations to prioritize urgent issues (e.g., immediate access problems) and maintain high service quality.

##### 4. User Interaction and Usage Instructions
1. Open Admin Dashboard (`/admin`) and navigate to the 'Support' tab.
2. Filter tickets by status ('Open', 'In Review', 'Waiting Customer', 'Resolved') or priority ('Urgent', 'High', 'Normal').
3. Click any ticket to open the full conversation drawer.
4. Post public replies to the customer or check 'Internal Note' to record staff-only notes.
5. Change ticket status to 'Resolved' or 'Closed' when finished.

##### 5. UI and Component Implementation
Implemented in `frontend/src/components/AdminLayout.tsx` (Support tab). Features master-detail layout, priority pill badges, internal note checkboxes, and status action buttons.

##### 6. Backend and Business Logic
`GET /api/v1/admin/support/tickets` and `PATCH /api/v1/admin/support/tickets/{id}`. Enforces valid state machine transitions defined in `ALLOWED_TICKET_TRANSITIONS`. Emits audit log entries on priority or status changes.

##### 7. Data Model and Persistence
Updates `support_tickets.status`, `priority`, `assigned_to`. Appends `ticket_events`.

##### 8. API and Integration Details
PATCH /api/v1/admin/support/tickets/{id}. Body: `TicketUpdateRequest` (`status`, `priority`, `assigned_to`). Requires admin role.

##### 9. State and Lifecycle
Open -> In Review -> Waiting Customer -> Resolved -> Closed.

##### 10. Permissions and Security
Restricted exclusively to `admin` role.

##### 11. Edge Cases and Error Behavior
Invalid state machine jumps (e.g., jumping from `resolved` back to `open`) raise HTTP 409 Conflict.

##### 12. Testing and Verification
Automated tests in `backend/tests/test_support_tickets.py` (27 tests passing).

##### 13. Maintenance and Extension
Main files: `backend/app/modules/support/service.py`, `frontend/src/components/AdminLayout.tsx`.

##### 14. Feature Summary
- **Summary:** Comprehensive administrative support ticketing console with SLA prioritization and private staff notes.
- **Status:** Implemented and verified

---

#### [FEAT-034] Self-Service Help Center Knowledge Base

##### 1. Feature Identity
- **Feature ID:** `FEAT-034`
- **Feature Name:** Self-Service Help Center Knowledge Base
- **Category:** Customer Support & Help Center
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/help`, `/api/v1/help/categories`, `/api/v1/help/articles`, `/api/v1/help/articles/{slug}`
- **User Roles Permitted:** Public Visitor, Customer, Owner
- **Core Module Dependencies:** HelpCategory Model, HelpArticle Model, Help Service

##### 2. Feature Description
Structured self-service knowledge base featuring categorized articles, guides, and searchable FAQs on booking policies, cancellations, payment verification, and venue listing guidelines.

##### 3. Purpose and User Benefits
Allows users to get instant answers to common questions 24/7 without waiting for a support agent.

##### 4. User Interaction and Usage Instructions
1. Navigate to the Help Center from the header or footer.
2. Browse topics: 'Booking & Cancellations', 'Payment Questions', 'Owner Listing Guide'.
3. Click an article title to read the detailed guide.
4. Use the search bar to locate specific policies (e.g., 'refund tiers').

##### 5. UI and Component Implementation
Clean article viewer layout with breadcrumb navigation, category tiles, and full-text search bar.

##### 6. Backend and Business Logic
`GET /api/v1/help/articles` in `backend/app/modules/help/service.py`. Supports ILIKE search against article titles and content. Tracks view count statistics.

##### 7. Data Model and Persistence
Tables: `help_categories` (`id`, `name`, `slug`, `icon`, `sort_order`), `help_articles` (`id`, `category_id` FK, `title`, `slug`, `content_markdown`, `view_count`, `is_published`).

##### 8. API and Integration Details
GET /api/v1/help/categories. GET /api/v1/help/articles?q=... GET /api/v1/help/articles/{slug}.

##### 9. State and Lifecycle
Article Drafted -> Published -> Indexed -> Searched/Viewed by Customers.

##### 10. Permissions and Security
Public read access for published articles.

##### 11. Edge Cases and Error Behavior
Unpublished articles are excluded from public search and category lists.

##### 12. Testing and Verification
Automated tests in `backend/tests/test_help_center.py` (13 tests passing).

##### 13. Maintenance and Extension
Main files: `backend/app/modules/help/service.py`, `backend/alembic/versions/f1_help_center.py`.

##### 14. Feature Summary
- **Summary:** Full-text searchable knowledge base providing self-service guides and policy documentation.
- **Status:** Implemented and verified

---

#### [FEAT-035] Help Article Feedback & Search Analytics Tracking

##### 1. Feature Identity
- **Feature ID:** `FEAT-035`
- **Feature Name:** Help Article Feedback & Search Analytics Tracking
- **Category:** Customer Support & Help Center
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/api/v1/help/articles/{id}/feedback`
- **User Roles Permitted:** Public Visitor, Customer, Administrator
- **Core Module Dependencies:** HelpFeedback Model, HelpSearchLog Model, Help Service

##### 2. Feature Description
Captures user feedback ('Was this article helpful? Yes / No') and logs search queries to identify missing documentation topics and improve content clarity.

##### 3. Purpose and User Benefits
Continuously improves help center documentation based on real customer feedback.

##### 4. User Interaction and Usage Instructions
1. At the bottom of any help article, locate the feedback widget: 'Was this article helpful?'.
2. Click 'Yes' or 'No'.
3. Optionally enter suggestions on how to improve the article.
4. Your feedback is recorded anonymously or linked to your account.

##### 5. UI and Component Implementation
Inline thumbs-up / thumbs-down buttons with optional comment field.

##### 6. Backend and Business Logic
`POST /api/v1/help/articles/{article_id}/feedback` in `backend/app/modules/help/service.py`. Inserts into `help_feedback`. Search queries log to `help_search_logs`.

##### 7. Data Model and Persistence
Tables: `help_feedback` (`id`, `article_id` FK, `user_id` FK nullable, `is_helpful` BOOLEAN, `comment`), `help_search_logs` (`id`, `query`, `result_count`, `user_id`, `created_at`).

##### 8. API and Integration Details
POST /api/v1/help/articles/{id}/feedback. Body: `HelpFeedbackRequest` (`is_helpful`, `comment`).

##### 9. State and Lifecycle
User Reads -> Clicks Helpful/Not Helpful -> Feedback Stored -> Analyzed by Admin.

##### 10. Permissions and Security
Public write (rate-limited). Admin read for analytics.

##### 11. Edge Cases and Error Behavior
Repeated submissions from the same IP are deduplicated to prevent feedback skew.

##### 12. Testing and Verification
Automated tests in `backend/tests/test_help_center.py`. Status: PASS.

##### 13. Maintenance and Extension
Main file: `backend/app/modules/help/service.py`.

##### 14. Feature Summary
- **Summary:** Content quality tracking system logging user helpfulness ratings and search query volume.
- **Status:** Implemented and verified

---

#### [FEAT-036] Public Contact & Business Inquiry Submission

##### 1. Feature Identity
- **Feature ID:** `FEAT-036`
- **Feature Name:** Public Contact & Business Inquiry Submission
- **Category:** Customer Support & Help Center
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/contact`, `/api/v1/contact`
- **User Roles Permitted:** Public Visitor
- **Core Module Dependencies:** Contact Component, GuestEnquiry Model, FastAPI Mailer/Outbox

##### 2. Feature Description
Public contact form enabling prospective venue partners, corporate clients, and general visitors to submit inquiries directly to the platform sales and support teams.

##### 3. Purpose and User Benefits
Provides an immediate channel for enterprise venue inquiries, partnerships, and press questions.

##### 4. User Interaction and Usage Instructions
1. Navigate to `/contact` from the footer.
2. Enter your Full Name, Email Address, Phone Number, Subject, and Message.
3. Click 'Send Message'.
4. A green confirmation banner confirms that your inquiry was received.

##### 5. UI and Component Implementation
Implemented in `frontend/src/components/Contact.tsx`. Features form validation, loading spinner during network request, and success confirmation banner.

##### 6. Backend and Business Logic
`POST /api/v1/contact` in `backend/app/main.py`. Inserts inquiry into `guest_enquiries` table, emits an outbox event, and returns HTTP 200.

##### 7. Data Model and Persistence
Table: `guest_enquiries`: `id` (UUID PK), `name`, `email`, `phone`, `subject`, `message`, `status='pending'`, `created_at`.

##### 8. API and Integration Details
POST /api/v1/contact. Body: `ContactSubmitRequest`. Response: `ContactSubmitResponse` (`success: true`, `message`).

##### 9. State and Lifecycle
Visitor Submits -> Ingested into Database -> Emits Notification Outbox Event -> Admin Review.

##### 10. Permissions and Security
Publicly accessible with rate limiting.

##### 11. Edge Cases and Error Behavior
Invalid email formats or empty messages return clear validation messages.

##### 12. Testing and Verification
Verified via `backend/tests/test_catalog.py` contact route test case. Status: PASS.

##### 13. Maintenance and Extension
Main files: `frontend/src/components/Contact.tsx`, `backend/app/main.py`.

##### 14. Feature Summary
- **Summary:** Public contact and commercial inquiry ingestion pipeline with automated outbox dispatch.
- **Status:** Implemented and verified

---

### Category: Venue Owner Onboarding & Workspace

#### [FEAT-037] Owner KYC Onboarding Gate & Identity Verification

##### 1. Feature Identity
- **Feature ID:** `FEAT-037`
- **Feature Name:** Owner KYC Onboarding Gate & Identity Verification
- **Category:** Venue Owner Onboarding & Workspace
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/owner`, `/api/v1/owner/verification`, `/api/v1/admin/owner-verifications`
- **User Roles Permitted:** Customer, Owner, Administrator
- **Core Module Dependencies:** OwnerVerification Model, OwnerLayout Component, Storage Service

##### 2. Feature Description
Compliance onboarding gate requiring prospective venue owners to submit legal business or identity documents (National ID, Aadhaar, PAN, Passport, or Business Registration) before listing venues.

##### 3. Purpose and User Benefits
Protects customers by ensuring all venue listings belong to physically verified property owners with verified legal documentation.

##### 4. User Interaction and Usage Instructions
1. Register or log in and navigate to `/owner`.
2. If unverified, the 'Owner Onboarding Gate' renders automatically.
3. Enter legal Business Name, select ID Type, enter ID Number, and attach a clear document scan (PDF, PNG, JPG).
4. Click 'Submit for Verification'. Status updates to 'Pending Admin Review'.
5. Once approved by an admin, the full Owner Dashboard unlocks immediately.

##### 5. UI and Component Implementation
Implemented in `frontend/src/components/OwnerLayout.tsx` (`OwnerOnboardingGate`). Features file picker, status badge tracking ('Pending', 'Verified', 'Rejected'), and status refresh button.

##### 6. Backend and Business Logic
`POST /api/v1/owner/verification` in `backend/app/modules/owner_onboarding/service.py`. Saves document securely to private storage. Inserts into `owner_verifications` with status `pending`. Admin approval updates `users.role='owner'`.

##### 7. Data Model and Persistence
Table: `owner_verifications`: `id` (UUID PK), `user_id` (UUID FK), `business_name`, `identification_type`, `identification_number`, `document_url`, `storage_key`, `status` ('pending', 'approved', 'rejected'), `rejection_reason`.

##### 8. API and Integration Details
POST /api/v1/owner/verification (multipart form-data). GET /api/v1/owner/verification. POST /api/v1/admin/owner-verifications/{id}/approve.

##### 9. State and Lifecycle
Unverified User -> Submits KYC -> Pending Review -> Admin Approves -> User Granted 'owner' Role.

##### 10. Permissions and Security
Authenticated user submits. Documents stored in private bucket accessible only to administrators.

##### 11. Edge Cases and Error Behavior
If rejected, displays rejection reason banner and allows the owner to upload a corrected document.

##### 12. Testing and Verification
Automated tests in `backend/tests/test_owner_onboarding.py` (10 tests passing).

##### 13. Maintenance and Extension
Main files: `backend/app/modules/owner_onboarding/service.py`, `frontend/src/components/OwnerLayout.tsx`.

##### 14. Feature Summary
- **Summary:** Mandatory owner identity verification workflow preventing fraudulent listings and ensuring platform trust.
- **Status:** Implemented and verified

---

#### [FEAT-038] 12-Step Wizard Venue Listing Builder

##### 1. Feature Identity
- **Feature ID:** `FEAT-038`
- **Feature Name:** 12-Step Wizard Venue Listing Builder
- **Category:** Venue Owner Onboarding & Workspace
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/owner (Listing Builder)`, `/api/v1/venues`, `/api/v1/venues/{id}`
- **User Roles Permitted:** Owner, Administrator
- **Core Module Dependencies:** ListingBuilder Component, Venue Model, Catalog Service

##### 2. Feature Description
Comprehensive 12-step guided listing wizard enabling property owners to configure identity, location, categories, event purposes, rental options, pricing rules, availability schedules, amenities, house policies, media uploads, and presentation blocks.

##### 3. Purpose and User Benefits
Guides owners step-by-step through creating a complete, high-converting venue profile meeting all platform listing quality standards.

##### 4. User Interaction and Usage Instructions
1. On the Owner Dashboard ('Listings' tab), click '+ Add New Venue'.
2. Complete Step 1 (Identity: name, tagline, description, capacity) through Step 11 (Presentation: FAQs, Highlights).
3. The builder automatically autosaves your progress in real-time.
4. On Step 12 (Review & Submit), review the validation checklist.
5. Click 'Submit for Review'. The venue transitions to `pending_review` for administrative inspection.

##### 5. UI and Component Implementation
Implemented in `frontend/src/components/owner/listing-builder/ListingBuilder.tsx` and 12 modular step components. Features step progression bar, debounced autosave, inline validation, and submission blocker.

##### 6. Backend and Business Logic
`POST /api/v1/venues` creates draft. Subsequent steps issue `PATCH /api/v1/venues/{id}` with partial updates. Submission validates minimum completeness requirements (3+ photos, capacity, address, description >= 80 words) before allowing `pending_review` status.

##### 7. Data Model and Persistence
Manages `venues` and associated relational rows: `venue_media`, `venue_content_blocks`, `venue_rental_options`, `venue_purposes`, `inventory_units`.

##### 8. API and Integration Details
POST /api/v1/venues (draft creation). PATCH /api/v1/venues/{id} (step updates). PATCH /api/v1/venues/{id} with `status='pending_review'`.

##### 9. State and Lifecycle
Draft (Steps 1-11) -> Validation Check (Step 12) -> Pending Review -> Admin Approval -> Active.

##### 10. Permissions and Security
Restricted to verified `owner` role. Owners can only edit their own venues.

##### 11. Edge Cases and Error Behavior
Attempting to submit with missing photos or slots returns an HTTP 422 with an explicit checklist of missing fields.

##### 12. Testing and Verification
Automated tests in `frontend/src/components/owner/listing-builder/ListingBuilderOnboarding.test.tsx` and `backend/tests/test_venue_onboarding.py`.

##### 13. Maintenance and Extension
Main files: `frontend/src/components/owner/listing-builder/ListingBuilder.tsx`, `backend/app/modules/catalog/service.py`.

##### 14. Feature Summary
- **Summary:** Full-featured 12-step guided listing builder with autosave and automated completeness validation.
- **Status:** Implemented and verified

---

#### [FEAT-039] Venue Workspace Management Hub

##### 1. Feature Identity
- **Feature ID:** `FEAT-039`
- **Feature Name:** Venue Workspace Management Hub
- **Category:** Venue Owner Onboarding & Workspace
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/owner (Venue Workspace)`, `/api/v1/venues/{venue_id}`
- **User Roles Permitted:** Owner, Administrator
- **Core Module Dependencies:** VenueWorkspace Component, OwnerLayout Component, Venue Model

##### 2. Feature Description
Dedicated property management cockpit where venue owners can adjust live rates, pause listings, schedule maintenance blocks, inspect booking history, and review customer feedback without re-entering the wizard.

##### 3. Purpose and User Benefits
Gives owners immediate operational control over daily property availability, pricing tweaks, and status changes.

##### 4. User Interaction and Usage Instructions
1. In Owner Dashboard ('Listings' tab), click 'Manage' on any venue.
2. Use workspace tabs: Overview, Calendar, Bookings, Rental & Pricing, Purposes, Photos & Videos, Settings.
3. In Settings, click 'Pause Venue' to temporarily hide from search, or 'Unpause' to restore.
4. Click 'Launch Full Builder' if structural edits to categories or locations are needed.

##### 5. UI and Component Implementation
Implemented in `frontend/src/components/owner/VenueWorkspace.tsx`. Features breadcrumb navigation, KPI cards, quick-action toggles (Pause, Archive, Delete), and sub-tab routing.

##### 6. Backend and Business Logic
`PATCH /api/v1/venues/{venue_id}` handles status updates (`active` <-> `suspended`/`draft`). Deletion is handled via `DELETE /api/v1/venues/{venue_id}` which soft-deletes or archives.

##### 7. Data Model and Persistence
Updates `venues.status`, `venues.base_price`, `venues.description`.

##### 8. API and Integration Details
GET /api/v1/venues/{id}. PATCH /api/v1/venues/{id}. DELETE /api/v1/venues/{id}.

##### 9. State and Lifecycle
Active -> Paused (hidden from public) -> Reactivated -> Archived.

##### 10. Permissions and Security
Verified owner owning that specific venue ID.

##### 11. Edge Cases and Error Behavior
Venues with active upcoming bookings cannot be deleted until reservations are fulfilled or cancelled.

##### 12. Testing and Verification
Automated tests in `backend/tests/test_owner_dashboard.py` and `frontend/src/components/OwnerLayout.test.tsx`.

##### 13. Maintenance and Extension
Main file: `frontend/src/components/owner/VenueWorkspace.tsx`.

##### 14. Feature Summary
- **Summary:** Centralized owner property cockpit for rapid configuration, status toggling, and calendar management.
- **Status:** Implemented and verified

---

#### [FEAT-040] Dynamic Pricing Rule Engine

##### 1. Feature Identity
- **Feature ID:** `FEAT-040`
- **Feature Name:** Dynamic Pricing Rule Engine
- **Category:** Venue Owner Onboarding & Workspace
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/venues/:id/pricing-rules`, `/api/v1/venues/{venue_id}/pricing-rules`
- **User Roles Permitted:** Owner, Administrator
- **Core Module Dependencies:** PricingRule Model, PricingStep Component, Catalog Service

##### 2. Feature Description
Enables venue owners to establish automated pricing rules: weekend multipliers, peak evening hour surcharges, and custom seasonal price adjustments.

##### 3. Purpose and User Benefits
Maximizes property revenue by automatically surging rates during peak demand hours (e.g., Saturday nights) without manual daily adjustments.

##### 4. User Interaction and Usage Instructions
1. Open Venue Workspace and select 'Rental & Pricing' (or Step 6 of the Listing Builder).
2. Click '+ Add Pricing Rule'.
3. Select rule type: 'Weekend Surge', 'Time-of-Day Multiplier', or 'Date Range Override'.
4. Enter multiplier (e.g., 1.25 for 25% surge) or fixed rate override.
5. Click 'Save Rule'. The availability matrix immediately applies the updated rates to matching future slots.

##### 5. UI and Component Implementation
Configured in `frontend/src/components/owner/listing-builder/PricingStep.tsx`. Displays rule list with toggle switches and multiplier badges.

##### 6. Backend and Business Logic
Managed by `pricing_rules` table and service in `backend/app/modules/catalog/service.py`. When slot prices are fetched, active pricing rules evaluate against the slot date and time, multiplying base price.

##### 7. Data Model and Persistence
Table: `pricing_rules`: `id` (UUID PK), `venue_id` (UUID FK), `name`, `rule_type`, `multiplier` (NUMERIC), `fixed_price` (NUMERIC), `days_of_week` (JSONB array), `start_time`, `end_time`, `is_active`.

##### 8. API and Integration Details
GET /api/v1/venues/{id}/pricing-rules. POST /api/v1/venues/{id}/pricing-rules. DELETE /api/v1/venues/{id}/pricing-rules/{rule_id}.

##### 9. State and Lifecycle
Rule Created -> Active -> Slot Generation Evaluates Rules -> Surged Rate Applied to Customer.

##### 10. Permissions and Security
Owner of the venue or platform admin.

##### 11. Edge Cases and Error Behavior
Overlapping rules apply multipliers in defined precedence order to avoid unintended price compounding.

##### 12. Testing and Verification
Automated tests in `backend/tests/test_pricing_rules.py` and `test_pricing_rules_api.py`. Status: PASS.

##### 13. Maintenance and Extension
Main files: `backend/app/models/core.py`, `backend/app/modules/catalog/service.py`.

##### 14. Feature Summary
- **Summary:** Dynamic pricing rule engine automating weekend and peak demand rate adjustments.
- **Status:** Implemented and verified

---

#### [FEAT-041] Owner Interactive Calendar & Slot Management

##### 1. Feature Identity
- **Feature ID:** `FEAT-041`
- **Feature Name:** Owner Interactive Calendar & Slot Management
- **Category:** Venue Owner Onboarding & Workspace
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/owner (Calendars tab)`, `/api/v1/venues/{id}/blocks`, `/api/v1/venues/{id}/inventory-units`
- **User Roles Permitted:** Owner, Administrator
- **Core Module Dependencies:** OwnerCalendar Component, Block Model, InventoryUnit Model

##### 2. Feature Description
Visual multi-venue calendar giving property owners a unified overview of all booked, held, and open slots, with tools to block slots for maintenance or private offline use.

##### 3. Purpose and User Benefits
Prevents schedule collisions between online GroundKart bookings and offline walk-in reservations.

##### 4. User Interaction and Usage Instructions
1. Navigate to the 'Calendars' tab in the Owner Dashboard.
2. Select a target property and browse calendar dates.
3. View reservations with customer names and slot durations.
4. To block a slot for maintenance, click an open slot and select 'Block Slot'.
5. Enter the block reason (e.g., 'Grass Reseeding'). The slot turns gray and cannot be booked online.

##### 5. UI and Component Implementation
Implemented in `frontend/src/components/owner/calendar/OwnerCalendar.tsx`. Features month/day views, color-coded status chips, and block creation modals.

##### 6. Backend and Business Logic
`POST /api/v1/venues/{venue_id}/blocks` in `backend/app/main.py`. Inserts row into `blocks` table and updates overlapping `inventory_units.status='blocked'`.

##### 7. Data Model and Persistence
Table: `blocks`: `id` (UUID PK), `venue_id` (UUID FK), `start_time` (TIMESTAMPTZ), `end_time` (TIMESTAMPTZ), `reason`, `status` ('active', 'cancelled'). Updates `inventory_units.status`.

##### 8. API and Integration Details
POST /api/v1/venues/{id}/blocks (`start_time`, `end_time`, `reason`). GET /api/v1/venues/{id}/blocks. PATCH /api/v1/venues/{id}/blocks/{block_id}.

##### 9. State and Lifecycle
Owner Selects Slot -> Block Created -> Slot Status Set to 'blocked' -> Slot Hidden from Customers.

##### 10. Permissions and Security
Owner of the venue or admin.

##### 11. Edge Cases and Error Behavior
Attempting to block a slot that already has a confirmed customer booking raises an HTTP 409 Conflict.

##### 12. Testing and Verification
Automated tests in `backend/tests/test_blocks.py` and `backend/tests/test_inventory_listing.py`.

##### 13. Maintenance and Extension
Main files: `frontend/src/components/owner/calendar/OwnerCalendar.tsx`, `backend/app/modules/catalog/service.py`.

##### 14. Feature Summary
- **Summary:** Visual operational calendar enabling owners to inspect reservations and schedule maintenance blocks.
- **Status:** Implemented and verified

---

#### [FEAT-042] Owner Bank Account & Payout Setup

##### 1. Feature Identity
- **Feature ID:** `FEAT-042`
- **Feature Name:** Owner Bank Account & Payout Setup
- **Category:** Venue Owner Onboarding & Workspace
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/owner (Account tab)`, `/api/v1/owner/bank-accounts`
- **User Roles Permitted:** Owner, Administrator
- **Core Module Dependencies:** OwnerBankAccount Model, OwnerLayout Component, Payout Service

##### 2. Feature Description
Secure bank account registration allowing property owners to register verified Indian bank details (IFSC code, Account Number, Beneficiary Name) for automated revenue disbursement.

##### 3. Purpose and User Benefits
Guarantees reliable, direct bank transfer of net booking earnings to the owner's legal entity.

##### 4. User Interaction and Usage Instructions
1. Open Owner Dashboard and navigate to the 'Account' tab.
2. Under 'Payout Bank Account', click 'Add Bank Account'.
3. Enter Account Holder Name, Bank Name, 11-character IFSC Code, and Bank Account Number.
4. Click 'Save Bank Details'. The account verifies and becomes the designated destination for payout batches.

##### 5. UI and Component Implementation
Rendered in `frontend/src/components/OwnerLayout.tsx` (Account tab). Features IFSC regex validation and masked account number display.

##### 6. Backend and Business Logic
`POST /api/v1/owner/bank-accounts` in `backend/app/modules/payout/service.py`. Validates IFSC structure (`^[A-Z]{4}0[A-Z0-9]{6}$`). Saves account record with `is_primary=True`.

##### 7. Data Model and Persistence
Table: `owner_bank_accounts`: `id` (UUID PK), `owner_id` (UUID FK), `account_holder_name`, `account_number`, `ifsc_code`, `bank_name`, `is_verified` (BOOLEAN), `is_primary` (BOOLEAN), `created_at`.

##### 8. API and Integration Details
POST /api/v1/owner/bank-accounts. Body: `OwnerBankAccountCreateRequest`. Response: `OwnerBankAccountResponse` (HTTP 201).

##### 9. State and Lifecycle
Owner Enters Bank Details -> IFSC Validated -> Persisted -> Used during Payout Batch Execution.

##### 10. Permissions and Security
Owner acting upon their own account. Admins have read access for disbursement verification.

##### 11. Edge Cases and Error Behavior
Malformed IFSC codes are rejected client-side and server-side with HTTP 422 Unprocessable Entity.

##### 12. Testing and Verification
Automated tests in `backend/tests/test_payout_ledger.py` (13 tests passing).

##### 13. Maintenance and Extension
Main files: `backend/app/modules/payout/service.py`, `frontend/src/components/OwnerLayout.tsx`.

##### 14. Feature Summary
- **Summary:** Compliant bank account registration interface ensuring secure revenue disbursement to verified owners.
- **Status:** Implemented and verified

---

#### [FEAT-043] Owner Analytics & Revenue Performance Dashboard

##### 1. Feature Identity
- **Feature ID:** `FEAT-043`
- **Feature Name:** Owner Analytics & Revenue Performance Dashboard
- **Category:** Venue Owner Onboarding & Workspace
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/owner (Overview tab)`, `/api/v1/owner/overview`, `/api/v1/owner/analytics`
- **User Roles Permitted:** Owner
- **Core Module Dependencies:** MetricCard Component, OwnerLayout Component, Analytics Service

##### 2. Feature Description
Comprehensive revenue and operational telemetry hub displaying Gross Merchandise Value (GMV), net payouts received, total confirmed bookings, venue occupancy percentages, and recent booking activity.

##### 3. Purpose and User Benefits
Empowers venue owners with actionable business intelligence to optimize pricing, increase occupancy, and track income growth.

##### 4. User Interaction and Usage Instructions
1. Navigate to `/owner` (lands on 'Overview' tab by default).
2. Inspect the high-level KPI cards: Gross Revenue, Net Earnings, Confirmed Bookings, and Occupancy Rate.
3. Review the 'Action Items' section highlighting rejected listings, pending reviews, or payout notices.
4. Review the 'Recent Bookings' table showing live reservation activity.

##### 5. UI and Component Implementation
Implemented in `frontend/src/components/OwnerLayout.tsx` using `DashboardShell` and `MetricCard`. Visual progress bars show occupancy benchmarks.

##### 6. Backend and Business Logic
`GET /api/v1/owner/overview` and `GET /api/v1/owner/analytics` in `backend/app/modules/owner_dashboard/service.py`. Aggregates sums from `payments` and `bookings` filtered by `venues.owner_id == current_user.id`.

##### 7. Data Model and Persistence
Aggregates `bookings`, `payments`, `inventory_units`, and `venues` tables.

##### 8. API and Integration Details
GET /api/v1/owner/overview. Returns `OwnerOverviewResponse` (`gross_revenue`, `net_earnings`, `confirmed_bookings`, `active_venues`, `recent_bookings`).

##### 9. State and Lifecycle
Owner Loads Dashboard -> Query Calculates Aggregates -> KPI Cards Render Metric Values.

##### 10. Permissions and Security
Restricted strictly to verified `owner` session. Scoped exclusively to owned properties.

##### 11. Edge Cases and Error Behavior
New owners with zero bookings see clear baseline zeros with onboarding recommendations.

##### 12. Testing and Verification
Automated tests in `backend/tests/test_owner_dashboard.py` (17 tests passing) and `OwnerDashboardGuide11.test.tsx`.

##### 13. Maintenance and Extension
Main files: `backend/app/modules/owner_dashboard/service.py`, `frontend/src/components/OwnerLayout.tsx`.

##### 14. Feature Summary
- **Summary:** Business intelligence dashboard providing venue owners with real-time earnings, bookings, and occupancy metrics.
- **Status:** Implemented and verified

---

### Category: Administrative Governance, Finance & Operations

#### [FEAT-044] Platform Executive Dashboard & Metric Intelligence

##### 1. Feature Identity
- **Feature ID:** `FEAT-044`
- **Feature Name:** Platform Executive Dashboard & Metric Intelligence
- **Category:** Administrative Governance, Finance & Operations
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/admin (Overview tab)`, `/api/v1/admin/dashboard/overview`, `/api/v1/admin/analytics`
- **User Roles Permitted:** Administrator
- **Core Module Dependencies:** AdminLayout Component, Analytics Service, MetricCard Component

##### 2. Feature Description
Executive command dashboard presenting cross-platform KPIs: Gross Merchandise Value (GMV), platform commission take, total completed bookings, active venue count, active registered users, and system health status.

##### 3. Purpose and User Benefits
Gives platform executives immediate visibility into transaction volume, platform revenue growth, operational queue backlogs, and server health.

##### 4. User Interaction and Usage Instructions
1. Log in with administrative credentials and navigate to `/admin`.
2. Inspect the headline KPI cards: Platform GMV, Commission Revenue, Completed Bookings, Active Venues, Active Users.
3. Review the 'Quick Actions' rail (Hold Sweeps, System Settings).
4. Switch to the 'Analytics' tab to view time-series volume trends and category breakdowns.

##### 5. UI and Component Implementation
Implemented in `frontend/src/components/AdminLayout.tsx` (Overview and Analytics tabs). Features responsive metric grids, quick-action action triggers, and recent audit activity tables.

##### 6. Backend and Business Logic
`GET /api/v1/admin/dashboard/overview` in `backend/app/main.py`. Performs aggregate SQL queries across `payments`, `bookings`, `venues`, and `users` tables.

##### 7. Data Model and Persistence
Aggregates `bookings`, `payments`, `venues`, `users`, and `audit_logs`.

##### 8. API and Integration Details
GET /api/v1/admin/dashboard/overview. Returns `DashboardOverview` schema. GET /api/v1/admin/analytics. Returns `AnalyticsMetrics`.

##### 9. State and Lifecycle
Admin Opens Dashboard -> Parallel SQL Queries Aggregate Platform Stats -> Dashboard Rendered.

##### 10. Permissions and Security
Restricted exclusively to `admin` role via `require_role('admin')`.

##### 11. Edge Cases and Error Behavior
Database load spikes are minimized via efficient SQL `COUNT` and `SUM` index aggregations.

##### 12. Testing and Verification
Automated tests in `backend/tests/test_analytics.py` (9 tests passing) and `frontend/src/AdminLayout.test.tsx` (14 tests passing).

##### 13. Maintenance and Extension
Main files: `backend/app/modules/analytics/service.py`, `frontend/src/components/AdminLayout.tsx`.

##### 14. Feature Summary
- **Summary:** Executive command center aggregating platform GMV, commission earnings, inventory, and user activity.
- **Status:** Implemented and verified

---

#### [FEAT-045] Venue Approval & Rejection Workflow

##### 1. Feature Identity
- **Feature ID:** `FEAT-045`
- **Feature Name:** Venue Approval & Rejection Workflow
- **Category:** Administrative Governance, Finance & Operations
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/admin (ApprovalQueue tab)`, `/api/v1/admin/venues/{venue_id}/approve`, `/api/v1/admin/venues/{venue_id}/reject`
- **User Roles Permitted:** Administrator
- **Core Module Dependencies:** AdminLayout Component, AdminVenueDrawer Component, Catalog Service

##### 2. Feature Description
Rigorous gatekeeping queue where administrators inspect submitted venue listings (photos, location, pricing, content blocks) and approve them for public discovery or reject them with mandatory feedback notes.

##### 3. Purpose and User Benefits
Prevents incomplete, substandard, or fraudulent listings from appearing in the public catalog, protecting customer trust.

##### 4. User Interaction and Usage Instructions
1. In Admin Dashboard, navigate to the 'Approval Queue' tab.
2. Under 'Pending Venues', click 'Review' on a submitted listing.
3. The `AdminVenueDrawer` opens displaying the full property profile, photos, amenities, and slots.
4. Click 'Approve Venue' to publish the property live immediately.
5. Or, click 'Reject Venue', enter a specific reason (e.g., 'Need at least 3 exterior photos'), and submit. The owner is notified immediately.

##### 5. UI and Component Implementation
Implemented in `frontend/src/components/AdminLayout.tsx` and `frontend/src/components/dashboard/AdminVenueDrawer.tsx`. Features slide-over drawer, rejection reason dialogs, and instant status updates.

##### 6. Backend and Business Logic
`POST /api/v1/admin/venues/{venue_id}/approve` and `POST /api/v1/admin/venues/{venue_id}/reject` in `backend/app/main.py`. Validates state transition from `pending_review` to `active` or `rejected`. Records rejection reason on `venues.rejection_reason`. Emits `AuditLog` entry.

##### 7. Data Model and Persistence
Updates `venues.status`, `venues.rejection_reason`. Inserts into `audit_logs`.

##### 8. API and Integration Details
POST /api/v1/admin/venues/{id}/approve. POST /api/v1/admin/venues/{id}/reject (`reason: str`). Requires admin role.

##### 9. State and Lifecycle
Pending Review -> Admin Inspects -> Approved (Active) OR Rejected (Returned to Owner with Notes).

##### 10. Permissions and Security
Strictly restricted to `admin` role.

##### 11. Edge Cases and Error Behavior
Venues with empty mandatory fields cannot be approved; API validates minimum completeness criteria.

##### 12. Testing and Verification
Automated tests in `backend/tests/test_admin_oversight.py` (25 tests passing).

##### 13. Maintenance and Extension
Main files: `backend/app/modules/admin/service.py`, `frontend/src/components/dashboard/AdminVenueDrawer.tsx`.

##### 14. Feature Summary
- **Summary:** Mandatory administrative quality assurance workflow controlling public venue publication and owner feedback.
- **Status:** Implemented and verified

---

#### [FEAT-046] User Governance & Account Sanctions

##### 1. Feature Identity
- **Feature ID:** `FEAT-046`
- **Feature Name:** User Governance & Account Sanctions
- **Category:** Administrative Governance, Finance & Operations
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/admin (Users tab)`, `/api/v1/admin/users`, `/api/v1/admin/users/{id}/suspend`, `/api/v1/admin/users/{id}/reactivate`
- **User Roles Permitted:** Administrator
- **Core Module Dependencies:** AdminLayout Component, User Model, AuditLog Model

##### 2. Feature Description
User administration console enabling operators to inspect registered customer and owner accounts, review booking activity, and apply temporary or permanent suspensions for terms of service violations.

##### 3. Purpose and User Benefits
Protects the community against abusive users, fraudulent operators, and non-compliant accounts.

##### 4. User Interaction and Usage Instructions
1. Open Admin Dashboard and navigate to the 'Users' tab.
2. Search by user name, email, or phone number.
3. Review account status, role, and registration date.
4. Click 'Suspend' on an offending account and enter the sanction reason.
5. To restore access, click 'Reactivate User'.

##### 5. UI and Component Implementation
Implemented in `frontend/src/components/AdminLayout.tsx` (Users tab). Displays paginated table, role filter pills, status badges, and action modals.

##### 6. Backend and Business Logic
`POST /api/v1/admin/users/{id}/suspend` and `reactivate` in `backend/app/modules/admin/service.py`. Updates `users.is_suspended`. Revokes active refresh tokens in `refresh_tokens` table. Emits an immutable `AuditLog` entry.

##### 7. Data Model and Persistence
Updates `users.is_suspended`. Revokes `refresh_tokens`. Inserts `audit_logs` (`action='user.suspended'`).

##### 8. API and Integration Details
POST /api/v1/admin/users/{id}/suspend Body: `SuspendRequest` (`reason`). POST /api/v1/admin/users/{id}/reactivate.

##### 9. State and Lifecycle
Active User -> Admin Sanctions -> Marked Suspended & Tokens Revoked -> Denied API Access -> Reactivated.

##### 10. Permissions and Security
Restricted exclusively to `admin` role.

##### 11. Edge Cases and Error Behavior
Administrators cannot suspend their own account (prevents accidental self-lockout).

##### 12. Testing and Verification
Automated tests in `backend/tests/test_admin_oversight.py` and `backend/tests/test_rbac.py`.

##### 13. Maintenance and Extension
Main file: `backend/app/modules/admin/service.py`.

##### 14. Feature Summary
- **Summary:** Account governance system enabling immediate suspension and token revocation for policy violations.
- **Status:** Implemented and verified

---

#### [FEAT-047] Venue Suspension & Reactivation Controls

##### 1. Feature Identity
- **Feature ID:** `FEAT-047`
- **Feature Name:** Venue Suspension & Reactivation Controls
- **Category:** Administrative Governance, Finance & Operations
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/admin (Venues tab)`, `/api/v1/admin/venues/{id}/suspend`, `/api/v1/admin/venues/{id}/reactivate`
- **User Roles Permitted:** Administrator
- **Core Module Dependencies:** AdminLayout Component, Venue Model, AuditLog Model

##### 2. Feature Description
Emergency administrative controls to instantly suspend active venues due to unresolved customer complaints, safety issues, or owner disputes, immediately hiding them from public search.

##### 3. Purpose and User Benefits
Ensures swift protection of customers when a listed venue fails to maintain promised standards or safety.

##### 4. User Interaction and Usage Instructions
1. In Admin Dashboard, navigate to the 'Venues' tab.
2. Locate the target venue.
3. Click 'Suspend Venue' and enter the operational reason (e.g., 'Facility renovation without notice').
4. The venue status updates to `suspended` and immediately disappears from public search results.
5. Once resolved, click 'Reactivate Venue' to restore live booking availability.

##### 5. UI and Component Implementation
Action buttons in `AdminLayout.tsx` (Venues tab) and `AdminVenueDrawer.tsx` with modal confirmation dialogs.

##### 6. Backend and Business Logic
`POST /api/v1/admin/venues/{id}/suspend` and `reactivate` in `backend/app/main.py`. Updates `venues.status='suspended'` and records `suspension_reason`. Emits audit log entry.

##### 7. Data Model and Persistence
Updates `venues.status` and `venues.suspension_reason`. Inserts into `audit_logs`.

##### 8. API and Integration Details
POST /api/v1/admin/venues/{id}/suspend (`reason: str`). POST /api/v1/admin/venues/{id}/reactivate.

##### 9. State and Lifecycle
Active Venue -> Suspended -> Hidden from Public Search -> Reactivated -> Restored to Search.

##### 10. Permissions and Security
Admin role strictly required.

##### 11. Edge Cases and Error Behavior
Suspending a venue does not cancel existing confirmed bookings; it prevents any new reservations.

##### 12. Testing and Verification
Automated tests in `backend/tests/test_admin_oversight.py`. Status: PASS.

##### 13. Maintenance and Extension
Main file: `backend/app/modules/catalog/service.py`.

##### 14. Feature Summary
- **Summary:** Administrative emergency controls allowing immediate suspension and reactivation of venue listings.
- **Status:** Implemented and verified

---

#### [FEAT-048] Offline Payment Manual Confirmation & Receipt Reconciliation

##### 1. Feature Identity
- **Feature ID:** `FEAT-048`
- **Feature Name:** Offline Payment Manual Confirmation & Receipt Reconciliation
- **Category:** Administrative Governance, Finance & Operations
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/admin (Bookings tab)`, `/api/v1/admin/bookings/{id}/confirm-payment`
- **User Roles Permitted:** Administrator
- **Core Module Dependencies:** AdminLayout Component, Booking Engine, Ledger Service

##### 2. Feature Description
The operational payment verification interface where administrators verify bank receipts/UPI transfers and formally confirm pending customer reservations, transitioning slots to booked and emitting double-entry ledger records.

##### 3. Purpose and User Benefits
Enables the platform to operate seamlessly with high-value offline bank payments common in large venue rentals without costly gateway fees.

##### 4. User Interaction and Usage Instructions
1. Navigate to the 'Bookings' tab in the Admin Dashboard.
2. Filter for bookings with status 'Pending Payment'.
3. Compare the booking reference code and amount against bank account statements.
4. Click 'Confirm Payment' and enter the bank transaction reference number.
5. The booking updates to 'Confirmed', the slot is marked 'Booked', and balanced financial ledger records are generated.

##### 5. UI and Component Implementation
Implemented in `frontend/src/components/AdminLayout.tsx` (Bookings tab). Features payment confirmation action button, transaction ID input dialog, and status badge update.

##### 6. Backend and Business Logic
`confirm_booking_by_admin()` in `backend/app/modules/booking/service.py`. Transitions booking from `pending_payment` to `confirmed`. Updates slot to `booked`. Inserts `Payment` row with `status='succeeded'`. Calls `ledger_service.record_payment_confirmation()`. Creates outbox event.

##### 7. Data Model and Persistence
Updates `bookings.status='confirmed'`. Updates `inventory_units.status='booked'`. Inserts into `payments` (`id`, `booking_id`, `amount`, `commission_amount`, `status='succeeded'`). Inserts into `ledger_entries`.

##### 8. API and Integration Details
POST /api/v1/admin/bookings/{id}/confirm-payment. Body: `AdminConfirmPaymentRequest`. Response: `BookingDetail`.

##### 9. State and Lifecycle
Pending Payment (Held) -> Admin Verifies Funds -> Confirmed (Booked) + Ledger Emitted + Outbox Event Created.

##### 10. Permissions and Security
Restricted exclusively to `admin` role.

##### 11. Edge Cases and Error Behavior
If a hold has already expired when the admin attempts confirmation, the system alerts the admin to evaluate whether the slot was reclaimed.

##### 12. Testing and Verification
Automated tests in `backend/tests/test_offline_payment_confirmation.py` (9 tests passing).

##### 13. Maintenance and Extension
Main files: `backend/app/modules/booking/service.py`, `backend/app/modules/ledger/service.py`.

##### 14. Feature Summary
- **Summary:** Core payment confirmation workflow reconciling offline customer receipts and generating financial ledger entries.
- **Status:** Implemented and verified

---

#### [FEAT-049] Double-Entry Financial Ledger System

##### 1. Feature Identity
- **Feature ID:** `FEAT-049`
- **Feature Name:** Double-Entry Financial Ledger System
- **Category:** Administrative Governance, Finance & Operations
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/admin/ledger/entries`, `/api/v1/admin/ledger/entries`
- **User Roles Permitted:** Administrator
- **Core Module Dependencies:** LedgerEntry Model, Ledger Service, Payment Model

##### 2. Feature Description
Enterprise-grade double-entry accounting engine recording every monetary movement (payments, refunds, commissions, and payout disbursements) across balanced debit and credit legs.

##### 3. Purpose and User Benefits
Guarantees complete financial auditability, eliminating unexplainable account discrepancies and satisfying statutory accounting standards.

##### 4. User Interaction and Usage Instructions
1. Automated: executes automatically on every payment confirmation, refund, or payout disbursement.
2. Administrators inspect the immutable transaction log via the Admin Dashboard or API.
3. Every transaction displays balanced debits and credits tied to booking IDs.

##### 5. UI and Component Implementation
Rendered in Admin Dashboard ledger view showing transaction IDs, accounts, directions (Debit / Credit), and amounts.

##### 6. Backend and Business Logic
`app.modules.ledger.service` in `backend/app/modules/ledger/service.py`. Enforces debit/credit balancing invariants across `customer_funds_held`, `owner_payable`, `platform_commission_revenue`, and `platform_cash`.

##### 7. Data Model and Persistence
Table: `ledger_entries`: `id` (UUID PK), `transaction_id` (UUID indexed), `entry_type`, `account`, `direction` ('debit'/'credit'), `amount` (NUMERIC(12, 2)), `currency`, `booking_id`, `payment_id`, `payout_id`, `created_at`.

##### 8. API and Integration Details
GET /api/v1/admin/ledger/entries?limit=50&offset=0. Returns `list[LedgerEntryResponse]`.

##### 9. State and Lifecycle
Financial Event Triggered -> Balanced Debit/Credit Entries Constructed -> Committed Atomically in Database.

##### 10. Permissions and Security
Admin read access only. Ledger entries are strictly append-only (no update or delete endpoints exist).

##### 11. Edge Cases and Error Behavior
Any transaction where total debits do not equal total credits raises an invariant exception and rolls back the database transaction.

##### 12. Testing and Verification
Automated tests in `backend/tests/test_payout_ledger.py` and `test_phase1_ledger_and_compliance.py` (29 tests passing).

##### 13. Maintenance and Extension
Main file: `backend/app/modules/ledger/service.py`.

##### 14. Feature Summary
- **Summary:** Strict double-entry accounting engine ensuring mathematical balance across platform escrow and revenue.
- **Status:** Implemented and verified

---

#### [FEAT-050] Ledger Reconciliation & Audit Integrity Check

##### 1. Feature Identity
- **Feature ID:** `FEAT-050`
- **Feature Name:** Ledger Reconciliation & Audit Integrity Check
- **Category:** Administrative Governance, Finance & Operations
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/admin/ledger/reconcile`, `/api/v1/admin/ledger/reconcile`
- **User Roles Permitted:** Administrator
- **Core Module Dependencies:** LedgerEntry Model, Ledger Service, Admin Dashboard

##### 2. Feature Description
Automated integrity verification endpoint calculating total debits vs total credits across all historical transactions and verifying that escrow balances match active booking liabilities.

##### 3. Purpose and User Benefits
Enables instantaneous automated verification that no platform funds are unaccounted for or out of balance.

##### 4. User Interaction and Usage Instructions
1. In the Admin Dashboard ('Payouts' or 'Ledger' section), view the Ledger Reconciliation status.
2. The system verifies that Total Debits == Total Credits and displays 'Balanced' with zero variance.
3. If any discrepancy exists, the interface flags the exact transaction ID and account variance.

##### 5. UI and Component Implementation
Reconciliation badge in `AdminLayout.tsx` displaying balance status, debit/credit totals, and audit timestamp.

##### 6. Backend and Business Logic
`reconcile_ledger()` in `backend/app/modules/ledger/service.py`. Issues `SUM(CASE WHEN direction='debit' THEN amount ELSE 0 END)` and `SUM(CASE WHEN direction='credit' THEN amount ELSE 0 END)` grouped by transaction and across the entire table.

##### 7. Data Model and Persistence
Aggregates all rows in `ledger_entries`.

##### 8. API and Integration Details
GET /api/v1/admin/ledger/reconcile. Response: `ReconciliationResponse` (`is_balanced: bool`, `total_debits`, `total_credits`, `variance`).

##### 9. State and Lifecycle
Reconciliation Requested -> Table-Wide Sums Calculated -> Equality Verified -> Result Returned.

##### 10. Permissions and Security
Restricted exclusively to `admin` role.

##### 11. Edge Cases and Error Behavior
Zero variance (`variance = 0.00`) asserts complete mathematical ledger integrity.

##### 12. Testing and Verification
Automated tests in `backend/tests/test_payout_ledger.py`. Status: PASS.

##### 13. Maintenance and Extension
Main file: `backend/app/modules/ledger/service.py`.

##### 14. Feature Summary
- **Summary:** Automated financial reconciliation auditor verifying platform-wide double-entry mathematical balance.
- **Status:** Implemented and verified

---

#### [FEAT-051] Payout Batch Execution & Disbursement Ledger

##### 1. Feature Identity
- **Feature ID:** `FEAT-051`
- **Feature Name:** Payout Batch Execution & Disbursement Ledger
- **Category:** Administrative Governance, Finance & Operations
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/admin (Payouts tab)`, `/api/v1/admin/payouts`, `/api/v1/admin/payouts/run`, `/api/v1/admin/payouts/{id}/mark-paid`
- **User Roles Permitted:** Administrator
- **Core Module Dependencies:** Payout Model, Payout Service, Ledger Service

##### 2. Feature Description
Calculates and executes owner revenue disbursements for completed bookings (Gross booking revenue minus platform commission take-rate), tracking disbursement batches through pending, processing, and paid states.

##### 3. Purpose and User Benefits
Ensures venue owners are paid accurately and promptly for fulfilled events while platform commissions are retained.

##### 4. User Interaction and Usage Instructions
1. In Admin Dashboard, navigate to the 'Payouts' tab.
2. Click 'Run Payout Batch'.
3. The system aggregates all eligible completed bookings for each owner and creates pending payout records.
4. Review the owner bank details and disburse funds via bank transfer.
5. Click 'Mark Paid' on the payout entry. The ledger records the disbursement and updates the owner's dashboard.

##### 5. UI and Component Implementation
Implemented in `frontend/src/components/AdminLayout.tsx` (Payouts tab). Displays owner payout list, bank IFSC details, run batch button, and mark paid actions.

##### 6. Backend and Business Logic
`run_payout_batch()` and `mark_payout_paid()` in `backend/app/modules/payout/service.py`. Aggregates completed unlinked payments. Creates `Payout` row. When marked paid, emits double-entry ledger entries debiting `owner_payable` and crediting `platform_cash`.

##### 7. Data Model and Persistence
Table: `payouts`: `id` (UUID PK), `owner_id` (UUID FK), `amount` (NUMERIC), `status` ('pending', 'processing', 'paid', 'failed'), `paid_at`. Links to `payments.payout_id`.

##### 8. API and Integration Details
POST /api/v1/admin/payouts/run. POST /api/v1/admin/payouts/{id}/mark-paid. GET /api/v1/admin/payouts.

##### 9. State and Lifecycle
Completed Bookings Accumulated -> Payout Batch Created ('pending') -> Bank Transfer Executed -> Marked 'paid' -> Ledger Updated.

##### 10. Permissions and Security
Restricted exclusively to `admin` role.

##### 11. Edge Cases and Error Behavior
Owners without verified bank account details are flagged and excluded from automated disbursement until bank details are provided.

##### 12. Testing and Verification
Automated tests in `backend/tests/test_payout_ledger.py` and `test_payout_split.py`.

##### 13. Maintenance and Extension
Main files: `backend/app/modules/payout/service.py`, `backend/app/modules/ledger/service.py`.

##### 14. Feature Summary
- **Summary:** Owner revenue disbursement engine calculating commission splits and recording bank payouts.
- **Status:** Implemented and verified

---

#### [FEAT-052] System Health Diagnostics & Production Readiness Telemetry

##### 1. Feature Identity
- **Feature ID:** `FEAT-052`
- **Feature Name:** System Health Diagnostics & Production Readiness Telemetry
- **Category:** Administrative Governance, Finance & Operations
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/healthz`, `/api/v1/health`, `/api/v1/admin/health`
- **User Roles Permitted:** Public Monitoring, Administrator
- **Core Module Dependencies:** AdminLayout Component, FastAPI Core, DB Engine

##### 2. Feature Description
Multi-tier operational observability endpoints providing lightweight liveness checks (`/healthz`) for load balancers and deep diagnostic telemetry (`/api/v1/admin/health`) verifying database connectivity, storage read/write status, job worker heartbeat, and system resource metrics.

##### 3. Purpose and User Benefits
Enables DevOps teams and automated uptime monitors to instantly detect database degradation or worker stalls before customers are impacted.

##### 4. User Interaction and Usage Instructions
1. Load balancers probe `/healthz` for HTTP 200 liveness.
2. Administrators open the 'Overview' tab in the Admin Dashboard to inspect the live 'System Health' panel.
3. Panel shows green/red status for Database connection, Media Storage, and Job Worker heartbeat.

##### 5. UI and Component Implementation
Rendered in `frontend/src/components/AdminLayout.tsx` (Overview tab) with real-time status indicators and refresh button.

##### 6. Backend and Business Logic
`GET /api/v1/admin/health` in `backend/app/main.py`. Executes `SELECT 1` against PostgreSQL, verifies storage read/write, checks recent job execution timestamps, and returns diagnostic metrics.

##### 7. Data Model and Persistence
Non-persistent diagnostic query inspecting database pool and system time.

##### 8. API and Integration Details
GET /healthz returns `{'status': 'ok'}`. GET /api/v1/admin/health returns `AdminHealthResponse` (`status`, `database: 'connected'`, `storage: 'ok'`, `worker_heartbeat`, `uptime_seconds`).

##### 9. State and Lifecycle
Probe Received -> Subsystems Evaluated -> Diagnostic JSON Emitted.

##### 10. Permissions and Security
`/healthz` is public. `/api/v1/admin/health` requires `admin` authentication.

##### 11. Edge Cases and Error Behavior
If database connection times out, returns HTTP 503 Service Unavailable with diagnostic error details.

##### 12. Testing and Verification
Automated tests in `backend/tests/test_observability.py` (3 tests passing).

##### 13. Maintenance and Extension
Main file: `backend/app/main.py`.

##### 14. Feature Summary
- **Summary:** Comprehensive health telemetry infrastructure verifying database, storage, and worker subsystems.
- **Status:** Implemented and verified

---

#### [FEAT-053] System-Wide Audit Log & Traceability Trail

##### 1. Feature Identity
- **Feature ID:** `FEAT-053`
- **Feature Name:** System-Wide Audit Log & Traceability Trail
- **Category:** Administrative Governance, Finance & Operations
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/admin (Overview tab)`, `/api/v1/admin/audit-log`
- **User Roles Permitted:** Administrator
- **Core Module Dependencies:** AuditLog Model, AdminLayout Component, Audit Service

##### 2. Feature Description
Immutable, chronological audit logging recording all sensitive administrative and financial actions (approvals, rejections, payment confirmations, password resets, suspensions) with actor ID, IP address, and payload snapshots.

##### 3. Purpose and User Benefits
Guarantees full accountability, allowing management to inspect who authorized any operational change.

##### 4. User Interaction and Usage Instructions
1. Automated: records entries on all sensitive operations.
2. In Admin Dashboard ('Overview' tab), scroll to the 'Audit Trail' table.
3. Inspect recent actions: timestamp, actor name/email, action type (e.g., `venue.approved`), target ID, and context details.

##### 5. UI and Component Implementation
Rendered in `frontend/src/components/AdminLayout.tsx` (Overview tab) as a chronological log table with action badges.

##### 6. Backend and Business Logic
`record_audit_log()` in `backend/app/modules/core/audit.py`. Inserts an append-only row into `audit_logs` table within the same transaction as the audited event.

##### 7. Data Model and Persistence
Table: `audit_logs`: `id` (UUID PK), `actor_id` (UUID FK nullable), `action` (VARCHAR), `target_type` (VARCHAR), `target_id` (UUID), `details` (JSONB), `ip_address`, `created_at`.

##### 8. API and Integration Details
GET /api/v1/admin/audit-log?limit=50&offset=0. Returns `list[AuditLogEntry]`.

##### 9. State and Lifecycle
Action Executed -> Audit Record Created -> Stored Permanently -> Queried by Administrators.

##### 10. Permissions and Security
Restricted exclusively to `admin` role. No delete or update APIs exist.

##### 11. Edge Cases and Error Behavior
Anonymous or system-initiated actions record `actor_id = NULL` with context specifying automated trigger.

##### 12. Testing and Verification
Automated tests in `backend/tests/test_admin_oversight.py` and `backend/tests/test_observability.py` (13 tests passing).

##### 13. Maintenance and Extension
Main files: `backend/app/models/core.py`, `backend/app/modules/core/audit.py`.

##### 14. Feature Summary
- **Summary:** Immutable administrative audit trail capturing all platform state changes, approvals, and financial confirmations.
- **Status:** Implemented and verified

---

#### [FEAT-054] Dynamic System Settings Configuration

##### 1. Feature Identity
- **Feature ID:** `FEAT-054`
- **Feature Name:** Dynamic System Settings Configuration
- **Category:** Administrative Governance, Finance & Operations
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/admin/settings`, `/api/v1/admin/settings`
- **User Roles Permitted:** Administrator
- **Core Module Dependencies:** SystemConfiguration Model, AdminLayout Component, Booking Engine

##### 2. Feature Description
Centralized platform configuration allowing administrators to dynamically adjust platform parameters: default commission rate, inventory hold duration, cancellation refund hours cutoffs, and maintenance modes without redeploying code.

##### 3. Purpose and User Benefits
Allows operational agility to modify business rules (e.g., extending hold times or updating commission take-rates) in real-time.

##### 4. User Interaction and Usage Instructions
1. Administrators access system settings via Admin Dashboard.
2. Adjust parameters: Platform Commission Percentage (e.g., 10%), Hold Duration Minutes (e.g., 10 mins), Cancellation Cutoff Hours (48h, 24h).
3. Click 'Save Settings'. Changes take effect immediately across all subsequent transactions.

##### 5. UI and Component Implementation
Settings dialog in `AdminLayout.tsx` with numerical inputs, percentage sliders, and save confirmation.

##### 6. Backend and Business Logic
`GET /api/v1/admin/settings` and `PATCH /api/v1/admin/settings` in `backend/app/main.py`. Persists key-value rows in `system_configurations` table.

##### 7. Data Model and Persistence
Table: `system_configurations`: `id` (UUID PK), `key` (VARCHAR unique), `value` (JSONB), `description`, `updated_at`.

##### 8. API and Integration Details
GET /api/v1/admin/settings. PATCH /api/v1/admin/settings. Body: `SystemSettingsUpdateRequest`.

##### 9. State and Lifecycle
Setting Modified -> Persisted in Database -> Read Dynamically by Booking and Ledger Services.

##### 10. Permissions and Security
Strictly restricted to `admin` role.

##### 11. Edge Cases and Error Behavior
Invalid ranges (e.g., negative commission rates) are rejected server-side via Pydantic validators.

##### 12. Testing and Verification
Automated tests in `backend/tests/test_phase0_hardening.py`. Status: PASS.

##### 13. Maintenance and Extension
Main files: `backend/app/models/core.py`, `backend/app/config.py`.

##### 14. Feature Summary
- **Summary:** Dynamic platform configuration management adjusting commission rates, hold windows, and cancellation rules.
- **Status:** Implemented and verified

---

#### [FEAT-055] Broadcast & Targeted User Notification Dispatcher

##### 1. Feature Identity
- **Feature ID:** `FEAT-055`
- **Feature Name:** Broadcast & Targeted User Notification Dispatcher
- **Category:** Administrative Governance, Finance & Operations
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `/admin (Notifications tab)`, `/api/v1/notifications`, `/api/v1/admin/notifications/send`
- **User Roles Permitted:** Customer, Owner, Administrator
- **Core Module Dependencies:** Notification Model, NotificationDelivery Model, Header Component

##### 2. Feature Description
Multi-channel in-app notification center notifying customers of booking confirmations and refunds, notifying owners of new reservations, and allowing administrators to dispatch platform-wide announcements.

##### 3. Purpose and User Benefits
Keeps users informed of critical reservation status updates and system announcements in real-time.

##### 4. User Interaction and Usage Instructions
1. Customers and owners view notification alerts via the Bell icon in the navigation header.
2. Unread notification badges indicate pending updates.
3. Click the bell to open the notifications dropdown and mark alerts as read.
4. Administrators can navigate to the 'Notifications' tab in Admin Dashboard to broadcast announcements to all users.

##### 5. UI and Component Implementation
Implemented in `frontend/src/components/Header.tsx` (notification bell dropdown), `HeaderNotifications.test.tsx`, and `AdminLayout.tsx` (Notifications tab).

##### 6. Backend and Business Logic
`app.modules.notifications.service.notify()` in `backend/app/modules/notifications/service.py`. Creates `Notification` and `NotificationDelivery` rows. Tracks unread counts via `GET /api/v1/notifications/unread-count`.

##### 7. Data Model and Persistence
Tables: `notifications` (`id`, `user_id`, `title`, `body`, `type`, `read`, `created_at`), `notification_deliveries` (`id`, `notification_id`, `channel`, `status`, `delivered_at`).

##### 8. API and Integration Details
GET /api/v1/notifications. POST /api/v1/notifications/{id}/read. POST /api/v1/admin/notifications/send.

##### 9. State and Lifecycle
Event Occurs -> Notification Generated -> Displayed in Header Dropdown -> Marked Read by User.

##### 10. Permissions and Security
Users access only their own notifications. Admins can broadcast.

##### 11. Edge Cases and Error Behavior
Empty notification lists display a clean 'No new notifications' state.

##### 12. Testing and Verification
Automated tests in `backend/tests/test_notifications.py` (13 tests passing) and `frontend/src/components/HeaderNotifications.test.tsx`.

##### 13. Maintenance and Extension
Main file: `backend/app/modules/notifications/service.py`.

##### 14. Feature Summary
- **Summary:** In-app and broadcast notification infrastructure delivering reservation alerts and platform announcements.
- **Status:** Implemented and verified

---

#### [FEAT-056] Asynchronous Outbox Event Publisher & Scheduled Job Worker

##### 1. Feature Identity
- **Feature ID:** `FEAT-056`
- **Feature Name:** Asynchronous Outbox Event Publisher & Scheduled Job Worker
- **Category:** Administrative Governance, Finance & Operations
- **Implementation Status:** Implemented and verified
- **Associated Routes / UI Points:** `Background Worker Loop`, `FastAPI Lifespan`
- **User Roles Permitted:** Background Worker
- **Core Module Dependencies:** OutboxEvent Model, Job Model, worker_loop

##### 2. Feature Description
Decoupled asynchronous task runner executing transactional outbox events and recurring jobs using PostgreSQL `SELECT ... FOR UPDATE SKIP LOCKED` for lock-free parallel worker execution.

##### 3. Purpose and User Benefits
Guarantees system reliability and responsiveness by ensuring long-running tasks never block incoming HTTP web requests.

##### 4. User Interaction and Usage Instructions
1. Automated: starts on FastAPI server startup via the `lifespan` context manager.
2. Continuously claims and executes pending jobs from the `jobs` table every 5 seconds.
3. If a job fails, exponential backoff retries are applied automatically up to `max_attempts`.

##### 5. UI and Component Implementation
Monitored via Admin Dashboard System Health panel (`AdminLayout.tsx`).

##### 6. Backend and Business Logic
`worker_loop()` and `process_one_job()` in `backend/app/modules/jobs/worker.py`. Claims tasks using `with_for_update(skip_locked=True)`. Dispatches to job logic handlers (such as `sweep_expired_holds`). Records completion timestamps or error traces.

##### 7. Data Model and Persistence
Tables: `outbox_events` (`id`, `event_type`, `payload`, `status`, `created_at`, `processed_at`), `jobs` (`id`, `job_type`, `payload`, `status`, `attempts`, `max_attempts`, `next_attempt_at`, `started_at`, `completed_at`, `error_details`).

##### 8. API and Integration Details
Internal background execution; monitored via `GET /api/v1/admin/health`.

##### 9. State and Lifecycle
Pending -> (Claimed with SKIP LOCKED) -> Running -> Completed OR Failed (with Exponential Backoff).

##### 10. Permissions and Security
Internal system worker.

##### 11. Edge Cases and Error Behavior
If a worker crashes mid-task, remaining jobs are safely claimed by surviving worker threads.

##### 12. Testing and Verification
Automated tests in `backend/tests/test_outbox.py` (5 tests passing) and `backend/tests/test_jobs.py` (8 tests passing).

##### 13. Maintenance and Extension
Main files: `backend/app/modules/jobs/worker.py`, `backend/app/modules/core/outbox.py`.

##### 14. Feature Summary
- **Summary:** Transactional outbox and background job worker utilizing PostgreSQL SKIP LOCKED for fault-tolerant task execution.
- **Status:** Implemented and verified

---

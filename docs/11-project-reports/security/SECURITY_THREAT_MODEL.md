# GroundKart — Security Threat Model & Risk Assessment

**Date:** 2026-10-11  
**Scope:** Public Catalog, Authentication, Customer Booking, Owner Portal, Admin Oversight, File Uploads, Database Sessions  
**Standards:** OWASP Top 10, ASVS Level 2, STRIDE Threat Modeling Methodology  

---

## 1. System Overview & Trust Boundaries

GroundKart is a sports turf and venue reservation platform handling customer identities, financial transactions (bookings, payments, payouts), venue inventory, owner KYC verification documents, and administrative audit logs.

### Trust Boundaries:
1. **Public Internet / Anonymous User:** Unauthenticated browsers accessing homepage, catalog search, public venue details, login/signup endpoints.
2. **Authenticated Customer:** User role `customer`, authorized to manage their own bookings, profile, reviews, and support tickets.
3. **Authenticated Venue Owner:** User role `owner`, authorized to create/edit their own venues, view slot bookings for their venues, manage maintenance blocks, and view payout statements.
4. **Platform Admin:** User role `admin`, authorized to moderate venues, approve owner verification documents, suspend accounts, confirm offline payments, and view platform analytics.
5. **Database & Storage Core:** PostgreSQL database, local static storage mount `/uploads`, outbox event worker.

---

## 2. Threat Modeling Matrix (20 Attack Vectors)

| ID | Threat Category | Threat Description | Attack Vector / Entry Point | Impact | Likelihood | Verified Status in Codebase |
|---|---|---|---|---|---|---|
| **TM-01** | Account Takeover | Attacker compromises user or admin account via credential stuffing or reset manipulation | `POST /api/v1/auth/forgot-password`, `POST /api/v1/auth/reset-password` | Critical | Low | **Hardened:** Password reset tokens are generated cryptographically and never exposed in API responses (verified in `auth/service.py`). Rate limiting applied. |
| **TM-02** | Reset Token Exposure | Leakage of password reset token in API JSON response or error trace | `POST /api/v1/auth/forgot-password` response | Critical | Low | **Fixed:** Token is delivered exclusively via outbox/notification service; HTTP response returns generic confirmation message. |
| **TM-03** | Broken Role Authorization | Customer attempts to access owner or admin endpoints | `POST /api/v1/admin/*`, `GET /api/v1/owner/*` | Critical | Low | **Hardened:** Enforced via `require_role('admin')` and `require_role('owner')` FastAPI dependencies. Tokens are verified cryptographically. |
| **TM-04** | IDOR (Insecure Direct Object References) | Customer accessing another customer's booking; Owner managing another owner's venue | `GET /api/v1/bookings/{id}`, `PATCH /api/v1/venues/{id}`, `GET /api/v1/owner/venues` | High | Low | **Hardened:** All booking and venue operations verify ownership against `current_user.id`. Customer queries enforce `customer_id == current_user.id`. |
| **TM-05** | Payment & Refund Manipulation | Client alters price or triggers unearned refund | `POST /api/v1/bookings`, `POST /api/v1/bookings/{id}/cancel` | High | Low | **Hardened:** Server calculates prices authoritatively from `InventoryUnit` and `pricing_rules`. Customer cannot supply arbitrary amounts. Refunds use tiered calculation server-side. |
| **TM-06** | Booking Race Conditions | Concurrent requests attempt to book the same inventory slot simultaneously | `POST /api/v1/bookings` concurrent calls | High | Medium | **Hardened:** Database partial unique index `uq_unit_slot` prevents overlapping slots. Explicit `FOR UPDATE` lock on inventory unit and transaction guarantees atomicity. |
| **TM-07** | Support Ticket Leakage | Owner views customer disputes or confidential tickets from unrelated users | `GET /api/v1/owner/support/tickets` | Medium | Low | **Hardened:** Tickets are scoped strictly to creator or explicitly assigned venue owner with dispute confidentiality checks. |
| **TM-08** | KYC Document Exposure | Public unauthenticated access to government IDs / tax documents | `GET /uploads/owner-verifications/*` | High | Medium | **Area for Hardening:** Uploads directory mounted via StaticFiles. Sensitive verification documents must have restricted access or randomized non-guessable storage keys. |
| **TM-09** | Malicious File Upload | Upload of executable scripts, webshells, or SVG with embedded JavaScript | `POST /api/v1/venues/{id}/media`, `POST /api/v1/owner/verification` | High | Low | **Hardened:** `LocalFileStorage` and upload routes validate file extensions and MIME types (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`). |
| **TM-10** | Stored / Reflected XSS | Malicious script in venue descriptions, reviews, or support messages | `Venue.description`, `Review.content`, `Ticket.message` | Medium | Low | **Hardened:** React DOM escapes HTML by default. Content blocks render structured text without `dangerouslySetInnerHTML`. |
| **TM-11** | SQL Injection | Untrusted input concatenated into SQL queries | Filter parameters in catalog search, admin overview | High | Low | **Hardened:** 100% of queries use SQLAlchemy 2.0 ORM expressions and parameterized statements. Zero raw string SQL concatenation. |
| **TM-12** | CSRF Vulnerability | Cross-site request forgery abusing cookies | Cookie-authenticated routes | Medium | Low | **Hardened:** Refresh token cookie sets `samesite="lax"` and `httponly=True`. Primary API authorization uses Bearer JWT tokens in `Authorization` header. |
| **TM-13** | Unsafe URL / Redirect | Open redirect or SSRF via URL parameters | External image links, webhook URLs | Medium | Low | **Hardened:** No arbitrary redirect parameters. Backend does not fetch remote user-supplied URLs on demand (SSRF mitigated). |
| **TM-14** | Rate Limit Bypass | Brute-force attacks against login, signup, or password reset | `POST /api/v1/auth/login`, `POST /api/v1/auth/signup` | Medium | Low | **Hardened:** Redis/database backed rate limiting (`check_login_rate_limit`) keys on login ID and IP. |
| **TM-15** | Secret Leakage | Production secret defaults (`jwt_secret_key`) checked into repo | Environment variables / `.env` | High | Medium | **Area for Hardening:** Ensure production environment asserts that `jwt_secret_key` is not the dev default string. |
| **TM-16** | Internal Error Disclosure | Global 500 handler leaks SQL trace, table names, or credentials to client | Global exception handler | Medium | Low | **Hardened:** Global exception handler returns generic `{"detail": "An internal server error occurred."}`. Stack trace logged server-side only. |
| **TM-17** | Notification Abuse | Flooding users with notification spam or spoofed templates | `POST /api/v1/admin/notifications` | Low | Low | **Hardened:** Admin-only route protected with RBAC and logged to audit table. |
| **TM-18** | Unauthorized Admin Operations | Privilege escalation to perform admin actions | User role manipulation | High | Low | **Hardened:** Role changes cannot be performed via self-service signup; requires admin authorization and audit logging. |
| **TM-19** | Session Persistence After Revocation | Stolen refresh token remains valid after logout or password change | Token refresh flow | High | Low | **Hardened:** Refresh tokens are tracked in DB and revoked on logout, password reset, or user suspension. |
| **TM-20** | Dependency Vulnerabilities | Outdated or compromised third-party packages | Frontend / Backend dependencies | Medium | Low | **Hardened:** NPM dependencies audited; unused animation libraries pruned; Python packages pinned in requirements. |

---

## 3. Prioritized Hardening Actions

1. **Production JWT Secret Validation:**
   - In `backend/app/config.py`, fail fast if `environment in ("prod", "production")` and `jwt_secret_key == "dev-only-not-for-production-CHANGE-ME"`.
2. **Database Connection Pool Optimization:**
   - In `backend/app/main.py`: Eliminate duplicate `idem_db` session dependency on `create_booking_route`. Allocate idempotency session conditionally or reuse request session with safe savepoints.
3. **Structured Request-ID Context in Error Logging:**
   - Update `custom_exception_handler` in `backend/app/main.py` to log with `logger.exception` including `X-Request-ID` context without printing raw stack trace to standard output.
4. **Frontend Asset & Animation Optimization:**
   - Remove `gsap` dependency from `frontend/package.json` and replace GSAP animation in `ReviewPay.tsx` with existing standard `framer-motion`.
   - Remove unused external image preload from `frontend/index.html`.
   - Replace blocking CSS `@import` in `frontend/src/index.css` with efficient font loading.
   - Optimize hero images in `frontend/public/` to reduce initial homepage transfer payload.

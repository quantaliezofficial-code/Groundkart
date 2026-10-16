# User Experiences & Test Coverage Audit Report

## 1. Customer Experience

### [P0] Customer Registration Completely Broken via UI Due to Schema Mismatch
- **Files**: `backend/app/schemas/auth.py` (L8), `frontend/src/lib/auth.tsx` (L56-66), `frontend/src/components/AuthModal.tsx` (L58)
- **Root Cause**: Backend `SignupRequest` requires `phone: str` (no default value). Frontend `useAuth().signup` drops `phone` (`authApi.signup(name, email, password)`). `JSON.stringify` omits `phone: undefined`, causing FastAPI to reject all signups with HTTP 422 Unprocessable Entity (`Field required: ['body', 'phone']`).
- **Remediation**: Update `signup` signature in `frontend/src/lib/auth.tsx` to accept `phone` and pass `phone` in `AuthModal.tsx`.

### [P1] Contextual Support Link from Booking/Venue Crashes with ReferenceError
- **Files**: `frontend/src/components/SupportTickets.tsx` (L122)
- **Root Cause**: In `CreateTicketView`, `<AlertTriangle size={16} />` is rendered when `defaultContext` is present, but `AlertTriangle` is not imported from `lucide-react`.
- **Impact**: Any customer clicking "Support" from a booking card crashes the application with `ReferenceError: AlertTriangle is not defined`.
- **Remediation**: Add `AlertTriangle` to the `lucide-react` import statement in `SupportTickets.tsx`.

### [P2] Inability for Customers to Cancel Pending Bookings
- **Files**: `backend/app/modules/booking/service.py` (L703)
- **Root Cause**: `cancel_booking_as_customer` rejects cancellations if status != `'confirmed'`. Customers who make mistakes during slot selection cannot cancel pending requests and must wait for hold timeouts.
- **Remediation**: Allow cancellation/abandonment of `pending_payment` bookings for customers.

### [P2] Guest Checkout Token Vulnerability
- **Files**: `frontend/src/components/ReviewPay.tsx` (L127-154)
- **Root Cause**: `manage_token` is only displayed on the success screen; no transactional email or SMS is dispatched. If the guest navigates away without copying, they permanently lose access to the booking.
- **Remediation**: Integrate background email/SMS notification dispatch for guest booking tokens.

### [P3] Review System Lacks Verification of Actual Attendance
- **Files**: `backend/app/main.py` (L1180-1206)
- **Root Cause**: `POST /api/v1/venues/{id}/reviews` permits any authenticated user to leave reviews without verifying completed booking history.
- **Remediation**: Require a completed booking at the venue to submit a review.

---

## 2. Owner Experience

### [P0] Listing Builder Wizard Blocked at Step 1 (Venue Creation Impossible)
- **Files**: `frontend/src/components/owner/listing-builder/ListingBuilder.tsx` (L47-58), `backend/app/schemas/catalog.py` (L33-48)
- **Root Cause**: Step 1 (`IdentityStep`) triggers `ownerApi.createVenue` before required fields (`category`, `address`, `city`, `unit_type`, `base_price`) are entered. FastAPI rejects the call with HTTP 422, triggering an alert that blocks owners from proceeding to Step 2.
- **Remediation**: Defer `createVenue` until Step 3 or submit draft with permissible defaults.

### [P1] Owner Calendar Blocks Are Never Rendered
- **Files**: `frontend/src/components/owner/calendar/OwnerCalendar.tsx` (L60-66), `backend/app/schemas/catalog.py` (L215-227)
- **Root Cause**: `OwnerCalendar` checks `block.start_date`, but backend schema `BlockResponse` defines `start_time: datetime`. `block.start_date` is always `undefined`, so maintenance blocks are never shown on the calendar.
- **Remediation**: Parse `start_time` date substring (`block.start_time.slice(0, 10)`).

### [P1] Missing Block Creation UI in Owner Calendar
- **Files**: `frontend/src/components/owner/calendar/OwnerCalendar.tsx`
- **Root Cause**: Backend supports block CRUD, but `OwnerCalendar` has no interactive controls for owners to create/edit blocks.
- **Remediation**: Implement a "Block Slot/Date" modal in `OwnerCalendar.tsx`.

### [P2] Identification Type Selection in Owner Onboarding is a No-Op
- **Files**: `frontend/src/components/OwnerLayout.tsx` (L168-178)
- **Root Cause**: `GroundSelect` has `onValueChange={() => {}}`, preventing owners from choosing identification types other than "National ID".
- **Remediation**: Wire `onValueChange={setIdentificationType}`.

### [P2] Dead Code in OwnerLayout
- **Files**: `frontend/src/components/OwnerLayout.tsx` (L439-584)
- **Root Cause**: An unused `CalendarsTab` is defined in `OwnerLayout.tsx` while line 329 renders `OwnerCalendar`.
- **Remediation**: Remove dead `CalendarsTab` code to reduce bundle size and prevent confusion.

### [P3] Payout Banking / Account Details Missing from Data Model
- **Files**: `backend/app/models/core.py`, `frontend/src/components/OwnerLayout.tsx` (L590)
- **Root Cause**: No IFSC, Account Number, or UPI ID is captured for venue owners; payouts are tracked by amount only.
- **Remediation**: Add banking/payout details table and capture form in Owner Account settings.

---

## 3. Admin Experience

### [P0] Analytics Tab Crashes Admin Dashboard with ReferenceError
- **Files**: `frontend/src/components/AdminLayout.tsx` (L208)
- **Root Cause**: `AnalyticsTab` is passed `overview={overview}` but `overview` is not defined in `AdminDashboard` (the hook returned `dashboard`).
- **Remediation**: Pass `overview={dashboard}` or alias `dashboard` to `overview`.

### [P0] Admin Notifications API Crashes Backend with NameError
- **Files**: `backend/app/main.py` (L1576)
- **Root Cause**: `GET /api/v1/admin/notifications` runs `select(Notification)` but `Notification` model is not imported in `app/main.py`.
- **Remediation**: Add `from app.models.core import Notification` to imports in `backend/app/main.py`.

### [P1] Missing Import for `ApproveOwnerVerificationRequest` in Owner Approval Route
- **Files**: `backend/app/main.py` (L662)
- **Root Cause**: `ApproveOwnerVerificationRequest` is typed in route signature without being imported or defined in schemas.
- **Remediation**: Define and import `ApproveOwnerVerificationRequest` schema in `app/schemas/owner_verification.py`.

### [P1] Orphaned Booking Operations: Reschedule and Dispute Actions Lack API Routes
- **Files**: `backend/app/modules/booking/service.py` (L947-1084)
- **Root Cause**: `request_booking_action` and `process_booking_action_request` are implemented in service layer but have no endpoints registered in `main.py`.
- **Remediation**: Register API routes in `main.py` and connect Admin Booking Ops UI.

---

## 4. Support Health & Privacy

### [P1] Owner Ticket List Leaks Customer Disputes & Hides Owner's Non-Venue Tickets
- **Files**: `backend/app/modules/support/service.py` (L196-215)
- **Root Cause**: `list_tickets_for_owner` queries only `SupportTicket.venue_id.in_(venue_ids_subq)`. If a customer files a confidential complaint mentioning a venue, the owner sees it. Conversely, if an owner files a general/billing ticket without linking a venue, the ticket is omitted from their list.
- **Remediation**: Update query to `or_(SupportTicket.creator_id == owner_id, SupportTicket.venue_id.in_(...))` and redact customer dispute tickets from owner view unless explicitly assigned.

### [P2] Unauthenticated Guests Cannot Access Support
- **Files**: `backend/app/main.py` (L1451-1485)
- **Root Cause**: Support ticket endpoints require user login; guest booking customers have no avenue to file support requests.
- **Remediation**: Add guest ticket submission endpoint authenticated by `manage_token`.

---

## 5. Testing & Test Coverage

### Backend Test Coverage Inventory (Post-Stabilization)
- **Status:** 315 passed / 0 failed / 0 errors across 41 test modules.
- **Key Modules Covered:**
  - `test_concurrency.py` (Double-booking lock & unique index)
  - `test_booking_retrieval.py` (GET bookings, guest tokens, PII leak protection)
  - `test_booking_cancellation.py` (Customer & guest cancellations, refund logic)
  - `test_hold_sweep.py` (Background expired hold sweep)
  - `test_refund_tiers.py` (Refund fraction math)
  - `test_grace_period.py` (Grace period calculation)
  - `test_rbac.py` (Owner flag booking RBAC)
  - `test_auth_flow.py` & `test_security.py` (Signup, login, refresh rotation, rate limiting, token safety)
  - `test_catalog.py` & `test_blocks.py` (CRUD, media uploads, inventory generation, maintenance blocks)
  - `test_owner_onboarding.py` & `test_owner_dashboard.py` (Verification submission, approval, owner analytics)
  - `test_payout_ledger.py` & `test_payout_split.py` (Ledger calculations, commission split, payout execution)
  - `test_support_tickets.py` (Creation, assignment, internal notes, isolation)
  - `test_notifications.py` & `test_reviews.py` (Delivery lifecycle, unread counts, review guards)
  - `test_admin_oversight.py`, `test_admin_lists.py`, `test_admin_bookings_payouts.py` (Suspension, reactivation, audit log search, dashboard metrics)
  - `test_idempotency.py` (Concurrent request deduplication, payload integrity, error tracking)
  - `test_analytics.py` (GMV reconciliation, date bound validations)
  - `test_observability.py` (X-Request-ID propagation, structured log context)

### Frontend Test Coverage Inventory (Post-Stabilization)
- **Status:** 30 passed / 0 failed across 6 test suites.
- **Covered Component Suites:**
  - `src/components/AuthModal.test.tsx` (5 tests — Form validation, login, registration, phone forwarding)
  - `src/components/VenueCard.test.tsx` (3 tests — Keyboard focus, accessibility, render states)
  - `src/components/MyBookings.test.tsx` (4 tests — Booking listing, status badges, cancel actions)
  - `src/App.test.tsx` (2 tests — Routing smoke test, core navigation)
  - `src/OwnerLayout.test.tsx` (4 tests — Owner dashboard role gating, session restore, navigation)
  - `src/AdminLayout.test.tsx` (12 tests — Admin role gating, overview figures, approval queue, user suspension, payment confirmation, payouts, user pagination, expired hold sweeps, booking lookup)
- **Build & Quality Gates:**
  - `npm run build` compiles Vite production bundle with 0 errors and 0 warnings.
  - `npm run lint` (`tsc --noEmit`) passes with 0 TypeScript compiler errors.

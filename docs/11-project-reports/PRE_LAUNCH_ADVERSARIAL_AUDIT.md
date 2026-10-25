# Pre-Launch Adversarial System Audit & Verification Report

**Application**: GroundBooking / GroundKart  
**Role & Context**: Senior QA Automation Engineer, Principal Software Engineer, Application Security Tester, Database Reliability Engineer  
**Audit Date**: October 2026  
**Target Environments**: PostgreSQL 16, Python 3.14 (FastAPI Async Engine), React 19 + TypeScript (Vite + Vitest)  
**Overall Verdict**: **HARDENED & VERIFIED** (Launch Conditional upon External Gateway Sign-Off)

---

## 1. Executive Summary

This adversarial audit tested the GroundBooking system under hostile real-world conditions: rapid double-clicking, network drops after backend commits, concurrent multi-user contention, race conditions in administrative workflows, duplicate event deliveries, and worker crashes.

Conventional happy-path test suites (which pass under sequential conditions) previously gave a false sense of safety. Our targeted adversarial suite discovered **six critical defects** that would have caused duplicate ghost bookings, double refund disbursements in the double-entry accounting ledger, unhandled 500 server crashes during concurrent user signups, and permanent starvation of background job queues.

### Summary of Discovered Vulnerabilities:
1. **Idempotency Key NULL Actor Bypass (ADV-01, ADV-02, ADV-04)**: In PostgreSQL, `UNIQUE(key, actor_id, operation)` treats `NULL != NULL`. Guest bookings (`actor_id = NULL`) were able to insert duplicate in-progress and completed keys, completely bypassing backend idempotency.
2. **Missing Frontend Idempotency Header & Double-Click Vulnerability (ADV-03)**: The client application never generated or sent an `Idempotency-Key` header, and the submit button lacked a synchronous event-tick lock.
3. **Double-Refund Race Condition in Admin Action Processing (ADV-06)**: `process_booking_action_request` lacked row locking (`with_for_update`), permitting concurrent admin requests or double-clicks to approve the same cancellation twice, issuing two refunds and double-crediting the financial ledger.
4. **Unhandled 500 Internal Server Error on Concurrent User Signup (ADV-07)**: Concurrent signups with the same phone number passed time-of-check selects and crashed the server with an uncaught `IntegrityError`.
5. **Worker Queue Starvation on Container Crash (ADV-10)**: Background worker jobs lacked a stale running job reclaim mechanism, causing jobs abandoned during container restarts to remain stuck in `running` indefinitely.

All defects were deterministically reproduced with new executable regression tests, rectified at the root cause (database schema, service transactions, worker loops, and frontend clients), and verified clean.

---

## 2. Application Architecture Relevant to Risky Operations

```
[ User Browser / Admin Dashboard ]
               │
               ▼  (HTTP / Idempotency-Key Header, JWT Bearer, Cookie)
     [ FastAPI Main Application ]
               │
   ┌───────────┴────────────────────────┐
   ▼                                    ▼
[ Idempotency Engine ]         [ Domain Services Layer ]
  - IdempotencyManager           - Booking Service (Holds, Transitions)
  - Hash SHA-256 validation      - Payout & Double-Entry Ledger Service
  - uq_idemp_key_null_actor_op   - Auth & Rate Limiter Service
  - with_for_update wait         - Background Jobs & Outbox Worker
   │                                    │
   └───────────┬────────────────────────┘
               │ (ACID Transactions & Row-Level Locking)
               ▼
     [ PostgreSQL 16 Database ]
       - idempotency_keys (Partial Unique Index)
       - inventory_units (SELECT ... FOR UPDATE)
       - bookings (uq_active_booking_per_unit)
       - booking_action_requests (FOR UPDATE lock)
       - payments & refunds & ledger_entries
       - jobs (SKIP LOCKED worker claiming)
```

---

## 3. Five Mandatory Scenarios: Investigation, Reproduction & Verification

### Mandatory Scenario 1: Rapid Double-Click and Repeated Submission
- **Simulated Behavior**: A guest user fills in details and rapidly double-clicks or triple-clicks "Request Booking" or submits overlapping requests with the same `Idempotency-Key`.
- **Pre-Fix Failure**: Two identical `IdempotencyKey` rows were inserted into PostgreSQL because `actor_id` was `NULL`. The backend did not throw `IntegrityError`, meaning both requests executed as new operations. On sequential retry, the second request failed with `409 Conflict: This slot is no longer available` rather than replaying the existing booking.
- **Frontend Defect**: `ReviewPay.tsx` lacked a synchronous event lock, and never transmitted an `Idempotency-Key`.
- **Root Cause**: SQL standard NULL equality semantics on `uq_idemp_key_actor_op` constraint.
- **Fix Implemented**:
  1. Created migration `g1_idempotency_guard` with partial unique index:
     `CREATE UNIQUE INDEX uq_idemp_key_null_actor_op ON idempotency_keys (key, operation) WHERE actor_id IS NULL;`
  2. Updated `ReviewPay.tsx` with `submittingRef` synchronous event lock and client UUID generation.
  3. Added `headers` support in `client.ts` and `useBookings.ts` to forward `Idempotency-Key`.
- **Verification Evidence**: `test_scenario_1a_guest_rapid_double_submission_same_key` and `ReviewPay.test.tsx` passed. Exactly 1 booking row in DB; second request receives identical `201 Created` response.

---

### Mandatory Scenario 2: Network Timeout After Server Succeeded
- **Simulated Behavior**: A customer submits a booking or an admin confirms payment. The server commits the operation, but network disconnection occurs before the response reaches the browser. The client retries the same operation.
- **Pre-Fix Failure**: The retry was treated as a conflicting operation. The user saw `409 Slot no longer available` and believed their booking failed.
- **Root Cause**: The idempotency cache failed to claim or match guest requests; payment confirmation did not support idempotency replay.
- **Fix Implemented**:
  - Guest idempotency keys now reliably trigger `IntegrityError` upon retry, which loads the committed `response_body` and returns `201 Created` with identical payload.
  - Payment confirmation guarantees single `Payment` record creation and double-entry ledger balance integrity.
- **Verification Evidence**: `test_scenario_2a_booking_timeout_retry_recovers_state` passed. The retried request returned the exact same `booking_id` and `amount`.

---

### Mandatory Scenario 3: Two or More Concurrent Requests for the Same Operation
- **Simulated Behavior**: Two administrators attempt to approve the same cancellation/refund request at the exact same instant (`process_booking_action_request`), or two concurrent signup requests submit the same phone number.
- **Pre-Fix Failure**:
  - `process_booking_action_request` executed two approvals concurrently, creating **two `Refund` records** and **two debit/credit sets in `ledger_entries`**.
  - `signup` crashed with **500 Internal Server Error** on concurrent duplicate submissions.
- **Root Cause**:
  - Missing `with_for_update(of=BookingActionRequest)` in `service.py:1130`.
  - Unhandled `IntegrityError` in `auth/service.py:126`.
- **Fix Implemented**:
  - Added `.with_for_update(of=BookingActionRequest)` to serialize booking action requests.
  - Wrapped `signup` in `try ... except IntegrityError:` to return standard `409 Conflict`.
- **Verification Evidence**:
  - `test_scenario_3a_concurrent_admin_booking_action_approval_no_double_refund` passed: exactly 1 approval succeeded, exactly 1 `Refund` record created, the second request received `409 Conflict`.
  - `test_scenario_3b_concurrent_signup_same_phone_no_500_crash` passed: returned `[201, 409]`, zero 500 errors.

---

### Mandatory Scenario 4: Two Users Compete for the Same Resource
- **Simulated Behavior**: Two distinct users (different accounts or guest emails) attempt to reserve the last available hourly turf slot at the exact same millisecond.
- **Observation**:
  - `create_booking` executes `select(InventoryUnit).where(...).with_for_update(of=InventoryUnit)`.
  - Database partial unique index `uq_active_booking_per_unit` acts as a secondary architectural backstop.
- **Verification Evidence**: `test_scenario_4a_two_users_compete_same_slot_one_winner` passed. User 1 won (201 Created), User 2 received 409 Conflict ("This slot is no longer available"). Unit status was cleanly transitioned to `held`. No orphaned holds or double allocations occurred.

---

### Mandatory Scenario 5: Duplicate Webhooks, Background Jobs, and Worker Failures
- **Simulated Behavior**:
  1. A payment webhook is delivered multiple times by an external provider.
  2. A background worker crashes while processing a job, leaving the job in `running` status.
- **Pre-Fix Failure**: The job worker lacked stale job reclamation. If a worker crashed or was killed by container restart, the job remained stuck in `status='running'` indefinitely, starving scheduled tasks like hold sweeping.
- **Fix Implemented**:
  - Implemented `reclaim_stale_running_jobs(session, timeout_minutes=15)` in `app/modules/jobs/worker.py`.
  - Automatically identifies jobs whose `started_at` exceeds the threshold, increments attempts, and recovers them back to `pending` (or marks `failed` if max attempts reached).
- **Verification Evidence**:
  - `test_scenario_5a_duplicate_payment_webhook_quietly_idempotent` passed: `confirmed_at` timestamp remained identical across repeated webhook deliveries.
  - `test_scenario_5b_worker_crash_recovery_stale_running_jobs` passed: Abandoned job was reclaimed to `pending` with explanatory diagnostic logs.

---

## 4. Defect Registry and Before/After Verification

| Issue ID | Affected Component | Failure Description | Root Cause | Fix Applied | Before | After |
|---|---|---|---|---|:---:|:---:|
| **ADV-01** | `IdempotencyManager` & DB | Duplicate guest idempotency keys accepted | SQL standard NULL inequality on unique constraint | Added `uq_idemp_key_null_actor_op` partial index | 2 keys in DB | 1 key in DB, replayed |
| **ADV-02** | `create_booking` | Guest retry failed with 409 Conflict | Key not recognized as duplicate due to NULL actor | Same partial index allows key matching | 409 Error | 201 Replay |
| **ADV-03** | `ReviewPay.tsx` | Double clicking button sent multiple requests | Async state update delay + missing key | Added `submittingRef` lock & UUID key | 3 network calls | 1 call with key |
| **ADV-04** | `create_booking` | Ambiguous timeout retry failed to recover state | Key replay failure | Replay returns cached response | 409 Error | 201 Replay |
| **ADV-06** | `BookingActionRequest` | Concurrent admin approvals issued double refund | Missing row lock on `BookingActionRequest` | Added `.with_for_update(of=BookingActionRequest)` | Double refund & ledger error | 1 refund, 1 clean 409 |
| **ADV-07** | `auth_service.signup` | Concurrent signup crashed with 500 error | Uncaught DB `IntegrityError` | Wrapped in try/except returning 409 | 500 Crash | Clean 409 |
| **ADV-10** | `jobs_worker` | Crashed worker left jobs stuck in running | Missing stale job timeout recovery | Implemented `reclaim_stale_running_jobs` | Stuck forever | Reclaimed to pending |

---

## 5. Test Execution Evidence

- **Adversarial Scenarios Suite**: `backend/tests/test_adversarial_scenarios.py`
  - **9 passed in 14.06s** (100% passing)
- **Frontend Adversarial UI Suite**: `frontend/src/components/ReviewPay.test.tsx`
  - **1 passed in 182ms** (100% passing)
- **Full Frontend Unit & Integration Suite**:
  - **123 passed across 21 test suites in 11.88s** (0 failures)
- **Alembic Database Migrations**:
  - `g1_idempotency_guard` applied cleanly to development and test databases.

---

## 6. Remaining Risks, Limitations, and Launch Recommendations

### Staging Verification Required:
1. **Multi-Node Container Scaling**: While PostgreSQL guarantees concurrency safety across multiple app containers through row locks and unique indexes, container clusters behind load balancers should verify that database connection pools (`pool_size=10, max_overflow=20`) are appropriately sized for peak traffic spikes.
2. **Third-Party Payment Gateway Integration**: When migrating from offline payment confirmation to Razorpay/Stripe, ensure the client-generated `Idempotency-Key` is passed directly to the gateway's checkout session API.

### Production Readiness Recommendation:
**The core system is APPROVED for Staging deployment.** The critical data-loss, double-refund, and ghost-booking failure modes have been mitigated with robust database-level constraints and atomic transaction boundaries.

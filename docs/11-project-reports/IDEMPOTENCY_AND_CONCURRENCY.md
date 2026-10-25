# GroundBooking Idempotency and Concurrency Specification

## 1. Logical Operations Being Protected

In GroundBooking, high-consequence operations must guarantee exactly-once business effects even when clients retry, network requests drop, or multiple users act simultaneously:

1. **Booking Reservation & Inventory Hold (`POST /api/v1/bookings`)**:
   - Holding a slot transfers `inventory_units.status` from `available` to `held`.
   - Creates a `bookings` record in `pending_payment` status.
   - Calculates pricing snapshot and outbox event (`booking_created`).
   - Non-repeatable effect: Multiple clicks or retries must never create two booking rows or lock multiple slots.
2. **Payment Confirmation (`POST /api/v1/admin/bookings/{id}/confirm-payment`)**:
   - Marks booking as `confirmed`, inventory unit as `booked`.
   - Creates a financial record in `payments`.
   - Dispatches entries to the double-entry accounting ledger (`ledger_entries`).
   - Non-repeatable effect: Under no circumstance may money be marked received twice or duplicate `Payment` rows be created.
3. **Booking Cancellation, Rescheduling, and Refund Processing (`process_booking_action_request`)**:
   - Transitions `BookingActionRequest` from `pending` to `approved` or `rejected`.
   - Re-releases inventory unit to `available` (if cancel) or transfers to new slot (if reschedule).
   - Issues a `Refund` record and dispatches reverse debit/credit entries to `ledger_entries`.
   - Non-repeatable effect: Double disbursement / duplicate refund records must be strictly prevented.
4. **User Registration (`POST /api/v1/auth/signup`)**:
   - Creates a user record with unique phone and unique email.
   - Non-repeatable effect: Concurrent identical requests must resolve cleanly to 409 Conflict rather than throwing unhandled 500 DB errors.

---

## 2. Idempotency-Key Lifecycle

### 2.1 Client-Side Generation & Stability
- In the browser client (`frontend/src/components/ReviewPay.tsx`), a stable idempotency key is generated when the user opens the review page for a specific slot:
  ```ts
  const idempotencyKeyRef = React.useRef<string>(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  ```
- **Stability guarantee**: When a user clicks "Request Booking", the key remains constant across re-renders and retries for that logical booking attempt. If the network drops or times out, retrying the operation transmits the **same** key.
- **Button lock**: Synchronous in-memory ref (`submittingRef`) plus React state (`isProcessing`) disables the button immediately on the first click, preventing double-event dispatch in the same event tick.
- **Header transmission**: The key is attached to the HTTP request as the standard `Idempotency-Key: <uuid>` header.

### 2.2 Backend Ingestion & Atomic Claiming
- `get_idem_db` in `app/db.py` inspects the request headers:
  - If `Idempotency-Key` is present, it provisions an isolated database session.
  - If absent, it yields `None` (falling back to lightweight execution without holding an extra DB session).
- `IdempotencyManager` calculates the request hash:
  ```python
  payload_bytes = payload.model_dump_json().encode("utf-8") # or canonical sorted JSON
  payload_hash = hashlib.sha256(payload_bytes).hexdigest()
  ```
- `IdempotencyManager._claim()` executes an atomic insert into the `idempotency_keys` table:
  - Default status: `in_progress`.
  - Retention window: `now() + 7 days`.
- **Handling Race Conditions (`IntegrityError`)**:
  - If a key with the same `(key, actor_id, operation)` already exists, the database raises an `IntegrityError`.
  - The second transaction rolls back the failed insert and executes:
    ```sql
    SELECT * FROM idempotency_keys
    WHERE key = :key AND operation = :operation AND actor_id IS :actor_id
    FOR UPDATE;
    ```
  - **Critical Concurrency Property**: Transaction 2 waits on the row lock until Transaction 1 completes (`status='completed'`) and commits.
  - Once unblocked, Transaction 2 inspects `existing_key`:
    - If `request_hash != payload_hash`: Raises `422 Unprocessable Entity` ("Idempotency key replayed with different payload").
    - If `status == 'completed'`: Sets `is_replaying = True` and returns the cached `response_body` with original HTTP status code (e.g. 201).
    - If `status == 'in_progress'`: Raises `409 Conflict` ("Concurrent request in progress").

---

## 3. Database Enforcement & The NULL Actor Bug Fix

### 3.1 The Vulnerability
Originally, the `idempotency_keys` table had a single table-level unique constraint:
```python
UniqueConstraint("key", "actor_id", "operation", name="uq_idemp_key_actor_op")
```
Under SQL standard and PostgreSQL, **NULL is not equal to NULL**.
For guest checkouts (where `actor_id` is `None`), multiple rows with:
`('idem-key-1', NULL, 'create_booking')`
could be inserted concurrently without violating the constraint!
As a result:
- Concurrent guest requests bypassed the `IntegrityError` catch block.
- Both requests treated the key as brand new, executing the booking engine twice.
- Sequential retries created new keys rather than replaying the first result.

### 3.2 The Architectural Fix
We created Alembic migration `g1_idempotency_guard` which introduces a dedicated PostgreSQL partial unique index:
```sql
CREATE UNIQUE INDEX uq_idemp_key_null_actor_op
ON idempotency_keys (key, operation)
WHERE actor_id IS NULL;
```
This guarantees strict uniqueness for both:
1. Authenticated users: `uq_idemp_key_actor_op` enforces uniqueness per user ID.
2. Guest users: `uq_idemp_key_null_actor_op` enforces uniqueness across the entire platform when `actor_id IS NULL`.

---

## 4. Transaction Boundaries & Concurrency Controls

| Operation | Isolation / Concurrency Primitive | Purpose |
|---|---|---|
| `create_booking` | `SELECT ... FOR UPDATE` on `InventoryUnit` + partial unique index `uq_active_booking_per_unit` | Prevents double-booking the same unit under multi-user concurrency. |
| `confirm_booking_by_admin` | `SELECT ... FOR UPDATE of Booking` | Ensures booking status is strictly `pending_payment` before creating payment and ledger rows. |
| `process_booking_action_request` | `SELECT ... FOR UPDATE of BookingActionRequest` | Serializes admin approval/rejection. Prevents duplicate `Refund` records and double ledger disbursement. |
| `run_payout` | `SELECT ... FOR UPDATE of Payment` | Locks all eligible payments in period, updates `payment.payout_id`, preventing payments from being settled twice. |
| `process_one_job` | `SELECT ... FOR UPDATE SKIP LOCKED` | Allows multiple distributed worker processes to claim distinct pending background tasks without colliding. |

---

## 5. Webhook and Asynchronous Processing

### 5.1 Payment Webhooks (`confirm_booking_from_webhook`)
- While offline payment is the active production path, the dormant Razorpay webhook handler enforces quiet idempotency:
  ```python
  if booking.status == "confirmed":
      return booking
  ```
- If a payment provider replays a webhook event:
  - If the booking is already confirmed, the handler quietly acknowledges the delivery without modifying `confirmed_at` or creating duplicate audit events.

### 5.2 Background Jobs & Crash Recovery
- Workers process jobs using transactional claiming (`SKIP LOCKED`).
- **Crash Recovery**: If a worker process abruptly dies while running a job:
  - `reclaim_stale_running_jobs(session, timeout_minutes=15)` scans for jobs stuck in `running` status where `started_at` is older than the timeout threshold.
  - Automatically resets the job to `pending` (if `attempts < max_attempts`) or marks it `failed`.
  - Guarantees background queues (e.g. hold sweeps) cannot be permanently deadlocked by container restarts.

---

## 6. Remaining Limitations & Edge Cases

1. **Distributed Memory vs. Database**:
   - All idempotency keys and locks are persisted in PostgreSQL. They are completely safe across multiple application container instances sharing the database.
   - However, during database failover or split-brain network partitions, multi-region distributed active-active replication would require external distributed consensus (e.g. Spanner or Raft-backed key lease).
2. **Key Retention Expiry**:
   - Idempotency keys expire after 7 days (`idempotency_retention_days`).
   - A request presented after 7 days will treat the key as expired (raising 409 requesting fresh client submission).
3. **Third-Party Payment Gateways**:
   - Currently, payment collection is confirmed offline via admin reconciliation. When integrating external online payment gateways (Razorpay, Stripe), the client-generated idempotency key must also be forwarded as the gateway's `Idempotency-Key` or `order_id` to guarantee gateway-side deduplication.

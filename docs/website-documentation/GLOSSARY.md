# GroundKart / GroundBooking — Domain & Technical Glossary

This glossary defines domain models, architectural patterns, and business terminology used throughout GroundKart.

---

### A
- **Account (Ledger):** A named financial bucket within GroundKart's double-entry accounting engine (`customer_funds_held`, `owner_payable`, `platform_commission_revenue`, `platform_cash`).
- **Admin Layout (`AdminLayout`):** The 12-tab administrative command center used by platform operators to govern listings, verify owners, confirm payments, disburse payouts, and handle support.
- **Argon2id:** The modern password-hashing algorithm used by GroundKart to securely hash and verify user passwords, providing strong resistance to GPU cracking and side-channel attacks.
- **Audit Log (`AuditLog`):** An append-only relational table capturing an immutable record of sensitive operational events (who, what, when, IP address, and JSON payload).

### B
- **Block (`Block`):** A scheduled time interval during which a venue or specific slot is taken offline by an owner or admin for maintenance, renovations, or private offline events.
- **Booking (`Booking`):** A customer reservation record representing the contract to use a specific `InventoryUnit` at a defined price and time.
- **Booking Action Request (`BookingActionRequest`):** A formal administrative request submitted by a customer or owner to cancel or reschedule a confirmed booking that requires manual review.
- **Booking Event (`BookingEvent`):** An immutable timeline entry recording state transitions, payments, cancellations, or disputes associated with a booking.

### C
- **Cancellation Policy:** Business rules that determine customer refund percentages based on proximity to the event start time (100% for 48h+, 50% for 24-48h, 0% for under 24h).
- **Category:** The high-level market sector of a venue (`sports`, `banquet_hall`, `corporate`, `farmhouse`).
- **Content Block (`VenueContentBlock`):** A modular, configurable content section on the venue detail page (e.g., Highlights, FAQs, Venue Story, Rules, Things to Know, Suitable For).
- **Correlation ID (`X-Request-ID`):** A unique UUID attached to an HTTP request and propagated through logging `contextvars` to trace operations across components.

### D
- **Double-Entry Bookkeeping:** A financial accounting method where every monetary movement produces balanced debit and credit entries, guaranteeing that `SUM(debits) == SUM(credits)`.

### G
- **GMV (Gross Merchandise Value):** The total cumulative monetary value of bookings transacted on the platform before deducting discounts, refunds, or platform commissions.
- **Grace Period (`grace_period_ends_at`):** A defined window following booking confirmation during which a customer can cancel with zero penalty or inspect facilities.

### H
- **Hold (Inventory Hold):** A temporary, 10-minute reservation placed on an `InventoryUnit` during checkout (`status = 'held'`) backed by database row-level locking to prevent double-booking.
- **Hold Sweep (`sweep_expired_holds`):** A periodic background process that identifies unconfirmed holds exceeding 10 minutes, returns slots to `available`, and marks bookings `expired`.

### I
- **Idempotency Key (`IdempotencyKey`):** A unique client-supplied token that ensures payment or booking operations cannot be executed more than once if network retries occur.
- **Inventory Unit (`InventoryUnit`):** The atomic bookable commodity in GroundKart representing a discrete date, time interval, and unit type at a specific venue.

### J
- **Job (`Job`):** A database-backed asynchronous task record scheduled for background execution by the worker loop using PostgreSQL `SKIP LOCKED`.

### K
- **KYC (Know Your Customer):** Identity verification workflow (`OwnerVerification`) requiring venue owners to submit government-issued identification or business registration documents before publishing listings.

### M
- **Manage Token (`manage_token`):** A cryptographically random URL-safe token that permits guest customers to view, manage, and cancel their reservations without creating a password-protected user account.
- **Manage Token Hash (`manage_token_hash`):** The SHA-256 digest of the raw manage token stored in the database to prevent token exposure in database dumps.

### O
- **Outbox Pattern (`OutboxEvent`):** An architectural pattern where domain events are committed within the same database transaction as business data, ensuring events are never dispatched if the transaction rolls back.
- **Owner Layout (`OwnerLayout`):** The venue management dashboard used by verified property owners to manage listings, inspect calendars, adjust pricing, and review earnings.

### P
- **Payout (`Payout`):** A monetary disbursement transferring net booking revenue from GroundKart escrow (`owner_payable`) to an owner's verified bank account.
- **Pessimistic Locking (`SELECT ... FOR UPDATE`):** A concurrency control mechanism where database rows are locked at the start of a transaction, blocking concurrent transactions from modifying the same slot until committed.
- **Pricing Rule (`PricingRule`):** A dynamic pricing policy configured by venue owners (e.g., weekend surge multipliers, peak evening rate adjustments).
- **Purpose (`VenuePurpose`):** An event suitability tag attached to a venue (e.g., "Cricket Tournament", "Wedding Reception", "Corporate Offsite") that can govern custom guest caps and pricing.

### R
- **RBAC (Role-Based Access Control):** Authorization system enforcing distinct operational boundaries for `customer`, `owner`, and `admin` roles.
- **Refund (`Refund`):** A record tracking funds returned to a customer following a booking cancellation, detailing the calculated refund tier and amount.
- **Rental Option (`VenueRentalOption`):** A specific rental configuration offered by a venue (e.g., Entire Ground, Court 1, Lawn Area).

### S
- **SKIP LOCKED:** A PostgreSQL concurrency feature (`SELECT ... FOR UPDATE SKIP LOCKED`) allowing worker threads to claim unlocked task rows without stalling on rows locked by concurrent processes.
- **Support Ticket (`SupportTicket`):** A customer service ticket facilitating two-way threaded communication between customers, owners, and platform administrators.

### T
- **Ticket Event (`TicketEvent`):** An append-only historical log entry capturing comments, status transitions, staff assignments, or internal notes on a support ticket.

### U
- **Unit Type (`UnitType`):** The temporal duration metric of an inventory unit: `hourly`, `half_day`, `full_day`, or `multi_day`.
- **User (`User`):** A registered platform account entity associated with a role (`customer`, `owner`, or `admin`).

### V
- **Venue (`Venue`):** A registered physical property or facility listed on GroundKart.
- **Venue Workspace (`VenueWorkspace`):** An operational management interface where owners can pause, edit, block, or configure an existing venue without re-entering the listing wizard.

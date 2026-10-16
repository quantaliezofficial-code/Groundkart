# Support Tickets Module

## Architecture
The Support Tickets module is built natively within GroundBooking, reusing the existing FastAPI backend, PostgreSQL, and SQLAlchemy infrastructure.
It includes a dedicated service layer (`backend/app/modules/support/service.py`) and a state machine for lifecycle transitions (`backend/app/modules/support/domain.py`).

## Schema
- **support_tickets**: Stores ticket metadata, references to creator, assignee, venue, and booking. Fields include subject, description, status, category, and priority.
- **ticket_events**: Captures a formal event history of ticket lifecycle changes, comments, and assignments, ensuring transparency and accountability.

## Lifecycle
Tickets follow a strict state machine defined in `ALLOWED_TICKET_TRANSITIONS`:
- `open` -> `in_review` or `closed`
- `in_review` -> `waiting_customer`, `resolved`, or `closed`
- `waiting_customer` -> `in_review` or `closed`
- `resolved` -> `closed`
- `closed` is terminal.

## API Endpoints
### Customer / Owner
- `POST /api/v1/support/tickets`: Create a ticket.
- `GET /api/v1/support/tickets`: List own tickets (or tickets for owned venues).
- `GET /api/v1/support/tickets/{id}`: View a ticket.
- `POST /api/v1/support/tickets/{id}/comments`: Reply to a ticket.

### Admin
- `GET /api/v1/admin/support/tickets`: View all tickets with filtering (status, category, assignee).
- `PATCH /api/v1/admin/support/tickets/{id}`: Update ticket status, priority, or assignee.
- `POST /api/v1/support/tickets/{id}/comments`: Reply to a ticket (supports internal notes).

## Permissions
- **Customers** can only view and interact with their own tickets.
- **Owners** can view tickets associated with their venues.
- **Admins** have full visibility and the ability to change status, assign priority, and add internal notes.
- **Internal notes** are strictly hidden from customers and owners.

## Notifications
The module integrates seamlessly with the existing notification service:
- Admin notified on ticket creation.
- Creator notified on status changes or admin replies.

## Audit Events
Sensitive actions (creation, status update, priority change, assignment) produce immutable audit logs via `AuditLog` to track who did what. The `TicketEvent` table complements this with domain-specific history.

## Test Coverage
Comprehensive coverage in `tests/test_support_tickets.py` (27 test cases):
- Lifecycle constraints
- Role-based visibility and access control
- Booking and dispute linkage
- Notification dispatch
- Audit log creation
- General ticket operations (assignment, priority changes)

## Future Extension Points
- SLA Tracking (`first_response_at`, `resolution_due_at`)
- Attachments handling
- External integrations (Email/WhatsApp ingestion)
- Admin Dashboard Metrics (Aggregated views)

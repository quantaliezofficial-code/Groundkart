# GroundBooking Lifecycle and Action Requests

## Booking Lifecycle States

The booking state machine ensures valid transitions between states. Below is the flow of states:

1. **`draft`**: Booking initiated but not submitted.
2. **`requested`**: Submitted by customer, pending any necessary reviews.
3. **`under_admin_review`**: Held for manual review by platform admin.
4. **`pending_payment`**: Approved/Valid, waiting for customer payment.
5. **`confirmed`**: Payment received, booking is confirmed.
6. **`upcoming`**: Automated state indicating the booking date is near.
7. **`in_progress`**: Automated state indicating the booking time has started.
8. **`completed`**: Automated state indicating the booking time has ended.
9. **`disputed`**: Flagged due to user or owner dispute.
10. **`suspended`**: Halted by platform admin.
11. **`cancelled`**: Booking cancelled before completion.
12. **`expired`**: Booking expired (e.g. payment not received in time).
13. **`refunded`**: Fully or partially refunded.
14. **`rejected`**: Rejected by platform admin or owner.

### State Transitions

Transitions between these states are strictly enforced by the centralized state machine (`transition_booking_status` in `app/modules/booking/domain.py`). Attempting invalid transitions raises a 409 Conflict.

## Booking Action Requests

To handle complex state changes that require admin approval, we use the `BookingActionRequest` model.

### Process

1. **Request**: A user (customer, owner, or guest) submits a request to `cancel` or `reschedule` a confirmed booking.
2. **Pending**: The request is recorded in the `booking_action_requests` table with status `pending`. A `BookingEvent` is created for traceability.
3. **Admin Review**: A platform admin reviews the request. They can use the `/admin/booking-actions` endpoints to see pending requests and assess refund impacts.
4. **Decision**: The admin decides to `approve` or `reject` the request.
   - If **approved**, the system automatically applies the requested changes (e.g., cancelling the booking, freeing the inventory unit, and initiating refunds based on the platform's configuration).
   - If **rejected**, the booking remains unchanged.
5. **Event Logging**: The decision is logged in `BookingEvent`.

### Refund Tiers for Customer Cancellation

When an admin approves a customer's cancellation request, the refund fraction is calculated based on proximity to the event start time:
- **Full Refund**: Cancellation request >= `cancellation_full_refund_hours`.
- **Partial Refund**: Cancellation request >= `cancellation_partial_refund_hours`.
- **No Refund**: Any time closer to the event start.

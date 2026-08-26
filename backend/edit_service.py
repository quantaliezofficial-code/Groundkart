import os
import sys

file_path = "app/modules/booking/service.py"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add import
if "transition_booking_status" not in content:
    content = content.replace(
        "from app.models.core import AuditLog, Booking, InventoryUnit, Payment, User, Venue",
        "from app.models.core import AuditLog, Booking, InventoryUnit, Payment, User, Venue\nfrom app.modules.booking.domain import transition_booking_status"
    )

# 2. _apply_payment_confirmation
content = content.replace(
    'booking.status = "confirmed"',
    'transition_booking_status(booking, "confirmed")'
)

# 3. cancel_pending_booking
old_cancel_pending = """        if actor_id is None:
            booking.status = "cancelled"
        else:
            booking.status = "cancelled" """
new_cancel_pending = """        if actor_id is None:
            transition_booking_status(booking, "expired")
        else:
            transition_booking_status(booking, "cancelled")"""
content = content.replace(old_cancel_pending, new_cancel_pending)

# 4. _apply_customer_cancellation
old_customer_cancel = """    booking.status = "cancelled"
    booking.cancellation_reason = reason
    booking.cancelled_at = now
    booking.inventory_unit.status = "available"
    booking.inventory_unit.hold_expires_at = None

    total_refund = Decimal("0.00")
    for payment in booking.payments:
        if payment.status == "success":
            refund = (payment.amount * fraction).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            payment.status = "refunded"
            payment.refund_amount = refund
            total_refund += refund

    booking.status = "refunded"  # always — see docstring"""

new_customer_cancel = """    transition_booking_status(booking, "cancelled")
    booking.cancellation_reason = reason
    booking.cancelled_at = now
    booking.inventory_unit.status = "available"
    booking.inventory_unit.hold_expires_at = None

    total_refund = Decimal("0.00")
    for payment in booking.payments:
        if payment.status == "success":
            refund = (payment.amount * fraction).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            payment.status = "refunded"
            payment.refund_amount = refund
            total_refund += refund

    transition_booking_status(booking, "refunded")  # always — see docstring"""
content = content.replace(old_customer_cancel, new_customer_cancel)

# 5. flag_booking
old_flag_booking = """        booking.status = "cancelled"
        booking.owner_flagged_at = now
        booking.cancellation_reason = reason
        booking.inventory_unit.status = "available"
        booking.inventory_unit.hold_expires_at = None

        total_refund = Decimal("0.00")
        for payment in booking.payments:
            if payment.status == "success":
                payment.status = "refunded"
                payment.refund_amount = payment.amount
                total_refund += payment.amount

        booking.status = "refunded"  # completes the transition — see docstring"""

new_flag_booking = """        transition_booking_status(booking, "cancelled")
        booking.owner_flagged_at = now
        booking.cancellation_reason = reason
        booking.inventory_unit.status = "available"
        booking.inventory_unit.hold_expires_at = None

        total_refund = Decimal("0.00")
        for payment in booking.payments:
            if payment.status == "success":
                payment.status = "refunded"
                payment.refund_amount = payment.amount
                total_refund += payment.amount

        transition_booking_status(booking, "refunded")  # completes the transition — see docstring"""
content = content.replace(old_flag_booking, new_flag_booking)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Done editing service.py")

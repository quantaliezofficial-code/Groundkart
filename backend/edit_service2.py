import os
import sys
import re

file_path = "app/modules/booking/service.py"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

if "transition_booking_status" not in content:
    content = content.replace(
        "from app.models.core import AuditLog, Booking, InventoryUnit, Payment, User, Venue",
        "from app.models.core import AuditLog, Booking, InventoryUnit, Payment, User, Venue\nfrom app.modules.booking.domain import transition_booking_status"
    )

content = re.sub(
    r'(\s+)if actor_id is None:\s+booking\.status = "cancelled"\s+else:\s+booking\.status = "cancelled"',
    r'\1if actor_id is None:\1    transition_booking_status(booking, "expired")\1else:\1    transition_booking_status(booking, "cancelled")',
    content
)

content = re.sub(
    r'(\s+)booking\.status = "cancelled"\n(\s+booking\.owner_flagged_at = now)',
    r'\1transition_booking_status(booking, "cancelled")\n\2',
    content
)

content = re.sub(
    r'(\s+)booking\.status = "refunded"  # completes the transition',
    r'\1transition_booking_status(booking, "refunded")  # completes the transition',
    content
)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Done editing service.py")

-- GroundKart System Invariant Audit Script
-- Verifies core financial, inventory, and lifecycle invariants.
-- Any returned rows indicate an invariant violation.

-- Invariant 1: No inventory unit has more than one booking in 'pending_payment' or 'confirmed'
SELECT 
    'INV-1: Multiple active bookings per unit' AS violation_type,
    inventory_unit_id::text AS entity_id,
    COUNT(*)::text AS detail
FROM bookings
WHERE status IN ('pending_payment', 'confirmed')
GROUP BY inventory_unit_id
HAVING COUNT(*) > 1

UNION ALL

-- Invariant 2a: Every 'confirmed' booking has exactly one successful payment
SELECT 
    'INV-2a: Confirmed booking without exactly 1 successful payment' AS violation_type,
    b.id::text AS entity_id,
    COALESCE(COUNT(p.id), 0)::text AS detail
FROM bookings b
LEFT JOIN payments p ON b.id = p.booking_id AND p.status = 'success'
WHERE b.status = 'confirmed'
GROUP BY b.id
HAVING COUNT(p.id) != 1

UNION ALL

-- Invariant 2b: Every successful payment belongs to an active, completed, or settled booking
SELECT 
    'INV-2b: Successful payment on invalid booking status' AS violation_type,
    p.id::text AS entity_id,
    ('booking_status=' || b.status) AS detail
FROM payments p
JOIN bookings b ON p.booking_id = b.id
WHERE p.status = 'success' AND b.status NOT IN ('confirmed', 'upcoming', 'in_progress', 'completed', 'refunded', 'cancelled', 'under_admin_review', 'disputed')

UNION ALL

-- Invariant 3a: Refund amount on payment exceeds total payment amount
SELECT 
    'INV-3a: Payment refund_amount exceeds amount' AS violation_type,
    p.id::text AS entity_id,
    ('refund_amount=' || COALESCE(p.refund_amount::text, 'null') || ' > amount=' || p.amount::text) AS detail
FROM payments p
WHERE p.refund_amount IS NOT NULL AND p.refund_amount > p.amount

UNION ALL

-- Invariant 3b: Total processed refunds for a payment exceed payment amount
SELECT 
    'INV-3b: Total refunds exceed payment amount' AS violation_type,
    p.id::text AS entity_id,
    ('total_refunded=' || SUM(r.amount)::text || ' > paid=' || p.amount::text) AS detail
FROM refunds r
JOIN payments p ON r.payment_id = p.id
WHERE r.status = 'processed'
GROUP BY p.id, p.amount
HAVING SUM(r.amount) > p.amount

UNION ALL

-- Invariant 4a: A unit with status 'booked' must have exactly one confirmed or completed booking
SELECT 
    'INV-4a: Booked unit without exactly 1 confirmed/completed booking' AS violation_type,
    u.id::text AS entity_id,
    COALESCE(COUNT(b.id), 0)::text AS detail
FROM inventory_units u
LEFT JOIN bookings b ON u.id = b.inventory_unit_id AND b.status IN ('confirmed', 'completed')
WHERE u.status = 'booked'
GROUP BY u.id
HAVING COUNT(b.id) != 1

UNION ALL

-- Invariant 4b: A unit with status 'held' must have exactly one pending_payment booking
SELECT 
    'INV-4b: Held unit without exactly 1 pending_payment booking' AS violation_type,
    u.id::text AS entity_id,
    COALESCE(COUNT(b.id), 0)::text AS detail
FROM inventory_units u
LEFT JOIN bookings b ON u.id = b.inventory_unit_id AND b.status = 'pending_payment'
WHERE u.status = 'held'
GROUP BY u.id
HAVING COUNT(b.id) != 1

UNION ALL

-- Invariant 4c: Available unit must not have an active booking
SELECT 
    'INV-4c: Available unit has active booking' AS violation_type,
    u.id::text AS entity_id,
    ('booking_id=' || b.id::text || ' status=' || b.status) AS detail
FROM inventory_units u
JOIN bookings b ON u.id = b.inventory_unit_id
WHERE u.status = 'available' AND b.status IN ('pending_payment', 'confirmed')

UNION ALL

-- Invariant 5a: Payout split reconciliation: commission + net must equal gross
SELECT 
    'INV-5a: Payout split does not reconcile' AS violation_type,
    p.id::text AS entity_id,
    ('gross=' || p.gross_amount::text || ' != comm+net=' || (p.commission_amount + p.net_amount)::text) AS detail
FROM payouts p
WHERE (p.commission_amount + p.net_amount) != p.gross_amount

UNION ALL

-- Invariant 5b: Payout gross matches sum of retained payment amounts
SELECT 
    'INV-5b: Payout gross does not match member payments' AS violation_type,
    p.id::text AS entity_id,
    ('payout_gross=' || p.gross_amount::text || ' != sum_retained=' || COALESCE(SUM(pmt.amount - COALESCE(pmt.refund_amount, 0)), 0)::text) AS detail
FROM payouts p
LEFT JOIN payments pmt ON pmt.payout_id = p.id
GROUP BY p.id, p.gross_amount
HAVING p.gross_amount != COALESCE(SUM(pmt.amount - COALESCE(pmt.refund_amount, 0)), 0)

UNION ALL

-- Invariant 6: No duplicate inventory units for the same venue, date and time window (including NULL times)
SELECT 
    'INV-6: Duplicate inventory unit for same slot' AS violation_type,
    venue_id::text AS entity_id,
    ('date=' || date::text || ' count=' || COUNT(*)::text) AS detail
FROM inventory_units
GROUP BY venue_id, date, COALESCE(start_time, '00:00:00'::time), COALESCE(end_time, '23:59:59'::time)
HAVING COUNT(*) > 1;

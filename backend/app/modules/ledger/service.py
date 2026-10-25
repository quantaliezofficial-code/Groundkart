"""
Ledger Service - Double-Entry Bookkeeping & Reconciliation
Enforces double-entry accounting invariants across all monetary events:
- Payment confirmations
- Refunds & disputes
- Payout disbursements
Every transaction creates balanced debit and credit entries with an immutable audit trail.
"""
from decimal import Decimal, ROUND_HALF_UP
import uuid
from typing import Any
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.core import LedgerEntry, Payment, Booking, Payout, Refund, AuditLog


class Account:
    CUSTOMER_FUNDS_HELD = "customer_funds_held"
    OWNER_PAYABLE = "owner_payable"
    PLATFORM_COMMISSION_REVENUE = "platform_commission_revenue"
    PLATFORM_CASH = "platform_cash"


class EntryType:
    BOOKING_PAYMENT = "booking_payment"
    REFUND = "refund"
    PAYOUT_DISBURSEMENT = "payout_disbursement"


async def record_payment_confirmation(
    session: AsyncSession,
    payment: Payment,
    booking: Booking,
    admin_id: uuid.UUID | None = None,
) -> uuid.UUID:
    """
    Emits balanced double-entry ledger records on payment confirmation:
    - Debit: customer_funds_held (gross amount)
    - Credit: owner_payable (gross - commission)
    - Credit: platform_commission_revenue (commission)
    Total Debits == Total Credits.
    """
    tx_id = uuid.uuid4()
    gross = payment.amount
    comm = payment.commission_amount if payment.commission_amount is not None else Decimal("0.00")
    owner_net = gross - comm

    entries = [
        LedgerEntry(
            transaction_id=tx_id,
            entry_type=EntryType.BOOKING_PAYMENT,
            account=Account.CUSTOMER_FUNDS_HELD,
            direction="debit",
            amount=gross,
            currency=payment.currency,
            booking_id=booking.id,
            payment_id=payment.id,
            actor_id=admin_id,
            description=f"Received payment for booking {booking.id} (slot {booking.venue_name})",
        ),
        LedgerEntry(
            transaction_id=tx_id,
            entry_type=EntryType.BOOKING_PAYMENT,
            account=Account.OWNER_PAYABLE,
            direction="credit",
            amount=owner_net,
            currency=payment.currency,
            booking_id=booking.id,
            payment_id=payment.id,
            actor_id=admin_id,
            description=f"Payable to venue owner for booking {booking.id}",
        ),
        LedgerEntry(
            transaction_id=tx_id,
            entry_type=EntryType.BOOKING_PAYMENT,
            account=Account.PLATFORM_COMMISSION_REVENUE,
            direction="credit",
            amount=comm,
            currency=payment.currency,
            booking_id=booking.id,
            payment_id=payment.id,
            actor_id=admin_id,
            description=f"Platform commission retained on booking {booking.id}",
        ),
    ]

    session.add_all(entries)
    return tx_id


async def record_refund(
    session: AsyncSession,
    refund: Refund,
    payment: Payment,
    admin_id: uuid.UUID | None = None,
) -> uuid.UUID:
    """
    Emits balanced double-entry ledger records on refund:
    - Debit: owner_payable (proportional owner share reversed)
    - Debit: platform_commission_revenue (proportional commission reversed)
    - Credit: customer_funds_held (total refund amount)
    Total Debits == Total Credits.
    """
    tx_id = uuid.uuid4()
    refund_amount = refund.amount
    
    # Calculate commission reversal proportion
    if payment.amount > Decimal("0.00") and payment.commission_amount is not None:
        comm_reversed = (payment.commission_amount * (refund_amount / payment.amount)).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
    else:
        comm_reversed = Decimal("0.00")
    
    owner_share_reversed = refund_amount - comm_reversed

    entries = [
        LedgerEntry(
            transaction_id=tx_id,
            entry_type=EntryType.REFUND,
            account=Account.OWNER_PAYABLE,
            direction="debit",
            amount=owner_share_reversed,
            currency=refund.currency,
            booking_id=refund.booking_id,
            payment_id=payment.id,
            refund_id=refund.id,
            actor_id=admin_id,
            description=f"Owner payable reversal for refund {refund.id} (reason: {refund.reason})",
        ),
        LedgerEntry(
            transaction_id=tx_id,
            entry_type=EntryType.REFUND,
            account=Account.PLATFORM_COMMISSION_REVENUE,
            direction="debit",
            amount=comm_reversed,
            currency=refund.currency,
            booking_id=refund.booking_id,
            payment_id=payment.id,
            refund_id=refund.id,
            actor_id=admin_id,
            description=f"Commission reversal for refund {refund.id}",
        ),
        LedgerEntry(
            transaction_id=tx_id,
            entry_type=EntryType.REFUND,
            account=Account.CUSTOMER_FUNDS_HELD,
            direction="credit",
            amount=refund_amount,
            currency=refund.currency,
            booking_id=refund.booking_id,
            payment_id=payment.id,
            refund_id=refund.id,
            actor_id=admin_id,
            description=f"Disbursement of customer refund {refund.id} via {refund.mode}",
        ),
    ]

    session.add_all(entries)
    return tx_id


async def record_payout_disbursement(
    session: AsyncSession,
    payout: Payout,
    admin_id: uuid.UUID | None = None,
    utr_reference: str | None = None,
) -> uuid.UUID:
    """
    Emits balanced double-entry ledger records on payout settlement:
    - Debit: owner_payable (settled amount)
    - Credit: platform_cash (disbursed funds out of platform bank)
    Total Debits == Total Credits.
    """
    tx_id = uuid.uuid4()
    amount = payout.net_amount

    entries = [
        LedgerEntry(
            transaction_id=tx_id,
            entry_type=EntryType.PAYOUT_DISBURSEMENT,
            account=Account.OWNER_PAYABLE,
            direction="debit",
            amount=amount,
            currency="INR",
            payout_id=payout.id,
            actor_id=admin_id,
            description=f"Settled owner payable for payout {payout.id} (period {payout.period_start} to {payout.period_end})",
        ),
        LedgerEntry(
            transaction_id=tx_id,
            entry_type=EntryType.PAYOUT_DISBURSEMENT,
            account=Account.PLATFORM_CASH,
            direction="credit",
            amount=amount,
            currency="INR",
            payout_id=payout.id,
            actor_id=admin_id,
            description=f"Bank disbursement for payout {payout.id} (ref: {utr_reference or 'manual'})",
        ),
    ]

    session.add_all(entries)
    return tx_id


async def get_reconciliation_summary(session: AsyncSession) -> dict[str, Any]:
    """
    Reconciles all ledger entries and verifies mathematical balance:
    1. Total debits == Total credits across the entire ledger.
    2. Account-level balances:
       - Customer funds held (Asset): Debits - Credits
       - Owner payables (Liability): Credits - Debits
       - Commission revenue (Equity/Revenue): Credits - Debits
       - Platform cash (Asset): Debits - Credits
    """
    result = await session.execute(
        select(
            LedgerEntry.account,
            LedgerEntry.direction,
            func.coalesce(func.sum(LedgerEntry.amount), Decimal("0.00")).label("total"),
        ).group_by(LedgerEntry.account, LedgerEntry.direction)
    )

    rows = result.all()
    account_totals: dict[str, dict[str, Decimal]] = {}
    total_debits = Decimal("0.00")
    total_credits = Decimal("0.00")

    for account, direction, total in rows:
        if account not in account_totals:
            account_totals[account] = {"debit": Decimal("0.00"), "credit": Decimal("0.00")}
        account_totals[account][direction] = total
        if direction == "debit":
            total_debits += total
        elif direction == "credit":
            total_credits += total

    # Net account balances
    balances = {
        Account.CUSTOMER_FUNDS_HELD: (
            account_totals.get(Account.CUSTOMER_FUNDS_HELD, {}).get("debit", Decimal("0.00"))
            - account_totals.get(Account.CUSTOMER_FUNDS_HELD, {}).get("credit", Decimal("0.00"))
        ),
        Account.OWNER_PAYABLE: (
            account_totals.get(Account.OWNER_PAYABLE, {}).get("credit", Decimal("0.00"))
            - account_totals.get(Account.OWNER_PAYABLE, {}).get("debit", Decimal("0.00"))
        ),
        Account.PLATFORM_COMMISSION_REVENUE: (
            account_totals.get(Account.PLATFORM_COMMISSION_REVENUE, {}).get("credit", Decimal("0.00"))
            - account_totals.get(Account.PLATFORM_COMMISSION_REVENUE, {}).get("debit", Decimal("0.00"))
        ),
        Account.PLATFORM_CASH: (
            account_totals.get(Account.PLATFORM_CASH, {}).get("debit", Decimal("0.00"))
            - account_totals.get(Account.PLATFORM_CASH, {}).get("credit", Decimal("0.00"))
        ),
    }

    is_balanced = total_debits == total_credits

    return {
        "balanced": is_balanced,
        "total_debits": total_debits,
        "total_credits": total_credits,
        "imbalance": total_debits - total_credits,
        "account_balances": balances,
    }


async def get_ledger_entries(
    session: AsyncSession,
    account: str | None = None,
    entry_type: str | None = None,
    booking_id: uuid.UUID | None = None,
    payout_id: uuid.UUID | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[LedgerEntry]:
    stmt = select(LedgerEntry)
    if account:
        stmt = stmt.where(LedgerEntry.account == account)
    if entry_type:
        stmt = stmt.where(LedgerEntry.entry_type == entry_type)
    if booking_id:
        stmt = stmt.where(LedgerEntry.booking_id == booking_id)
    if payout_id:
        stmt = stmt.where(LedgerEntry.payout_id == payout_id)
    stmt = stmt.order_by(LedgerEntry.created_at.desc()).limit(limit).offset(offset)
    result = await session.execute(stmt)
    return list(result.scalars().all())

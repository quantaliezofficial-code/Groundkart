"""phase1_ledger_and_compliance

Revision ID: b69b95d77243
Revises: 59d032bf5926
Create Date: 2026-10-16 15:12:34.139940

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b69b95d77243'
down_revision: Union[str, Sequence[str], None] = '59d032bf5926'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    from sqlalchemy.dialects import postgresql

    # 1. owner_bank_accounts
    op.create_table(
        'owner_bank_accounts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('owner_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('account_holder_name', sa.String(255), nullable=False),
        sa.Column('account_number', sa.String(64), nullable=False),
        sa.Column('ifsc_code', sa.String(16), nullable=False),
        sa.Column('bank_name', sa.String(128), nullable=True),
        sa.Column('upi_id', sa.String(128), nullable=True),
        sa.Column('is_verified', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('is_primary', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('idx_owner_bank_accounts_owner', 'owner_bank_accounts', ['owner_id', 'is_primary'])

    # 2. refunds
    op.create_table(
        'refunds',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('payment_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('payments.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('booking_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('bookings.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('amount', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('currency', sa.String(3), server_default='INR', nullable=False),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('status', sa.String(32), server_default='pending', nullable=False),
        sa.Column('mode', sa.String(32), server_default='offline_manual', nullable=False),
        sa.Column('reference', sa.String(128), nullable=True),
        sa.Column('requested_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('processed_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('processed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('idx_refunds_payment_id', 'refunds', ['payment_id'])
    op.create_index('idx_refunds_booking_id', 'refunds', ['booking_id'])

    # 3. payouts columns
    op.add_column('payouts', sa.Column('payout_reference', sa.String(128), nullable=True))
    op.add_column('payouts', sa.Column('bank_account_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('owner_bank_accounts.id', ondelete='SET NULL'), nullable=True))

    # 4. owner_verifications columns
    op.add_column('owner_verifications', sa.Column('pan', sa.String(10), nullable=True))
    op.add_column('owner_verifications', sa.Column('gstin', sa.String(15), nullable=True))

    # 5. system_configuration column
    op.add_column('system_configuration', sa.Column('payout_holdback_days', sa.Integer(), server_default='3', nullable=False))

    # 6. ledger_entries
    op.create_table(
        'ledger_entries',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('transaction_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('entry_type', sa.String(64), nullable=False),
        sa.Column('account', sa.String(64), nullable=False),
        sa.Column('direction', sa.String(10), nullable=False),
        sa.Column('amount', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('currency', sa.String(3), server_default='INR', nullable=False),
        sa.Column('booking_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('bookings.id', ondelete='SET NULL'), nullable=True),
        sa.Column('payment_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('payments.id', ondelete='SET NULL'), nullable=True),
        sa.Column('payout_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('payouts.id', ondelete='SET NULL'), nullable=True),
        sa.Column('refund_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('refunds.id', ondelete='SET NULL'), nullable=True),
        sa.Column('actor_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('idx_ledger_transaction_id', 'ledger_entries', ['transaction_id'])
    op.create_index('idx_ledger_account', 'ledger_entries', ['account'])
    op.create_index('idx_ledger_booking_id', 'ledger_entries', ['booking_id'])
    op.create_index('idx_ledger_payout_id', 'ledger_entries', ['payout_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('ledger_entries')
    op.drop_column('system_configuration', 'payout_holdback_days')
    op.drop_column('owner_verifications', 'gstin')
    op.drop_column('owner_verifications', 'pan')
    op.drop_column('payouts', 'bank_account_id')
    op.drop_column('payouts', 'payout_reference')
    op.drop_table('refunds')
    op.drop_table('owner_bank_accounts')


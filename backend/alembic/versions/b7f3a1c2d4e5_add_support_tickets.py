"""add support tickets and ticket events

Revision ID: b7f3a1c2d4e5
Revises: 03f90242a38c
Create Date: 2026-08-28 19:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, ENUM as PGEnum


# revision identifiers, used by Alembic.
revision: str = 'b7f3a1c2d4e5'
down_revision: Union[str, Sequence[str], None] = '03f90242a38c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create support ticket enums, tables, and indexes."""

    # Create ENUM types
    op.execute("CREATE TYPE ticket_status AS ENUM ('open', 'in_review', 'waiting_customer', 'resolved', 'closed')")
    op.execute("CREATE TYPE ticket_category AS ENUM ('general', 'billing', 'venue_issue', 'dispute')")
    op.execute("CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent')")

    # Create support_tickets table
    op.create_table(
        'support_tickets',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('subject', sa.Text(), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('status', PGEnum('open', 'in_review', 'waiting_customer', 'resolved', 'closed', name='ticket_status', create_type=False), nullable=False, server_default='open'),
        sa.Column('category', PGEnum('general', 'billing', 'venue_issue', 'dispute', name='ticket_category', create_type=False), nullable=False, server_default='general'),
        sa.Column('priority', PGEnum('low', 'medium', 'high', 'urgent', name='ticket_priority', create_type=False), nullable=False, server_default='medium'),
        sa.Column('creator_id', sa.UUID(), nullable=False),
        sa.Column('assignee_id', sa.UUID(), nullable=True),
        sa.Column('booking_id', sa.UUID(), nullable=True),
        sa.Column('venue_id', sa.UUID(), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['creator_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['assignee_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['booking_id'], ['bookings.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['venue_id'], ['venues.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_support_tickets_creator', 'support_tickets', ['creator_id', 'created_at'])
    op.create_index(
        'idx_support_tickets_venue_status', 'support_tickets', ['venue_id', 'status'],
        postgresql_where=sa.text('venue_id IS NOT NULL'),
    )
    op.create_index('idx_support_tickets_status', 'support_tickets', ['status', 'created_at'])

    # Create ticket_events table
    op.create_table(
        'ticket_events',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('ticket_id', sa.UUID(), nullable=False),
        sa.Column('event_type', sa.Text(), nullable=False),
        sa.Column('actor_id', sa.UUID(), nullable=True),
        sa.Column('old_status', sa.Text(), nullable=True),
        sa.Column('new_status', sa.Text(), nullable=True),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('internal', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('metadata', JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['ticket_id'], ['support_tickets.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['actor_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_ticket_events_ticket', 'ticket_events', ['ticket_id', 'created_at'])


def downgrade() -> None:
    """Drop tables and enums — complete rollback."""
    op.drop_index('idx_ticket_events_ticket', table_name='ticket_events')
    op.drop_table('ticket_events')

    op.drop_index('idx_support_tickets_status', table_name='support_tickets')
    op.drop_index('idx_support_tickets_venue_status', table_name='support_tickets')
    op.drop_index('idx_support_tickets_creator', table_name='support_tickets')
    op.drop_table('support_tickets')

    op.execute("DROP TYPE ticket_priority")
    op.execute("DROP TYPE ticket_category")
    op.execute("DROP TYPE ticket_status")

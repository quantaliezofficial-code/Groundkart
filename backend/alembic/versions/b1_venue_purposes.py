"""add_venue_purposes

Revision ID: b1_venue_purposes
Revises: a1_venue_rental_options
Create Date: 2026-10-19

Phase 1b — Guide 11: Per-venue purpose configuration.
Owners tick which events they host (wedding, cricket, party…) from the
catalogue (venue_use_cases) or define their own (pending admin approval).
Each purpose carries its own description, guest limit, allowed rental
modes and optional price override.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ARRAY

# revision identifiers, used by Alembic.
revision: str = "b1_venue_purposes"
down_revision: Union[str, Sequence[str], None] = "a1_venue_rental_options"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "venue_purposes",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("venue_id", sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("venues.id", ondelete="CASCADE"), nullable=False),
        # Catalogue entry (null when this is a custom-named purpose)
        sa.Column("use_case_id", sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("use_cases.id", ondelete="SET NULL"), nullable=True),
        # Custom name used when use_case_id is null
        sa.Column("custom_name", sa.String(200), nullable=True),
        # Admin approval state for custom purposes (null = not custom)
        sa.Column("is_custom_approved", sa.Boolean(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("max_guests", sa.Integer(), nullable=True),
        # Array of allowed modes — stored as text[]
        sa.Column("allowed_modes", ARRAY(sa.String(20)), nullable=True),
        # Optional per-purpose price override (overrides rental_option.price)
        sa.Column("price_override", sa.Numeric(10, 2), nullable=True),
        sa.Column("rules", sa.Text(), nullable=True),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint(
            "use_case_id IS NOT NULL OR custom_name IS NOT NULL",
            name="chk_purpose_has_name",
        ),
        sa.CheckConstraint("price_override IS NULL OR price_override >= 0",
                           name="chk_purpose_price_override_non_negative"),
    )

    op.create_index("idx_venue_purposes_venue_id", "venue_purposes", ["venue_id"])
    op.create_index("idx_venue_purposes_use_case_id", "venue_purposes", ["use_case_id"])


def downgrade() -> None:
    op.drop_index("idx_venue_purposes_use_case_id", table_name="venue_purposes")
    op.drop_index("idx_venue_purposes_venue_id", table_name="venue_purposes")
    op.drop_table("venue_purposes")

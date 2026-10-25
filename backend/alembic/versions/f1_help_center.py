"""add help center, know more tickets, and guest enquiries

Revision ID: f1_help_center
Revises: e1_overlap_guard
Create Date: 2026-10-19 14:45:00.000000

Phase H1 — Foundation: Help categories, articles, revisions, feedback,
search log, guest enquiries, and support ticket help request extension.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = "f1_help_center"
down_revision: Union[str, Sequence[str], None] = "e1_overlap_guard"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add 'help_request' to ticket_category ENUM in autocommit block
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE ticket_category ADD VALUE IF NOT EXISTS 'help_request'")

    # 2. help_categories table
    op.create_table(
        "help_categories",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("slug", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("icon", sa.Text(), nullable=False, server_default="help-circle"),
        sa.Column("audience", sa.Text(), nullable=False, server_default="all"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug", name="uq_help_categories_slug"),
    )
    op.create_index("idx_help_categories_audience", "help_categories", ["audience", "sort_order"])

    # 3. help_articles table
    op.create_table(
        "help_articles",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("slug", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("body_markdown", sa.Text(), nullable=False),
        sa.Column("audience", sa.Text(), nullable=False, server_default="all"),
        sa.Column("category_id", UUID(as_uuid=True), nullable=True),
        sa.Column("language", sa.Text(), nullable=False, server_default="en"),
        sa.Column("group_id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("status", sa.Text(), nullable=False, server_default="draft"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("video_url", sa.Text(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("author_id", UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["category_id"], ["help_categories.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug", name="uq_help_articles_slug"),
    )
    op.create_index("idx_help_articles_category_status", "help_articles", ["category_id", "status"])
    op.create_index("idx_help_articles_audience_status_lang", "help_articles", ["audience", "status", "language"])
    op.create_index("idx_help_articles_group_lang", "help_articles", ["group_id", "language"])

    # Full-text search index on title, summary, body_markdown
    op.execute(
        "CREATE INDEX idx_help_articles_fts ON help_articles "
        "USING gin(to_tsvector('english', title || ' ' || summary || ' ' || body_markdown))"
    )

    # 4. help_article_revisions table
    op.create_table(
        "help_article_revisions",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("article_id", UUID(as_uuid=True), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("body_markdown", sa.Text(), nullable=False),
        sa.Column("editor_id", UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["article_id"], ["help_articles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["editor_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_help_revisions_article_version", "help_article_revisions", ["article_id", "version"])

    # 5. help_feedback table
    op.create_table(
        "help_feedback",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("article_id", UUID(as_uuid=True), nullable=False),
        sa.Column("section", sa.Text(), nullable=True),
        sa.Column("user_id", UUID(as_uuid=True), nullable=True),
        sa.Column("helpful", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["article_id"], ["help_articles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_help_feedback_article", "help_feedback", ["article_id", "created_at"])

    # 6. help_search_log table
    op.create_table(
        "help_search_log",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("query", sa.Text(), nullable=False),
        sa.Column("result_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("role", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_help_search_log_created", "help_search_log", ["created_at"])

    # 7. guest_enquiries table (fixes Contact form messages being lost)
    op.create_table(
        "guest_enquiries",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("phone", sa.Text(), nullable=True),
        sa.Column("subject", sa.Text(), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False, server_default="new"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_guest_enquiries_status", "guest_enquiries", ["status", "created_at"])

    # 8. Add help request context columns to support_tickets
    op.add_column("support_tickets", sa.Column("help_article_id", UUID(as_uuid=True), nullable=True))
    op.add_column("support_tickets", sa.Column("help_article_version", sa.Integer(), nullable=True))
    op.add_column("support_tickets", sa.Column("help_section", sa.Text(), nullable=True))
    op.add_column("support_tickets", sa.Column("help_excerpt", sa.Text(), nullable=True))
    op.create_foreign_key(
        "fk_support_tickets_help_article",
        "support_tickets",
        "help_articles",
        ["help_article_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("idx_support_tickets_help_article", "support_tickets", ["help_article_id", "help_section"])


def downgrade() -> None:
    # Rollback columns & indexes from support_tickets
    op.drop_index("idx_support_tickets_help_article", table_name="support_tickets")
    op.drop_constraint("fk_support_tickets_help_article", "support_tickets", type_="foreignkey")
    op.drop_column("support_tickets", "help_excerpt")
    op.drop_column("support_tickets", "help_section")
    op.drop_column("support_tickets", "help_article_version")
    op.drop_column("support_tickets", "help_article_id")

    # Drop guest_enquiries
    op.drop_index("idx_guest_enquiries_status", table_name="guest_enquiries")
    op.drop_table("guest_enquiries")

    # Drop help_search_log
    op.drop_index("idx_help_search_log_created", table_name="help_search_log")
    op.drop_table("help_search_log")

    # Drop help_feedback
    op.drop_index("idx_help_feedback_article", table_name="help_feedback")
    op.drop_table("help_feedback")

    # Drop help_article_revisions
    op.drop_index("idx_help_revisions_article_version", table_name="help_article_revisions")
    op.drop_table("help_article_revisions")

    # Drop help_articles
    op.execute("DROP INDEX IF EXISTS idx_help_articles_fts")
    op.drop_index("idx_help_articles_group_lang", table_name="help_articles")
    op.drop_index("idx_help_articles_audience_status_lang", table_name="help_articles")
    op.drop_index("idx_help_articles_category_status", table_name="help_articles")
    op.drop_table("help_articles")

    # Drop help_categories
    op.drop_index("idx_help_categories_audience", table_name="help_categories")
    op.drop_table("help_categories")

"""
Service layer for Help Center — categories, articles, search, feedback,
and server-side snapshot extraction for Know More tickets.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Sequence

from fastapi import HTTPException
from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.core import (
    AuditLog,
    GuestEnquiry,
    HelpArticle,
    HelpArticleRevision,
    HelpCategory,
    HelpFeedback,
    HelpSearchLog,
    User,
)
from app.modules.notifications.service import notify


# ── Section Excerpt Extraction ──────────────────────────────────────────

def clean_markdown_prose(md: str) -> str:
    """Strips markdown syntax leaving plain readable text."""
    # Remove image links: ![alt](url)
    cleaned = re.sub(r"!\[.*?\]\(.*?\)", "", md)
    # Convert links [text](url) -> text
    cleaned = re.sub(r"\[(.*?)\]\(.*?\)", r"\1", cleaned)
    # Remove heading markers (#+ )
    cleaned = re.sub(r"^#{1,6}\s+", "", cleaned, flags=re.MULTILINE)
    # Remove bold/italic markers
    cleaned = re.sub(r"[*_]{1,3}", "", cleaned)
    # Remove inline code blocks
    cleaned = re.sub(r"`(.*?)`", r"\1", cleaned)
    # Collapse multiple whitespace/newlines
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def extract_section_excerpt(
    body_markdown: str,
    section_heading: str | None,
    max_chars: int = 500,
) -> str:
    """
    Extracts the prose content under a specific section heading up to the next
    heading or end of document. If section_heading is not found or None, returns
    the initial article prose. Never exceeds max_chars.
    """
    if not body_markdown:
        return ""

    if not section_heading:
        prose = clean_markdown_prose(body_markdown)
        return prose[:max_chars].strip()

    # Normalize target section heading
    target_clean = re.sub(r"[^\w\s-]", "", section_heading).strip().lower()
    target_slug = re.sub(r"[-\s]+", "-", target_clean)

    # Split markdown by headings (## or ###)
    lines = body_markdown.splitlines()
    found_section = False
    section_lines: list[str] = []
    current_level = 0

    heading_regex = re.compile(r"^(#{1,4})\s+(.+)$")

    for line in lines:
        match = heading_regex.match(line)
        if match:
            hashes, heading_text = match.groups()
            level = len(hashes)
            heading_clean = re.sub(r"[^\w\s-]", "", heading_text).strip().lower()
            heading_slug = re.sub(r"[-\s]+", "-", heading_clean)

            if found_section:
                # If we encounter another heading of same or higher level, end section
                if level <= current_level:
                    break
                else:
                    section_lines.append(line)
            elif (
                heading_clean == target_clean
                or heading_slug == target_slug
                or target_clean in heading_clean
                or target_slug in heading_slug
            ):
                found_section = True
                current_level = level
        elif found_section:
            section_lines.append(line)

    if found_section and section_lines:
        content = "\n".join(section_lines)
        prose = clean_markdown_prose(content)
        if prose:
            return prose[:max_chars].strip()

    # Fallback if section wasn't specifically located
    return clean_markdown_prose(body_markdown)[:max_chars].strip()


# ── Categories ───────────────────────────────────────────────────────────

async def list_categories(
    session: AsyncSession,
    *,
    audience: str | None = None,
    lang: str = "en",
) -> list[dict]:
    """Returns all categories with the count of published articles in each."""
    query = select(HelpCategory).order_by(HelpCategory.sort_order)
    if audience and audience != "all":
        query = query.where(HelpCategory.audience.in_([audience, "all"]))

    cat_result = await session.execute(query)
    categories = cat_result.scalars().all()

    # Query counts for published articles per category
    count_query = (
        select(HelpArticle.category_id, func.count(HelpArticle.id))
        .where(
            HelpArticle.status == "published",
            HelpArticle.language == lang,
        )
        .group_by(HelpArticle.category_id)
    )
    if audience and audience != "all":
        count_query = count_query.where(HelpArticle.audience.in_([audience, "all"]))

    count_result = await session.execute(count_query)
    counts = dict(count_result.all())

    return [
        {
            "category": cat,
            "article_count": counts.get(cat.id, 0),
        }
        for cat in categories
    ]


# ── Articles ─────────────────────────────────────────────────────────────

async def list_articles(
    session: AsyncSession,
    *,
    audience: str | None = None,
    category_slug: str | None = None,
    query: str | None = None,
    lang: str = "en",
    limit: int = 50,
    offset: int = 0,
) -> list[HelpArticle]:
    """Lists published articles matching audience, category, and optional search query."""
    stmt = (
        select(HelpArticle)
        .where(
            HelpArticle.status == "published",
            HelpArticle.language == lang,
        )
        .order_by(HelpArticle.sort_order, HelpArticle.title)
        .limit(limit)
        .offset(offset)
    )

    if audience and audience != "all":
        stmt = stmt.where(HelpArticle.audience.in_([audience, "all"]))

    if category_slug:
        stmt = stmt.join(HelpCategory, HelpArticle.category_id == HelpCategory.id).where(
            HelpCategory.slug == category_slug
        )

    if query and query.strip():
        q_term = query.strip()
        search_filter = or_(
            text(
                "to_tsvector('english', help_articles.title || ' ' || help_articles.summary || ' ' || help_articles.body_markdown) "
                "@@ plainto_tsquery('english', :q)"
            ).bindparams(q=q_term),
            HelpArticle.title.ilike(f"%{q_term}%"),
            HelpArticle.summary.ilike(f"%{q_term}%"),
        )
        stmt = stmt.where(search_filter)

    result = await session.execute(stmt)
    articles = list(result.scalars().all())

    # Log search queries for telemetry and missing topic insights
    if query and query.strip():
        await log_search(session, query.strip(), result_count=len(articles), role=audience)

    return articles


async def get_article_by_slug(
    session: AsyncSession,
    slug: str,
    *,
    lang: str = "en",
) -> HelpArticle | None:
    """Fetches a published article by slug and language, including category."""
    stmt = (
        select(HelpArticle)
        .where(
            HelpArticle.slug == slug,
            HelpArticle.status == "published",
            HelpArticle.language == lang,
        )
        .options(selectinload(HelpArticle.category))
    )
    result = await session.execute(stmt)
    article = result.scalar_one_or_none()

    if not article and lang != "en":
        # Fallback to English translation if Hindi is not yet drafted
        stmt_en = (
            select(HelpArticle)
            .where(
                HelpArticle.slug == slug,
                HelpArticle.status == "published",
                HelpArticle.language == "en",
            )
            .options(selectinload(HelpArticle.category))
        )
        result_en = await session.execute(stmt_en)
        article = result_en.scalar_one_or_none()

    return article


async def get_related_articles(
    session: AsyncSession,
    article: HelpArticle,
    limit: int = 3,
) -> list[HelpArticle]:
    """Finds up to `limit` related published articles in the same category or audience."""
    stmt = (
        select(HelpArticle)
        .where(
            HelpArticle.id != article.id,
            HelpArticle.status == "published",
            HelpArticle.language == article.language,
        )
    )
    if article.category_id:
        stmt = stmt.where(HelpArticle.category_id == article.category_id)
    else:
        stmt = stmt.where(HelpArticle.audience == article.audience)

    stmt = stmt.order_by(HelpArticle.sort_order).limit(limit)
    result = await session.execute(stmt)
    return list(result.scalars().all())


# ── Feedback & Search Logging ────────────────────────────────────────────

async def submit_feedback(
    session: AsyncSession,
    article_id: uuid.UUID,
    *,
    helpful: bool,
    section: str | None = None,
    user_id: uuid.UUID | None = None,
) -> HelpFeedback:
    """Records helpful / not helpful vote on an article or section."""
    article_res = await session.execute(
        select(HelpArticle.id).where(HelpArticle.id == article_id)
    )
    if article_res.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Help article not found")

    feedback = HelpFeedback(
        article_id=article_id,
        section=section,
        user_id=user_id,
        helpful=helpful,
    )
    session.add(feedback)
    await session.flush()
    return feedback


async def log_search(
    session: AsyncSession,
    query: str,
    result_count: int = 0,
    role: str | None = None,
) -> None:
    """Logs a search query to identify zero-result topics or user friction points."""
    try:
        log_entry = HelpSearchLog(
            query=query[:255],
            result_count=result_count,
            role=role[:50] if role else None,
        )
        session.add(log_entry)
        await session.commit()
    except Exception:
        # Logging failure should never block read operations
        pass


# ── Guest Enquiries (Contact Form) ───────────────────────────────────────

async def create_guest_enquiry(
    session: AsyncSession,
    *,
    name: str,
    email: str,
    phone: str | None = None,
    subject: str,
    message: str,
) -> GuestEnquiry:
    """Creates a guest enquiry from the public /contact form."""
    enquiry = GuestEnquiry(
        name=name.strip(),
        email=email.strip().lower(),
        phone=phone.strip() if phone else None,
        subject=subject.strip(),
        message=message.strip(),
        status="new",
    )
    session.add(enquiry)
    await session.flush()

    # Notify admins about guest inquiry
    admin_result = await session.execute(
        select(User).where(User.role == "admin", User.deleted_at.is_(None))
    )
    admins = admin_result.scalars().all()
    for admin in admins:
        for obj in notify(
            admin.id,
            type="support.guest_enquiry",
            message=f"New contact inquiry from {name}: {subject}",
            entity_type="guest_enquiry",
            entity_id=enquiry.id,
        ):
            session.add(obj)

    await session.flush()
    return enquiry

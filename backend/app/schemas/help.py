"""
Pydantic schemas for Help Center categories, articles, feedback, and guest contact enquiries.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


def parse_markdown_sections(body_markdown: str) -> list[HelpArticleSection]:
    """Extracts H2 and H3 headings as navigable sections with generated anchor slugs."""
    sections: list[HelpArticleSection] = []
    heading_pattern = re.compile(r"^(#{2,3})\s+(.+)$", re.MULTILINE)
    for match in heading_pattern.finditer(body_markdown):
        hashes, title = match.groups()
        clean_title = title.strip()
        # Generate anchor slug: "Step 1: Choose Date" -> "step-1-choose-date"
        anchor = re.sub(r"[^\w\s-]", "", clean_title).strip().lower()
        anchor = re.sub(r"[-\s]+", "-", anchor)
        sections.append(
            HelpArticleSection(
                title=clean_title,
                anchor=anchor,
                level=len(hashes),
            )
        )
    return sections


class HelpCategoryResponse(BaseModel):
    id: str
    slug: str
    name: str
    icon: str
    audience: str
    sort_order: int
    article_count: int = 0

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_category(cls, category, count: int = 0) -> "HelpCategoryResponse":
        return cls(
            id=str(category.id),
            slug=category.slug,
            name=category.name,
            icon=category.icon,
            audience=category.audience,
            sort_order=category.sort_order,
            article_count=count,
        )


class HelpArticleSection(BaseModel):
    title: str
    anchor: str
    level: int


class HelpArticleSummary(BaseModel):
    id: str
    slug: str
    title: str
    summary: str
    audience: str
    category_id: str | None = None
    language: str
    version: int
    sort_order: int
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_article(cls, article) -> "HelpArticleSummary":
        return cls(
            id=str(article.id),
            slug=article.slug,
            title=article.title,
            summary=article.summary,
            audience=article.audience,
            category_id=str(article.category_id) if article.category_id else None,
            language=article.language,
            version=article.version,
            sort_order=article.sort_order,
            updated_at=article.updated_at,
        )


class HelpArticleDetail(BaseModel):
    id: str
    slug: str
    title: str
    summary: str
    body_markdown: str
    audience: str
    category_id: str | None = None
    category: HelpCategoryResponse | None = None
    language: str
    group_id: str
    version: int
    video_url: str | None = None
    sections: list[HelpArticleSection] = []
    related_articles: list[HelpArticleSummary] = []
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_article(
        cls,
        article,
        category: HelpCategoryResponse | None = None,
        related: list[HelpArticleSummary] | None = None,
    ) -> "HelpArticleDetail":
        sections = parse_markdown_sections(article.body_markdown)
        return cls(
            id=str(article.id),
            slug=article.slug,
            title=article.title,
            summary=article.summary,
            body_markdown=article.body_markdown,
            audience=article.audience,
            category_id=str(article.category_id) if article.category_id else None,
            category=category,
            language=article.language,
            group_id=str(article.group_id),
            version=article.version,
            video_url=article.video_url,
            sections=sections,
            related_articles=related or [],
            updated_at=article.updated_at,
        )


class HelpFeedbackRequest(BaseModel):
    helpful: bool
    section: str | None = Field(None, max_length=200)


class HelpFeedbackResponse(BaseModel):
    success: bool
    message: str


class ContactSubmitRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., min_length=5, max_length=120)
    phone: str | None = Field(None, max_length=20)
    subject: str = Field(..., min_length=2, max_length=200)
    message: str = Field(..., min_length=5, max_length=5000)


class ContactSubmitResponse(BaseModel):
    success: bool
    ticket_id: str | None = None
    enquiry_id: str | None = None
    message: str

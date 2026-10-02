"""add_video_support

Revision ID: 48fc1eaeba4f
Revises: de54777d9e8c
Create Date: 2026-10-02 09:24:03.897363

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '48fc1eaeba4f'
down_revision: Union[str, Sequence[str], None] = 'de54777d9e8c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.rename_table('venue_images', 'venue_media')
    op.add_column('venue_media', sa.Column('media_type', sa.String(), server_default='image', nullable=False))
    op.add_column('venue_media', sa.Column('thumbnail_url', sa.String(), nullable=True))
    op.execute("ALTER INDEX uq_one_cover_image_per_venue RENAME TO uq_one_cover_media_per_venue")


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("ALTER INDEX uq_one_cover_media_per_venue RENAME TO uq_one_cover_image_per_venue")
    op.drop_column('venue_media', 'thumbnail_url')
    op.drop_column('venue_media', 'media_type')
    op.rename_table('venue_media', 'venue_images')

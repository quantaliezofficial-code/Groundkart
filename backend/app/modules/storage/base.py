"""
TRD §2: "File storage: Cloudflare R2 or AWS S3 ... never store uploads on
the app server's local disk." This sandbox has no network access to either
provider (see network_configuration — only package registries are
reachable), so the actual S3/R2 client isn't built here. What's built is
the interface, specifically so that not being able to reach a cloud
provider doesn't block writing or testing the rest of the verification
flow: swap LocalFileStorage for an S3FileStorage implementing the same
three methods, and nothing else in this module changes.

LocalFileStorage itself is explicitly NOT what TRD §2 asks for, and is not
meant to run in anything other than dev/test — it exists to make this slice
testable at all without cloud credentials this environment can't have.
"""
from __future__ import annotations

import uuid
from pathlib import Path
from typing import Protocol

from app.config import settings

MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024  # 10MB
ALLOWED_CONTENT_TYPES = {"application/pdf", "image/jpeg", "image/png"}


class UnsupportedFileError(Exception):
    pass


class FileStorage(Protocol):
    async def save(self, content: bytes, content_type: str, key_prefix: str) -> str:
        """Returns a URL/path the file can be retrieved from. Raises
        UnsupportedFileError for anything failing the size/type checks —
        callers should turn that into a 422, not a 500."""
        ...


def _validate(content: bytes, content_type: str) -> None:
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise UnsupportedFileError(f"Unsupported file type: {content_type}")
    if len(content) > MAX_UPLOAD_SIZE_BYTES:
        raise UnsupportedFileError("File exceeds the 10MB limit")
    if len(content) == 0:
        raise UnsupportedFileError("Empty file")


class LocalFileStorage:
    """Dev/test only — see module docstring. Not what ships to production."""

    def __init__(self, base_dir: str = "/tmp/groundbooking-uploads"):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    async def save(self, content: bytes, content_type: str, key_prefix: str) -> str:
        _validate(content, content_type)
        ext = {"application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png"}[content_type]
        key = f"{key_prefix}/{uuid.uuid4().hex}.{ext}"
        path = self.base_dir / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        # A real gap found while wiring the owner dashboard's image upload
        # to real data: this used to return f"local://{key}" — not a URL
        # scheme any browser understands, so an uploaded photo saved
        # correctly on disk but could never actually be displayed anywhere
        # it was used (a venue card, the gallery, the verification-doc
        # preview). app/main.py mounts /uploads as a static file server
        # against this same base_dir; this now returns a URL that
        # resolves through that mount, so what save() returns is actually
        # fetchable, not just a path meaningful to this one process.
        return f"{settings.app_base_url}/uploads/{key}"

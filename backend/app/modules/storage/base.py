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
MAX_VIDEO_UPLOAD_SIZE_BYTES = 100 * 1024 * 1024 # 100MB
ALLOWED_CONTENT_TYPES = {"application/pdf", "image/jpeg", "image/png", "video/mp4", "video/webm"}


class UnsupportedFileError(Exception):
    pass


class FileStorage(Protocol):
    async def save(self, content: bytes, content_type: str, key_prefix: str) -> tuple[str, str]:
        """Returns a tuple of (URL, storage_key). Raises
        UnsupportedFileError for anything failing the size/type checks —
        callers should turn that into a 422, not a 500."""
        ...


def _validate(content: bytes, content_type: str) -> None:
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise UnsupportedFileError(f"Unsupported file type: {content_type}")
    max_size = MAX_VIDEO_UPLOAD_SIZE_BYTES if content_type.startswith("video/") else MAX_UPLOAD_SIZE_BYTES
    if len(content) > max_size:
        raise UnsupportedFileError(f"File exceeds the {max_size // (1024 * 1024)}MB limit")
    if len(content) == 0:
        raise UnsupportedFileError("Empty file")


class LocalFileStorage:
    """Dev/test only — see module docstring. Not what ships to production."""

    def __init__(self, base_dir: str | None = None, is_private: bool = False):
        if base_dir is not None:
            self.base_dir = Path(base_dir)
        else:
            self.base_dir = Path(settings.private_uploads_dir if is_private else settings.uploads_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.is_private = is_private

    async def save(self, content: bytes, content_type: str, key_prefix: str) -> tuple[str, str]:
        _validate(content, content_type)
        ext = {"application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "video/mp4": "mp4", "video/webm": "webm"}[content_type]
        key = f"{key_prefix}/{uuid.uuid4().hex}.{ext}"
        path = self.base_dir / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        if self.is_private:
            url = ""
        else:
            url = f"{settings.app_base_url}/uploads/{key}"
        return url, key

    async def get_object(self, key: str) -> tuple[bytes, str]:
        path = self.base_dir / key
        if not path.is_file():
            raise FileNotFoundError(f"File not found: {key}")
        content = path.read_bytes()
        ext = path.suffix.lower()
        content_type_map = {
            ".pdf": "application/pdf",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".mp4": "video/mp4",
            ".webm": "video/webm",
        }
        content_type = content_type_map.get(ext, "application/octet-stream")
        return content, content_type


class S3FileStorage:
    """S3/R2-compatible storage backend."""

    def __init__(
        self,
        bucket_name: str,
        endpoint_url: str | None = None,
        region: str = "us-east-1",
        public_base_url: str | None = None,
        is_private: bool = False,
    ):
        import aioboto3
        self.bucket_name = bucket_name
        self.endpoint_url = endpoint_url
        self.region = region
        self.public_base_url = public_base_url if public_base_url is not None else settings.s3_public_base_url
        self.is_private = is_private
        self.session = aioboto3.Session()

    async def save(self, content: bytes, content_type: str, key_prefix: str) -> tuple[str, str]:
        _validate(content, content_type)
        ext = {"application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "video/mp4": "mp4", "video/webm": "webm"}[content_type]
        key = f"{key_prefix}/{uuid.uuid4().hex}.{ext}"

        async with self.session.client(
            "s3",
            endpoint_url=self.endpoint_url,
            region_name=self.region,
            aws_access_key_id=settings.s3_access_key_id,
            aws_secret_access_key=settings.s3_secret_access_key,
        ) as client:
            await client.put_object(
                Bucket=self.bucket_name,
                Key=key,
                Body=content,
                ContentType=content_type,
            )
            if self.is_private:
                url = ""
            elif self.public_base_url:
                url = f"{self.public_base_url.rstrip('/')}/{key}"
            elif self.endpoint_url:
                url = f"{self.endpoint_url}/{self.bucket_name}/{key}"
            else:
                url = f"https://{self.bucket_name}.s3.{self.region}.amazonaws.com/{key}"
            return url, key

    async def get_presigned_url(self, key: str, expires_in: int = 300) -> str:
        async with self.session.client(
            "s3",
            endpoint_url=self.endpoint_url,
            region_name=self.region,
            aws_access_key_id=settings.s3_access_key_id,
            aws_secret_access_key=settings.s3_secret_access_key,
        ) as client:
            return await client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket_name, "Key": key},
                ExpiresIn=expires_in,
            )

    async def get_object(self, key: str) -> tuple[bytes, str]:
        async with self.session.client(
            "s3",
            endpoint_url=self.endpoint_url,
            region_name=self.region,
            aws_access_key_id=settings.s3_access_key_id,
            aws_secret_access_key=settings.s3_secret_access_key,
        ) as client:
            resp = await client.get_object(Bucket=self.bucket_name, Key=key)
            content_type = resp.get("ContentType", "application/octet-stream")
            data = await resp["Body"].read()
            return data, content_type


def get_storage() -> FileStorage:
    if settings.storage_backend == "s3":
        if not settings.s3_bucket_name:
            raise ValueError("S3 bucket name must be configured when using S3 storage backend")
        return S3FileStorage(
            bucket_name=settings.s3_bucket_name,
            endpoint_url=settings.s3_endpoint_url,
            region=settings.s3_region,
            public_base_url=settings.s3_public_base_url,
        )
    return LocalFileStorage()


def get_private_storage() -> FileStorage:
    if settings.storage_backend == "s3":
        bucket = settings.private_s3_bucket_name or settings.s3_bucket_name
        if not bucket:
            raise ValueError("S3 bucket name must be configured when using S3 storage backend")
        return S3FileStorage(
            bucket_name=bucket,
            endpoint_url=settings.s3_endpoint_url,
            region=settings.s3_region,
            is_private=True,
        )
    return LocalFileStorage(is_private=True)

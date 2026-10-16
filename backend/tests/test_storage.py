import pytest
from app.modules.storage.base import LocalFileStorage, S3FileStorage, UnsupportedFileError
import os
import uuid
from unittest.mock import AsyncMock, patch, MagicMock

@pytest.mark.asyncio
async def test_local_storage_success(tmp_path):
    storage = LocalFileStorage(base_dir=str(tmp_path))
    content = b"fake image"
    
    url, key = await storage.save(content, "image/jpeg", "test/prefix")
    
    assert key.startswith("test/prefix/")
    assert key.endswith(".jpg")
    assert "/uploads/test/prefix/" in url
    
    saved_file = tmp_path / key
    assert saved_file.exists()
    assert saved_file.read_bytes() == content

@pytest.mark.asyncio
async def test_local_storage_unsupported_type(tmp_path):
    storage = LocalFileStorage(base_dir=str(tmp_path))
    
    with pytest.raises(UnsupportedFileError):
        await storage.save(b"content", "text/plain", "prefix")

@pytest.mark.asyncio
async def test_local_storage_size_limit(tmp_path):
    storage = LocalFileStorage(base_dir=str(tmp_path))
    content = b"x" * (10 * 1024 * 1024 + 1)
    
    with pytest.raises(UnsupportedFileError):
        await storage.save(content, "image/jpeg", "prefix")

@pytest.mark.asyncio
@patch("aioboto3.Session")
async def test_s3_storage_success(mock_session_cls):
    mock_session = MagicMock()
    mock_client = AsyncMock()
    mock_session.client.return_value.__aenter__.return_value = mock_client
    mock_session_cls.return_value = mock_session

    storage = S3FileStorage(bucket_name="test-bucket", region="eu-west-1")
    content = b"fake s3 image"
    
    url, key = await storage.save(content, "image/png", "venues/123")
    
    assert key.startswith("venues/123/")
    assert key.endswith(".png")
    assert url == f"https://test-bucket.s3.eu-west-1.amazonaws.com/{key}"
    
    mock_client.put_object.assert_called_once_with(
        Bucket="test-bucket",
        Key=key,
        Body=content,
        ContentType="image/png"
    )

@pytest.mark.asyncio
@patch("aioboto3.Session")
async def test_s3_storage_custom_endpoint(mock_session_cls):
    mock_session = MagicMock()
    mock_client = AsyncMock()
    mock_session.client.return_value.__aenter__.return_value = mock_client
    mock_session_cls.return_value = mock_session

    storage = S3FileStorage(bucket_name="test-bucket", endpoint_url="https://s3.custom.net")
    content = b"fake s3 image"
    
    url, key = await storage.save(content, "image/png", "venues/123")
    
    assert key.startswith("venues/123/")
    assert key.endswith(".png")
    assert url == f"https://s3.custom.net/test-bucket/{key}"

@pytest.mark.asyncio
@patch("aioboto3.Session")
async def test_s3_storage_public_base_url(mock_session_cls):
    mock_session = MagicMock()
    mock_client = AsyncMock()
    mock_session.client.return_value.__aenter__.return_value = mock_client
    mock_session_cls.return_value = mock_session

    storage = S3FileStorage(
        bucket_name="test-bucket",
        endpoint_url="https://s3.custom.net",
        public_base_url="https://cdn.example.com",
    )
    content = b"fake s3 image"
    
    url, key = await storage.save(content, "image/png", "venues/123")
    
    assert key.startswith("venues/123/")
    assert key.endswith(".png")
    assert url == f"https://cdn.example.com/{key}"

@pytest.mark.asyncio
async def test_local_storage_private(tmp_path):
    storage = LocalFileStorage(base_dir=str(tmp_path), is_private=True)
    content = b"fake id document"
    
    url, key = await storage.save(content, "application/pdf", "owner-verifications/user-1")
    
    assert url == ""  # Private files must not have a public URL
    assert key.startswith("owner-verifications/user-1/")
    assert key.endswith(".pdf")
    
    fetched_bytes, content_type = await storage.get_object(key)
    assert fetched_bytes == content
    assert content_type == "application/pdf"


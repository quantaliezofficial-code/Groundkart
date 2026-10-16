"""
Migration script for Guide 4 - Step 2:
Migrate existing owner verification documents:
1. Copies existing documents from public uploads target to the private target.
2. Clears the public objects from the public uploads target.
3. Updates owner_verifications table to store storage_key and clear public document_url.
"""
import asyncio
import os
import shutil
from pathlib import Path
from urllib.parse import urlparse

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.config import settings
from app.models.core import OwnerVerification


async def migrate_documents() -> None:
    uploads_dir = Path(settings.uploads_dir)
    private_uploads_dir = Path(settings.private_uploads_dir)
    private_uploads_dir.mkdir(parents=True, exist_ok=True)

    engine = create_async_engine(settings.database_url)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    print(f"Starting migration of verification documents...")
    print(f"Public uploads dir:  {uploads_dir}")
    print(f"Private uploads dir: {private_uploads_dir}")

    migrated_count = 0
    async with session_factory() as session:
        async with session.begin():
            result = await session.execute(select(OwnerVerification))
            verifications = result.scalars().all()

            for v in verifications:
                storage_key = v.storage_key
                doc_url = v.document_url or ""

                # Extract key from document_url if storage_key is missing
                if not storage_key and "/uploads/" in doc_url:
                    parsed = urlparse(doc_url)
                    idx = parsed.path.find("/uploads/")
                    if idx != -1:
                        storage_key = parsed.path[idx + len("/uploads/"):].lstrip("/")
                elif not storage_key and doc_url.startswith("owner-verifications/"):
                    storage_key = doc_url

                if not storage_key:
                    continue

                public_path = uploads_dir / storage_key
                private_path = private_uploads_dir / storage_key

                # Copy to private storage if public file exists
                if public_path.exists() and public_path.is_file():
                    private_path.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(public_path, private_path)
                    print(f"Copied {public_path} -> {private_path}")
                    try:
                        public_path.unlink()
                        print(f"Removed public file: {public_path}")
                    except Exception as e:
                        print(f"Warning: could not delete {public_path}: {e}")

                v.storage_key = storage_key
                v.document_url = ""
                migrated_count += 1

    # Clean up empty directories under uploads_dir/owner-verifications
    public_verifs_dir = uploads_dir / "owner-verifications"
    if public_verifs_dir.exists():
        for root, dirs, files in os.walk(str(public_verifs_dir), topdown=False):
            for d in dirs:
                dir_path = Path(root) / d
                try:
                    dir_path.rmdir()
                except OSError:
                    pass
        try:
            public_verifs_dir.rmdir()
        except OSError:
            pass

    await engine.dispose()
    print(f"Migration completed successfully. Updated {migrated_count} verification records.")


if __name__ == "__main__":
    asyncio.run(migrate_documents())

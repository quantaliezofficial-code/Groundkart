import asyncio
import hashlib
import json
import logging
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.core import IdempotencyKey
from app.config import settings

logger = logging.getLogger(__name__)

class IdempotencyManager:
    def __init__(self, db: AsyncSession, key: str, actor_id: uuid.UUID | None, operation: str, payload_hash: str):
        self.db = db
        self.key = key
        self.actor_id = actor_id
        self.operation = operation
        self.payload_hash = payload_hash
        self.record_id = None
        self.is_replaying = False
        self.response_body = None
        self.response_code = None

    async def _claim(self):
        try:
            expires_at = datetime.now(timezone.utc) + timedelta(days=getattr(settings, "idempotency_retention_days", 7))
            new_key = IdempotencyKey(
                key=self.key,
                actor_id=self.actor_id,
                operation=self.operation,
                request_hash=self.payload_hash,
                status="in_progress",
                expires_at=expires_at
            )
            self.db.add(new_key)
            await self.db.commit()
            self.record_id = new_key.id
        except IntegrityError:
            await self.db.rollback()
            stmt = select(IdempotencyKey).where(
                IdempotencyKey.key == self.key,
                IdempotencyKey.operation == self.operation,
            )
            if self.actor_id:
                stmt = stmt.where(IdempotencyKey.actor_id == self.actor_id)
            else:
                stmt = stmt.where(IdempotencyKey.actor_id.is_(None))
                
            stmt = stmt.with_for_update()
            
            existing_key = (await self.db.execute(stmt)).scalar_one_or_none()
            if not existing_key:
                raise HTTPException(
                    status_code=409,
                    detail="Concurrent request in progress",
                    headers={"Retry-After": "1"},
                )
                
            if existing_key.expires_at and existing_key.expires_at < datetime.now(timezone.utc):
                await self.db.delete(existing_key)
                await self.db.commit()
                raise HTTPException(status_code=409, detail="Idempotency key expired, please retry")

            if existing_key.request_hash != self.payload_hash:
                raise HTTPException(status_code=422, detail="Idempotency key replayed with different payload")
                
            current_status = existing_key.status
            response_body = existing_key.response_body
            response_code = existing_key.response_code
            record_id = existing_key.id

            if current_status == "in_progress":
                # Wait briefly for in-progress request to finish before giving up
                for _ in range(20):
                    await asyncio.sleep(0.1)
                    await self.db.rollback()
                    refreshed = (await self.db.execute(stmt)).scalar_one_or_none()
                    if refreshed:
                        current_status = refreshed.status
                        response_body = refreshed.response_body
                        response_code = refreshed.response_code
                        record_id = refreshed.id
                        if current_status != "in_progress":
                            break
                
                if current_status == "in_progress":
                    raise HTTPException(
                        status_code=409,
                        detail="Concurrent request in progress",
                        headers={"Retry-After": "1"},
                    )
                
            if current_status == "completed":
                self.is_replaying = True
                self.response_body = response_body
                self.response_code = response_code
            elif current_status == "error":
                # Server error occurred previously: allow safe retry
                stmt_rec = select(IdempotencyKey).where(IdempotencyKey.id == record_id).with_for_update()
                rec = (await self.db.execute(stmt_rec)).scalar_one_or_none()
                if rec:
                    rec.status = "in_progress"
                    rec.request_hash = self.payload_hash
                    await self.db.commit()
                    self.record_id = rec.id

    async def complete(self, response_body: dict | BaseModel, status_code: int = 200):
        if self.is_replaying or not self.record_id:
            return
            
        if isinstance(response_body, BaseModel):
            body_dict = json.loads(response_body.model_dump_json())
        elif hasattr(response_body, "model_dump_json"):
            body_dict = json.loads(response_body.model_dump_json())
        else:
            body_dict = response_body
            
        stmt = select(IdempotencyKey).where(IdempotencyKey.id == self.record_id)
        record = (await self.db.execute(stmt)).scalar_one_or_none()
        if record:
            record.status = "completed"
            record.response_body = body_dict
            record.response_code = status_code
            await self.db.commit()

@asynccontextmanager
async def idempotency(
    db: AsyncSession | None,
    key: str | None,
    actor_id: uuid.UUID | None,
    operation: str,
    payload: BaseModel | dict,
    client_ip: str | None = None,
):
    if not key or db is None:
        class DummyManager:
            is_replaying = False
            response_code = None
            response_body = None
            async def complete(self, *args, **kwargs): pass
        yield DummyManager()
        return

    # Scope guest keys by client_ip if provided to prevent cross-guest collision
    scoped_key = f"{client_ip}:{key}" if (actor_id is None and client_ip) else key

    if isinstance(payload, BaseModel):
        payload_bytes = payload.model_dump_json().encode("utf-8")
    else:
        payload_bytes = json.dumps(payload, sort_keys=True).encode("utf-8")
        
    payload_hash = hashlib.sha256(payload_bytes).hexdigest()
    
    manager = IdempotencyManager(db, scoped_key, actor_id, operation, payload_hash)
    await manager._claim()
    
    try:
        yield manager
    except Exception:
        if manager.record_id and not manager.is_replaying:
            try:
                stmt = select(IdempotencyKey).where(IdempotencyKey.id == manager.record_id)
                record = (await db.execute(stmt)).scalar_one_or_none()
                if record and record.status == "in_progress":
                    record.status = "error"
                    await db.commit()
            except Exception as e:
                logger.error(f"Failed to mark idempotency key as error: {e}")
        raise

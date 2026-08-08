"""Append-only audit writer — never log clinical content."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db.models_identity import AuditEvent


async def write_audit(
    db: AsyncSession,
    *,
    organization_id: uuid.UUID | None,
    actor_user_id: uuid.UUID | None,
    action: str,
    resource_type: str,
    resource_id: str | None = None,
    result: str = "success",
    request_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    event = AuditEvent(
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        result=result,
        request_id=request_id,
        metadata_json=metadata or {},
    )
    db.add(event)

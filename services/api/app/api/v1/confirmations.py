from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, get_current_auth
from app.api.v1.schemas import ConfirmationEnqueueRequest
from app.application.confirmation_queue_service import ConfirmationQueueService
from app.infrastructure.db.session import get_db

router = APIRouter()


@router.post("/appointments/{appointment_id}/enqueue", status_code=201)
async def enqueue_confirmation(
    appointment_id: UUID,
    body: ConfirmationEnqueueRequest,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await ConfirmationQueueService(db, auth).enqueue(
        appointment_id, channel=body.channel or "whatsapp"
    )


@router.get("/queue")
async def list_queue(
    limit: int = Query(30, ge=1, le=50),
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    items = await ConfirmationQueueService(db, auth).list_queued(limit=limit)
    return {"items": items}

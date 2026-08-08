from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, require_permissions
from app.api.v1.schemas import AiFeedbackRequest
from app.application.ai_observability_service import AiObservabilityService
from app.core.permissions import Permission
from app.infrastructure.db.session import get_db

router = APIRouter()


@router.get("/history")
async def recent_history(
    limit: int = Query(30, ge=1, le=50),
    auth: AuthContext = Depends(require_permissions(Permission.AI_SUPERVISION_USE)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    items = await AiObservabilityService(db, auth).list_recent(limit=limit)
    return {"items": items}


@router.get("/history/patients/{patient_id}")
async def patient_history(
    patient_id: UUID,
    limit: int = Query(20, ge=1, le=50),
    auth: AuthContext = Depends(require_permissions(Permission.AI_SUPERVISION_USE)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    items = await AiObservabilityService(db, auth).list_for_patient(patient_id, limit=limit)
    return {"items": items}


@router.post("/feedback")
async def feedback(
    body: AiFeedbackRequest,
    auth: AuthContext = Depends(require_permissions(Permission.AI_SUPERVISION_USE)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await AiObservabilityService(db, auth).feedback(
        body.output_id,
        useful=body.useful,
        reasons=body.reasons,
        comment=body.comment,
    )

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, get_current_auth
from app.api.v1.schemas import TaskCreateRequest
from app.application.task_service import TaskService
from app.infrastructure.db.session import get_db

router = APIRouter()


@router.get("")
async def list_tasks(
    patient_id: UUID | None = None,
    limit: int = Query(50, ge=1, le=100),
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    items = await TaskService(db, auth).list_open(patient_id=patient_id, limit=limit)
    return {"items": items}


@router.post("", status_code=201)
async def create_task(
    body: TaskCreateRequest,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await TaskService(db, auth).create(body.model_dump(exclude_unset=True))


@router.post("/{task_id}/complete")
async def complete_task(
    task_id: UUID,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await TaskService(db, auth).complete(task_id)

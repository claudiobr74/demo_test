from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, get_current_auth
from app.api.v1.schemas import CaseMemoryCreateRequest, CaseMemoryStatusRequest
from app.application.case_memory_service import CaseMemoryService
from app.infrastructure.db.session import get_db

router = APIRouter()


@router.get("/patients/{patient_id}")
async def list_memory(
    patient_id: UUID,
    kind: str | None = Query(None),
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    items = await CaseMemoryService(db, auth).list_for_patient(patient_id, kind=kind)
    return {"items": items}


@router.post("/patients/{patient_id}", status_code=201)
async def create_memory(
    patient_id: UUID,
    body: CaseMemoryCreateRequest,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await CaseMemoryService(db, auth).create(
        patient_id, body.model_dump(exclude_unset=True)
    )


@router.post("/{entry_id}/accept")
async def accept_memory(
    entry_id: UUID,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await CaseMemoryService(db, auth).accept_suggestion(entry_id)


@router.post("/{entry_id}/status")
async def memory_status(
    entry_id: UUID,
    body: CaseMemoryStatusRequest,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await CaseMemoryService(db, auth).update_status(entry_id, body.status)

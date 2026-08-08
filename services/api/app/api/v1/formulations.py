from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, get_current_auth
from app.api.v1.schemas import FormulationUpsertRequest
from app.application.formulation_service import FormulationService
from app.infrastructure.db.session import get_db

router = APIRouter()


@router.get("/patients/{patient_id}/current")
async def current_formulation(
    patient_id: UUID,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    current = await FormulationService(db, auth).current(patient_id)
    return {"formulation": current}


@router.get("/patients/{patient_id}")
async def list_formulations(
    patient_id: UUID,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    items = await FormulationService(db, auth).list_for_patient(patient_id)
    return {"items": items}


@router.put("/patients/{patient_id}/draft")
async def upsert_draft(
    patient_id: UUID,
    body: FormulationUpsertRequest,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await FormulationService(db, auth).upsert_draft(
        patient_id, body.model_dump(exclude_unset=True)
    )


@router.post("/{formulation_id}/promote")
async def promote_official(
    formulation_id: UUID,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await FormulationService(db, auth).promote_official(formulation_id)

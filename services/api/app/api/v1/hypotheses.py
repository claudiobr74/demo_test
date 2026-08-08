from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, get_current_auth
from app.api.v1.schemas import ClinicalHypothesisCreateRequest, ClinicalHypothesisStrengthRequest
from app.application.clinical_hypothesis_service import ClinicalHypothesisService
from app.infrastructure.db.session import get_db

router = APIRouter()


@router.get("/patients/{patient_id}")
async def list_hypotheses(
    patient_id: UUID,
    include_retired: bool = Query(False),
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    items = await ClinicalHypothesisService(db, auth).list_for_patient(
        patient_id, include_retired=include_retired
    )
    return {"items": items}


@router.post("/patients/{patient_id}", status_code=201)
async def create_hypothesis(
    patient_id: UUID,
    body: ClinicalHypothesisCreateRequest,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await ClinicalHypothesisService(db, auth).create(
        patient_id, body.model_dump(exclude_unset=True)
    )


@router.post("/{hypothesis_id}/strength")
async def update_strength(
    hypothesis_id: UUID,
    body: ClinicalHypothesisStrengthRequest,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await ClinicalHypothesisService(db, auth).update_strength(hypothesis_id, body.strength)


@router.post("/{hypothesis_id}/accept")
async def accept_hypothesis(
    hypothesis_id: UUID,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await ClinicalHypothesisService(db, auth).accept_ai(hypothesis_id)

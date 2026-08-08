from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, get_current_auth
from app.api.v1.schemas import TreatmentGoalCreateRequest, TreatmentGoalUpdateRequest, TreatmentPlanUpsertRequest
from app.application.treatment_plan_service import TreatmentPlanService
from app.infrastructure.db.session import get_db

router = APIRouter()


@router.get("/patients/{patient_id}/current")
async def current_plan(
    patient_id: UUID,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    plan = await TreatmentPlanService(db, auth).current(patient_id)
    return {"plan": plan}


@router.put("/patients/{patient_id}")
async def upsert_plan(
    patient_id: UUID,
    body: TreatmentPlanUpsertRequest,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await TreatmentPlanService(db, auth).upsert_plan(
        patient_id, body.model_dump(exclude_unset=True)
    )


@router.post("/patients/{patient_id}/goals", status_code=201)
async def add_goal(
    patient_id: UUID,
    body: TreatmentGoalCreateRequest,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await TreatmentPlanService(db, auth).add_goal(
        patient_id, body.model_dump(exclude_unset=True)
    )


@router.patch("/goals/{goal_id}")
async def update_goal(
    goal_id: UUID,
    body: TreatmentGoalUpdateRequest,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await TreatmentPlanService(db, auth).update_goal(
        goal_id, body.model_dump(exclude_unset=True)
    )

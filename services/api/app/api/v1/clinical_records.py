from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, get_current_auth
from app.application.clinical_record_service import ClinicalRecordService
from app.infrastructure.db.session import get_db

router = APIRouter()


@router.get("/patients/{patient_id}")
async def list_records(
    patient_id: UUID,
    limit: int = Query(50, ge=1, le=100),
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    items = await ClinicalRecordService(db, auth).list_for_patient(patient_id, limit=limit)
    return {"items": items}


@router.get("/{record_id}")
async def get_record(
    record_id: UUID,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await ClinicalRecordService(db, auth).get(record_id)

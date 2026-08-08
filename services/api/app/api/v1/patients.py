from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, get_current_auth
from app.api.v1.schemas import PatientCreateRequest, PatientUpdateRequest
from app.application.patient_service import PatientService
from app.infrastructure.db.session import get_db

router = APIRouter()


@router.get("")
async def list_patients(
    status: str | None = None,
    q: str | None = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await PatientService(db, auth).list_patients(
        status=status, q=q, limit=limit, offset=offset
    )


@router.post("", status_code=201)
async def create_patient(
    body: PatientCreateRequest,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await PatientService(db, auth).create_patient(body.model_dump(exclude_unset=True))


@router.get("/{patient_id}")
async def get_patient(
    patient_id: UUID,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await PatientService(db, auth).get_patient(patient_id)


@router.patch("/{patient_id}")
async def update_patient(
    patient_id: UUID,
    body: PatientUpdateRequest,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    data = body.model_dump(exclude_unset=True)
    version = data.pop("version", None)
    return await PatientService(db, auth).update_patient(
        patient_id, data, expected_version=version
    )

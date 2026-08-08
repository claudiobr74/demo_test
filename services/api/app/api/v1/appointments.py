from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, get_current_auth
from app.api.v1.schemas import (
    AppointmentCreateRequest,
    AppointmentRescheduleRequest,
    AppointmentStatusRequest,
)
from app.application.appointment_service import AppointmentService
from app.application.confirmation_messages import build_confirmation_message
from app.infrastructure.db.models_clinical import Patient
from app.infrastructure.db.models_identity import Organization
from app.infrastructure.db.session import get_db

router = APIRouter()


@router.post("", status_code=201)
async def create_appointment(
    body: AppointmentCreateRequest,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await AppointmentService(db, auth).create(body.model_dump(exclude_unset=True))


@router.get("")
async def list_appointments(
    start: datetime = Query(...),
    end: datetime = Query(...),
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    items = await AppointmentService(db, auth).list_range(start=start, end=end)
    return {"items": items}


@router.get("/{appointment_id}")
async def get_appointment(
    appointment_id: UUID,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await AppointmentService(db, auth).get(appointment_id)


@router.post("/{appointment_id}/status")
async def update_status(
    appointment_id: UUID,
    body: AppointmentStatusRequest,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await AppointmentService(db, auth).update_status(
        appointment_id, body.status, reason=body.reason
    )


@router.post("/{appointment_id}/reschedule")
async def reschedule(
    appointment_id: UUID,
    body: AppointmentRescheduleRequest,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await AppointmentService(db, auth).reschedule(
        appointment_id,
        starts_at=body.starts_at,
        duration_minutes=body.duration_minutes,
        expected_version=body.version,
    )


@router.get("/{appointment_id}/confirmation-message")
async def confirmation_message(
    appointment_id: UUID,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    service = AppointmentService(db, auth)
    appt = await service._get_owned(appointment_id)
    patient = await db.get(Patient, appt.patient_id)
    org = await db.get(Organization, auth.organization_id)
    return build_confirmation_message(
        patient=patient,  # type: ignore[arg-type]
        appointment=appt,
        professional_name=auth.user.full_name,
        clinic_name=org.name if org else None,
    )

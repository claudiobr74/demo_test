from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, get_current_auth
from app.api.v1.schemas import AppointmentCreateRequest, AppointmentStatusRequest
from app.application.appointment_service import AppointmentService
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

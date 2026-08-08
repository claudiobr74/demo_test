from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, get_current_auth
from app.api.v1.schemas import SessionAutosaveRequest, SessionCloseRequest, SessionStartRequest
from app.application.session_service import SessionService
from app.infrastructure.db.session import get_db

router = APIRouter()


@router.post("/start", status_code=201)
async def start_session(
    body: SessionStartRequest,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await SessionService(db, auth).start(
        patient_id=body.patient_id,
        appointment_id=body.appointment_id,
        idempotency_key=body.idempotency_key,
    )


@router.get("/{session_id}")
async def get_session(
    session_id: UUID,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await SessionService(db, auth).get(session_id)


@router.patch("/{session_id}/autosave")
async def autosave_session(
    session_id: UUID,
    body: SessionAutosaveRequest,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    data = body.model_dump(exclude_unset=True)
    version = data.pop("version", None)
    return await SessionService(db, auth).autosave(session_id, data, expected_version=version)


@router.post("/{session_id}/close")
async def close_session(
    session_id: UUID,
    body: SessionCloseRequest,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await SessionService(db, auth).close(session_id, finalize_record=body.finalize_record)


@router.post("/{session_id}/defer-closure")
async def defer_closure(
    session_id: UUID,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await SessionService(db, auth).mark_pending_closure(session_id)


@router.get("/prepare/{patient_id}")
async def prepare_session(
    patient_id: UUID,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await SessionService(db, auth).prepare_context(patient_id)

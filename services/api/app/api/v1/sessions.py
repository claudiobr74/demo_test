from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, get_current_auth
from app.api.v1.schemas import (
    SessionAutosaveRequest,
    SessionCloseRequest,
    SessionStartRequest,
    TranscriptionApplyRequest,
    TranscriptionProposeRequest,
)
from app.application.session_service import SessionService
from app.infrastructure.db.session import get_db

router = APIRouter()


@router.get("")
async def list_sessions(
    patient_id: UUID = Query(...),
    limit: int = Query(20, ge=1, le=50),
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    items = await SessionService(db, auth).list_for_patient(patient_id, limit=limit)
    return {"items": items}


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


@router.post("/{session_id}/transcription/propose")
async def propose_transcription(
    session_id: UUID,
    body: TranscriptionProposeRequest,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Gravação/transcrição → proposta CFP revisável (não finaliza prontuário)."""
    if not body.audio_base64 and not (body.transcript_text and body.transcript_text.strip()):
        # Allow empty body for offline stub path (audio omitted in tests / paste-later UX)
        pass
    return await SessionService(db, auth).propose_transcription(
        session_id,
        audio_base64=body.audio_base64,
        mime_type=body.mime_type,
        transcript_text=body.transcript_text,
    )


@router.post("/{session_id}/transcription/apply")
async def apply_transcription_proposal(
    session_id: UUID,
    body: TranscriptionApplyRequest,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Aceite humano: preenche rascunho da sessão no modelo CFP (não cria ClinicalRecord)."""
    return await SessionService(db, auth).apply_cfp_proposal(
        session_id,
        focus=body.focus,
        evolution=body.evolution,
        relevant_observations=body.relevant_observations,
        interventions=body.interventions,
        tasks=body.tasks,
        planning=body.planning,
        agreements=body.agreements,
        store_transcript=body.store_transcript,
        expected_version=body.version,
    )


@router.get("/prepare/{patient_id}")
async def prepare_session(
    patient_id: UUID,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await SessionService(db, auth).prepare_context(patient_id)

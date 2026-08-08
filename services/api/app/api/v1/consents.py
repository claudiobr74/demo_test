from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, get_current_auth
from app.api.v1.schemas import ConsentCreateRequest, ConsentDecisionRequest
from app.application.consent_service import ConsentService
from app.core.permissions import Permission
from app.infrastructure.db.session import get_db

router = APIRouter()


@router.get("/templates")
async def list_templates(
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    service = ConsentService(db, auth)
    if auth.has(Permission.CONSENT_WRITE):
        items = await service.ensure_default_templates()
    else:
        items = await service.list_templates()
    return {"items": items}


@router.get("/patients/{patient_id}")
async def list_patient_consents(
    patient_id: UUID,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    items = await ConsentService(db, auth).list_for_patient(patient_id)
    return {"items": items}


@router.post("/patients/{patient_id}", status_code=201)
async def create_patient_consent(
    patient_id: UUID,
    body: ConsentCreateRequest,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await ConsentService(db, auth).create_pending(
        patient_id,
        consent_type=body.consent_type,
        template_id=body.template_id,
    )


@router.post("/{consent_id}/decision")
async def decide_consent(
    consent_id: UUID,
    body: ConsentDecisionRequest,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await ConsentService(db, auth).record_decision(
        consent_id,
        status=body.status,
        method=body.method,
        notes=body.notes,
    )

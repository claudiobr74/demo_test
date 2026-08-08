from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, get_current_auth
from app.api.v1.schemas import DocumentCreateRequest, DocumentFinalizeRequest, DocumentUpdateRequest
from app.application.document_service import DocumentService
from app.infrastructure.db.session import get_db

router = APIRouter()


@router.get("/templates")
async def list_templates(
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    items = await DocumentService(db, auth).list_templates()
    return {"items": items}


@router.get("")
async def list_documents(
    patient_id: UUID | None = None,
    limit: int = Query(50, ge=1, le=100),
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    items = await DocumentService(db, auth).list_documents(patient_id=patient_id, limit=limit)
    return {"items": items}


@router.post("", status_code=201)
async def create_document(
    body: DocumentCreateRequest,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await DocumentService(db, auth).create(body.model_dump(exclude_unset=True))


@router.get("/{document_id}")
async def get_document(
    document_id: UUID,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await DocumentService(db, auth).get(document_id)


@router.patch("/{document_id}")
async def update_document(
    document_id: UUID,
    body: DocumentUpdateRequest,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await DocumentService(db, auth).update_draft(
        document_id, body.model_dump(exclude_unset=True)
    )


@router.post("/{document_id}/finalize")
async def finalize_document(
    document_id: UUID,
    body: DocumentFinalizeRequest,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if not body.confirm:
        return await DocumentService(db, auth).get(document_id)
    return await DocumentService(db, auth).finalize(document_id)


@router.get("/{document_id}/export")
async def export_document(
    document_id: UUID,
    format: str = Query("html", alias="format"),
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await DocumentService(db, auth).export_payload(document_id, fmt=format)

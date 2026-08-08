"""Consent management — purpose-specific, versioned, historically auditable."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext
from app.application.audit import write_audit
from app.core.errors import NotFoundError, ValidationAppError
from app.core.permissions import Permission
from app.infrastructure.db.models_clinical import Consent, ConsentTemplate, Patient

VALID_CONSENT_STATUS = {"pending", "accepted", "refused", "revoked", "expired"}
VALID_TYPES = {
    "data_processing",
    "digital_resources",
    "transcription",
    "ai_processing",
    "telehealth",
    "other",
}


class ConsentService:
    def __init__(self, db: AsyncSession, auth: AuthContext) -> None:
        self.db = db
        self.auth = auth

    async def list_templates(self) -> list[dict]:
        self.auth.require(Permission.CONSENT_READ)
        rows = (
            await self.db.execute(
                select(ConsentTemplate)
                .where(
                    ConsentTemplate.organization_id == self.auth.organization_id,
                    ConsentTemplate.is_active.is_(True),
                )
                .order_by(ConsentTemplate.consent_type, ConsentTemplate.version.desc())
            )
        ).scalars().all()
        return [self._template_dto(t) for t in rows]

    async def ensure_default_templates(self) -> list[dict]:
        self.auth.require(Permission.CONSENT_WRITE)
        existing = await self.list_templates()
        if existing:
            return existing
        defaults = [
            ("data_processing", "1.0", "Tratamento de dados", "Consentimento para tratamento de dados pessoais e clínicos no SerenaPsi."),
            ("digital_resources", "1.0", "Recursos digitais", "Consentimento para uso de recursos digitais do consultório."),
            ("transcription", "1.0", "Transcrição de sessão", "Consentimento específico para gravação e transcrição de áudio."),
            ("ai_processing", "1.0", "Processamento por IA", "Consentimento específico para apoio do Supervisor Clínico por IA."),
        ]
        for ctype, version, title, content in defaults:
            self.db.add(
                ConsentTemplate(
                    organization_id=self.auth.organization_id,
                    consent_type=ctype,
                    version=version,
                    title=title,
                    content=content,
                    is_active=True,
                )
            )
        await self.db.commit()
        return await self.list_templates()

    async def list_for_patient(self, patient_id: uuid.UUID) -> list[dict]:
        self.auth.require(Permission.CONSENT_READ)
        await self._owned_patient(patient_id)
        rows = (
            await self.db.execute(
                select(Consent)
                .where(
                    Consent.organization_id == self.auth.organization_id,
                    Consent.patient_id == patient_id,
                )
                .order_by(Consent.created_at.desc())
            )
        ).scalars().all()
        return [self._consent_dto(c) for c in rows]

    async def create_pending(self, patient_id: uuid.UUID, *, consent_type: str, template_id: uuid.UUID | None = None) -> dict:
        self.auth.require(Permission.CONSENT_WRITE)
        await self._owned_patient(patient_id)
        if consent_type not in VALID_TYPES:
            raise ValidationAppError("Tipo de consentimento inválido.")

        version = "1.0"
        content = None
        title = consent_type
        if template_id:
            template = await self.db.get(ConsentTemplate, template_id)
            if template is None or template.organization_id != self.auth.organization_id:
                raise NotFoundError("Modelo de consentimento não encontrado.")
            version = template.version
            content = template.content
            title = template.title
            consent_type = template.consent_type
        else:
            templates = await self.list_templates()
            match = next((t for t in templates if t["consent_type"] == consent_type), None)
            if match:
                version = match["version"]
                content = match["content"]
                title = match["title"]
                template_id = uuid.UUID(match["id"])

        consent = Consent(
            organization_id=self.auth.organization_id,
            patient_id=patient_id,
            template_id=template_id,
            consent_type=consent_type,
            version=version,
            status="pending",
            content_snapshot=content,
            notes=title,
        )
        self.db.add(consent)
        await self.db.flush()
        await write_audit(
            self.db,
            organization_id=self.auth.organization_id,
            actor_user_id=self.auth.user_id,
            action="consent.created",
            resource_type="consent",
            resource_id=str(consent.id),
            request_id=self.auth.request_id,
            metadata={"consent_type": consent_type, "version": version},
        )
        await self.db.commit()
        await self.db.refresh(consent)
        return self._consent_dto(consent)

    async def record_decision(
        self,
        consent_id: uuid.UUID,
        *,
        status: str,
        method: str | None = None,
        notes: str | None = None,
    ) -> dict:
        self.auth.require(Permission.CONSENT_WRITE)
        if status not in {"accepted", "refused", "revoked"}:
            raise ValidationAppError("Decisão inválida.")
        consent = await self.db.get(Consent, consent_id)
        if consent is None or consent.organization_id != self.auth.organization_id:
            raise NotFoundError("Consentimento não encontrado.")

        now = datetime.now(UTC)
        consent.status = status
        consent.method = method or "manual"
        consent.recorded_by_user_id = self.auth.user_id
        consent.recorded_at = now
        if status == "revoked":
            consent.revoked_at = now
        if notes:
            consent.notes = notes

        await write_audit(
            self.db,
            organization_id=self.auth.organization_id,
            actor_user_id=self.auth.user_id,
            action=f"consent.{status}",
            resource_type="consent",
            resource_id=str(consent.id),
            request_id=self.auth.request_id,
            metadata={"consent_type": consent.consent_type, "version": consent.version},
        )
        await self.db.commit()
        await self.db.refresh(consent)
        return self._consent_dto(consent)

    async def _owned_patient(self, patient_id: uuid.UUID) -> Patient:
        patient = await self.db.get(Patient, patient_id)
        if (
            patient is None
            or patient.organization_id != self.auth.organization_id
            or patient.deleted_at is not None
        ):
            raise NotFoundError("Paciente não encontrado.")
        return patient

    def _template_dto(self, t: ConsentTemplate) -> dict:
        return {
            "id": str(t.id),
            "consent_type": t.consent_type,
            "version": t.version,
            "title": t.title,
            "content": t.content,
            "is_active": t.is_active,
        }

    def _consent_dto(self, c: Consent) -> dict:
        return {
            "id": str(c.id),
            "patient_id": str(c.patient_id),
            "template_id": str(c.template_id) if c.template_id else None,
            "consent_type": c.consent_type,
            "version": c.version,
            "status": c.status,
            "method": c.method,
            "recorded_at": c.recorded_at.isoformat() if c.recorded_at else None,
            "revoked_at": c.revoked_at.isoformat() if c.revoked_at else None,
            "expires_at": c.expires_at.isoformat() if c.expires_at else None,
            "notes": c.notes,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }

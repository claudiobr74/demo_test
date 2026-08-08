"""Clinical records listing — longitudinal chart, never transcript dump."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext
from app.application.audit import write_audit
from app.core.errors import NotFoundError
from app.core.permissions import Permission
from app.infrastructure.db.models_clinical import ClinicalRecord, Patient


class ClinicalRecordService:
    def __init__(self, db: AsyncSession, auth: AuthContext) -> None:
        self.db = db
        self.auth = auth

    async def list_for_patient(self, patient_id: uuid.UUID, *, limit: int = 50) -> list[dict]:
        self.auth.require(Permission.CLINICAL_RECORD_READ)
        await self._owned_patient(patient_id)
        rows = (
            await self.db.execute(
                select(ClinicalRecord)
                .where(
                    ClinicalRecord.organization_id == self.auth.organization_id,
                    ClinicalRecord.patient_id == patient_id,
                )
                .order_by(ClinicalRecord.recorded_at.desc())
                .limit(min(limit, 100))
            )
        ).scalars().all()
        await write_audit(
            self.db,
            organization_id=self.auth.organization_id,
            actor_user_id=self.auth.user_id,
            action="clinical_record.list",
            resource_type="patient",
            resource_id=str(patient_id),
            request_id=self.auth.request_id,
        )
        await self.db.commit()
        return [self._dto(r) for r in rows]

    async def get(self, record_id: uuid.UUID) -> dict:
        self.auth.require(Permission.CLINICAL_RECORD_READ)
        record = await self.db.get(ClinicalRecord, record_id)
        if record is None or record.organization_id != self.auth.organization_id:
            raise NotFoundError("Registro clínico não encontrado.")
        await write_audit(
            self.db,
            organization_id=self.auth.organization_id,
            actor_user_id=self.auth.user_id,
            action="clinical_record.read",
            resource_type="clinical_record",
            resource_id=str(record.id),
            request_id=self.auth.request_id,
        )
        await self.db.commit()
        return self._dto(record, detailed=True)

    async def _owned_patient(self, patient_id: uuid.UUID) -> Patient:
        patient = await self.db.get(Patient, patient_id)
        if (
            patient is None
            or patient.organization_id != self.auth.organization_id
            or patient.deleted_at is not None
        ):
            raise NotFoundError("Paciente não encontrado.")
        return patient

    def _dto(self, r: ClinicalRecord, *, detailed: bool = False) -> dict:
        base = {
            "id": str(r.id),
            "patient_id": str(r.patient_id),
            "session_id": str(r.session_id) if r.session_id else None,
            "recorded_at": r.recorded_at.isoformat(),
            "session_type": r.session_type,
            "status": r.status,
            "focus": r.focus,
            "version": r.version,
        }
        if not detailed:
            return {
                **base,
                "evolution_preview": (r.evolution or "")[:180],
            }
        return {
            **base,
            "evolution": r.evolution,
            "interventions": r.interventions,
            "relevant_observations": r.relevant_observations,
            "tasks": r.tasks,
            "planning": r.planning,
            "finalized_at": r.finalized_at.isoformat() if r.finalized_at else None,
            "previous_version_id": str(r.previous_version_id) if r.previous_version_id else None,
        }

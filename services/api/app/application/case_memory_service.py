"""Case memory service — human decides; AI only suggests."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext
from app.application.audit import write_audit
from app.core.errors import NotFoundError, ValidationAppError
from app.core.permissions import Permission
from app.infrastructure.db.models_clinical import Patient
from app.infrastructure.db.models_memory import CaseMemoryEntry

VALID_KINDS = {"fact", "observation", "hypothesis"}
VALID_EPISTEMOLOGY = {
    "documented_fact",
    "clinical_observation",
    "inference",
    "working_hypothesis",
    "insufficient_information",
}
VALID_STATUS = {"active", "strengthened", "weakened", "retired"}


class CaseMemoryService:
    def __init__(self, db: AsyncSession, auth: AuthContext) -> None:
        self.db = db
        self.auth = auth

    async def list_for_patient(self, patient_id: uuid.UUID, *, kind: str | None = None) -> list[dict]:
        self.auth.require(Permission.CLINICAL_RECORD_READ)
        await self._owned_patient(patient_id)
        q = select(CaseMemoryEntry).where(
            CaseMemoryEntry.organization_id == self.auth.organization_id,
            CaseMemoryEntry.patient_id == patient_id,
            CaseMemoryEntry.status != "retired",
        )
        if kind:
            q = q.where(CaseMemoryEntry.kind == kind)
        rows = (await self.db.execute(q.order_by(CaseMemoryEntry.created_at.desc()))).scalars().all()
        return [self._dto(r) for r in rows]

    async def create(self, patient_id: uuid.UUID, data: dict) -> dict:
        self.auth.require(Permission.CLINICAL_RECORD_WRITE)
        await self._owned_patient(patient_id)
        kind = data.get("kind") or "observation"
        epistemology = data.get("epistemology") or (
            "documented_fact" if kind == "fact" else
            "working_hypothesis" if kind == "hypothesis" else
            "clinical_observation"
        )
        if kind not in VALID_KINDS:
            raise ValidationAppError("Tipo de memória inválido.")
        if epistemology not in VALID_EPISTEMOLOGY:
            raise ValidationAppError("Epistemologia inválida.")
        content = (data.get("content") or "").strip()
        if not content:
            raise ValidationAppError("Conteúdo obrigatório.")

        entry = CaseMemoryEntry(
            organization_id=self.auth.organization_id,
            patient_id=patient_id,
            kind=kind,
            epistemology=epistemology,
            content=content,
            status="active",
            provenance=data.get("provenance") or [],
            framework=data.get("framework"),
            created_by_user_id=self.auth.user_id,
            source=data.get("source") or "professional",
            accepted_at=datetime.now(UTC) if data.get("source") != "ai_suggestion" else None,
        )
        if entry.source == "ai_suggestion":
            # AI suggestions stay pending until accepted
            entry.status = "active"
            entry.accepted_at = None

        self.db.add(entry)
        await self.db.flush()
        await write_audit(
            self.db,
            organization_id=self.auth.organization_id,
            actor_user_id=self.auth.user_id,
            action="case_memory.created",
            resource_type="case_memory_entry",
            resource_id=str(entry.id),
            request_id=self.auth.request_id,
            metadata={"kind": kind, "source": entry.source},
        )
        await self.db.commit()
        await self.db.refresh(entry)
        return self._dto(entry)

    async def accept_suggestion(self, entry_id: uuid.UUID) -> dict:
        self.auth.require(Permission.CLINICAL_RECORD_WRITE)
        entry = await self._owned_entry(entry_id)
        if entry.source != "ai_suggestion":
            raise ValidationAppError("Apenas sugestões da IA precisam de aceite.")
        entry.accepted_at = datetime.now(UTC)
        entry.source = "professional"
        await write_audit(
            self.db,
            organization_id=self.auth.organization_id,
            actor_user_id=self.auth.user_id,
            action="case_memory.accepted",
            resource_type="case_memory_entry",
            resource_id=str(entry.id),
            request_id=self.auth.request_id,
        )
        await self.db.commit()
        return self._dto(entry)

    async def update_status(self, entry_id: uuid.UUID, status: str) -> dict:
        self.auth.require(Permission.CLINICAL_RECORD_WRITE)
        if status not in VALID_STATUS:
            raise ValidationAppError("Status inválido.")
        entry = await self._owned_entry(entry_id)
        entry.status = status
        await self.db.commit()
        return self._dto(entry)

    async def context_bundle(self, patient_id: uuid.UUID) -> dict:
        """Compact memory for prepare_session / supervisor."""
        self.auth.require(Permission.CLINICAL_RECORD_READ)
        items = await self.list_for_patient(patient_id)
        return {
            "facts": [i for i in items if i["kind"] == "fact"][:20],
            "observations": [i for i in items if i["kind"] == "observation"][:20],
            "hypotheses": [i for i in items if i["kind"] == "hypothesis"][:15],
        }

    async def _owned_patient(self, patient_id: uuid.UUID) -> Patient:
        patient = await self.db.get(Patient, patient_id)
        if (
            patient is None
            or patient.organization_id != self.auth.organization_id
            or patient.deleted_at is not None
        ):
            raise NotFoundError("Paciente não encontrado.")
        return patient

    async def _owned_entry(self, entry_id: uuid.UUID) -> CaseMemoryEntry:
        entry = await self.db.get(CaseMemoryEntry, entry_id)
        if entry is None or entry.organization_id != self.auth.organization_id:
            raise NotFoundError("Memória não encontrada.")
        return entry

    def _dto(self, e: CaseMemoryEntry) -> dict:
        return {
            "id": str(e.id),
            "patient_id": str(e.patient_id),
            "kind": e.kind,
            "epistemology": e.epistemology,
            "content": e.content,
            "status": e.status,
            "provenance": e.provenance,
            "framework": e.framework,
            "source": e.source,
            "accepted_at": e.accepted_at.isoformat() if e.accepted_at else None,
            "created_at": e.created_at.isoformat() if e.created_at else None,
            "pending_review": e.source == "ai_suggestion" and e.accepted_at is None,
        }

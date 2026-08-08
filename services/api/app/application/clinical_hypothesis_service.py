"""Clinical hypotheses — versioned working hypotheses linked to living formulation."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext
from app.application.audit import write_audit
from app.core.errors import NotFoundError, ValidationAppError
from app.core.permissions import Permission
from app.infrastructure.db.models_clinical import CaseFormulation, ClinicalHypothesis, Patient

VALID_EPISTEMOLOGY = {
    "documented_fact",
    "clinical_observation",
    "inference",
    "working_hypothesis",
    "insufficient_information",
}
VALID_STRENGTH = {"active", "strengthened", "weakened", "retired"}


class ClinicalHypothesisService:
    def __init__(self, db: AsyncSession, auth: AuthContext) -> None:
        self.db = db
        self.auth = auth

    async def list_for_patient(self, patient_id: uuid.UUID, *, include_retired: bool = False) -> list[dict]:
        self.auth.require(Permission.CLINICAL_RECORD_READ)
        await self._owned_patient(patient_id)
        q = select(ClinicalHypothesis).where(
            ClinicalHypothesis.organization_id == self.auth.organization_id,
            ClinicalHypothesis.patient_id == patient_id,
        )
        if not include_retired:
            q = q.where(ClinicalHypothesis.strength != "retired")
        rows = (
            await self.db.execute(q.order_by(ClinicalHypothesis.created_at.desc()))
        ).scalars().all()
        return [self._dto(r) for r in rows]

    async def create(self, patient_id: uuid.UUID, data: dict) -> dict:
        self.auth.require(Permission.CLINICAL_RECORD_WRITE)
        await self._owned_patient(patient_id)
        statement = (data.get("statement") or "").strip()
        if not statement:
            raise ValidationAppError("Enunciado da hipótese obrigatório.")
        epistemology = data.get("epistemology") or "working_hypothesis"
        if epistemology not in VALID_EPISTEMOLOGY:
            raise ValidationAppError("Epistemologia inválida.")
        formulation_id = data.get("formulation_id")
        if formulation_id:
            fid = formulation_id if isinstance(formulation_id, uuid.UUID) else uuid.UUID(str(formulation_id))
            await self._owned_formulation(fid, patient_id)
        else:
            # Auto-link to current official/draft formulation when present
            current = await self.db.scalar(
                select(CaseFormulation)
                .where(
                    CaseFormulation.organization_id == self.auth.organization_id,
                    CaseFormulation.patient_id == patient_id,
                    CaseFormulation.status.in_(["official", "draft"]),
                )
                .order_by(CaseFormulation.is_official.desc(), CaseFormulation.updated_at.desc())
                .limit(1)
            )
            fid = current.id if current else None

        hyp = ClinicalHypothesis(
            organization_id=self.auth.organization_id,
            patient_id=patient_id,
            formulation_id=fid,
            statement=statement,
            epistemology=epistemology,
            strength=data.get("strength") or "active",
            provenance=data.get("provenance") or [],
            framework=data.get("framework"),
            created_by=data.get("created_by") or "professional",
            accepted_at=datetime.now(UTC) if data.get("created_by") != "ai_suggestion" else None,
        )
        if hyp.strength not in VALID_STRENGTH:
            raise ValidationAppError("Status de força inválido.")
        self.db.add(hyp)
        await self.db.flush()
        await write_audit(
            self.db,
            organization_id=self.auth.organization_id,
            actor_user_id=self.auth.user_id,
            action="clinical_hypothesis.created",
            resource_type="clinical_hypothesis",
            resource_id=str(hyp.id),
            request_id=self.auth.request_id,
            metadata={"epistemology": epistemology, "formulation_id": str(fid) if fid else None},
        )
        await self.db.commit()
        await self.db.refresh(hyp)
        return self._dto(hyp)

    async def update_strength(self, hypothesis_id: uuid.UUID, strength: str) -> dict:
        self.auth.require(Permission.CLINICAL_RECORD_WRITE)
        if strength not in VALID_STRENGTH:
            raise ValidationAppError("Status de força inválido.")
        hyp = await self._owned(hypothesis_id)
        hyp.strength = strength
        await self.db.commit()
        return self._dto(hyp)

    async def accept_ai(self, hypothesis_id: uuid.UUID) -> dict:
        self.auth.require(Permission.CLINICAL_RECORD_WRITE)
        hyp = await self._owned(hypothesis_id)
        if hyp.created_by != "ai_suggestion":
            raise ValidationAppError("Apenas hipóteses sugeridas pela IA precisam de aceite.")
        hyp.accepted_at = datetime.now(UTC)
        hyp.created_by = "professional"
        await self.db.commit()
        return self._dto(hyp)

    async def import_from_supervisor(self, patient_id: uuid.UUID, hypotheses: list) -> list[dict]:
        """Create AI suggestions as clinical hypotheses — professional must accept."""
        created = []
        for item in hypotheses[:8]:
            text = item if isinstance(item, str) else item.get("text") or item.get("statement") or ""
            if not text:
                continue
            created.append(
                await self.create(
                    patient_id,
                    {
                        "statement": str(text),
                        "epistemology": "working_hypothesis",
                        "created_by": "ai_suggestion",
                        "framework": item.get("framework") if isinstance(item, dict) else None,
                    },
                )
            )
        return created

    async def _owned_patient(self, patient_id: uuid.UUID) -> Patient:
        patient = await self.db.get(Patient, patient_id)
        if (
            patient is None
            or patient.organization_id != self.auth.organization_id
            or patient.deleted_at is not None
        ):
            raise NotFoundError("Paciente não encontrado.")
        return patient

    async def _owned_formulation(self, formulation_id: uuid.UUID, patient_id: uuid.UUID) -> CaseFormulation:
        row = await self.db.get(CaseFormulation, formulation_id)
        if (
            row is None
            or row.organization_id != self.auth.organization_id
            or row.patient_id != patient_id
        ):
            raise NotFoundError("Formulação não encontrada.")
        return row

    async def _owned(self, hypothesis_id: uuid.UUID) -> ClinicalHypothesis:
        hyp = await self.db.get(ClinicalHypothesis, hypothesis_id)
        if hyp is None or hyp.organization_id != self.auth.organization_id:
            raise NotFoundError("Hipótese não encontrada.")
        return hyp

    def _dto(self, h: ClinicalHypothesis) -> dict:
        return {
            "id": str(h.id),
            "patient_id": str(h.patient_id),
            "formulation_id": str(h.formulation_id) if h.formulation_id else None,
            "statement": h.statement,
            "epistemology": h.epistemology,
            "strength": h.strength,
            "provenance": h.provenance or [],
            "framework": h.framework,
            "created_by": h.created_by,
            "accepted_at": h.accepted_at.isoformat() if h.accepted_at else None,
            "pending_review": h.created_by == "ai_suggestion" and h.accepted_at is None,
            "created_at": h.created_at.isoformat() if h.created_at else None,
        }

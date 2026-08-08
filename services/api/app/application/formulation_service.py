"""Living case formulation — versioned, professional-owned, AI only suggests."""

from __future__ import annotations

import uuid
from copy import deepcopy

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext
from app.application.audit import write_audit
from app.core.errors import ConflictError, NotFoundError, ValidationAppError
from app.core.permissions import Permission
from app.infrastructure.db.models_clinical import CaseFormulation, Patient

VALID_STATUS = {"draft", "official", "archived"}

EMPTY_BODY = {
    "presenting_problems": [],
    "precipitating_factors": [],
    "maintaining_factors": [],
    "protective_factors": [],
    "core_beliefs_or_schemas": [],
    "working_hypotheses": [],
    "therapeutic_focus": "",
    "notes": "",
    "linked_memory_ids": [],
}


class FormulationService:
    def __init__(self, db: AsyncSession, auth: AuthContext) -> None:
        self.db = db
        self.auth = auth

    async def current(self, patient_id: uuid.UUID) -> dict | None:
        self.auth.require(Permission.CLINICAL_RECORD_READ)
        await self._owned_patient(patient_id)
        official = await self.db.scalar(
            select(CaseFormulation)
            .where(
                CaseFormulation.organization_id == self.auth.organization_id,
                CaseFormulation.patient_id == patient_id,
                CaseFormulation.is_official.is_(True),
                CaseFormulation.status == "official",
            )
            .order_by(CaseFormulation.version.desc())
            .limit(1)
        )
        if official:
            return self._dto(official)
        draft = await self.db.scalar(
            select(CaseFormulation)
            .where(
                CaseFormulation.organization_id == self.auth.organization_id,
                CaseFormulation.patient_id == patient_id,
                CaseFormulation.status == "draft",
            )
            .order_by(CaseFormulation.updated_at.desc())
            .limit(1)
        )
        return self._dto(draft) if draft else None

    async def list_for_patient(self, patient_id: uuid.UUID) -> list[dict]:
        self.auth.require(Permission.CLINICAL_RECORD_READ)
        await self._owned_patient(patient_id)
        rows = (
            await self.db.execute(
                select(CaseFormulation)
                .where(
                    CaseFormulation.organization_id == self.auth.organization_id,
                    CaseFormulation.patient_id == patient_id,
                )
                .order_by(CaseFormulation.version.desc())
            )
        ).scalars().all()
        return [self._dto(r) for r in rows]

    async def upsert_draft(self, patient_id: uuid.UUID, data: dict) -> dict:
        self.auth.require(Permission.CLINICAL_RECORD_WRITE)
        patient = await self._owned_patient(patient_id)
        framework = data.get("framework") or patient.framework or self.auth.user.default_framework or "cbt"
        body = _merge_body(data.get("body"))

        draft = await self.db.scalar(
            select(CaseFormulation)
            .where(
                CaseFormulation.organization_id == self.auth.organization_id,
                CaseFormulation.patient_id == patient_id,
                CaseFormulation.status == "draft",
            )
            .order_by(CaseFormulation.updated_at.desc())
            .limit(1)
        )
        expected = data.get("version")
        if draft is None:
            latest_version = await self.db.scalar(
                select(CaseFormulation.version)
                .where(
                    CaseFormulation.organization_id == self.auth.organization_id,
                    CaseFormulation.patient_id == patient_id,
                )
                .order_by(CaseFormulation.version.desc())
                .limit(1)
            )
            draft = CaseFormulation(
                organization_id=self.auth.organization_id,
                patient_id=patient_id,
                framework=framework,
                version=(latest_version or 0) + 1,
                status="draft",
                body=body,
                is_official=False,
                created_by_user_id=self.auth.user_id,
            )
            self.db.add(draft)
            action = "formulation.draft_created"
        else:
            if expected is not None and draft.version != expected:
                raise ConflictError(
                    "A formulação foi alterada em outro lugar. Recarregue e tente novamente.",
                    code="OPTIMISTIC_LOCK",
                )
            draft.framework = framework
            draft.body = body
            draft.version += 1
            action = "formulation.draft_updated"

        await self.db.flush()
        await write_audit(
            self.db,
            organization_id=self.auth.organization_id,
            actor_user_id=self.auth.user_id,
            action=action,
            resource_type="case_formulation",
            resource_id=str(draft.id),
            request_id=self.auth.request_id,
            metadata={"framework": framework},
        )
        await self.db.commit()
        await self.db.refresh(draft)
        return self._dto(draft)

    async def promote_official(self, formulation_id: uuid.UUID) -> dict:
        self.auth.require(Permission.CLINICAL_RECORD_WRITE)
        draft = await self._owned(formulation_id)
        if draft.status == "archived":
            raise ValidationAppError("Formulação arquivada não pode ser promovida.")

        previous = (
            await self.db.execute(
                select(CaseFormulation).where(
                    CaseFormulation.organization_id == self.auth.organization_id,
                    CaseFormulation.patient_id == draft.patient_id,
                    CaseFormulation.is_official.is_(True),
                    CaseFormulation.id != draft.id,
                )
            )
        ).scalars().all()
        for prev in previous:
            prev.is_official = False
            prev.status = "archived"

        draft.status = "official"
        draft.is_official = True
        draft.version += 1
        await write_audit(
            self.db,
            organization_id=self.auth.organization_id,
            actor_user_id=self.auth.user_id,
            action="formulation.promoted_official",
            resource_type="case_formulation",
            resource_id=str(draft.id),
            request_id=self.auth.request_id,
        )
        await self.db.commit()
        await self.db.refresh(draft)
        return self._dto(draft)

    async def apply_ai_suggestion(self, patient_id: uuid.UUID, suggestion: dict) -> dict:
        """Persist AI suggestion as draft body fields — professional still owns content."""
        self.auth.require(Permission.CLINICAL_RECORD_WRITE)
        body = _merge_body({})
        if suggestion.get("suggested_focus"):
            focus = suggestion["suggested_focus"]
            body["therapeutic_focus"] = focus[0] if isinstance(focus, list) else str(focus)
        for h in suggestion.get("hypotheses") or []:
            text = h if isinstance(h, str) else h.get("text") or h.get("statement") or ""
            if text:
                body["working_hypotheses"].append(
                    {
                        "text": text,
                        "epistemology": "working_hypothesis",
                        "source": "ai_suggestion",
                    }
                )
        for o in suggestion.get("observations") or []:
            text = o if isinstance(o, str) else o.get("text") or o.get("content") or ""
            if text:
                body["maintaining_factors"].append(text)
        notes = suggestion.get("summary", {}).get("message") if isinstance(suggestion.get("summary"), dict) else None
        if notes:
            body["notes"] = f"[Sugestão Supervisor]\n{notes}"
        return await self.upsert_draft(
            patient_id,
            {"body": body, "framework": suggestion.get("metadata", {}).get("framework")},
        )

    async def compact_for_context(self, patient_id: uuid.UUID) -> dict | None:
        current = await self.current(patient_id)
        if not current:
            return None
        body = current.get("body") or {}
        return {
            "id": current["id"],
            "framework": current["framework"],
            "status": current["status"],
            "is_official": current["is_official"],
            "therapeutic_focus": body.get("therapeutic_focus"),
            "working_hypotheses": (body.get("working_hypotheses") or [])[:8],
            "presenting_problems": (body.get("presenting_problems") or [])[:8],
            "maintaining_factors": (body.get("maintaining_factors") or [])[:8],
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

    async def _owned(self, formulation_id: uuid.UUID) -> CaseFormulation:
        row = await self.db.get(CaseFormulation, formulation_id)
        if row is None or row.organization_id != self.auth.organization_id:
            raise NotFoundError("Formulação não encontrada.")
        return row

    def _dto(self, f: CaseFormulation) -> dict:
        return {
            "id": str(f.id),
            "patient_id": str(f.patient_id),
            "framework": f.framework,
            "version": f.version,
            "status": f.status,
            "is_official": f.is_official,
            "body": f.body or deepcopy(EMPTY_BODY),
            "created_by_user_id": str(f.created_by_user_id),
            "updated_at": f.updated_at.isoformat() if f.updated_at else None,
        }


def _merge_body(raw: dict | None) -> dict:
    body = deepcopy(EMPTY_BODY)
    if not raw:
        return body
    for key in EMPTY_BODY:
        if key in raw and raw[key] is not None:
            body[key] = raw[key]
    return body

"""Clinical session lifecycle — autosave, closure flow, records."""

from __future__ import annotations

import hashlib
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext
from app.application.audit import write_audit
from app.core.errors import ConflictError, ForbiddenError, NotFoundError, ValidationAppError
from app.core.permissions import Permission
from app.infrastructure.db.models_clinical import ClinicalRecord, ClinicalSession, Patient, Task

SESSION_FIELDS = (
    "focus",
    "observations",
    "events",
    "interventions",
    "responses",
    "hypotheses",
    "tasks",
    "agreements",
    "planning",
)


class SessionService:
    def __init__(self, db: AsyncSession, auth: AuthContext) -> None:
        self.db = db
        self.auth = auth

    async def start(
        self,
        *,
        patient_id: uuid.UUID,
        appointment_id: uuid.UUID | None = None,
        idempotency_key: str | None = None,
    ) -> dict:
        self.auth.require(Permission.SESSION_WRITE)
        patient = await self._owned_patient(patient_id)

        session = ClinicalSession(
            organization_id=self.auth.organization_id,
            patient_id=patient.id,
            appointment_id=appointment_id,
            professional_id=self.auth.user_id,
            status="in_progress",
            started_at=datetime.now(UTC),
            structured_data={},
        )
        self.db.add(session)
        await self.db.flush()
        await write_audit(
            self.db,
            organization_id=self.auth.organization_id,
            actor_user_id=self.auth.user_id,
            action="session.started",
            resource_type="session",
            resource_id=str(session.id),
            request_id=self.auth.request_id,
        )
        await self.db.commit()
        await self.db.refresh(session)
        return self._to_dto(session, patient)

    async def autosave(self, session_id: uuid.UUID, data: dict, *, expected_version: int | None) -> dict:
        self.auth.require(Permission.SESSION_WRITE)
        session = await self._owned_session(session_id)
        if session.status not in {"draft", "in_progress", "pending_closure"}:
            raise ValidationAppError("Sessão finalizada não pode ser editada.")

        if expected_version is not None and session.version != expected_version:
            raise ConflictError(
                "A sessão foi alterada em outro dispositivo. Recarregue antes de continuar.",
                code="OPTIMISTIC_LOCK",
            )

        for field in SESSION_FIELDS:
            if field in data:
                setattr(session, field, data[field])
        if "structured_data" in data and isinstance(data["structured_data"], dict):
            session.structured_data = data["structured_data"]

        session.autosave_at = datetime.now(UTC)
        session.version += 1
        await self.db.commit()
        await self.db.refresh(session)
        return {
            "id": str(session.id),
            "version": session.version,
            "autosave_at": session.autosave_at.isoformat(),
            "save_state": "saved",
        }

    async def get(self, session_id: uuid.UUID) -> dict:
        self.auth.require(Permission.SESSION_READ)
        session = await self._owned_session(session_id)
        patient = await self.db.get(Patient, session.patient_id)
        await write_audit(
            self.db,
            organization_id=self.auth.organization_id,
            actor_user_id=self.auth.user_id,
            action="session.read",
            resource_type="session",
            resource_id=str(session.id),
            request_id=self.auth.request_id,
        )
        await self.db.commit()
        return self._to_dto(session, patient)

    async def close(self, session_id: uuid.UUID, *, finalize_record: bool = True) -> dict:
        """Guided closure: clinical content → evolution → tasks → next → finance."""
        self.auth.require(Permission.SESSION_WRITE)
        session = await self._owned_session(session_id)
        if session.status == "completed":
            raise ValidationAppError("Sessão já finalizada.")

        patient = await self.db.get(Patient, session.patient_id)
        session.status = "completed"
        session.ended_at = datetime.now(UTC)
        session.version += 1

        record_dto = None
        if finalize_record:
            self.auth.require(Permission.CLINICAL_RECORD_WRITE)
            content = {
                "evolution": session.observations,
                "focus": session.focus,
                "interventions": session.interventions,
                "relevant_observations": session.events,
                "tasks": session.tasks,
                "planning": session.planning,
            }
            digest = hashlib.sha256(
                "|".join((content.get(k) or "") for k in sorted(content)).encode()
            ).hexdigest()
            record = ClinicalRecord(
                organization_id=self.auth.organization_id,
                patient_id=session.patient_id,
                session_id=session.id,
                professional_id=self.auth.user_id,
                recorded_at=session.ended_at,
                evolution=content["evolution"],
                focus=content["focus"],
                interventions=content["interventions"],
                relevant_observations=content["relevant_observations"],
                tasks=content["tasks"],
                planning=content["planning"],
                status="finalized",
                finalized_at=session.ended_at,
                content_hash=digest,
            )
            self.db.add(record)
            await self.db.flush()
            record_dto = {"id": str(record.id), "status": record.status}

        charge_dto = None
        package_dto = None
        if patient and self.auth.has(Permission.FINANCE_WRITE):
            from app.application.finance_service import FinanceService
            from app.application.package_service import PackageService

            packages = PackageService(self.db, self.auth)
            package_dto = await packages.use_for_session(
                patient_id=session.patient_id,
                session_id=session.id,
            )
            if package_dto is None:
                finance = FinanceService(self.db, self.auth)
                charge = await finance.ensure_session_charge(
                    patient_id=session.patient_id,
                    session_id=session.id,
                    amount=patient.session_fee,
                    description=f"Sessão · {patient.display_name}",
                )
                if charge is not None:
                    await self.db.flush()
                    charge_dto = {
                        "id": str(charge.id),
                        "amount": str(charge.amount),
                        "status": charge.status,
                        "description": charge.description,
                        "patient_display_name": patient.display_name,
                    }

        await write_audit(
            self.db,
            organization_id=self.auth.organization_id,
            actor_user_id=self.auth.user_id,
            action="session.completed",
            resource_type="session",
            resource_id=str(session.id),
            request_id=self.auth.request_id,
        )
        await self.db.commit()
        return {
            **self._to_dto(session, patient),
            "clinical_record": record_dto,
            "charge": charge_dto,
            "package": package_dto,
        }

    async def mark_pending_closure(self, session_id: uuid.UUID) -> dict:
        self.auth.require(Permission.SESSION_WRITE)
        session = await self._owned_session(session_id)
        session.status = "pending_closure"
        session.incomplete_reason = "Fechamento adiado"
        session.version += 1

        task = Task(
            organization_id=self.auth.organization_id,
            patient_id=session.patient_id,
            assignee_user_id=self.auth.user_id,
            title="Finalizar registro clínico",
            kind="clinical",
            status="open",
            source="incomplete_record",
            source_resource_type="session",
            source_resource_id=str(session.id),
            priority=10,
        )
        self.db.add(task)
        await self.db.commit()
        patient = await self.db.get(Patient, session.patient_id)
        return self._to_dto(session, patient)

    async def list_for_patient(self, patient_id: uuid.UUID, *, limit: int = 20) -> list[dict]:
        self.auth.require(Permission.SESSION_READ)
        await self._owned_patient(patient_id)
        rows = (
            await self.db.execute(
                select(ClinicalSession)
                .where(
                    ClinicalSession.organization_id == self.auth.organization_id,
                    ClinicalSession.patient_id == patient_id,
                )
                .order_by(ClinicalSession.started_at.desc().nullslast())
                .limit(min(limit, 50))
            )
        ).scalars().all()
        patient = await self.db.get(Patient, patient_id)
        return [self._to_dto(s, patient) for s in rows]

    async def prepare_context(self, patient_id: uuid.UUID) -> dict:
        """Session prep — only relevant clinical context, not ten evolutions."""
        self.auth.require(Permission.CLINICAL_RECORD_READ)
        patient = await self._owned_patient(patient_id)
        last_records = (
            await self.db.execute(
                select(ClinicalRecord)
                .where(
                    ClinicalRecord.organization_id == self.auth.organization_id,
                    ClinicalRecord.patient_id == patient_id,
                    ClinicalRecord.status == "finalized",
                )
                .order_by(ClinicalRecord.recorded_at.desc())
                .limit(3)
            )
        ).scalars().all()

        open_tasks = (
            await self.db.execute(
                select(Task).where(
                    Task.organization_id == self.auth.organization_id,
                    Task.patient_id == patient_id,
                    Task.status == "open",
                    Task.kind == "clinical",
                ).limit(10)
            )
        ).scalars().all()

        last = last_records[0] if last_records else None
        memory: dict = {"facts": [], "observations": [], "hypotheses": []}
        try:
            from app.application.case_memory_service import CaseMemoryService

            memory = await CaseMemoryService(self.db, self.auth).context_bundle(patient_id)
        except Exception:
            memory = {"facts": [], "observations": [], "hypotheses": []}

        formulation = None
        try:
            from app.application.formulation_service import FormulationService

            formulation = await FormulationService(self.db, self.auth).compact_for_context(
                patient_id
            )
        except Exception:
            formulation = None

        active_goals: list[dict] = []
        try:
            from app.application.treatment_plan_service import TreatmentPlanService

            active_goals = await TreatmentPlanService(self.db, self.auth).active_goals_compact(
                patient_id
            )
        except Exception:
            active_goals = []

        suggested = None
        if formulation and formulation.get("therapeutic_focus"):
            suggested = formulation["therapeutic_focus"]
        elif last:
            suggested = last.planning

        return {
            "patient": {
                "id": str(patient.id),
                "display_name": patient.display_name,
                "framework": patient.framework or self.auth.user.default_framework,
            },
            "last_session_summary": {
                "recorded_at": last.recorded_at.isoformat() if last else None,
                "focus": last.focus if last else None,
                "evolution": last.evolution if last else None,
                "planning": last.planning if last else None,
                "tasks": last.tasks if last else None,
            }
            if last
            else None,
            "recent_records": [
                {
                    "id": str(r.id),
                    "recorded_at": r.recorded_at.isoformat(),
                    "focus": r.focus,
                    "evolution_preview": (r.evolution or "")[:160],
                }
                for r in last_records
            ],
            "case_memory": memory,
            "formulation": formulation,
            "active_goals": active_goals,
            "active_tasks": [{"id": str(t.id), "title": t.title} for t in open_tasks],
            "suggested_focus": suggested,
            "supervisor_action": "Abrir Supervisor IA — Preparar próxima sessão",
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

    async def _owned_session(self, session_id: uuid.UUID) -> ClinicalSession:
        session = await self.db.get(ClinicalSession, session_id)
        if session is None or session.organization_id != self.auth.organization_id:
            raise NotFoundError("Sessão não encontrada.")
        if session.professional_id != self.auth.user_id and not self.auth.has(
            Permission.ORGANIZATION_MANAGE
        ):
            raise ForbiddenError()
        return session

    def _to_dto(self, s: ClinicalSession, p: Patient | None) -> dict:
        return {
            "id": str(s.id),
            "patient_id": str(s.patient_id),
            "patient_display_name": p.display_name if p else None,
            "appointment_id": str(s.appointment_id) if s.appointment_id else None,
            "status": s.status,
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "ended_at": s.ended_at.isoformat() if s.ended_at else None,
            "focus": s.focus,
            "observations": s.observations,
            "events": s.events,
            "interventions": s.interventions,
            "responses": s.responses,
            "hypotheses": s.hypotheses,
            "tasks": s.tasks,
            "agreements": s.agreements,
            "planning": s.planning,
            "structured_data": s.structured_data,
            "autosave_at": s.autosave_at.isoformat() if s.autosave_at else None,
            "version": s.version,
            "save_state": "saved",
        }

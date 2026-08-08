"""Treatment plan + goals — clinical planning owned by the professional."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext
from app.application.audit import write_audit
from app.core.errors import NotFoundError, ValidationAppError
from app.core.permissions import Permission
from app.infrastructure.db.models_clinical import Patient, TreatmentGoal, TreatmentPlan

VALID_PLAN_STATUS = {"active", "paused", "completed", "archived"}
VALID_GOAL_STATUS = {"active", "achieved", "paused", "dropped"}


class TreatmentPlanService:
    def __init__(self, db: AsyncSession, auth: AuthContext) -> None:
        self.db = db
        self.auth = auth

    async def current(self, patient_id: uuid.UUID) -> dict | None:
        self.auth.require(Permission.CLINICAL_RECORD_READ)
        await self._owned_patient(patient_id)
        plan = await self.db.scalar(
            select(TreatmentPlan)
            .where(
                TreatmentPlan.organization_id == self.auth.organization_id,
                TreatmentPlan.patient_id == patient_id,
                TreatmentPlan.status.in_(["active", "paused"]),
            )
            .order_by(TreatmentPlan.updated_at.desc())
            .limit(1)
        )
        if plan is None:
            return None
        goals = await self._goals_for_plan(plan.id)
        return self._plan_dto(plan, goals)

    async def upsert_plan(self, patient_id: uuid.UUID, data: dict) -> dict:
        self.auth.require(Permission.CLINICAL_RECORD_WRITE)
        await self._owned_patient(patient_id)

        plan = await self.db.scalar(
            select(TreatmentPlan)
            .where(
                TreatmentPlan.organization_id == self.auth.organization_id,
                TreatmentPlan.patient_id == patient_id,
                TreatmentPlan.status.in_(["active", "paused"]),
            )
            .order_by(TreatmentPlan.updated_at.desc())
            .limit(1)
        )
        if plan is None:
            latest = await self.db.scalar(
                select(TreatmentPlan.version)
                .where(
                    TreatmentPlan.organization_id == self.auth.organization_id,
                    TreatmentPlan.patient_id == patient_id,
                )
                .order_by(TreatmentPlan.version.desc())
                .limit(1)
            )
            plan = TreatmentPlan(
                organization_id=self.auth.organization_id,
                patient_id=patient_id,
                version=(latest or 0) + 1,
                status=data.get("status") or "active",
                priority_problems=data.get("priority_problems") or [],
                initial_formulation_summary=data.get("initial_formulation_summary"),
                body=data.get("body") or {},
            )
            self.db.add(plan)
            action = "treatment_plan.created"
        else:
            if "priority_problems" in data:
                plan.priority_problems = data["priority_problems"] or []
            if "initial_formulation_summary" in data:
                plan.initial_formulation_summary = data["initial_formulation_summary"]
            if "body" in data and data["body"] is not None:
                plan.body = data["body"]
            if "status" in data and data["status"]:
                if data["status"] not in VALID_PLAN_STATUS:
                    raise ValidationAppError("Status do plano inválido.")
                plan.status = data["status"]
            plan.version += 1
            plan.reviewed_at = datetime.now(UTC)
            action = "treatment_plan.updated"

        await self.db.flush()
        await write_audit(
            self.db,
            organization_id=self.auth.organization_id,
            actor_user_id=self.auth.user_id,
            action=action,
            resource_type="treatment_plan",
            resource_id=str(plan.id),
            request_id=self.auth.request_id,
        )
        await self.db.commit()
        await self.db.refresh(plan)
        goals = await self._goals_for_plan(plan.id)
        return self._plan_dto(plan, goals)

    async def add_goal(self, patient_id: uuid.UUID, data: dict) -> dict:
        self.auth.require(Permission.CLINICAL_RECORD_WRITE)
        plan_dto = await self.current(patient_id)
        if plan_dto is None:
            plan_dto = await self.upsert_plan(patient_id, {})
        plan_id = uuid.UUID(plan_dto["id"])
        title = (data.get("title") or "").strip()
        if not title:
            raise ValidationAppError("Título da meta obrigatório.")

        max_order = await self.db.scalar(
            select(TreatmentGoal.sort_order)
            .where(TreatmentGoal.treatment_plan_id == plan_id)
            .order_by(TreatmentGoal.sort_order.desc())
            .limit(1)
        )
        goal = TreatmentGoal(
            organization_id=self.auth.organization_id,
            treatment_plan_id=plan_id,
            patient_id=patient_id,
            title=title,
            specific_objectives=data.get("specific_objectives") or [],
            indicators=data.get("indicators") or [],
            strategies=data.get("strategies") or [],
            status=data.get("status") or "active",
            sort_order=(max_order or 0) + 1,
        )
        if goal.status not in VALID_GOAL_STATUS:
            raise ValidationAppError("Status da meta inválido.")
        self.db.add(goal)
        await self.db.flush()
        await write_audit(
            self.db,
            organization_id=self.auth.organization_id,
            actor_user_id=self.auth.user_id,
            action="treatment_goal.created",
            resource_type="treatment_goal",
            resource_id=str(goal.id),
            request_id=self.auth.request_id,
        )
        await self.db.commit()
        await self.db.refresh(goal)
        return self._goal_dto(goal)

    async def update_goal(self, goal_id: uuid.UUID, data: dict) -> dict:
        self.auth.require(Permission.CLINICAL_RECORD_WRITE)
        goal = await self._owned_goal(goal_id)
        if "title" in data and data["title"] is not None:
            title = str(data["title"]).strip()
            if not title:
                raise ValidationAppError("Título da meta obrigatório.")
            goal.title = title
        if "specific_objectives" in data:
            goal.specific_objectives = data["specific_objectives"] or []
        if "indicators" in data:
            goal.indicators = data["indicators"] or []
        if "strategies" in data:
            goal.strategies = data["strategies"] or []
        if "status" in data and data["status"]:
            if data["status"] not in VALID_GOAL_STATUS:
                raise ValidationAppError("Status da meta inválido.")
            goal.status = data["status"]
        if "sort_order" in data and data["sort_order"] is not None:
            goal.sort_order = int(data["sort_order"])
        await self.db.commit()
        await self.db.refresh(goal)
        return self._goal_dto(goal)

    async def active_goals_compact(self, patient_id: uuid.UUID) -> list[dict]:
        self.auth.require(Permission.CLINICAL_RECORD_READ)
        rows = (
            await self.db.execute(
                select(TreatmentGoal)
                .where(
                    TreatmentGoal.organization_id == self.auth.organization_id,
                    TreatmentGoal.patient_id == patient_id,
                    TreatmentGoal.status == "active",
                )
                .order_by(TreatmentGoal.sort_order)
                .limit(10)
            )
        ).scalars().all()
        return [{"id": str(g.id), "title": g.title} for g in rows]

    async def _goals_for_plan(self, plan_id: uuid.UUID) -> list[TreatmentGoal]:
        return list(
            (
                await self.db.execute(
                    select(TreatmentGoal)
                    .where(
                        TreatmentGoal.organization_id == self.auth.organization_id,
                        TreatmentGoal.treatment_plan_id == plan_id,
                    )
                    .order_by(TreatmentGoal.sort_order, TreatmentGoal.created_at)
                )
            ).scalars().all()
        )

    async def _owned_patient(self, patient_id: uuid.UUID) -> Patient:
        patient = await self.db.get(Patient, patient_id)
        if (
            patient is None
            or patient.organization_id != self.auth.organization_id
            or patient.deleted_at is not None
        ):
            raise NotFoundError("Paciente não encontrado.")
        return patient

    async def _owned_goal(self, goal_id: uuid.UUID) -> TreatmentGoal:
        goal = await self.db.get(TreatmentGoal, goal_id)
        if goal is None or goal.organization_id != self.auth.organization_id:
            raise NotFoundError("Meta não encontrada.")
        return goal

    def _plan_dto(self, plan: TreatmentPlan, goals: list[TreatmentGoal]) -> dict:
        return {
            "id": str(plan.id),
            "patient_id": str(plan.patient_id),
            "version": plan.version,
            "status": plan.status,
            "priority_problems": plan.priority_problems or [],
            "initial_formulation_summary": plan.initial_formulation_summary,
            "body": plan.body or {},
            "reviewed_at": plan.reviewed_at.isoformat() if plan.reviewed_at else None,
            "updated_at": plan.updated_at.isoformat() if plan.updated_at else None,
            "goals": [self._goal_dto(g) for g in goals],
        }

    def _goal_dto(self, g: TreatmentGoal) -> dict:
        return {
            "id": str(g.id),
            "treatment_plan_id": str(g.treatment_plan_id),
            "patient_id": str(g.patient_id),
            "title": g.title,
            "specific_objectives": g.specific_objectives or [],
            "indicators": g.indicators or [],
            "strategies": g.strategies or [],
            "status": g.status,
            "sort_order": g.sort_order,
        }

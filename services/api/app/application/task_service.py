"""Actionable tasks / pendências — surface work to the professional."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext
from app.application.audit import write_audit
from app.core.errors import NotFoundError, ValidationAppError
from app.core.permissions import Permission
from app.infrastructure.db.models_clinical import Patient, Task


class TaskService:
    def __init__(self, db: AsyncSession, auth: AuthContext) -> None:
        self.db = db
        self.auth = auth

    async def list_open(
        self,
        *,
        patient_id: uuid.UUID | None = None,
        limit: int = 50,
    ) -> list[dict]:
        self.auth.require(Permission.TASK_READ)
        q = select(Task).where(
            Task.organization_id == self.auth.organization_id,
            Task.status == "open",
            or_(Task.assignee_user_id == self.auth.user_id, Task.assignee_user_id.is_(None)),
        )
        if patient_id:
            q = q.where(Task.patient_id == patient_id)
        rows = (
            await self.db.execute(
                q.order_by(Task.priority.desc(), Task.due_at.nulls_last(), Task.created_at.desc()).limit(
                    min(limit, 100)
                )
            )
        ).scalars().all()
        return [await self._dto(t) for t in rows]

    async def create(self, data: dict) -> dict:
        self.auth.require(Permission.TASK_WRITE)
        title = (data.get("title") or "").strip()
        if not title:
            raise ValidationAppError("Título da tarefa obrigatório.")
        patient_id = data.get("patient_id")
        if patient_id:
            pid = patient_id if isinstance(patient_id, uuid.UUID) else uuid.UUID(str(patient_id))
            patient = await self.db.get(Patient, pid)
            if patient is None or patient.organization_id != self.auth.organization_id:
                raise NotFoundError("Paciente não encontrado.")
            patient_id = pid
        else:
            patient_id = None

        task = Task(
            organization_id=self.auth.organization_id,
            patient_id=patient_id,
            assignee_user_id=self.auth.user_id,
            title=title,
            description=(data.get("description") or "").strip() or None,
            kind=(data.get("kind") or "admin").strip(),
            status="open",
            source=data.get("source") or "manual",
            source_resource_type=data.get("source_resource_type"),
            source_resource_id=str(data["source_resource_id"]) if data.get("source_resource_id") else None,
            priority=int(data.get("priority") or 0),
            due_at=_parse_optional_dt(data.get("due_at")),
        )
        self.db.add(task)
        await self.db.flush()
        await write_audit(
            self.db,
            organization_id=self.auth.organization_id,
            actor_user_id=self.auth.user_id,
            action="task.created",
            resource_type="task",
            resource_id=str(task.id),
            request_id=self.auth.request_id,
        )
        await self.db.commit()
        await self.db.refresh(task)
        return await self._dto(task)

    async def complete(self, task_id: uuid.UUID) -> dict:
        self.auth.require(Permission.TASK_WRITE)
        task = await self._owned(task_id)
        if task.status == "done":
            return await self._dto(task)
        task.status = "done"
        await write_audit(
            self.db,
            organization_id=self.auth.organization_id,
            actor_user_id=self.auth.user_id,
            action="task.completed",
            resource_type="task",
            resource_id=str(task.id),
            request_id=self.auth.request_id,
        )
        await self.db.commit()
        return await self._dto(task)

    async def _owned(self, task_id: uuid.UUID) -> Task:
        task = await self.db.get(Task, task_id)
        if task is None or task.organization_id != self.auth.organization_id:
            raise NotFoundError("Tarefa não encontrada.")
        return task

    async def _dto(self, t: Task) -> dict:
        patient_name = None
        if t.patient_id:
            patient = await self.db.get(Patient, t.patient_id)
            if patient and patient.organization_id == self.auth.organization_id:
                patient_name = patient.display_name
        return {
            "id": str(t.id),
            "patient_id": str(t.patient_id) if t.patient_id else None,
            "patient_display_name": patient_name,
            "title": t.title,
            "description": t.description,
            "kind": t.kind,
            "status": t.status,
            "source": t.source,
            "source_resource_type": t.source_resource_type,
            "source_resource_id": t.source_resource_id,
            "priority": t.priority,
            "due_at": t.due_at.isoformat() if t.due_at else None,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "deep_link": _task_deep_link(t),
        }


def _task_deep_link(t: Task) -> str | None:
    if t.source_resource_type == "session" and t.source_resource_id:
        return f"/sessoes/{t.source_resource_id}"
    if t.patient_id and t.source_resource_type == "clinical_record":
        return f"/pacientes/{t.patient_id}/prontuario"
    if t.patient_id and t.source == "pending_consent":
        return f"/pacientes/{t.patient_id}"
    if t.source == "pending_payment":
        return "/financeiro"
    if t.patient_id:
        return f"/pacientes/{t.patient_id}"
    return None


def _parse_optional_dt(value) -> datetime | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=UTC)
    dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)

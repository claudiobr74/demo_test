"""Appointments and Meu Dia aggregation."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, time, timedelta

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext
from app.application.audit import write_audit
from app.core.errors import ConflictError, NotFoundError, ValidationAppError
from app.core.permissions import Permission
from app.infrastructure.db.models_clinical import (
    Appointment,
    ClinicalRecord,
    ClinicalSession,
    Consent,
    Patient,
    Task,
)
from app.infrastructure.db.models_ops import Charge

VALID_APPT_STATUS = {
    "scheduled",
    "awaiting_confirmation",
    "confirmed",
    "completed",
    "no_show",
    "cancelled",
    "rescheduled",
}


class AppointmentService:
    def __init__(self, db: AsyncSession, auth: AuthContext) -> None:
        self.db = db
        self.auth = auth

    async def create(self, data: dict) -> dict:
        self.auth.require(Permission.APPOINTMENT_WRITE)
        patient_id = uuid.UUID(data["patient_id"])
        patient = await self.db.get(Patient, patient_id)
        if (
            patient is None
            or patient.organization_id != self.auth.organization_id
            or patient.deleted_at is not None
        ):
            raise NotFoundError("Paciente não encontrado.")

        starts_at = _parse_dt(data["starts_at"])
        duration = int(data.get("duration_minutes") or 50)
        ends_at = starts_at + timedelta(minutes=duration)
        professional_id = uuid.UUID(data.get("professional_id") or str(self.auth.user_id))

        conflict = await self._find_conflict(professional_id, starts_at, ends_at)
        if conflict:
            raise ConflictError("Conflito de horário com outro atendimento.", code="APPOINTMENT_CONFLICT")

        idem = data.get("idempotency_key")
        if idem:
            existing = await self.db.scalar(
                select(Appointment).where(
                    Appointment.organization_id == self.auth.organization_id,
                    Appointment.idempotency_key == idem,
                )
            )
            if existing:
                return self._to_dto(existing, patient)

        appt = Appointment(
            organization_id=self.auth.organization_id,
            patient_id=patient_id,
            professional_id=professional_id,
            starts_at=starts_at,
            ends_at=ends_at,
            duration_minutes=duration,
            modality=data.get("modality") or patient.modality,
            location=data.get("location"),
            status=data.get("status") or "awaiting_confirmation",
            confirmation_status="pending",
            notes_admin=data.get("notes_admin"),
            idempotency_key=idem,
        )
        if appt.status not in VALID_APPT_STATUS:
            raise ValidationAppError("Status de atendimento inválido.")

        self.db.add(appt)
        await self.db.flush()
        await write_audit(
            self.db,
            organization_id=self.auth.organization_id,
            actor_user_id=self.auth.user_id,
            action="appointment.created",
            resource_type="appointment",
            resource_id=str(appt.id),
            request_id=self.auth.request_id,
        )
        await self.db.commit()
        await self.db.refresh(appt)
        return self._to_dto(appt, patient)

    async def list_range(self, *, start: datetime, end: datetime) -> list[dict]:
        self.auth.require(Permission.APPOINTMENT_READ)
        rows = (
            await self.db.execute(
                select(Appointment, Patient)
                .join(Patient, Patient.id == Appointment.patient_id)
                .where(
                    Appointment.organization_id == self.auth.organization_id,
                    Appointment.starts_at >= start,
                    Appointment.starts_at < end,
                    Appointment.status != "cancelled",
                )
                .order_by(Appointment.starts_at)
            )
        ).all()
        return [self._to_dto(a, p) for a, p in rows]

    async def update_status(self, appointment_id: uuid.UUID, status: str, *, reason: str | None = None) -> dict:
        self.auth.require(Permission.APPOINTMENT_WRITE)
        if status not in VALID_APPT_STATUS:
            raise ValidationAppError("Status inválido.")
        appt = await self._get_owned(appointment_id)
        appt.status = status
        if status == "confirmed":
            appt.confirmation_status = "confirmed"
        if status == "cancelled":
            appt.cancelled_reason = reason
        appt.version += 1
        patient = await self.db.get(Patient, appt.patient_id)
        await write_audit(
            self.db,
            organization_id=self.auth.organization_id,
            actor_user_id=self.auth.user_id,
            action=f"appointment.{status}",
            resource_type="appointment",
            resource_id=str(appt.id),
            request_id=self.auth.request_id,
        )
        await self.db.commit()
        return self._to_dto(appt, patient)

    async def _find_conflict(
        self, professional_id: uuid.UUID, starts_at: datetime, ends_at: datetime, exclude_id: uuid.UUID | None = None
    ) -> Appointment | None:
        q = select(Appointment).where(
            Appointment.organization_id == self.auth.organization_id,
            Appointment.professional_id == professional_id,
            Appointment.status.notin_(["cancelled", "rescheduled", "no_show"]),
            Appointment.starts_at < ends_at,
            Appointment.ends_at > starts_at,
        )
        if exclude_id:
            q = q.where(Appointment.id != exclude_id)
        return await self.db.scalar(q)

    async def _get_owned(self, appointment_id: uuid.UUID) -> Appointment:
        appt = await self.db.get(Appointment, appointment_id)
        if appt is None or appt.organization_id != self.auth.organization_id:
            raise NotFoundError("Atendimento não encontrado.")
        return appt

    def _to_dto(self, a: Appointment, p: Patient | None) -> dict:
        return {
            "id": str(a.id),
            "patient_id": str(a.patient_id),
            "patient_display_name": p.display_name if p else None,
            "professional_id": str(a.professional_id),
            "starts_at": a.starts_at.isoformat(),
            "ends_at": a.ends_at.isoformat(),
            "duration_minutes": a.duration_minutes,
            "modality": a.modality,
            "location": a.location,
            "status": a.status,
            "confirmation_status": a.confirmation_status,
            "version": a.version,
        }


class TodayService:
    """Meu Dia — action-oriented daily hub, not a vanity metrics dashboard."""

    def __init__(self, db: AsyncSession, auth: AuthContext) -> None:
        self.db = db
        self.auth = auth

    async def get_board(self, day: date | None = None) -> dict:
        self.auth.require(Permission.APPOINTMENT_READ)
        day = day or datetime.now(UTC).astimezone().date()
        start = datetime.combine(day, time.min, tzinfo=UTC)
        end = start + timedelta(days=1)
        org = self.auth.organization_id

        appts = (
            await self.db.execute(
                select(Appointment, Patient)
                .join(Patient, Patient.id == Appointment.patient_id)
                .where(
                    Appointment.organization_id == org,
                    Appointment.starts_at >= start,
                    Appointment.starts_at < end,
                    Appointment.professional_id == self.auth.user_id,
                )
                .order_by(Appointment.starts_at)
            )
        ).all()

        now = datetime.now(UTC)
        next_appt = None
        for a, p in appts:
            if a.status in {"scheduled", "awaiting_confirmation", "confirmed"} and a.starts_at >= now:
                next_appt = AppointmentService(self.db, self.auth)._to_dto(a, p)
                break

        incomplete_sessions = (
            await self.db.execute(
                select(ClinicalSession, Patient)
                .join(Patient, Patient.id == ClinicalSession.patient_id)
                .where(
                    ClinicalSession.organization_id == org,
                    ClinicalSession.professional_id == self.auth.user_id,
                    ClinicalSession.status.in_(["draft", "in_progress", "pending_closure"]),
                )
                .order_by(ClinicalSession.updated_at.desc())
                .limit(20)
            )
        ).all()

        from sqlalchemy import func

        incomplete_record_count = await self.db.scalar(
            select(func.count())
            .select_from(ClinicalRecord)
            .where(
                ClinicalRecord.organization_id == org,
                ClinicalRecord.professional_id == self.auth.user_id,
                ClinicalRecord.status == "draft",
            )
        )

        pending_payments = 0
        if self.auth.has(Permission.FINANCE_READ):
            pending_payments = await self.db.scalar(
                select(func.count())
                .select_from(Charge)
                .where(
                    Charge.organization_id == org,
                    Charge.status.in_(["pending", "partial", "overdue"]),
                )
            ) or 0

        pending_consents = 0
        if self.auth.has(Permission.CONSENT_READ):
            pending_consents = await self.db.scalar(
                select(func.count())
                .select_from(Consent)
                .where(Consent.organization_id == org, Consent.status == "pending")
            ) or 0

        open_tasks = (
            await self.db.execute(
                select(Task)
                .where(
                    Task.organization_id == org,
                    Task.status == "open",
                    or_(Task.assignee_user_id == self.auth.user_id, Task.assignee_user_id.is_(None)),
                )
                .order_by(Task.priority.desc(), Task.due_at.nulls_last())
                .limit(20)
            )
        ).scalars().all()

        buckets = {
            "confirmed": [],
            "awaiting_confirmation": [],
            "completed": [],
            "cancelled": [],
            "no_show": [],
            "scheduled": [],
        }
        for a, p in appts:
            dto = AppointmentService(self.db, self.auth)._to_dto(a, p)
            key = a.status if a.status in buckets else "scheduled"
            buckets[key].append(dto)

        return {
            "date": day.isoformat(),
            "next_appointment": next_appt,
            "appointments": buckets,
            "incomplete_sessions": [
                {
                    "id": str(s.id),
                    "patient_display_name": p.display_name,
                    "patient_id": str(s.patient_id),
                    "status": s.status,
                    "updated_at": s.updated_at.isoformat() if s.updated_at else None,
                    "primary_action": "Continuar registro"
                    if s.status == "pending_closure"
                    else "Continuar sessão",
                }
                for s, p in incomplete_sessions
            ],
            "pendencies": {
                "incomplete_clinical_records": incomplete_record_count or 0,
                "pending_payments": pending_payments,
                "pending_consents": pending_consents,
                "open_tasks": len(open_tasks),
            },
            "tasks": [
                {
                    "id": str(t.id),
                    "title": t.title,
                    "kind": t.kind,
                    "source": t.source,
                    "due_at": t.due_at.isoformat() if t.due_at else None,
                    "priority": t.priority,
                }
                for t in open_tasks
            ],
            "primary_question": "O que preciso fazer agora?",
        }


def _parse_dt(value: str | datetime) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=UTC)
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)

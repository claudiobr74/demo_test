"""Outbound confirmation queue — channel-agnostic; real providers plug later."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext
from app.application.audit import write_audit
from app.application.confirmation_messages import build_confirmation_message
from app.core.errors import NotFoundError, ValidationAppError
from app.core.permissions import Permission
from app.infrastructure.db.models_clinical import Appointment, Patient
from app.infrastructure.db.models_identity import Organization
from app.infrastructure.db.models_ops import Notification

VALID_CHANNELS = {"whatsapp", "sms", "email", "push", "in_app"}


class ConfirmationQueueService:
    def __init__(self, db: AsyncSession, auth: AuthContext) -> None:
        self.db = db
        self.auth = auth

    async def enqueue(self, appointment_id: uuid.UUID, *, channel: str = "whatsapp") -> dict:
        self.auth.require(Permission.APPOINTMENT_WRITE)
        if channel not in VALID_CHANNELS:
            raise ValidationAppError("Canal inválido.")

        appt = await self.db.get(Appointment, appointment_id)
        if appt is None or appt.organization_id != self.auth.organization_id:
            raise NotFoundError("Atendimento não encontrado.")
        patient = await self.db.get(Patient, appt.patient_id)
        if patient is None:
            raise NotFoundError("Paciente não encontrado.")
        org = await self.db.get(Organization, self.auth.organization_id)

        built = build_confirmation_message(
            patient=patient,
            appointment=appt,
            professional_name=self.auth.user.full_name,
            clinic_name=org.name if org else None,
        )

        # Queued notification for the professional (ops inbox) — patient send is stubbed.
        note = Notification(
            organization_id=self.auth.organization_id,
            user_id=self.auth.user_id,
            channel=channel,
            title=f"Confirmação · {patient.display_name}",
            body=built["message"],
            payload={
                "kind": "appointment_confirmation",
                "status": "queued",
                "appointment_id": str(appt.id),
                "patient_id": str(patient.id),
                "channel": channel,
                "suggested_channels": built["suggested_channels"],
                "queued_at": datetime.now(UTC).isoformat(),
                "delivery": "stub",  # real WhatsApp/SMS/email providers plug here
                "note": "Mensagem enfileirada. Envio real será plugado sem alterar o domínio clínico.",
            },
        )
        self.db.add(note)
        appt.confirmation_status = "queued"
        await self.db.flush()
        await write_audit(
            self.db,
            organization_id=self.auth.organization_id,
            actor_user_id=self.auth.user_id,
            action="confirmation.queued",
            resource_type="appointment",
            resource_id=str(appt.id),
            request_id=self.auth.request_id,
            metadata={"channel": channel, "notification_id": str(note.id)},
        )
        await self.db.commit()
        await self.db.refresh(note)
        return {
            "id": str(note.id),
            "appointment_id": str(appt.id),
            "channel": channel,
            "status": "queued",
            "message": built["message"],
            "delivery": "stub",
            "created_at": note.created_at.isoformat() if note.created_at else None,
        }

    async def list_queued(self, *, limit: int = 30) -> list[dict]:
        self.auth.require(Permission.APPOINTMENT_READ)
        rows = (
            await self.db.execute(
                select(Notification)
                .where(
                    Notification.organization_id == self.auth.organization_id,
                    Notification.user_id == self.auth.user_id,
                )
                .order_by(Notification.created_at.desc())
                .limit(min(limit, 50))
            )
        ).scalars().all()
        items = []
        for n in rows:
            payload = n.payload or {}
            if payload.get("kind") != "appointment_confirmation":
                continue
            items.append(
                {
                    "id": str(n.id),
                    "channel": n.channel,
                    "title": n.title,
                    "body": n.body,
                    "status": payload.get("status"),
                    "appointment_id": payload.get("appointment_id"),
                    "patient_id": payload.get("patient_id"),
                    "delivery": payload.get("delivery"),
                    "created_at": n.created_at.isoformat() if n.created_at else None,
                    "read_at": n.read_at.isoformat() if n.read_at else None,
                    "copied_at": payload.get("copied_at"),
                    "sent_at": payload.get("sent_at"),
                }
            )
        return items

    async def mark_status(self, notification_id: uuid.UUID, *, status: str) -> dict:
        """Ops workflow for real clinic use: copied → sent (providers plug later)."""
        self.auth.require(Permission.APPOINTMENT_WRITE)
        if status not in {"copied", "sent", "dismissed"}:
            raise ValidationAppError("Status inválido. Use copied, sent ou dismissed.")

        note = await self.db.get(Notification, notification_id)
        if (
            note is None
            or note.organization_id != self.auth.organization_id
            or note.user_id != self.auth.user_id
        ):
            raise NotFoundError("Item da fila não encontrado.")

        payload = dict(note.payload or {})
        if payload.get("kind") != "appointment_confirmation":
            raise ValidationAppError("Notificação não é uma confirmação de atendimento.")

        now = datetime.now(UTC)
        payload["status"] = status
        if status == "copied":
            payload["copied_at"] = now.isoformat()
            payload["delivery"] = payload.get("delivery") or "manual_copy"
        elif status == "sent":
            payload["sent_at"] = now.isoformat()
            payload["delivery"] = "manual_sent"
            note.read_at = now
        elif status == "dismissed":
            payload["dismissed_at"] = now.isoformat()
            note.read_at = now

        note.payload = payload

        appt_id = payload.get("appointment_id")
        if appt_id:
            try:
                appt = await self.db.get(Appointment, uuid.UUID(str(appt_id)))
            except ValueError:
                appt = None
            if appt and appt.organization_id == self.auth.organization_id:
                if status == "copied":
                    appt.confirmation_status = "awaiting_confirmation"
                elif status == "sent":
                    appt.confirmation_status = "sent"
                elif status == "dismissed":
                    appt.confirmation_status = "pending"

        await write_audit(
            self.db,
            organization_id=self.auth.organization_id,
            actor_user_id=self.auth.user_id,
            action=f"confirmation.{status}",
            resource_type="notification",
            resource_id=str(note.id),
            request_id=self.auth.request_id,
            metadata={"appointment_id": appt_id, "channel": note.channel},
        )
        await self.db.commit()
        await self.db.refresh(note)
        payload = note.payload or {}
        return {
            "id": str(note.id),
            "status": payload.get("status"),
            "appointment_id": payload.get("appointment_id"),
            "channel": note.channel,
            "delivery": payload.get("delivery"),
            "copied_at": payload.get("copied_at"),
            "sent_at": payload.get("sent_at"),
            "read_at": note.read_at.isoformat() if note.read_at else None,
        }

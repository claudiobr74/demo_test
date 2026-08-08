"""Confirmation message builder — provider-agnostic (WhatsApp/SMS/email later)."""

from __future__ import annotations

from datetime import datetime

from app.infrastructure.db.models_clinical import Appointment, Patient


def build_confirmation_message(
    *,
    patient: Patient,
    appointment: Appointment,
    professional_name: str | None = None,
    clinic_name: str | None = None,
) -> dict:
    starts = appointment.starts_at
    if starts.tzinfo is not None:
        local = starts.astimezone()
    else:
        local = starts
    date_label = local.strftime("%d/%m/%Y")
    time_label = local.strftime("%H:%M")
    modality = {
        "in_person": "presencial",
        "online": "online",
        "hybrid": "híbrida",
    }.get(appointment.modality, appointment.modality)

    first = patient.preferred_name or patient.first_name
    lines = [
        f"Olá, {first}!",
        f"Confirmando seu atendimento em {date_label} às {time_label} ({modality}).",
    ]
    if appointment.location:
        lines.append(f"Local: {appointment.location}.")
    if professional_name:
        lines.append(f"Com: {professional_name}.")
    if clinic_name:
        lines.append(f"{clinic_name}")
    lines.append("Por favor, responda confirmando sua presença.")
    text = "\n".join(lines)

    return {
        "channel_agnostic": True,
        "suggested_channels": ["whatsapp", "sms", "email", "push"],
        "patient_id": str(patient.id),
        "appointment_id": str(appointment.id),
        "message": text,
        "variables": {
            "patient_first_name": first,
            "date": date_label,
            "time": time_label,
            "modality": modality,
            "location": appointment.location,
            "professional_name": professional_name,
            "clinic_name": clinic_name,
        },
        "note": "Mensagem gerada localmente. Integrações de envio serão plugadas sem acoplar o domínio clínico.",
    }

"""Pydantic request/response schemas."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class APIModel(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")


class RegisterRequest(APIModel):
    organization_name: str = Field(min_length=2, max_length=200)
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
    full_name: str = Field(min_length=2, max_length=200)
    default_framework: str = Field(default="cbt", pattern="^(cbt|schema)$")
    kind: str = Field(default="individual", pattern="^(individual|clinic)$")


class LoginRequest(APIModel):
    email: EmailStr
    password: str
    organization_id: UUID | None = None


class PatientCreateRequest(APIModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    preferred_name: str | None = None
    internal_code: str | None = None
    birth_date: date | None = None
    gender: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    address: dict[str, Any] | None = None
    modality: str = "in_person"
    session_fee: Decimal | None = None
    status: str = "active"
    therapeutic_approach: str | None = None
    framework: str | None = None
    admin_notes: str | None = None
    finance_config: dict[str, Any] | None = None
    emergency_contact: dict[str, Any] | None = None
    guardian: dict[str, Any] | None = None
    responsible_professional_id: UUID | None = None


class PatientUpdateRequest(APIModel):
    first_name: str | None = None
    last_name: str | None = None
    preferred_name: str | None = None
    birth_date: date | None = None
    gender: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    address: dict[str, Any] | None = None
    modality: str | None = None
    session_fee: Decimal | None = None
    status: str | None = None
    therapeutic_approach: str | None = None
    framework: str | None = None
    admin_notes: str | None = None
    finance_config: dict[str, Any] | None = None
    emergency_contact: dict[str, Any] | None = None
    guardian: dict[str, Any] | None = None
    version: int | None = None


class AppointmentCreateRequest(APIModel):
    patient_id: UUID
    starts_at: datetime
    duration_minutes: int = Field(default=50, ge=15, le=240)
    professional_id: UUID | None = None
    modality: str | None = None
    location: str | None = None
    status: str | None = None
    notes_admin: str | None = None
    idempotency_key: str | None = None
    recurrence_frequency: str | None = None  # none | weekly | biweekly
    recurrence_count: int | None = Field(default=None, ge=2, le=52)


class AppointmentStatusRequest(APIModel):
    status: str
    reason: str | None = None


class AppointmentRescheduleRequest(APIModel):
    starts_at: datetime
    duration_minutes: int | None = Field(default=None, ge=15, le=240)
    version: int | None = None


class SessionStartRequest(APIModel):
    patient_id: UUID
    appointment_id: UUID | None = None
    idempotency_key: str | None = None


class SessionAutosaveRequest(APIModel):
    focus: str | None = None
    observations: str | None = None
    events: str | None = None
    interventions: str | None = None
    responses: str | None = None
    hypotheses: str | None = None
    tasks: str | None = None
    agreements: str | None = None
    planning: str | None = None
    structured_data: dict[str, Any] | None = None
    version: int | None = None


class SessionCloseRequest(APIModel):
    finalize_record: bool = True


class DocumentCreateRequest(APIModel):
    patient_id: UUID | None = None
    template_id: UUID | None = None
    doc_type: str = "attendance_declaration"
    title: str | None = None
    body: str | None = None
    variables: dict[str, str] | None = None


class DocumentFinalizeRequest(APIModel):
    confirm: bool = True


class SupervisorRequest(APIModel):
    mode: str
    patient_id: UUID | None = None
    framework: str | None = None
    message: str | None = None
    context: dict[str, Any] = Field(default_factory=dict)
    import_hypotheses: bool = False


class AiFeedbackRequest(APIModel):
    output_id: UUID
    useful: bool
    reasons: list[str] | None = None
    comment: str | None = None


class ClinicalHypothesisCreateRequest(APIModel):
    statement: str = Field(min_length=1)
    epistemology: str | None = None
    strength: str | None = None
    formulation_id: UUID | None = None
    framework: str | None = None
    provenance: list[dict[str, Any]] | None = None
    created_by: str | None = None


class ClinicalHypothesisStrengthRequest(APIModel):
    strength: str


class ConfirmationEnqueueRequest(APIModel):
    channel: str | None = "whatsapp"


class ConsentCreateRequest(APIModel):
    consent_type: str
    template_id: UUID | None = None


class ConsentDecisionRequest(APIModel):
    status: str
    method: str | None = "manual"
    notes: str | None = None


class ChargeCreateRequest(APIModel):
    patient_id: UUID
    amount: Decimal
    origin: str = "adjustment"
    origin_id: UUID | None = None
    due_date: date | None = None
    description: str | None = None
    idempotency_key: str | None = None


class PaymentCreateRequest(APIModel):
    charge_id: UUID
    amount: Decimal
    method: str = "pix"
    discount: Decimal | None = None
    surcharge: Decimal | None = None
    notes: str | None = None
    idempotency_key: str | None = None


class CaseMemoryCreateRequest(APIModel):
    kind: str = "observation"
    content: str = Field(min_length=1)
    epistemology: str | None = None
    provenance: list[dict[str, Any]] | None = None
    framework: str | None = None
    source: str = "professional"


class CaseMemoryStatusRequest(APIModel):
    status: str


class CaseMemoryProvenanceRequest(APIModel):
    resource_type: str
    resource_id: str | None = None
    note: str | None = None


class FormulationUpsertRequest(APIModel):
    framework: str | None = None
    body: dict[str, Any] | None = None
    version: int | None = None


class TreatmentPlanUpsertRequest(APIModel):
    priority_problems: list[str] | None = None
    initial_formulation_summary: str | None = None
    body: dict[str, Any] | None = None
    status: str | None = None


class TreatmentGoalCreateRequest(APIModel):
    title: str = Field(min_length=1)
    specific_objectives: list[str] | None = None
    indicators: list[str] | None = None
    strategies: list[str] | None = None
    status: str | None = None


class TreatmentGoalUpdateRequest(APIModel):
    title: str | None = None
    specific_objectives: list[str] | None = None
    indicators: list[str] | None = None
    strategies: list[str] | None = None
    status: str | None = None
    sort_order: int | None = None

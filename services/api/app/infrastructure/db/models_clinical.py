"""Clinical domain ORM — patients, consents, appointments, sessions, records."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.db.base import (
    OptimisticLockMixin,
    OrganizationScopedMixin,
    SoftDeleteMixin,
    Base,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
)


class Patient(Base, OrganizationScopedMixin, SoftDeleteMixin, OptimisticLockMixin):
    __tablename__ = "patients"
    __table_args__ = (
        UniqueConstraint("organization_id", "internal_code", name="uq_patient_org_code"),
    )

    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    preferred_name: Mapped[str | None] = mapped_column(String(100))
    internal_code: Mapped[str] = mapped_column(String(32), nullable=False)
    # Display: "João Silva • PAC-042"
    birth_date: Mapped[date | None] = mapped_column(Date)
    gender: Mapped[str | None] = mapped_column(String(32))
    phone: Mapped[str | None] = mapped_column(String(32))
    email: Mapped[str | None] = mapped_column(String(320))
    address_json: Mapped[dict | None] = mapped_column(JSONB)
    photo_object_key: Mapped[str | None] = mapped_column(String(512))
    responsible_professional_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    modality: Mapped[str] = mapped_column(String(32), nullable=False, default="in_person")
    # in_person | online | hybrid
    session_fee: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    # active | paused | inactive | closed | archived
    therapeutic_approach: Mapped[str | None] = mapped_column(String(64))
    framework: Mapped[str | None] = mapped_column(String(64))
    # overrides professional.default_framework
    admin_notes: Mapped[str | None] = mapped_column(Text)
    finance_config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    emergency_contact: Mapped[dict | None] = mapped_column(JSONB)
    guardian: Mapped[dict | None] = mapped_column(JSONB)

    @property
    def display_name(self) -> str:
        return f"{self.first_name} {self.last_name} • {self.internal_code}"


class ConsentTemplate(Base, OrganizationScopedMixin):
    __tablename__ = "consent_templates"
    __table_args__ = (
        UniqueConstraint(
            "organization_id", "consent_type", "version", name="uq_consent_template_version"
        ),
    )

    consent_type: Mapped[str] = mapped_column(String(64), nullable=False)
    # data_processing | digital_resources | transcription | ai_processing | ...
    version: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class Consent(Base, OrganizationScopedMixin):
    __tablename__ = "consents"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    template_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    consent_type: Mapped[str] = mapped_column(String(64), nullable=False)
    version: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    # pending | accepted | refused | revoked | expired
    method: Mapped[str | None] = mapped_column(String(64))
    recorded_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    recorded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    content_snapshot: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)


class AppointmentRecurrence(Base, OrganizationScopedMixin):
    __tablename__ = "appointment_recurrences"

    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    professional_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    rrule: Mapped[str] = mapped_column(String(512), nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    modality: Mapped[str] = mapped_column(String(32), nullable=False, default="in_person")
    location: Mapped[str | None] = mapped_column(String(255))
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class Appointment(Base, OrganizationScopedMixin, OptimisticLockMixin):
    __tablename__ = "appointments"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    professional_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    modality: Mapped[str] = mapped_column(String(32), nullable=False, default="in_person")
    location: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="scheduled", index=True)
    # scheduled | awaiting_confirmation | confirmed | completed | no_show | cancelled | rescheduled
    confirmation_status: Mapped[str | None] = mapped_column(String(32))
    recurrence_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    notes_admin: Mapped[str | None] = mapped_column(Text)
    cancelled_reason: Mapped[str | None] = mapped_column(String(255))
    idempotency_key: Mapped[str | None] = mapped_column(String(128), index=True)


class ClinicalSession(Base, OrganizationScopedMixin, OptimisticLockMixin):
    __tablename__ = "sessions"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    appointment_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    professional_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft", index=True)
    # draft | in_progress | pending_closure | completed | cancelled
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    focus: Mapped[str | None] = mapped_column(Text)
    observations: Mapped[str | None] = mapped_column(Text)
    events: Mapped[str | None] = mapped_column(Text)
    interventions: Mapped[str | None] = mapped_column(Text)
    responses: Mapped[str | None] = mapped_column(Text)
    hypotheses: Mapped[str | None] = mapped_column(Text)
    tasks: Mapped[str | None] = mapped_column(Text)
    agreements: Mapped[str | None] = mapped_column(Text)
    planning: Mapped[str | None] = mapped_column(Text)
    structured_data: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    autosave_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    incomplete_reason: Mapped[str | None] = mapped_column(String(255))


class ClinicalRecord(Base, OrganizationScopedMixin, OptimisticLockMixin):
    """Official longitudinal chart entry — never a raw transcript dump."""

    __tablename__ = "clinical_records"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    session_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    professional_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    session_type: Mapped[str] = mapped_column(String(64), nullable=False, default="individual")
    evolution: Mapped[str | None] = mapped_column(Text)
    focus: Mapped[str | None] = mapped_column(Text)
    interventions: Mapped[str | None] = mapped_column(Text)
    relevant_observations: Mapped[str | None] = mapped_column(Text)
    tasks: Mapped[str | None] = mapped_column(Text)
    planning: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    # draft | finalized
    finalized_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Versioning: previous_version_id links superseded drafts/finals for auditability
    previous_version_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    content_hash: Mapped[str | None] = mapped_column(String(128))


class CaseFormulation(Base, OrganizationScopedMixin, OptimisticLockMixin):
    __tablename__ = "case_formulations"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    framework: Mapped[str] = mapped_column(String(64), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    # draft | official | archived
    body: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    is_official: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)


class ClinicalHypothesis(Base, OrganizationScopedMixin):
    __tablename__ = "clinical_hypotheses"

    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    formulation_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    statement: Mapped[str] = mapped_column(Text, nullable=False)
    epistemology: Mapped[str] = mapped_column(String(64), nullable=False, default="working_hypothesis")
    # documented_fact | clinical_observation | inference | working_hypothesis | insufficient_information
    strength: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    # active | strengthened | weakened | retired
    provenance: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    framework: Mapped[str | None] = mapped_column(String(64))
    created_by: Mapped[str] = mapped_column(String(32), nullable=False, default="professional")
    # professional | ai_suggestion
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class TreatmentPlan(Base, OrganizationScopedMixin, OptimisticLockMixin):
    __tablename__ = "treatment_plans"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    priority_problems: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    initial_formulation_summary: Mapped[str | None] = mapped_column(Text)
    body: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class TreatmentGoal(Base, OrganizationScopedMixin):
    __tablename__ = "treatment_goals"

    treatment_plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("treatment_plans.id", ondelete="CASCADE"), nullable=False
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    specific_objectives: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    indicators: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    strategies: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class Task(Base, OrganizationScopedMixin):
    __tablename__ = "tasks"

    patient_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    assignee_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    kind: Mapped[str] = mapped_column(String(64), nullable=False, default="admin")
    # clinical | admin | system_pending
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="open", index=True)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    source: Mapped[str | None] = mapped_column(String(64))
    # incomplete_record | pending_payment | pending_consent | ...
    source_resource_type: Mapped[str | None] = mapped_column(String(64))
    source_resource_id: Mapped[str | None] = mapped_column(String(64))
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

"""Finance, documents, AI usage, notifications."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.db.base import OrganizationScopedMixin, Base, TimestampMixin, UUIDPrimaryKeyMixin


class Charge(Base, OrganizationScopedMixin):
    __tablename__ = "charges"
    __table_args__ = (
        UniqueConstraint("organization_id", "idempotency_key", name="uq_charge_idempotency"),
    )

    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    origin: Mapped[str] = mapped_column(String(32), nullable=False)
    # session | package | subscription | adjustment
    origin_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    amount_paid: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending", index=True)
    # pending | partial | paid | overdue | cancelled | written_off
    due_date: Mapped[date | None] = mapped_column(Date)
    description: Mapped[str | None] = mapped_column(String(255))
    idempotency_key: Mapped[str | None] = mapped_column(String(128))


class Payment(Base, OrganizationScopedMixin):
    __tablename__ = "payments"
    __table_args__ = (
        UniqueConstraint("organization_id", "idempotency_key", name="uq_payment_idempotency"),
    )

    charge_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("charges.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    method: Mapped[str] = mapped_column(String(32), nullable=False)
    # pix | cash | card | transfer | other
    paid_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    discount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    surcharge: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    notes: Mapped[str | None] = mapped_column(Text)
    idempotency_key: Mapped[str | None] = mapped_column(String(128))
    recorded_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))


class Package(Base, OrganizationScopedMixin):
    __tablename__ = "packages"

    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    total_sessions: Mapped[int] = mapped_column(Integer, nullable=False)
    used_sessions: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    valid_until: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")


class PackageUsage(Base, OrganizationScopedMixin):
    __tablename__ = "package_usages"

    package_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("packages.id", ondelete="CASCADE"), nullable=False
    )
    session_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    used_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class Expense(Base, OrganizationScopedMixin):
    __tablename__ = "expenses"

    vendor: Mapped[str | None] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    recurrence_rule: Mapped[str | None] = mapped_column(String(255))
    notes: Mapped[str | None] = mapped_column(Text)


class DocumentTemplate(Base, OrganizationScopedMixin):
    __tablename__ = "document_templates"

    doc_type: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    body_template: Mapped[str] = mapped_column(Text, nullable=False)
    variables: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class Document(Base, OrganizationScopedMixin):
    __tablename__ = "documents"

    patient_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    template_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    doc_type: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    object_key: Mapped[str | None] = mapped_column(String(512))
    # Final artifact in private object storage
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    finalized_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AiRequest(Base, OrganizationScopedMixin):
    """AI observability — never store full clinical prompts by default."""

    __tablename__ = "ai_requests"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    patient_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    task: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(64), nullable=False)
    model: Mapped[str] = mapped_column(String(128), nullable=False)
    model_class: Mapped[str] = mapped_column(String(32), nullable=False)
    # fast | reasoning | deep_reasoning
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    estimated_cost_usd: Mapped[Decimal | None] = mapped_column(Numeric(12, 6))
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="ok")
    engine_version: Mapped[str | None] = mapped_column(String(32))
    framework_version: Mapped[str | None] = mapped_column(String(32))
    prompt_policy_version: Mapped[str | None] = mapped_column(String(32))
    knowledge_base_version: Mapped[str | None] = mapped_column(String(32))
    error_code: Mapped[str | None] = mapped_column(String(64))


class AiOutput(Base, OrganizationScopedMixin):
    __tablename__ = "ai_outputs"

    request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ai_requests.id", ondelete="CASCADE"), nullable=False
    )
    patient_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    structured_output: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    schema_version: Mapped[str] = mapped_column(String(32), nullable=False, default="1.0")
    safety_flags: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    critic_notes: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)


class AiFeedback(Base, OrganizationScopedMixin):
    __tablename__ = "ai_feedback"

    output_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ai_outputs.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    useful: Mapped[bool] = mapped_column(Boolean, nullable=False)
    reasons: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    # generic | incorrect | insufficient_info | already_used | inadequate | framework_mismatch
    comment: Mapped[str | None] = mapped_column(Text)


class Notification(Base, OrganizationScopedMixin):
    __tablename__ = "notifications"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    channel: Mapped[str] = mapped_column(String(32), nullable=False, default="in_app")
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    # Push must not reveal clinical PHI
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Plan(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "plans"

    code: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    features: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    limits: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)


class Subscription(Base, OrganizationScopedMixin):
    __tablename__ = "subscriptions"

    plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("plans.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    current_period_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

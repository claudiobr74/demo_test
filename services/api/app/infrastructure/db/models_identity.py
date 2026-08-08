"""ORM models — organizations, users, memberships, roles."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin, utcnow


class Organization(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    kind: Mapped[str] = mapped_column(String(32), nullable=False, default="individual")
    # individual | clinic
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="America/Sao_Paulo")
    locale: Mapped[str] = mapped_column(String(16), nullable=False, default="pt-BR")
    default_session_duration_minutes: Mapped[int] = mapped_column(nullable=False, default=50)
    settings: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    memberships: Mapped[list[Membership]] = relationship(back_populates="organization")


class User(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    preferred_name: Mapped[str | None] = mapped_column(String(100))
    professional_registration: Mapped[str | None] = mapped_column(String(64))
    specialty: Mapped[str | None] = mapped_column(String(120))
    photo_object_key: Mapped[str | None] = mapped_column(String(512))
    default_framework: Mapped[str] = mapped_column(String(64), nullable=False, default="cbt")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    memberships: Mapped[list[Membership]] = relationship(back_populates="user")


class Membership(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """User ↔ Organization link with explicit permission set (RBAC)."""

    __tablename__ = "memberships"
    __table_args__ = (UniqueConstraint("organization_id", "user_id", name="uq_membership_org_user"),)

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    role_key: Mapped[str] = mapped_column(String(32), nullable=False)
    # Template label only — authorization uses permissions[]
    permissions: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    organization: Mapped[Organization] = relationship(back_populates="memberships")
    user: Mapped[User] = relationship(back_populates="memberships")


class AuditEvent(Base, UUIDPrimaryKeyMixin):
    """Append-only audit trail — never store clinical content here."""

    __tablename__ = "audit_events"

    organization_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    action: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    resource_type: Mapped[str] = mapped_column(String(64), nullable=False)
    resource_id: Mapped[str | None] = mapped_column(String(64))
    result: Mapped[str] = mapped_column(String(32), nullable=False, default="success")
    request_id: Mapped[str | None] = mapped_column(String(64))
    metadata_json: Mapped[dict] = mapped_column("metadata", JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, index=True
    )


class FeatureFlag(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "feature_flags"

    key: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text)
    enabled_globally: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    rollout_percent: Mapped[int] = mapped_column(nullable=False, default=0)
    organization_allowlist: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

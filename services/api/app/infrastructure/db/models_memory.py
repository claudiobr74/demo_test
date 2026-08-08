"""Case memory — structured longitudinal facts/observations/hypotheses with provenance."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.db.base import OrganizationScopedMixin, Base


class CaseMemoryEntry(Base, OrganizationScopedMixin):
    """Persistent clinical case memory — not fine-tuned into an LLM."""

    __tablename__ = "case_memory_entries"

    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    kind: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    # fact | observation | hypothesis
    epistemology: Mapped[str] = mapped_column(
        String(64), nullable=False, default="clinical_observation"
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    # active | strengthened | weakened | retired
    provenance: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    # [{resource_type, resource_id, note}]
    framework: Mapped[str | None] = mapped_column(String(64))
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    source: Mapped[str] = mapped_column(String(32), nullable=False, default="professional")
    # professional | ai_suggestion
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

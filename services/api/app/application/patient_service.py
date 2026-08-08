"""Patient application service — tenant-scoped, permission-aware."""

from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext
from app.application.audit import write_audit
from app.core.errors import ConflictError, ForbiddenError, NotFoundError, ValidationAppError
from app.core.permissions import Permission
from app.infrastructure.db.models_clinical import Patient

VALID_STATUSES = {"active", "paused", "inactive", "closed", "archived"}
VALID_MODALITIES = {"in_person", "online", "hybrid"}


class PatientService:
    def __init__(self, db: AsyncSession, auth: AuthContext) -> None:
        self.db = db
        self.auth = auth

    async def list_patients(
        self,
        *,
        status: str | None = None,
        q: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> dict:
        self.auth.require(Permission.PATIENT_READ)
        query = select(Patient).where(
            Patient.organization_id == self.auth.organization_id,
            Patient.deleted_at.is_(None),
        )
        if status:
            query = query.where(Patient.status == status)
        if q:
            like = f"%{q.strip()}%"
            query = query.where(
                (Patient.first_name.ilike(like))
                | (Patient.last_name.ilike(like))
                | (Patient.internal_code.ilike(like))
                | (Patient.preferred_name.ilike(like))
            )
        total = await self.db.scalar(
            select(func.count()).select_from(query.subquery())
        )
        rows = (
            await self.db.execute(
                query.order_by(Patient.first_name, Patient.last_name).limit(min(limit, 100)).offset(offset)
            )
        ).scalars().all()
        return {
            "items": [self._to_dto(p) for p in rows],
            "total": total or 0,
            "limit": limit,
            "offset": offset,
        }

    async def get_patient(self, patient_id: uuid.UUID) -> dict:
        self.auth.require(Permission.PATIENT_READ)
        patient = await self._get_owned(patient_id)
        await write_audit(
            self.db,
            organization_id=self.auth.organization_id,
            actor_user_id=self.auth.user_id,
            action="patient.read",
            resource_type="patient",
            resource_id=str(patient.id),
            request_id=self.auth.request_id,
        )
        await self.db.commit()
        return self._to_dto(patient, detailed=True)

    async def create_patient(self, data: dict) -> dict:
        self.auth.require(Permission.PATIENT_WRITE)
        first = (data.get("first_name") or "").strip()
        last = (data.get("last_name") or "").strip()
        if not first or not last:
            raise ValidationAppError("Nome e sobrenome são obrigatórios.")

        status = data.get("status", "active")
        modality = data.get("modality", "in_person")
        if status not in VALID_STATUSES:
            raise ValidationAppError("Status inválido.")
        if modality not in VALID_MODALITIES:
            raise ValidationAppError("Modalidade inválida.")

        code = data.get("internal_code") or await self._next_code()
        exists = await self.db.scalar(
            select(Patient.id).where(
                Patient.organization_id == self.auth.organization_id,
                Patient.internal_code == code,
                Patient.deleted_at.is_(None),
            )
        )
        if exists:
            raise ConflictError("Identificador interno já em uso.")

        patient = Patient(
            organization_id=self.auth.organization_id,
            first_name=first,
            last_name=last,
            preferred_name=data.get("preferred_name"),
            internal_code=code,
            birth_date=data.get("birth_date"),
            gender=data.get("gender"),
            phone=data.get("phone"),
            email=data.get("email"),
            address_json=data.get("address"),
            responsible_professional_id=data.get("responsible_professional_id") or self.auth.user_id,
            modality=modality,
            session_fee=Decimal(str(data["session_fee"])) if data.get("session_fee") is not None else None,
            status=status,
            therapeutic_approach=data.get("therapeutic_approach"),
            framework=data.get("framework"),
            admin_notes=data.get("admin_notes"),
            finance_config=data.get("finance_config") or {},
            emergency_contact=data.get("emergency_contact"),
            guardian=data.get("guardian"),
        )
        self.db.add(patient)
        await self.db.flush()
        await write_audit(
            self.db,
            organization_id=self.auth.organization_id,
            actor_user_id=self.auth.user_id,
            action="patient.created",
            resource_type="patient",
            resource_id=str(patient.id),
            request_id=self.auth.request_id,
        )
        await self.db.commit()
        await self.db.refresh(patient)
        return self._to_dto(patient, detailed=True)

    async def update_patient(self, patient_id: uuid.UUID, data: dict, *, expected_version: int | None) -> dict:
        self.auth.require(Permission.PATIENT_WRITE)
        patient = await self._get_owned(patient_id)

        # Secretaries may update administrative fields only.
        is_secretary = self.auth.membership.role_key == "secretary"
        clinical_fields = {"framework", "therapeutic_approach", "admin_notes"}
        if is_secretary and clinical_fields.intersection(data.keys()):
            # admin_notes allowed for secretary; framework is clinical preference
            if "framework" in data or "therapeutic_approach" in data:
                raise ForbiddenError("Secretaria não pode alterar dados clínicos.")

        if expected_version is not None and patient.version != expected_version:
            raise ConflictError(
                "Este paciente foi alterado por outra pessoa. Recarregue e tente novamente.",
                code="OPTIMISTIC_LOCK",
            )

        for field in (
            "first_name",
            "last_name",
            "preferred_name",
            "birth_date",
            "gender",
            "phone",
            "email",
            "modality",
            "status",
            "therapeutic_approach",
            "framework",
            "admin_notes",
        ):
            if field in data and data[field] is not None:
                setattr(patient, field, data[field])
        if "address" in data:
            patient.address_json = data["address"]
        if "session_fee" in data:
            patient.session_fee = (
                Decimal(str(data["session_fee"])) if data["session_fee"] is not None else None
            )
        if "emergency_contact" in data:
            patient.emergency_contact = data["emergency_contact"]
        if "guardian" in data:
            patient.guardian = data["guardian"]
        if "finance_config" in data:
            patient.finance_config = data["finance_config"] or {}

        if patient.status not in VALID_STATUSES:
            raise ValidationAppError("Status inválido.")
        if patient.modality not in VALID_MODALITIES:
            raise ValidationAppError("Modalidade inválida.")

        patient.version += 1
        await write_audit(
            self.db,
            organization_id=self.auth.organization_id,
            actor_user_id=self.auth.user_id,
            action="patient.updated",
            resource_type="patient",
            resource_id=str(patient.id),
            request_id=self.auth.request_id,
            metadata={"version": patient.version},
        )
        await self.db.commit()
        await self.db.refresh(patient)
        return self._to_dto(patient, detailed=True)

    async def _get_owned(self, patient_id: uuid.UUID) -> Patient:
        patient = await self.db.get(Patient, patient_id)
        if (
            patient is None
            or patient.organization_id != self.auth.organization_id
            or patient.deleted_at is not None
        ):
            raise NotFoundError("Paciente não encontrado.")
        return patient

    async def _next_code(self) -> str:
        count = await self.db.scalar(
            select(func.count()).select_from(Patient).where(
                Patient.organization_id == self.auth.organization_id
            )
        )
        return f"PAC-{(count or 0) + 1:03d}"

    def _to_dto(self, p: Patient, *, detailed: bool = False) -> dict:
        base = {
            "id": str(p.id),
            "display_name": p.display_name,
            "first_name": p.first_name,
            "last_name": p.last_name,
            "preferred_name": p.preferred_name,
            "internal_code": p.internal_code,
            "status": p.status,
            "modality": p.modality,
            "responsible_professional_id": str(p.responsible_professional_id)
            if p.responsible_professional_id
            else None,
            "version": p.version,
        }
        if not detailed:
            return base
        return {
            **base,
            "birth_date": p.birth_date.isoformat() if p.birth_date else None,
            "gender": p.gender,
            "phone": p.phone,
            "email": p.email,
            "address": p.address_json,
            "session_fee": str(p.session_fee) if p.session_fee is not None else None,
            "therapeutic_approach": p.therapeutic_approach,
            "framework": p.framework,
            "admin_notes": p.admin_notes,
            "finance_config": p.finance_config,
            "emergency_contact": p.emergency_contact,
            "guardian": p.guardian,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "updated_at": p.updated_at.isoformat() if p.updated_at else None,
        }

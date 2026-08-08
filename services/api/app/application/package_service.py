"""Session packages — prepaid packs that debit on session close."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext
from app.application.audit import write_audit
from app.core.errors import ConflictError, NotFoundError, ValidationAppError
from app.core.permissions import Permission
from app.infrastructure.db.models_clinical import Patient
from app.infrastructure.db.models_ops import Charge, Package, PackageUsage


class PackageService:
    def __init__(self, db: AsyncSession, auth: AuthContext) -> None:
        self.db = db
        self.auth = auth

    async def list_packages(
        self,
        *,
        patient_id: uuid.UUID | None = None,
        status: str | None = None,
        limit: int = 50,
    ) -> list[dict]:
        self.auth.require(Permission.FINANCE_READ)
        q = select(Package, Patient).join(Patient, Patient.id == Package.patient_id).where(
            Package.organization_id == self.auth.organization_id
        )
        if patient_id:
            q = q.where(Package.patient_id == patient_id)
        if status:
            q = q.where(Package.status == status)
        rows = (
            await self.db.execute(q.order_by(Package.created_at.desc()).limit(min(limit, 100)))
        ).all()
        return [self._dto(pkg, patient) for pkg, patient in rows]

    async def create_package(self, data: dict) -> dict:
        self.auth.require(Permission.FINANCE_WRITE)
        patient_id = _as_uuid(data["patient_id"])
        patient = await self._owned_patient(patient_id)
        total = int(data["total_sessions"])
        if total < 1 or total > 200:
            raise ValidationAppError("Quantidade de sessões do pacote inválida.")
        price = Decimal(str(data["price"]))
        if price < 0:
            raise ValidationAppError("Preço do pacote inválido.")

        package = Package(
            organization_id=self.auth.organization_id,
            patient_id=patient_id,
            total_sessions=total,
            used_sessions=0,
            price=price,
            valid_until=data.get("valid_until"),
            status="active",
        )
        self.db.add(package)
        await self.db.flush()

        create_charge = data.get("create_charge", True)
        charge_dto = None
        if create_charge and price > 0:
            charge = Charge(
                organization_id=self.auth.organization_id,
                patient_id=patient_id,
                origin="package",
                origin_id=package.id,
                amount=price,
                amount_paid=Decimal("0"),
                status="pending",
                due_date=date.today(),
                description=f"Pacote {total} sessões · {patient.display_name}",
                idempotency_key=f"package:{package.id}",
            )
            self.db.add(charge)
            await self.db.flush()
            charge_dto = {
                "id": str(charge.id),
                "amount": str(charge.amount),
                "status": charge.status,
            }

        await write_audit(
            self.db,
            organization_id=self.auth.organization_id,
            actor_user_id=self.auth.user_id,
            action="package.created",
            resource_type="package",
            resource_id=str(package.id),
            request_id=self.auth.request_id,
            metadata={"total_sessions": total, "price": str(price)},
        )
        await self.db.commit()
        await self.db.refresh(package)
        dto = self._dto(package, patient)
        dto["charge"] = charge_dto
        return dto

    async def active_for_patient(self, patient_id: uuid.UUID) -> Package | None:
        today = date.today()
        rows = (
            await self.db.execute(
                select(Package)
                .where(
                    Package.organization_id == self.auth.organization_id,
                    Package.patient_id == patient_id,
                    Package.status == "active",
                    Package.used_sessions < Package.total_sessions,
                )
                .order_by(Package.created_at.asc())
            )
        ).scalars().all()
        for package in rows:
            if package.valid_until and package.valid_until < today:
                package.status = "expired"
                continue
            return package
        return None

    async def use_for_session(
        self,
        *,
        patient_id: uuid.UUID,
        session_id: uuid.UUID,
    ) -> dict | None:
        """Debit one session from the oldest active package. Returns dto or None."""
        package = await self.active_for_patient(patient_id)
        if package is None:
            return None

        existing = await self.db.scalar(
            select(PackageUsage).where(
                PackageUsage.organization_id == self.auth.organization_id,
                PackageUsage.session_id == session_id,
            )
        )
        if existing:
            patient = await self.db.get(Patient, patient_id)
            return self._dto(package, patient)

        usage = PackageUsage(
            organization_id=self.auth.organization_id,
            package_id=package.id,
            session_id=session_id,
            used_at=datetime.now(UTC),
        )
        package.used_sessions += 1
        if package.used_sessions >= package.total_sessions:
            package.status = "exhausted"
        self.db.add(usage)
        await self.db.flush()
        patient = await self.db.get(Patient, patient_id)
        return self._dto(package, patient)

    async def cancel_package(self, package_id: uuid.UUID) -> dict:
        self.auth.require(Permission.FINANCE_WRITE)
        package = await self.db.get(Package, package_id)
        if package is None or package.organization_id != self.auth.organization_id:
            raise NotFoundError("Pacote não encontrado.")
        if package.status == "cancelled":
            raise ConflictError("Pacote já cancelado.")
        package.status = "cancelled"
        patient = await self.db.get(Patient, package.patient_id)
        await write_audit(
            self.db,
            organization_id=self.auth.organization_id,
            actor_user_id=self.auth.user_id,
            action="package.cancelled",
            resource_type="package",
            resource_id=str(package.id),
            request_id=self.auth.request_id,
        )
        await self.db.commit()
        await self.db.refresh(package)
        return self._dto(package, patient)

    async def _owned_patient(self, patient_id: uuid.UUID) -> Patient:
        patient = await self.db.get(Patient, patient_id)
        if (
            patient is None
            or patient.organization_id != self.auth.organization_id
            or patient.deleted_at is not None
        ):
            raise NotFoundError("Paciente não encontrado.")
        return patient

    def _dto(self, pkg: Package, patient: Patient | None) -> dict:
        remaining = max(pkg.total_sessions - pkg.used_sessions, 0)
        return {
            "id": str(pkg.id),
            "patient_id": str(pkg.patient_id),
            "patient_display_name": patient.display_name if patient else None,
            "total_sessions": pkg.total_sessions,
            "used_sessions": pkg.used_sessions,
            "remaining_sessions": remaining,
            "price": str(pkg.price),
            "valid_until": pkg.valid_until.isoformat() if pkg.valid_until else None,
            "status": pkg.status,
            "created_at": pkg.created_at.isoformat() if pkg.created_at else None,
        }


def _as_uuid(value: uuid.UUID | str) -> uuid.UUID:
    return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))

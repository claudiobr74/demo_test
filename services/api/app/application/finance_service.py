"""Finance application service — clinic-friendly, not accounting software."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext
from app.application.audit import write_audit
from app.core.errors import ConflictError, NotFoundError, ValidationAppError
from app.core.permissions import Permission
from app.infrastructure.db.models_clinical import Patient
from app.infrastructure.db.models_ops import Charge, Expense, Payment

VALID_CHARGE_STATUS = {"pending", "partial", "paid", "overdue", "cancelled", "written_off"}
VALID_EXPENSE_STATUS = {"pending", "paid", "overdue", "cancelled"}
VALID_METHODS = {"pix", "cash", "card", "transfer", "other"}


class FinanceService:
    def __init__(self, db: AsyncSession, auth: AuthContext) -> None:
        self.db = db
        self.auth = auth

    async def summary(self) -> dict:
        self.auth.require(Permission.FINANCE_READ)
        org = self.auth.organization_id
        pending = await self.db.scalar(
            select(func.coalesce(func.sum(Charge.amount - Charge.amount_paid), 0)).where(
                Charge.organization_id == org,
                Charge.status.in_(["pending", "partial", "overdue"]),
            )
        )
        received = await self.db.scalar(
            select(func.coalesce(func.sum(Payment.amount), 0)).where(
                Payment.organization_id == org,
            )
        )
        overdue = await self.db.scalar(
            select(func.count()).select_from(Charge).where(
                Charge.organization_id == org,
                Charge.status == "overdue",
            )
        )
        open_charges = await self.db.scalar(
            select(func.count()).select_from(Charge).where(
                Charge.organization_id == org,
                Charge.status.in_(["pending", "partial", "overdue"]),
            )
        )
        expenses_month = await self.db.scalar(
            select(func.coalesce(func.sum(Expense.amount), 0)).where(
                Expense.organization_id == org,
                Expense.status != "cancelled",
                func.extract("month", Expense.due_date) == date.today().month,
                func.extract("year", Expense.due_date) == date.today().year,
            )
        )
        expenses_paid_month = await self.db.scalar(
            select(func.coalesce(func.sum(Expense.amount), 0)).where(
                Expense.organization_id == org,
                Expense.status == "paid",
                func.extract("month", Expense.due_date) == date.today().month,
                func.extract("year", Expense.due_date) == date.today().year,
            )
        )
        return {
            "pending_amount": str(pending or 0),
            "received_amount": str(received or 0),
            "overdue_count": overdue or 0,
            "open_charges": open_charges or 0,
            "expenses_month_amount": str(expenses_month or 0),
            "expenses_paid_month_amount": str(expenses_paid_month or 0),
            "net_month_estimate": str(
                Decimal(str(received or 0)) - Decimal(str(expenses_paid_month or 0))
            ),
        }

    async def list_charges(
        self,
        *,
        status: str | None = None,
        patient_id: uuid.UUID | None = None,
        limit: int = 50,
    ) -> list[dict]:
        self.auth.require(Permission.FINANCE_READ)
        q = select(Charge, Patient).join(Patient, Patient.id == Charge.patient_id).where(
            Charge.organization_id == self.auth.organization_id
        )
        if status:
            q = q.where(Charge.status == status)
        if patient_id:
            q = q.where(Charge.patient_id == patient_id)
        rows = (
            await self.db.execute(q.order_by(Charge.created_at.desc()).limit(min(limit, 100)))
        ).all()
        return [self._charge_dto(c, p) for c, p in rows]

    async def create_charge(self, data: dict) -> dict:
        self.auth.require(Permission.FINANCE_WRITE)
        patient_id = _as_uuid(data["patient_id"])
        patient = await self._owned_patient(patient_id)
        amount = Decimal(str(data["amount"]))
        if amount <= 0:
            raise ValidationAppError("Valor da cobrança deve ser positivo.")

        idem = data.get("idempotency_key")
        if idem:
            existing = await self.db.scalar(
                select(Charge).where(
                    Charge.organization_id == self.auth.organization_id,
                    Charge.idempotency_key == idem,
                )
            )
            if existing:
                return self._charge_dto(existing, patient)

        charge = Charge(
            organization_id=self.auth.organization_id,
            patient_id=patient_id,
            origin=data.get("origin") or "adjustment",
            origin_id=_as_uuid(data["origin_id"]) if data.get("origin_id") else None,
            amount=amount,
            amount_paid=Decimal("0"),
            status="pending",
            due_date=data.get("due_date") or date.today(),
            description=data.get("description") or "Cobrança",
            idempotency_key=idem,
        )
        self.db.add(charge)
        await self.db.flush()
        await write_audit(
            self.db,
            organization_id=self.auth.organization_id,
            actor_user_id=self.auth.user_id,
            action="charge.created",
            resource_type="charge",
            resource_id=str(charge.id),
            request_id=self.auth.request_id,
            metadata={"amount": str(amount), "origin": charge.origin},
        )
        await self.db.commit()
        await self.db.refresh(charge)
        return self._charge_dto(charge, patient)

    async def ensure_session_charge(
        self,
        *,
        patient_id: uuid.UUID,
        session_id: uuid.UUID,
        amount: Decimal | None,
        description: str,
    ) -> Charge | None:
        """Called after session close — creates charge if fee exists (idempotent)."""
        if amount is None or amount <= 0:
            return None
        idem = f"session:{session_id}"
        existing = await self.db.scalar(
            select(Charge).where(
                Charge.organization_id == self.auth.organization_id,
                Charge.idempotency_key == idem,
            )
        )
        if existing:
            return existing
        charge = Charge(
            organization_id=self.auth.organization_id,
            patient_id=patient_id,
            origin="session",
            origin_id=session_id,
            amount=amount,
            amount_paid=Decimal("0"),
            status="pending",
            due_date=date.today(),
            description=description,
            idempotency_key=idem,
        )
        self.db.add(charge)
        return charge

    async def register_payment(self, data: dict) -> dict:
        self.auth.require(Permission.FINANCE_WRITE)
        charge_id = _as_uuid(data["charge_id"])
        charge = await self.db.get(Charge, charge_id)
        if charge is None or charge.organization_id != self.auth.organization_id:
            raise NotFoundError("Cobrança não encontrada.")

        idem = data.get("idempotency_key")
        if idem:
            existing = await self.db.scalar(
                select(Payment).where(
                    Payment.organization_id == self.auth.organization_id,
                    Payment.idempotency_key == idem,
                )
            )
            if existing:
                patient = await self.db.get(Patient, charge.patient_id)
                return {"payment": self._payment_dto(existing), "charge": self._charge_dto(charge, patient)}

        method = data.get("method") or "pix"
        if method not in VALID_METHODS:
            raise ValidationAppError("Meio de pagamento inválido.")
        amount = Decimal(str(data["amount"]))
        if amount <= 0:
            raise ValidationAppError("Valor do pagamento deve ser positivo.")
        discount = Decimal(str(data.get("discount") or 0))
        surcharge = Decimal(str(data.get("surcharge") or 0))
        remaining = charge.amount - charge.amount_paid
        if amount > remaining + Decimal("0.01"):
            raise ConflictError("Pagamento maior que o saldo da cobrança.")

        payment = Payment(
            organization_id=self.auth.organization_id,
            charge_id=charge.id,
            patient_id=charge.patient_id,
            amount=amount,
            method=method,
            paid_at=datetime.now(UTC),
            discount=discount,
            surcharge=surcharge,
            notes=data.get("notes"),
            idempotency_key=idem,
            recorded_by_user_id=self.auth.user_id,
        )
        charge.amount_paid = charge.amount_paid + amount
        if charge.amount_paid >= charge.amount:
            charge.status = "paid"
        elif charge.amount_paid > 0:
            charge.status = "partial"

        self.db.add(payment)
        await self.db.flush()
        await write_audit(
            self.db,
            organization_id=self.auth.organization_id,
            actor_user_id=self.auth.user_id,
            action="payment.received",
            resource_type="payment",
            resource_id=str(payment.id),
            request_id=self.auth.request_id,
            metadata={"amount": str(amount), "method": method},
        )
        await self.db.commit()
        await self.db.refresh(charge)
        patient = await self.db.get(Patient, charge.patient_id)
        return {"payment": self._payment_dto(payment), "charge": self._charge_dto(charge, patient)}

    async def _owned_patient(self, patient_id: uuid.UUID) -> Patient:
        patient = await self.db.get(Patient, patient_id)
        if (
            patient is None
            or patient.organization_id != self.auth.organization_id
            or patient.deleted_at is not None
        ):
            raise NotFoundError("Paciente não encontrado.")
        return patient

    def _charge_dto(self, c: Charge, p: Patient | None) -> dict:
        balance = c.amount - c.amount_paid
        return {
            "id": str(c.id),
            "patient_id": str(c.patient_id),
            "patient_display_name": p.display_name if p else None,
            "origin": c.origin,
            "origin_id": str(c.origin_id) if c.origin_id else None,
            "amount": str(c.amount),
            "amount_paid": str(c.amount_paid),
            "balance": str(balance),
            "status": c.status,
            "due_date": c.due_date.isoformat() if c.due_date else None,
            "description": c.description,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }

    def _payment_dto(self, p: Payment) -> dict:
        return {
            "id": str(p.id),
            "charge_id": str(p.charge_id),
            "amount": str(p.amount),
            "method": p.method,
            "paid_at": p.paid_at.isoformat(),
            "discount": str(p.discount),
            "surcharge": str(p.surcharge),
            "notes": p.notes,
        }

    async def list_expenses(self, *, status: str | None = None, limit: int = 50) -> list[dict]:
        self.auth.require(Permission.FINANCE_READ)
        q = select(Expense).where(Expense.organization_id == self.auth.organization_id)
        if status:
            q = q.where(Expense.status == status)
        rows = (
            await self.db.execute(q.order_by(Expense.created_at.desc()).limit(min(limit, 100)))
        ).scalars().all()
        return [self._expense_dto(e) for e in rows]

    async def create_expense(self, data: dict) -> dict:
        self.auth.require(Permission.FINANCE_WRITE)
        amount = Decimal(str(data["amount"]))
        if amount <= 0:
            raise ValidationAppError("Valor da despesa deve ser positivo.")
        status = data.get("status") or "pending"
        if status not in VALID_EXPENSE_STATUS:
            raise ValidationAppError("Status de despesa inválido.")
        expense = Expense(
            organization_id=self.auth.organization_id,
            vendor=data.get("vendor"),
            category=data.get("category") or "Outros",
            amount=amount,
            due_date=data.get("due_date") or date.today(),
            paid_at=datetime.now(UTC) if status == "paid" else None,
            status=status,
            recurrence_rule=data.get("recurrence_rule"),
            notes=data.get("notes"),
        )
        self.db.add(expense)
        await self.db.flush()
        await write_audit(
            self.db,
            organization_id=self.auth.organization_id,
            actor_user_id=self.auth.user_id,
            action="expense.created",
            resource_type="expense",
            resource_id=str(expense.id),
            request_id=self.auth.request_id,
            metadata={"amount": str(amount), "category": expense.category},
        )
        await self.db.commit()
        await self.db.refresh(expense)
        return self._expense_dto(expense)

    async def update_expense(self, expense_id: uuid.UUID, data: dict) -> dict:
        self.auth.require(Permission.FINANCE_WRITE)
        expense = await self.db.get(Expense, expense_id)
        if expense is None or expense.organization_id != self.auth.organization_id:
            raise NotFoundError("Despesa não encontrada.")

        if data.get("category"):
            expense.category = data["category"]
        if "vendor" in data:
            expense.vendor = data.get("vendor")
        if data.get("amount") is not None:
            amount = Decimal(str(data["amount"]))
            if amount <= 0:
                raise ValidationAppError("Valor da despesa deve ser positivo.")
            expense.amount = amount
        if "due_date" in data:
            expense.due_date = data.get("due_date")
        if "notes" in data:
            expense.notes = data.get("notes")

        if data.get("mark_paid") is True:
            expense.status = "paid"
            expense.paid_at = datetime.now(UTC)
        elif data.get("status"):
            status = data["status"]
            if status not in VALID_EXPENSE_STATUS:
                raise ValidationAppError("Status de despesa inválido.")
            expense.status = status
            if status == "paid" and expense.paid_at is None:
                expense.paid_at = datetime.now(UTC)
            if status in {"pending", "cancelled", "overdue"}:
                expense.paid_at = None

        await write_audit(
            self.db,
            organization_id=self.auth.organization_id,
            actor_user_id=self.auth.user_id,
            action="expense.updated",
            resource_type="expense",
            resource_id=str(expense.id),
            request_id=self.auth.request_id,
            metadata={"status": expense.status},
        )
        await self.db.commit()
        await self.db.refresh(expense)
        return self._expense_dto(expense)

    def _expense_dto(self, e: Expense) -> dict:
        return {
            "id": str(e.id),
            "vendor": e.vendor,
            "category": e.category,
            "amount": str(e.amount),
            "due_date": e.due_date.isoformat() if e.due_date else None,
            "paid_at": e.paid_at.isoformat() if e.paid_at else None,
            "status": e.status,
            "recurrence_rule": e.recurrence_rule,
            "notes": e.notes,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }


def _as_uuid(value: uuid.UUID | str) -> uuid.UUID:
    return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))

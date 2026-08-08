from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, get_current_auth
from app.api.v1.schemas import (
    ChargeCreateRequest,
    ExpenseCreateRequest,
    ExpenseUpdateRequest,
    PackageCreateRequest,
    PaymentCreateRequest,
)
from app.application.finance_service import FinanceService
from app.application.package_service import PackageService
from app.infrastructure.db.session import get_db

router = APIRouter()


@router.get("/summary")
async def finance_summary(
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await FinanceService(db, auth).summary()


@router.get("/charges")
async def list_charges(
    status: str | None = None,
    patient_id: UUID | None = None,
    limit: int = Query(50, ge=1, le=100),
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    items = await FinanceService(db, auth).list_charges(
        status=status, patient_id=patient_id, limit=limit
    )
    return {"items": items}


@router.post("/charges", status_code=201)
async def create_charge(
    body: ChargeCreateRequest,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await FinanceService(db, auth).create_charge(body.model_dump(exclude_unset=True))


@router.post("/payments", status_code=201)
async def register_payment(
    body: PaymentCreateRequest,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await FinanceService(db, auth).register_payment(body.model_dump(exclude_unset=True))


@router.get("/expenses")
async def list_expenses(
    status: str | None = None,
    limit: int = Query(50, ge=1, le=100),
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    items = await FinanceService(db, auth).list_expenses(status=status, limit=limit)
    return {"items": items}


@router.post("/expenses", status_code=201)
async def create_expense(
    body: ExpenseCreateRequest,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await FinanceService(db, auth).create_expense(body.model_dump(exclude_unset=True))


@router.patch("/expenses/{expense_id}")
async def update_expense(
    expense_id: UUID,
    body: ExpenseUpdateRequest,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await FinanceService(db, auth).update_expense(
        expense_id, body.model_dump(exclude_unset=True)
    )


@router.get("/packages")
async def list_packages(
    patient_id: UUID | None = None,
    status: str | None = None,
    limit: int = Query(50, ge=1, le=100),
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    items = await PackageService(db, auth).list_packages(
        patient_id=patient_id, status=status, limit=limit
    )
    return {"items": items}


@router.post("/packages", status_code=201)
async def create_package(
    body: PackageCreateRequest,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await PackageService(db, auth).create_package(body.model_dump(exclude_unset=True))


@router.post("/packages/{package_id}/cancel")
async def cancel_package(
    package_id: UUID,
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await PackageService(db, auth).cancel_package(package_id)

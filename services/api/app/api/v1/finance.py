from datetime import date
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, get_current_auth
from app.api.v1.schemas import ChargeCreateRequest, PaymentCreateRequest
from app.application.finance_service import FinanceService
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

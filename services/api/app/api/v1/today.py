from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, get_current_auth
from app.application.appointment_service import TodayService
from app.infrastructure.db.session import get_db

router = APIRouter()


@router.get("")
async def meu_dia(
    day: date | None = Query(None),
    auth: AuthContext = Depends(get_current_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await TodayService(db, auth).get_board(day)
